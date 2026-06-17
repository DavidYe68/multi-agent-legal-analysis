import { useMemo } from "react";
import type { ReactNode } from "react";

import type { CaseOutput } from "../../types";
import { issueStatusLabel } from "./issueMeta";

/**
 * JudgeBench · 法官席
 *
 * 坐落在中央争点详情下方的独立区域，视觉上像「审判席居于法庭中央上方」：
 *   - 2px 黄铜强调边框（--border-emphasis），内部 --space-8 留白，与上方对抗区
 *     以 --space-12 顶距明确分隔；
 *   - 标题「法官席」用 --font-display / --text-xl，两侧以 ═ 字符做装饰线
 *     （不用法槌 / 天平等图标）。
 *
 * 数据全部来自 judge 输出（caseOutput.judge_summary）：
 *   resolved_points → 已解决；unresolved_points → 未决；evidence_gaps → 证据缺口；
 *   issue_response_table → 争点回应表；judge_observations / discussion_focus → 观察与讨论焦点。
 *
 * 表格中「公诉回应 / 辩护回应」由控辩是否就该争点提出过论证推导（arguments_by_issue /
 * rebuttals_to_accusation）；「证据」一列由支撑证据数量与遗留缺口推导其充分度。
 */

interface JudgeBenchProps {
  caseOutput: CaseOutput;
  /** 点击「进入评议室」：滚动到下方 Deliberation Room。 */
  onEnterDeliberation: () => void;
}

/** 装饰线：一长串 ═，由容器 overflow-hidden 裁出可用宽度。 */
function RuleLine({ align }: { align: "left" | "right" }) {
  return (
    <span
      aria-hidden="true"
      className="min-w-0 flex-1 select-none overflow-hidden whitespace-nowrap font-mono"
      style={{
        color: "var(--border-emphasis)",
        opacity: 0.5,
        textAlign: align,
      }}
    >
      {"═".repeat(80)}
    </span>
  );
}

