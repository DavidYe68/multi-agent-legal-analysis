import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";

import { issueStatusLabel } from "../components/courtroom/issueMeta";
import {
  positionLabel,
  reviewerLabel,
  REVIEWER_ORDER,
} from "../components/deliberation/reviewerMeta";
import { getCaseOutput, getPairCases } from "../services/caseService";
import type { CaseInput, CaseOutput, Fact } from "../types";

/**
 * ComparePage · A/B 对照（/compare/:pairId）
 *
 * pairId 形如 "criminal_001"，对应同一最小对照组的 A、B 两案
 * （criminal_001a / criminal_001b）。整页严格左右并排：A 在左、B 在右。
 *
 * 自上而下：
 *   1. 工具栏——返回案件列表 + 配对标题 + 两案各自的「查看庭审」入口。
 *   2. 双栏题首——各自的变体徽标、案件编号、标题。
 *   3. 不变事实（全宽）——两案 fact_id 相同且 content 相同的事实，只展示一次。
 *   4. 改变变量（全宽，--bg-surface-alt，视觉重点）——content 不同或仅一侧存在的事实，
 *      左右并排 diff，变化文字用下划线 + --relation-disagree 高亮。
 *   5. 推理变化——把 A/B 的争点状态、公诉强度、辩护替代解释、Judge 未决、Reviewer
 *      立场、多数意见左右对照；争点 open→closed、Reviewer 立场改变用箭头高亮。
 *
 * 数据来源：getPairCases(pairId) 取两案输入，getCaseOutput 取两案产物。
 * 某案无产物时，其推理列显示「该案例尚未运行」。
 */

/* ===========================================================================
 * 小工具：事实争议状态标签（与卷宗栏 FactList 同义，此处局部内联，不改既有组件）
 * ======================================================================== */

const FACT_STATUS: Record<string, { label: string; color: string }> = {
  undisputed: { label: "无争议", color: "var(--text-caption)" },
  disputed: { label: "有争议", color: "var(--role-prosecutor)" },
  alleged: { label: "一方主张", color: "var(--relation-partial)" },
  one_party_claim: { label: "一方主张", color: "var(--relation-partial)" },
  unknown: { label: "待明确", color: "var(--status-pending)" },
  unclear: { label: "待明确", color: "var(--status-pending)" },
};

function FactStatusTag({ status }: { status: string }) {
  const meta = FACT_STATUS[status] ?? { label: status, color: "var(--text-caption)" };
  return (
    <span
      className="inline-flex items-center gap-1 font-label text-xs"
      style={{ color: meta.color }}
    >
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: meta.color }}
      />
      {meta.label}
    </span>
  );
}

/* ===========================================================================
 * 对照数据模型
 * ======================================================================== */

interface PairData {
  a: CaseInput;
  b: CaseInput;
  outA: CaseOutput | null;
  outB: CaseOutput | null;
}

interface FactDiff {
  factId: string;
  a: Fact | null;
  b: Fact | null;
}

/** 把事实数组按 fact_id 建索引。 */
function indexFacts(facts: Fact[]): Record<string, Fact> {
  const map: Record<string, Fact> = {};
  for (const f of facts) map[f.fact_id] = f;
  return map;
}

/** 两案事实的并集（按 A 顺序，再补 B 独有），保留稳定渲染顺序。 */
function buildFactDiffs(a: CaseInput, b: CaseInput): FactDiff[] {
  const ai = indexFacts(a.facts);
  const bi = indexFacts(b.facts);
  const order: string[] = [];
  const seen = new Set<string>();
  for (const f of a.facts) {
    order.push(f.fact_id);
    seen.add(f.fact_id);
  }
  for (const f of b.facts) {
    if (!seen.has(f.fact_id)) order.push(f.fact_id);
  }
  return order.map((id) => ({ factId: id, a: ai[id] ?? null, b: bi[id] ?? null }));
}

/** 一条事实是否「不变」：两侧都存在且正文完全一致。 */
function isUnchanged(d: FactDiff): boolean {
  return d.a !== null && d.b !== null && d.a.content === d.b.content;
}

