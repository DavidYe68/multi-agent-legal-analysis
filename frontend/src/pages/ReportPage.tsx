import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";

import Timeline from "../components/courtroom/Timeline";
import { issueStatusLabel } from "../components/courtroom/issueMeta";
import { getCase, getCaseOutput } from "../services/caseService";
import type {
  CaseInput,
  CaseOutput,
  IssueResponseRow,
  TaskMode,
} from "../types";

/**
 * ReportPage · 最终报告（/case/:caseId/report）
 *
 * 一个「阅读页面」：模仿法律意见书 / 学术论文的单栏排版（max-width 800px，居中），
 * section 之间以 1px 分隔线断开，不用卡片、不用页面级分栏（控辩对照的左右两栏是
 * section 内部的局部对照，不是页面布局）。
 *
 * 数据来自 state_final.json：
 *   - final_report（writer 产物）是主体；
 *   - 时间线复用卷宗栏的 <Timeline/>；
 *   - 法官收束的「争点回应表缩略版」「不确定性说明」「结论边界」取自上游
 *     judge_summary（writer prompt 明确要求不得忽略 Judge 的 unresolved_points /
 *     evidence_gaps，故以其为这些派生小节的真源）；
 *   - 评议分歧取自 foreperson_summary.disagreement_points。
 *
 * 教学 / 实务由 final_report.mode_hint 决定初始视图，可在工具栏切换。
 */

/* ===========================================================================
 * 通用排版小件
 * ======================================================================== */

/** 一个 section：上方 1px 分隔线 + 衬线小标题 + 内容。 */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      style={{
        marginTop: "var(--space-8)",
        paddingTop: "var(--space-8)",
        borderTop: "1px solid var(--border-default)",
      }}
    >
      <h2
        className="font-display"
        style={{ fontSize: "var(--text-lg)", color: "var(--text-primary)" }}
      >
        {title}
      </h2>
      <div style={{ marginTop: "var(--space-3)" }}>{children}</div>
    </section>
  );
}

/** 正文段落。 */
function Prose({ children }: { children: ReactNode }) {
  return <p className="font-body text-base text-ink">{children}</p>;
}

/** 空内容占位。 */
function Empty({ note = "—" }: { note?: string }) {
  return <p className="font-body text-sm text-ink-caption">{note}</p>;
}

/** bullet 列表（左侧细色点）。 */
function Bullets({ items, dot }: { items: string[]; dot: string }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2">
          <span
            aria-hidden="true"
            className="mt-[10px] h-[5px] w-[5px] shrink-0 rounded-full"
            style={{ backgroundColor: dot }}
          />
          <span className="font-body text-base text-ink-secondary">{it}</span>
        </li>
      ))}
    </ul>
  );
}

/** 有序列表（衬线编号）。 */
function Numbered({ items, accent }: { items: string[]; accent: string }) {
  return (
    <ol className="flex flex-col gap-1.5">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2.5">
          <span
            aria-hidden="true"
            className="shrink-0 font-mono text-base tabular-nums"
            style={{ color: accent }}
          >
            {i + 1}.
          </span>
          <span className="font-body text-base text-ink">{it}</span>
        </li>
      ))}
    </ol>
  );
}

/** 控辩对照的一栏。 */
function PartyColumn({
  title,
  color,
  items,
}: {
  title: string;
  color: string;
  items: string[];
}) {
  return (
    <div style={{ borderLeft: `3px solid ${color}`, paddingLeft: "var(--space-4)" }}>
      <h3 className="mb-2 font-label text-sm" style={{ color }}>
        {title}
      </h3>
      {items.length === 0 ? <Empty /> : <Bullets items={items} dot={color} />}
    </div>
  );
}