/** 三栏小结卡片：顶部 3px 强调色条 + 标题(计数) + 条目列表。 */
function SummaryCard({
  title,
  count,
  accent,
  children,
}: {
  title: string;
  count: number;
  accent: string;
  children: ReactNode;
}) {
  return (
    <div
      className="flex flex-col rounded border bg-surface-alt"
      style={{ borderColor: "var(--border-default)" }}
    >
      <span
        aria-hidden="true"
        className="h-[3px] w-full rounded-t"
        style={{ backgroundColor: accent }}
      />
      <div className="flex flex-col gap-2 p-3">
        <h4 className="font-label text-xs text-ink-secondary">
          {title}
          <span className="ml-1 font-mono text-ink-caption">({count})</span>
        </h4>
        {count === 0 ? (
          <p className="font-body text-sm text-ink-caption">—</p>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

/** 列表项：左侧细色点 + 文本。 */
function PointItem({ accent, children }: { accent: string; children: ReactNode }) {
  return (
    <li className="flex gap-2">
      <span
        aria-hidden="true"
        className="mt-[9px] h-[5px] w-[5px] shrink-0 rounded-full"
        style={{ backgroundColor: accent }}
      />
      <span className="font-body text-sm text-ink-secondary">{children}</span>
    </li>
  );
}

export default function JudgeBench({
  caseOutput,
  onEnterDeliberation,
}: JudgeBenchProps) {
  const judge = caseOutput.judge_summary;

  /** issue_id → 争点文本（表格首列展示）。 */
  const issueTextById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const i of caseOutput.issues?.issues ?? []) map[i.issue_id] = i.issue_text;
    return map;
  }, [caseOutput.issues]);

  /** 控方就哪些争点提出过论证（claim 非空）。 */
  const prosecutorIssues = useMemo(() => {
    const set = new Set<string>();
    for (const a of caseOutput.prosecutor_analysis?.arguments_by_issue ?? [])
      if (a.claim?.trim()) set.add(a.issue_id);
    return set;
  }, [caseOutput.prosecutor_analysis]);

  /** 辩方就哪些争点提出过论证或反驳。 */
  const defenseIssues = useMemo(() => {
    const set = new Set<string>();
    for (const a of caseOutput.defense_analysis?.arguments_by_issue ?? [])
      if (a.claim?.trim()) set.add(a.issue_id);
    for (const r of caseOutput.defense_analysis?.rebuttals_to_accusation ?? [])
      if (r.defense_rebuttal?.trim() || r.core_response?.trim())
        set.add(r.issue_id);
    return set;
  }, [caseOutput.defense_analysis]);

  const resolved = judge.resolved_points ?? [];
  const unresolved = judge.unresolved_points ?? [];
  const gaps = judge.evidence_gaps ?? [];
  const table = judge.issue_response_table ?? [];
  const observations = judge.judge_observations ?? [];
  const focus = judge.discussion_focus ?? [];

  return (
    <section
      // 与上方对抗区以 --space-12 明确分隔；2px 黄铜边框，内部 --space-8 留白。
      className="rounded bg-surface"
      style={{
        marginTop: "var(--space-12)",
        marginLeft: "var(--space-6)",
        marginRight: "var(--space-6)",
        padding: "var(--space-8)",
        border: "2px solid var(--border-emphasis)",
      }}
      aria-label="法官席"
    >
      {/* ── 标题：═══ 法 官 席 ═══ ── */}
      <div className="flex items-center gap-4">
        <RuleLine align="right" />
        <h3
          className="shrink-0 font-display"
          style={{
            fontSize: "var(--text-xl)",
            color: "var(--border-emphasis)",
            letterSpacing: "0.3em",
          }}
        >
          法&thinsp;官&thinsp;席
        </h3>
        <RuleLine align="left" />
      </div>

      {/* ── 三栏：已解决 / 未决 / 证据缺口 ── */}
      <div
        className="grid grid-cols-1 gap-4 md:grid-cols-3"
        style={{ marginTop: "var(--space-8)" }}
      >
        <SummaryCard
          title="已解决问题"
          count={resolved.length}
          accent="var(--relation-agree)"
        >
          <ul className="flex flex-col gap-1.5">
            {resolved.map((p, i) => (
              <PointItem key={i} accent="var(--relation-agree)">
                {p}
              </PointItem>
            ))}
          </ul>
        </SummaryCard>

        <SummaryCard
          title="未决问题"
          count={unresolved.length}
          accent="var(--relation-partial)"
        >
          <ul className="flex flex-col gap-1.5">
            {unresolved.map((p, i) => (
              <PointItem key={i} accent="var(--relation-partial)">
                {p}
              </PointItem>
            ))}
          </ul>
        </SummaryCard>

        <SummaryCard
          title="证据缺口"
          count={gaps.length}
          accent="var(--relation-disagree)"
        >
          <ul className="flex flex-col gap-2">
            {gaps.map((g, i) => (
              <li key={i} className="flex flex-col gap-0.5">
                <span className="font-mono text-xs text-ink-caption">
                  {g.issue_id}
                </span>
                <span className="font-body text-sm text-ink-secondary">
                  {g.gap}
                </span>
              </li>
            ))}
          </ul>
        </SummaryCard>
      </div>

      {/* ── 争点回应表 ── */}
      {table.length > 0 && (
        <div style={{ marginTop: "var(--space-8)" }}>
          <h4 className="mb-2 font-label text-xs text-ink-caption">争点回应表</h4>
          <div
            className="overflow-hidden rounded border"
            style={{ borderColor: "var(--border-default)" }}
          >
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-surface-alt">
                  {["争点", "公诉回应", "辩护回应", "证据", "状态"].map((h, i) => (
                    <th
                      key={h}
                      className="px-3 py-2 font-label text-xs text-ink-secondary"
                      style={{
                        borderBottom: "1px solid var(--border-default)",
                        textAlign: i === 0 ? "left" : "center",
                        width: i === 0 ? "auto" : "1%",
                        whiteSpace: i === 0 ? "normal" : "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.map((row) => {
                  const suff = evidenceSufficiency(row);
                  return (
                    <tr key={row.issue_id} className="align-top">
                      <td
                        className="px-3 py-2"
                        style={{ borderTop: "1px solid var(--border-default)" }}
                      >
                        <div className="flex flex-col">
                          <span className="font-mono text-xs text-ink-caption">
                            {row.issue_id}
                          </span>
                          <span
                            className="font-body text-sm text-ink"
                            title={issueTextById[row.issue_id]}
                          >
                            {issueTextById[row.issue_id] ?? "—"}
                          </span>
                        </div>
                      </td>
                      <td
                        className="px-3 py-2 text-center"
                        style={{ borderTop: "1px solid var(--border-default)" }}
                      >
                        <RespondMark covered={prosecutorIssues.has(row.issue_id)} />
                      </td>
                      <td
                        className="px-3 py-2 text-center"
                        style={{ borderTop: "1px solid var(--border-default)" }}
                      >
                        <RespondMark covered={defenseIssues.has(row.issue_id)} />
                      </td>
                      <td
                        className="px-3 py-2 text-center"
                        style={{ borderTop: "1px solid var(--border-default)" }}
                      >
                        <span
                          className="font-label text-xs"
                          style={{ color: suff.color }}
                        >
                          {suff.label}
                        </span>
                      </td>
                      <td
                        className="px-3 py-2 text-center"
                        style={{ borderTop: "1px solid var(--border-default)" }}
                      >
                        <span
                          className="inline-flex items-center rounded-sm border px-1.5 font-label text-xs"
                          style={{
                            borderColor: "var(--border-emphasis)",
                            color: "var(--role-judge)",
                          }}
                        >
                          {issueStatusLabel(row.current_status)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 法官观察 / 讨论焦点 ── */}
      {(observations.length > 0 || focus.length > 0) && (
        <div
          className="grid grid-cols-1 gap-6 md:grid-cols-2"
          style={{ marginTop: "var(--space-8)" }}
        >
          {observations.length > 0 && (
            <div>
              <h4 className="mb-2 font-label text-xs text-ink-caption">
                法官观察
              </h4>
              <ul className="flex flex-col gap-1.5">
                {observations.map((o, i) => (
                  <PointItem key={i} accent="var(--role-judge)">
                    {o}
                  </PointItem>
                ))}
              </ul>
            </div>
          )}
          {focus.length > 0 && (
            <div>
              <h4 className="mb-2 font-label text-xs text-ink-caption">
                讨论焦点
              </h4>
              <ul className="flex flex-col gap-1.5">
                {focus.map((f, i) => (
                  <PointItem key={i} accent="var(--role-judge)">
                    {f}
                  </PointItem>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── 进入评议室 ── */}
      <div className="flex justify-center" style={{ marginTop: "var(--space-8)" }}>
        <button
          type="button"
          onClick={onEnterDeliberation}
          className="inline-flex items-center gap-2 rounded border px-6 py-2 font-label text-sm transition-colors duration-150"
          style={{
            borderColor: "var(--border-emphasis)",
            color: "var(--border-emphasis)",
            backgroundColor: "transparent",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor =
              "color-mix(in srgb, var(--border-emphasis) 10%, transparent)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          进入评议室
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </section>
  );
}

/** 公诉/辩护是否回应：✓（已回应，绿）/ ✗（未回应，灰）。 */
function RespondMark({ covered }: { covered: boolean }) {
  return (
    <span
      className="font-label text-sm"
      style={{
        color: covered ? "var(--relation-agree)" : "var(--status-pending)",
      }}
      title={covered ? "已就该争点回应" : "未就该争点回应"}
    >
      {covered ? "✓" : "✗"}
    </span>
  );
}

/** 由支撑证据数量与遗留缺口推导证据充分度：充分 / 部分 / 不足。 */
function evidenceSufficiency(row: {
  supporting_evidence_ids?: string[];
  remaining_gap?: string;
}): { label: string; color: string } {
  const n = row.supporting_evidence_ids?.length ?? 0;
  if (n === 0) return { label: "不足", color: "var(--relation-disagree)" };
  if (row.remaining_gap && row.remaining_gap.trim())
    return { label: "部分", color: "var(--relation-partial)" };
  return { label: "充分", color: "var(--relation-agree)" };
}