/** 取某评议者的最终立场：优先第二轮 position_after，回退第一轮 position；无则 null。 */
function finalPosition(out: CaseOutput | null, reviewerId: string): string | null {
  if (!out) return null;
  const r2 = out.round2_outputs?.find((r) => r.agent_id === reviewerId);
  if (r2) return r2.position_after;
  const r1 = out.reviewer_outputs?.find((r) => r.agent_id === reviewerId);
  return r1 ? r1.position : null;
}

/* ===========================================================================
 * 通用排版小件
 * ======================================================================== */

/** 全宽 section：上方 1px 分隔线 + 衬线小标题 + 可选副标题 + 内容。 */
function Section({
  title,
  hint,
  emphasized = false,
  children,
}: {
  title: string;
  hint?: string;
  emphasized?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      style={{
        marginTop: "var(--space-8)",
        paddingTop: "var(--space-8)",
        borderTop: "1px solid var(--border-default)",
      }}
    >
      <div className="mb-3 flex items-baseline gap-3">
        <h2 className="font-display text-lg text-ink">{title}</h2>
        {emphasized && (
          <span
            className="rounded-sm px-1.5 py-0.5 font-label text-xs"
            style={{
              color: "var(--relation-disagree)",
              border: "1px solid var(--relation-disagree)",
            }}
          >
            页面重点
          </span>
        )}
        {hint && <span className="font-label text-xs text-ink-caption">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

/** 空状态灰字。 */
function Empty({ note = "—" }: { note?: string }) {
  return <p className="font-body text-sm text-ink-caption">{note}</p>;
}

/** 「该案例尚未运行」占位。 */
function NotRun() {
  return (
    <p className="font-body text-sm text-ink-caption">该案例尚未运行，暂无该环节产物。</p>
  );
}

/** 变化文字：下划线 + 暗红。 */
function Changed({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        color: "var(--relation-disagree)",
        textDecoration: "underline",
        textDecorationColor: "var(--relation-disagree)",
        textUnderlineOffset: "3px",
      }}
    >
      {children}
    </span>
  );
}

/** A→B 变化箭头。 */
function Arrow() {
  return (
    <span
      aria-hidden="true"
      className="shrink-0 px-1 font-label"
      style={{ color: "var(--relation-disagree)" }}
    >
      →
    </span>
  );
}

/* ===========================================================================
 * 题首：变体徽标 + 编号 + 标题
 * ======================================================================== */

function SideHeader({ variant, input }: { variant: "A" | "B"; input: CaseInput }) {
  return (
    <div className="bg-surface p-6">
      <div className="flex items-center gap-2">
        <span
          className="inline-flex h-6 w-6 items-center justify-center rounded-sm font-display text-sm"
          style={{ backgroundColor: "var(--bg-shell)", color: "var(--text-on-dark)" }}
        >
          {variant}
        </span>
        <span className="font-mono text-xs text-ink-caption">{input.case_id}</span>
      </div>
      <h3 className="mt-2 font-display text-lg text-ink">{input.title}</h3>
      <p className="mt-1 font-body text-sm text-ink-secondary">
        {input.domain.case_category}
      </p>
    </div>
  );
}

/* ===========================================================================
 * 改变变量：单条事实 diff（左 A / 右 B）
 *
 * 只高亮「变化的文字」：先剥去两侧逐字符相同的公共前缀 / 后缀，仅把不同的中段
 * 用下划线 + 暗红高亮，公共部分维持正文墨色，使差异点更突出。
 * 内容完全不同（无公共前后缀）时整条高亮；某侧无对应事实时整条按变化处理。
 * ======================================================================== */

/** 渲染单侧正文：other 为对侧正文（null 表示对侧无此事实，整条高亮）。 */
function renderFactContent(self: string, other: string | null): ReactNode {
  if (other === null) return <Changed>{self}</Changed>;

  const min = Math.min(self.length, other.length);
  let p = 0;
  while (p < min && self[p] === other[p]) p++;
  let s = 0;
  while (s < min - p && self[self.length - 1 - s] === other[other.length - 1 - s]) s++;

  const prefix = self.slice(0, p);
  const mid = self.slice(p, self.length - s);
  const suffix = self.slice(self.length - s);

  if (mid.length === 0) {
    // 两侧正文一致（理论上不进入「改变变量」，防御性处理）。
    return <span className="text-ink">{self}</span>;
  }
  return (
    <>
      {prefix && <span className="text-ink">{prefix}</span>}
      <Changed>{mid}</Changed>
      {suffix && <span className="text-ink">{suffix}</span>}
    </>
  );
}

function FactCell({ fact, other }: { fact: Fact | null; other: Fact | null }) {
  if (!fact) {
    return (
      <div className="p-4">
        <Empty note="（该案无对应事实）" />
      </div>
    );
  }
  return (
    <div className="p-4">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="font-mono text-xs text-ink-caption">{fact.fact_id}</span>
        <FactStatusTag status={fact.status} />
      </div>
      <p className="font-body text-base">
        {renderFactContent(fact.content, other ? other.content : null)}
      </p>
    </div>
  );
}

function ChangedFactRow({ diff }: { diff: FactDiff }) {
  return (
    <div
      className="grid grid-cols-2 gap-px"
      style={{ backgroundColor: "var(--border-default)" }}
    >
      <div style={{ backgroundColor: "var(--bg-surface-alt)" }}>
        <FactCell fact={diff.a} other={diff.b} />
      </div>
      <div style={{ backgroundColor: "var(--bg-surface-alt)" }}>
        <FactCell fact={diff.b} other={diff.a} />
      </div>
    </div>
  );
}

/* ===========================================================================
 * 推理变化：争点状态对照
 *
 * 重要：争点由 issue_spotter 对每案独立生成，issue_id 不具备跨案语义
 * （A 的 I2 与 B 的 I2 可能是不同争点）。事实是按 fact_id 对齐构造的最小对照组，
 * 争点却不是——因此这里按「争点文本」匹配：文本一致才视为同一争点、画 A→B 箭头；
 * 其余各自归入「A 独有 / B 独有」，避免把不同争点错配成一行。
 * ======================================================================== */

interface SideIssue {
  id: string;
  text: string;
  status: string;
}

interface SharedIssue {
  /** 两侧各自的 issue_id（稳定唯一），用于组合成稳定 React key。 */
  idA: string;
  idB: string;
  text: string;
  statusA: string;
  statusB: string;
}

interface IssueComparison {
  shared: SharedIssue[];
  aOnly: SideIssue[];
  bOnly: SideIssue[];
}

/** 把某案的法官争点回应表展开成 {id, 文本, 状态} 列表。 */
function sideIssues(out: CaseOutput | null): SideIssue[] {
  const rows = out?.judge_summary?.issue_response_table ?? [];
  const textById: Record<string, string> = {};
  for (const i of out?.issues?.issues ?? []) textById[i.issue_id] = i.issue_text;
  return rows.map((r) => ({
    id: r.issue_id,
    text: textById[r.issue_id] ?? r.issue_id,
    status: r.current_status,
  }));
}

function buildIssueComparison(
  outA: CaseOutput | null,
  outB: CaseOutput | null,
): IssueComparison {
  const aList = sideIssues(outA);
  const bList = sideIssues(outB);
  const norm = (s: string) => s.trim();
  // 严格一对一匹配：按索引标记已用的 B 项，
  // 避免同案内文本重复时「Map 塌缩成一条」或「多个 A 命中同一 B 产生重复行」。
  const bUsed = new Array(bList.length).fill(false);

  const shared: SharedIssue[] = [];
  const aOnly: SideIssue[] = [];
  for (const a of aList) {
    const j = bList.findIndex((b, idx) => !bUsed[idx] && norm(b.text) === norm(a.text));
    if (j >= 0) {
      bUsed[j] = true;
      shared.push({
        idA: a.id,
        idB: bList[j].id,
        text: a.text,
        statusA: a.status,
        statusB: bList[j].status,
      });
    } else {
      aOnly.push(a);
    }
  }
  const bOnly = bList.filter((_, idx) => !bUsed[idx]);
  return { shared, aOnly, bOnly };
}

/** 争点状态徽标（黄铜描边，仅文字区分，不用颜色编码状态）。 */
function StatusPill({ status }: { status: string | null }) {
  if (!status) return <span className="font-body text-sm text-ink-caption">—</span>;
  return (
    <span
      className="inline-flex items-center rounded-sm border px-1.5 font-label text-xs"
      style={{ borderColor: "var(--border-emphasis)", color: "var(--role-judge)" }}
    >
      {issueStatusLabel(status)}
    </span>
  );
}

/** 某一侧独有争点的小列表。 */
function SideIssueList({ items }: { items: SideIssue[] }) {
  if (items.length === 0) return <Empty note="无" />;
  return (
    <ul className="flex flex-col gap-2">
      {items.map((it) => (
        <li key={it.id} className="flex items-start justify-between gap-2">
          <span className="min-w-0 font-body text-sm text-ink-secondary">{it.text}</span>
          <span className="shrink-0">
            <StatusPill status={it.status} />
          </span>
        </li>
      ))}
    </ul>
  );
}

function IssueStatusCompare({ comparison }: { comparison: IssueComparison }) {
  const { shared, aOnly, bOnly } = comparison;
  if (shared.length === 0 && aOnly.length === 0 && bOnly.length === 0) {
    return <Empty note="两案均无法官争点回应表。" />;
  }
  return (
    <div className="flex flex-col gap-4">
      {/* 共有争点：文本一致，画 A→B 箭头，状态不同则高亮 */}
      {shared.length > 0 && (
        <div
          className="overflow-hidden rounded border"
          style={{ borderColor: "var(--border-default)" }}
        >
          {shared.map((d, i) => {
            const changed = d.statusA !== d.statusB;
            return (
              <div
                key={`${d.idA}__${d.idB}`}
                className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-2.5"
                style={{
                  borderTop: i === 0 ? undefined : "1px solid var(--border-default)",
                  backgroundColor: changed
                    ? "color-mix(in srgb, var(--relation-disagree) 7%, transparent)"
                    : undefined,
                }}
              >
                <span className="min-w-0 font-body text-sm text-ink">{d.text}</span>
                <div className="flex shrink-0 items-center gap-1">
                  <StatusPill status={d.statusA} />
                  {changed ? (
                    <Arrow />
                  ) : (
                    <span aria-hidden="true" className="px-1 text-ink-caption">
                      ·
                    </span>
                  )}
                  <StatusPill status={d.statusB} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 各自独有的争点（issue_id 跨案不可比，故分列展示，不画箭头） */}
      {(aOnly.length > 0 || bOnly.length > 0) && (
        <div>
          <p className="mb-2 font-label text-xs text-ink-caption">
            以下争点仅在单侧出现（两案争点集合本就不同，不作跨案状态对比）
          </p>
          <div
            className="grid grid-cols-2 gap-px overflow-hidden rounded border"
            style={{
              backgroundColor: "var(--border-default)",
              borderColor: "var(--border-default)",
            }}
          >
            <div className="bg-surface p-4">
              <h4 className="mb-2 font-label text-xs text-ink-secondary">A 独有争点</h4>
              <SideIssueList items={aOnly} />
            </div>
            <div className="bg-surface p-4">
              <h4 className="mb-2 font-label text-xs text-ink-secondary">B 独有争点</h4>
              <SideIssueList items={bOnly} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===========================================================================
 * 推理变化：Reviewer 立场对照（四行，A → B，立场不同则高亮）
 * ======================================================================== */

function PositionPill({ position }: { position: string | null }) {
  if (!position) return <span className="font-body text-sm text-ink-caption">未运行</span>;
  return (
    <span className="font-label text-sm text-ink">{positionLabel(position)}</span>
  );
}

function ReviewerCompare({
  outA,
  outB,
}: {
  outA: CaseOutput | null;
  outB: CaseOutput | null;
}) {
  return (
    <div
      className="overflow-hidden rounded border"
      style={{ borderColor: "var(--border-default)" }}
    >
      {REVIEWER_ORDER.map((rid, i) => {
        const pa = finalPosition(outA, rid);
        const pb = finalPosition(outB, rid);
        const changed = pa !== null && pb !== null && pa !== pb;
        return (
          <div
            key={rid}
            className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-2.5"
            style={{
              borderTop: i === 0 ? undefined : "1px solid var(--border-default)",
              backgroundColor: changed
                ? "color-mix(in srgb, var(--relation-disagree) 7%, transparent)"
                : undefined,
            }}
          >
            <span className="font-body text-sm text-ink-secondary">
              {reviewerLabel(rid)}
            </span>
            <div className="flex shrink-0 items-center gap-1">
              <PositionPill position={pa} />
              {changed ? (
                <Arrow />
              ) : (
                <span aria-hidden="true" className="px-1 text-ink-caption">
                  ·
                </span>
              )}
              <PositionPill position={pb} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ===========================================================================
 * 推理变化：左右两列的同类内容（公诉强度 / 辩护替代解释 / Judge 未决 / 多数意见）
 * ======================================================================== */

function ColCard({ children }: { children: ReactNode }) {
  return <div className="bg-surface p-4">{children}</div>;
}

/** 公诉强度：信心百分比 + 指控摘要。 */
function ProsecutionStrength({ out }: { out: CaseOutput | null }) {
  if (!out?.prosecutor_analysis) return <NotRun />;
  const p = out.prosecutor_analysis;
  const pct = Math.round((p.confidence ?? 0) * 100);
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span
          className="font-display tabular-nums"
          style={{ fontSize: "var(--text-2xl)", color: "var(--role-prosecutor)" }}
        >
          {pct}%
        </span>
        <span className="font-label text-xs text-ink-caption">公诉信心</span>
      </div>
      <div
        className="mt-2 h-1.5 w-full overflow-hidden rounded-sm"
        style={{ backgroundColor: "var(--bg-surface-alt)" }}
      >
        <div
          className="h-full"
          style={{ width: `${pct}%`, backgroundColor: "var(--role-prosecutor)" }}
        />
      </div>
      {p.accusation && (
        <p className="mt-3 font-body text-sm text-ink-secondary">{p.accusation}</p>
      )}
    </div>
  );
}

/** 项目符号列表。 */
function Bullets({ items, dot }: { items: string[]; dot: string }) {
  if (items.length === 0) return <Empty />;
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2">
          <span
            aria-hidden="true"
            className="mt-[9px] h-[5px] w-[5px] shrink-0 rounded-full"
            style={{ backgroundColor: dot }}
          />
          <span className="font-body text-sm text-ink-secondary">{it}</span>
        </li>
      ))}
    </ul>
  );
}

/** 双栏对照：标题 + 左右两块（缺产物显示「该案例尚未运行」）。 */
function CompareBlock({
  title,
  renderA,
  renderB,
}: {
  title: string;
  renderA: ReactNode;
  renderB: ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-2 font-label text-sm text-ink-secondary">{title}</h3>
      <div
        className="grid grid-cols-2 gap-px overflow-hidden rounded border"
        style={{
          backgroundColor: "var(--border-default)",
          borderColor: "var(--border-default)",
        }}
      >
        <ColCard>{renderA}</ColCard>
        <ColCard>{renderB}</ColCard>
      </div>
    </div>
  );
}

/* ===========================================================================
 * 工具栏入口
 * ======================================================================== */

function CourtroomLink({
  variant,
  out,
  caseId,
}: {
  variant: "A" | "B";
  out: CaseOutput | null;
  caseId: string;
}) {
  if (!out) {
    return (
      <span className="inline-flex cursor-not-allowed items-center rounded-sm border border-border bg-surface-alt px-3 py-1 font-label text-sm text-ink-caption">
        {variant} · 未运行
      </span>
    );
  }
  return (
    <Link
      to={`/case/${caseId}`}
      className="inline-flex items-center rounded-sm border border-border bg-surface px-3 py-1 font-label text-sm text-ink-secondary transition-colors hover:bg-surface-alt"
    >
      查看 {variant} 庭审 →
    </Link>
  );
}

/* ===========================================================================
 * 页面
 * ======================================================================== */

export default function ComparePage() {
  const { pairId } = useParams<{ pairId: string }>();

  const [data, setData] = useState<PairData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!pairId) return;
    let alive = true;
    setLoading(true);
    setData(null);
    setError(null);
    getPairCases(pairId)
      .then(async ([a, b]) => {
        const [outA, outB] = await Promise.all([
          getCaseOutput(a.case_id),
          getCaseOutput(b.case_id),
        ]);
        if (alive) setData({ a, b, outA, outB });
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [pairId]);

  const factDiffs = useMemo(
    () => (data ? buildFactDiffs(data.a, data.b) : []),
    [data],
  );
  const unchanged = useMemo(() => factDiffs.filter(isUnchanged), [factDiffs]);
  const changed = useMemo(() => factDiffs.filter((d) => !isUnchanged(d)), [factDiffs]);
  const issueComparison = useMemo(
    () =>
      data
        ? buildIssueComparison(data.outA, data.outB)
        : { shared: [], aOnly: [], bOnly: [] },
    [data],
  );

  if (loading) {
    return (
      <div className="p-8">
        <p className="font-label text-sm text-ink-on-dark">正在载入对照…</p>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="p-8">
        <div className="panel mx-auto max-w-2xl p-8">
          <h1 className="font-display text-2xl text-ink">对照载入失败</h1>
          <p className="mt-2 font-body text-sm text-ink-secondary">
            {error ?? "未找到该配对案件。"}
          </p>
          <Link to="/" className="mt-4 inline-block font-label text-sm text-ink">
            ← 返回案件列表
          </Link>
        </div>
      </div>
    );
  }

  const { a, b, outA, outB } = data;
  const bothRun = outA !== null && outB !== null;

  return (
    <div className="min-h-[calc(100vh-48px)] bg-surface">
      {/* ── 工具栏（固定顶部）── */}
      <div
        className="sticky top-0 z-30 border-b bg-surface"
        style={{ borderColor: "var(--border-default)" }}
      >
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-3 px-8 py-2.5">
          <Link
            to="/"
            className="rounded-sm border border-border bg-surface px-3 py-1 font-label text-sm text-ink-secondary transition-colors hover:bg-surface-alt"
          >
            ← 返回案件列表
          </Link>
          <span className="font-display text-base text-ink">A/B 对照</span>
          <span className="font-mono text-xs text-ink-caption">{pairId}</span>
          <div className="ml-auto flex items-center gap-2">
            <CourtroomLink variant="A" out={outA} caseId={a.case_id} />
            <CourtroomLink variant="B" out={outB} caseId={b.case_id} />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1200px] px-8 pb-12 pt-6">
        {/* ── 双栏题首 ── */}
        <div
          className="grid grid-cols-2 gap-px overflow-hidden rounded border"
          style={{
            backgroundColor: "var(--border-default)",
            borderColor: "var(--border-default)",
          }}
        >
          <SideHeader variant="A" input={a} />
          <SideHeader variant="B" input={b} />
        </div>

        {/* ── 不变事实 ── */}
        <Section title="不变事实" hint={`两案共有、内容一致的 ${unchanged.length} 条事实`}>
          {unchanged.length === 0 ? (
            <Empty note="两案没有完全一致的共有事实。" />
          ) : (
            <ul className="flex flex-col gap-2">
              {unchanged.map((d) => {
                const fact = d.a as Fact;
                return (
                  <li
                    key={d.factId}
                    className="flex items-start gap-3 rounded border px-4 py-2.5"
                    style={{ borderColor: "var(--border-default)" }}
                  >
                    <span className="mt-0.5 font-mono text-xs text-ink-caption">
                      {fact.fact_id}
                    </span>
                    <FactStatusTag status={fact.status} />
                    <span className="font-body text-base text-ink">{fact.content}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        {/* ── 改变变量（页面重点）── */}
        <Section
          title="改变变量"
          emphasized
          hint={`两案唯一不同的 ${changed.length} 处事实——A/B 的因变量来源`}
        >
          {changed.length === 0 ? (
            <Empty note="两案事实完全相同。" />
          ) : (
            <div
              className="overflow-hidden rounded border"
              style={{
                borderColor: "var(--border-default)",
                backgroundColor: "var(--bg-surface-alt)",
              }}
            >
              {/* 列标头 */}
              <div
                className="grid grid-cols-2 gap-px"
                style={{ backgroundColor: "var(--border-default)" }}
              >
                <div
                  className="px-4 py-2 font-label text-xs text-ink-secondary"
                  style={{ backgroundColor: "var(--bg-surface-alt)" }}
                >
                  A · {a.case_id}
                </div>
                <div
                  className="px-4 py-2 font-label text-xs text-ink-secondary"
                  style={{ backgroundColor: "var(--bg-surface-alt)" }}
                >
                  B · {b.case_id}
                </div>
              </div>
              <div style={{ borderTop: "1px solid var(--border-default)" }}>
                {changed.map((d, i) => (
                  <div
                    key={d.factId}
                    style={{
                      borderTop: i === 0 ? undefined : "1px solid var(--border-default)",
                    }}
                  >
                    <ChangedFactRow diff={d} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>

        {/* ── 推理变化 ── */}
        <Section
          title="推理变化"
          hint={
            bothRun
              ? "事实改变如何传导到各 Agent 的输出"
              : "部分案例尚未运行，仅展示已有产物"
          }
        >
          <div className="flex flex-col gap-6">
            {/* 争点状态：open → closed 高亮 */}
            <div>
              <h3 className="mb-2 font-label text-sm text-ink-secondary">
                争点审理状态（A → B）
              </h3>
              <IssueStatusCompare comparison={issueComparison} />
            </div>

            {/* Reviewer 立场：四行 A → B */}
            <div>
              <h3 className="mb-2 font-label text-sm text-ink-secondary">
                评议者立场（A → B）
              </h3>
              <ReviewerCompare outA={outA} outB={outB} />
            </div>

            {/* 公诉强度 */}
            <CompareBlock
              title="公诉强度"
              renderA={<ProsecutionStrength out={outA} />}
              renderB={<ProsecutionStrength out={outB} />}
            />

            {/* 辩护替代解释 */}
            <CompareBlock
              title="辩护替代解释"
              renderA={
                outA ? (
                  <Bullets
                    items={outA.defense_analysis?.alternative_explanations ?? []}
                    dot="var(--role-defense)"
                  />
                ) : (
                  <NotRun />
                )
              }
              renderB={
                outB ? (
                  <Bullets
                    items={outB.defense_analysis?.alternative_explanations ?? []}
                    dot="var(--role-defense)"
                  />
                ) : (
                  <NotRun />
                )
              }
            />

            {/* Judge 未决 */}
            <CompareBlock
              title="Judge 未决事项"
              renderA={
                outA ? (
                  <Bullets
                    items={outA.judge_summary?.unresolved_points ?? []}
                    dot="var(--status-pending)"
                  />
                ) : (
                  <NotRun />
                )
              }
              renderB={
                outB ? (
                  <Bullets
                    items={outB.judge_summary?.unresolved_points ?? []}
                    dot="var(--status-pending)"
                  />
                ) : (
                  <NotRun />
                )
              }
            />

            {/* 多数意见 */}
            <CompareBlock
              title="评议多数意见"
              renderA={
                outA ? (
                  <p className="font-body text-sm text-ink">
                    {outA.foreperson_summary?.majority_view || "—"}
                  </p>
                ) : (
                  <NotRun />
                )
              }
              renderB={
                outB ? (
                  <p className="font-body text-sm text-ink">
                    {outB.foreperson_summary?.majority_view || "—"}
                  </p>
                ) : (
                  <NotRun />
                )
              }
            />
          </div>
        </Section>
      </div>
    </div>
  );
}