/** 法官「争点回应表缩略版」：争点 + 状态。 */
function IssueStatusTable({
  rows,
  issueTextById,
}: {
  rows: IssueResponseRow[];
  issueTextById: Record<string, string>;
}) {
  return (
    <div
      className="overflow-hidden rounded border"
      style={{ borderColor: "var(--border-default)" }}
    >
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="bg-surface-alt">
            {["争点", "状态"].map((h, i) => (
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
          {rows.map((row) => (
            <tr key={row.issue_id} className="align-top">
              <td
                className="px-3 py-2"
                style={{ borderTop: "1px solid var(--border-default)" }}
              >
                <span className="font-mono text-xs text-ink-caption">
                  {row.issue_id}
                </span>
                <span className="ml-2 font-body text-sm text-ink">
                  {issueTextById[row.issue_id] ?? "—"}
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
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ===========================================================================
 * 下载 / Markdown
 * ======================================================================== */

function triggerDownload(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** 把列表渲染成 markdown。 */
function mdList(items: string[], ordered = false): string {
  if (items.length === 0) return "（无）\n";
  return (
    items
      .map((it, i) => (ordered ? `${i + 1}. ${it}` : `- ${it}`))
      .join("\n") + "\n"
  );
}

/** 依当前视图把报告渲染为 Markdown 文本。 */
function reportToMarkdown(
  title: string,
  caseId: string,
  mode: TaskMode,
  out: CaseOutput,
): string {
  const r = out.final_report;
  const judge = out.judge_summary;
  const fore = out.foreperson_summary;
  const lines: string[] = [];
  lines.push(`# ${title}`);
  lines.push(`\n> 案件编号 ${caseId} · ${mode === "teaching" ? "教学模式" : "实务模式"}\n`);

  lines.push(`## 案件摘要\n\n${r.case_summary || "—"}\n`);

  if (mode === "teaching") {
    lines.push(`## 核心争点\n\n${mdList(r.core_issues, true)}`);
    lines.push(`## 公诉意见\n\n${mdList(r.prosecutor_view)}`);
    lines.push(`## 辩护意见\n\n${mdList(r.defense_view)}`);
    lines.push(`## 法官收束\n\n${mdList(r.judge_summary)}`);
    lines.push(`## 评议分歧\n\n${mdList(fore?.disagreement_points ?? [])}`);
    lines.push(
      `## 多数与少数意见\n\n**多数意见**：${r.reviewer_summary?.majority_view || "—"}\n\n**少数意见**：${r.reviewer_summary?.minority_view || "（无）"}\n`,
    );
    lines.push(`## 证据缺口\n\n${mdList(r.evidence_gaps)}`);
    if ((r.open_questions?.length ?? 0) > 0)
      lines.push(`## 课堂讨论问题\n\n${mdList(r.open_questions, true)}`);
  } else {
    lines.push(`## 核心风险\n\n${mdList(r.risk_flags)}`);
    lines.push(`## 公诉主要论点\n\n${mdList(r.prosecutor_view)}`);
    lines.push(`## 辩护主要论点\n\n${mdList(r.defense_view)}`);
    lines.push(`## 关键证据缺口\n\n${mdList(r.evidence_gaps)}`);
    lines.push(`## 不确定性说明\n\n${mdList(judge?.uncertainty_reasons ?? [])}`);
    lines.push(`## 下一步调查建议\n\n${mdList(r.next_step_suggestions)}`);
    lines.push(
      `## 结论边界（不应作出的结论）\n\n${mdList(judge?.unresolved_points ?? [])}`,
    );
  }
  return lines.join("\n");
}

/* ===========================================================================
 * Trace 全屏 modal
 * ======================================================================== */

function TraceModal({ output, onClose }: { output: CaseOutput; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const json = useMemo(() => JSON.stringify(output, null, 2), [output]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ backgroundColor: "rgba(27, 40, 56, 0.6)", padding: "var(--space-8)" }}
      onClick={onClose}
    >
      <div
        className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col panel-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <header
          className="flex shrink-0 items-center justify-between px-4 py-3"
          style={{ borderBottom: "1px solid var(--border-default)" }}
        >
          <h2 className="font-display text-lg text-ink">完整 Trace · state_final.json</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                triggerDownload(
                  `${output.case_id}.state_final.json`,
                  json,
                  "application/json",
                )
              }
              className="rounded-sm border border-border px-3 py-1 font-label text-xs text-ink-secondary transition-colors hover:bg-surface-alt"
            >
              下载完整 JSON
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="关闭"
              className="rounded-sm border border-border px-3 py-1 font-label text-xs text-ink-secondary transition-colors hover:bg-surface-alt"
            >
              关闭 ✕
            </button>
          </div>
        </header>
        <pre
          className="min-h-0 flex-1 overflow-auto bg-surface-alt p-4 font-mono text-xs text-ink-secondary"
          style={{ lineHeight: 1.6 }}
        >
          {json}
        </pre>
      </div>
    </div>
  );
}

/* ===========================================================================
 * 工具栏
 * ======================================================================== */

function ToolbarButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-sm border border-border bg-surface px-3 py-1 font-label text-sm text-ink-secondary transition-colors hover:bg-surface-alt"
    >
      {children}
    </button>
  );
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: TaskMode;
  onChange: (m: TaskMode) => void;
}) {
  return (
    <div
      className="inline-flex overflow-hidden rounded-sm border"
      style={{ borderColor: "var(--border-default)" }}
      role="group"
      aria-label="模式切换"
    >
      {(["teaching", "practice"] as const).map((m) => {
        const active = mode === m;
        return (
          <button
            key={m}
            type="button"
            onClick={() => onChange(m)}
            aria-pressed={active}
            className="px-3 py-1 font-label text-sm transition-colors"
            style={{
              backgroundColor: active ? "var(--role-writer)" : "transparent",
              color: active ? "var(--text-on-dark)" : "var(--text-secondary)",
            }}
          >
            {m === "teaching" ? "教学" : "实务"}
          </button>
        );
      })}
    </div>
  );
}

/* ===========================================================================
 * 页面
 * ======================================================================== */

export default function ReportPage() {
  const { caseId } = useParams<{ caseId: string }>();

  const [caseInput, setCaseInput] = useState<CaseInput | null>(null);
  const [caseOutput, setCaseOutput] = useState<CaseOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [mode, setMode] = useState<TaskMode>("teaching");
  const [traceOpen, setTraceOpen] = useState(false);

  useEffect(() => {
    if (!caseId) return;
    let alive = true;
    setLoading(true);
    setCaseInput(null);
    setCaseOutput(null);
    setError(null);
    Promise.all([getCase(caseId), getCaseOutput(caseId)])
      .then(([input, output]) => {
        if (!alive) return;
        setCaseInput(input);
        setCaseOutput(output);
        // 初始视图：尊重 writer 的 mode_hint，回退到案件 task_mode。
        const hint = (output?.final_report?.mode_hint as TaskMode) || input.task_mode;
        setMode(hint === "practice" ? "practice" : "teaching");
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
  }, [caseId]);

  const issueTextById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const i of caseOutput?.issues?.issues ?? []) map[i.issue_id] = i.issue_text;
    return map;
  }, [caseOutput]);

  const backTo = `/case/${caseId ?? ""}`;

  /* ---- 加载 / 错误 / 无产物 ---- */
  if (loading) {
    return (
      <div className="p-8">
        <p className="font-label text-sm text-ink-on-dark">正在载入报告…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-8">
        <div className="panel mx-auto max-w-2xl p-8">
          <p className="font-label text-sm text-ink-secondary">
            报告载入失败：{error}
          </p>
          <Link to={backTo} className="mt-4 inline-block font-label text-sm text-ink">
            ← 返回法庭
          </Link>
        </div>
      </div>
    );
  }
  if (!caseOutput || !caseInput || !caseOutput.final_report?.case_summary) {
    return (
      <div className="p-8">
        <div className="panel mx-auto max-w-2xl p-8">
          <h1 className="font-display text-2xl text-ink">尚无最终报告</h1>
          <p className="mt-2 font-body text-sm text-ink-secondary">
            该案件尚未运行写作 Agent，暂无可展示的报告。
          </p>
          <Link to={backTo} className="mt-4 inline-block font-label text-sm text-ink">
            ← 返回法庭
          </Link>
        </div>
      </div>
    );
  }

  const report = caseOutput.final_report;
  const judge = caseOutput.judge_summary;
  const fore = caseOutput.foreperson_summary;
  const timeline = caseOutput.case_narrative?.timeline ?? caseInput.case_narrative.timeline;
  const issueTable = judge?.issue_response_table ?? [];

  return (
    <div className="min-h-[calc(100vh-48px)]">
      {/* ── 工具栏（固定顶部）── */}
      <div
        className="sticky top-0 z-30 border-b bg-surface"
        style={{ borderColor: "var(--border-default)" }}
      >
        <div className="mx-auto flex max-w-[800px] flex-wrap items-center gap-2 px-6 py-2.5">
          <Link
            to={backTo}
            className="rounded-sm border border-border bg-surface px-3 py-1 font-label text-sm text-ink-secondary transition-colors hover:bg-surface-alt"
          >
            ← 返回法庭
          </Link>
          <ModeToggle mode={mode} onChange={setMode} />
          <div className="ml-auto flex items-center gap-2">
            <ToolbarButton
              onClick={() =>
                triggerDownload(
                  `${caseOutput.case_id}.state_final.json`,
                  JSON.stringify(caseOutput, null, 2),
                  "application/json",
                )
              }
            >
              下载 JSON
            </ToolbarButton>
            <ToolbarButton
              onClick={() =>
                triggerDownload(
                  `${caseOutput.case_id}.report.md`,
                  reportToMarkdown(caseInput.title, caseOutput.case_id, mode, caseOutput),
                  "text/markdown",
                )
              }
            >
              下载 Markdown
            </ToolbarButton>
            <ToolbarButton onClick={() => setTraceOpen(true)}>
              查看完整 Trace
            </ToolbarButton>
          </div>
        </div>
      </div>

      {/* ── 阅读栏 ── */}
      <article
        className="mx-auto max-w-[800px] bg-surface"
        style={{
          paddingLeft: "var(--space-12)",
          paddingRight: "var(--space-12)",
          paddingTop: "var(--space-12)",
          paddingBottom: "var(--space-12)",
          minHeight: "calc(100vh - 48px)",
        }}
      >
        {/* 题首块：标题 + 元信息 */}
        <header>
          <p className="font-mono text-xs text-ink-caption">{caseOutput.case_id}</p>
          <h1
            className="mt-1 font-display"
            style={{ fontSize: "var(--text-3xl)", lineHeight: 1.3 }}
          >
            {caseInput.title}
          </h1>
          <p className="mt-2 font-label text-sm text-ink-caption">
            {mode === "teaching" ? "教学模式 · 过程展示报告" : "实务模式 · 风险研判报告"}
          </p>
        </header>

        {/* 案件摘要（两种模式共有） */}
        <Section title="案件摘要">
          {report.case_summary ? <Prose>{report.case_summary}</Prose> : <Empty />}
        </Section>

        {mode === "teaching" ? (
          <>
            {/* 时间线 */}
            {timeline.length > 0 && (
              <Section title="时间线">
                <Timeline events={timeline} />
              </Section>
            )}

            {/* 核心争点 */}
            <Section title="核心争点">
              {report.core_issues.length === 0 ? (
                <Empty />
              ) : (
                <Numbered items={report.core_issues} accent="var(--role-judge)" />
              )}
            </Section>

            {/* 控辩意见对照（左右两栏） */}
            <Section title="控辩意见对照">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <PartyColumn
                  title="公诉意见"
                  color="var(--role-prosecutor)"
                  items={report.prosecutor_view}
                />
                <PartyColumn
                  title="辩护意见"
                  color="var(--role-defense)"
                  items={report.defense_view}
                />
              </div>
            </Section>

            {/* 法官收束（争点回应表缩略版） */}
            <Section title="法官收束">
              {report.judge_summary.length > 0 && (
                <div style={{ marginBottom: "var(--space-4)" }}>
                  <Bullets items={report.judge_summary} dot="var(--role-judge)" />
                </div>
              )}
              {issueTable.length > 0 ? (
                <IssueStatusTable rows={issueTable} issueTextById={issueTextById} />
              ) : (
                report.judge_summary.length === 0 && <Empty />
              )}
            </Section>

            {/* 评议分歧 */}
            <Section title="评议分歧">
              {(fore?.disagreement_points?.length ?? 0) === 0 ? (
                <Empty note="评议过程未出现实质分歧。" />
              ) : (
                <Bullets
                  items={fore.disagreement_points}
                  dot="var(--relation-disagree)"
                />
              )}
            </Section>

            {/* 多数与少数意见 */}
            <Section title="多数与少数意见">
              <div className="flex flex-col gap-3">
                <div
                  style={{
                    borderLeft: "3px solid var(--role-judge)",
                    paddingLeft: "var(--space-4)",
                  }}
                >
                  <h3 className="mb-1 font-label text-sm text-ink-caption">多数意见</h3>
                  {report.reviewer_summary?.majority_view ? (
                    <Prose>{report.reviewer_summary.majority_view}</Prose>
                  ) : (
                    <Empty />
                  )}
                </div>
                <div
                  style={{
                    borderLeft: "3px solid var(--text-secondary)",
                    paddingLeft: "var(--space-4)",
                  }}
                >
                  <h3 className="mb-1 font-label text-sm text-ink-caption">少数意见</h3>
                  {report.reviewer_summary?.minority_view ? (
                    <Prose>{report.reviewer_summary.minority_view}</Prose>
                  ) : (
                    <Empty note="无少数意见，评议意见一致。" />
                  )}
                </div>
              </div>
            </Section>

            {/* 证据缺口 */}
            <Section title="证据缺口">
              {report.evidence_gaps.length === 0 ? (
                <Empty />
              ) : (
                <Bullets items={report.evidence_gaps} dot="var(--relation-disagree)" />
              )}
            </Section>

            {/* 课堂讨论问题（仅当 writer 输出中存在） */}
            {report.open_questions.length > 0 && (
              <Section title="课堂讨论问题">
                <Numbered items={report.open_questions} accent="var(--role-foreperson)" />
              </Section>
            )}
          </>
        ) : (
          <>
            {/* 核心风险 */}
            <Section title="核心风险">
              {report.risk_flags.length === 0 ? (
                <Empty note="未标注核心风险。" />
              ) : (
                <Bullets items={report.risk_flags} dot="var(--relation-disagree)" />
              )}
            </Section>

            {/* 双方主要论点（精简版） */}
            <Section title="双方主要论点">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <PartyColumn
                  title="公诉方"
                  color="var(--role-prosecutor)"
                  items={report.prosecutor_view}
                />
                <PartyColumn
                  title="辩护方"
                  color="var(--role-defense)"
                  items={report.defense_view}
                />
              </div>
            </Section>

            {/* 关键证据缺口 */}
            <Section title="关键证据缺口">
              {report.evidence_gaps.length === 0 ? (
                <Empty />
              ) : (
                <Bullets items={report.evidence_gaps} dot="var(--relation-disagree)" />
              )}
            </Section>

            {/* 不确定性说明（取自 judge.uncertainty_reasons） */}
            <Section title="不确定性说明">
              {(judge?.uncertainty_reasons?.length ?? 0) === 0 ? (
                <Empty />
              ) : (
                <Bullets
                  items={judge.uncertainty_reasons}
                  dot="var(--relation-partial)"
                />
              )}
            </Section>

            {/* 下一步调查建议 */}
            <Section title="下一步调查建议">
              {report.next_step_suggestions.length === 0 ? (
                <Empty />
              ) : (
                <Numbered
                  items={report.next_step_suggestions}
                  accent="var(--role-writer)"
                />
              )}
            </Section>

            {/* 结论边界（不应作出的结论）— 取自 judge.unresolved_points */}
            <Section title="结论边界">
              <p className="mb-2 font-body text-sm text-ink-caption">
                以下问题尚未解决，不应据此作出确定结论：
              </p>
              {(judge?.unresolved_points?.length ?? 0) === 0 ? (
                <Empty note="无明确未决事项。" />
              ) : (
                <Bullets items={judge.unresolved_points} dot="var(--status-pending)" />
              )}
            </Section>
          </>
        )}
      </article>

      {traceOpen && (
        <TraceModal output={caseOutput} onClose={() => setTraceOpen(false)} />
      )}
    </div>
  );
}
