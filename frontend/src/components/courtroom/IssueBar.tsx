import type { CSSProperties } from "react";

import type { Issue, IssueResponseRow } from "../../types";
import { importanceMeta, issueStatusLabel } from "./issueMeta";

/**
 * IssueBar · 争点总览条（中央区域顶部，固定不滚动）
 *
 * 横向铺开全部争点，每个争点是一枚可点击标签：
 *   - 左侧 3px 色条：核心争点用黄铜（--role-judge），其余用暖灰（--border-default）；
 *   - 争点名（issue_text）13px / body / 500；
 *   - 状态行：● 核心 / ○ 次要 · 未决/部分明确/已明确（仅文字区分状态，不用颜色）；
 *   - 选中态：底色 --bg-surface-alt + 2px 黄铜底线。
 *
 * 状态来自法官争点回应表（按 issue_id 索引）；缺失时回退为「待审」。
 */

interface IssueBarProps {
  issues: Issue[];
  /** issue_id → 法官争点回应行（用于读取 current_status）。 */
  responseIndex: Record<string, IssueResponseRow>;
  selectedIssueId: string | null;
  onSelect: (issueId: string) => void;
}

function IssueTab({
  issue,
  status,
  selected,
  onSelect,
}: {
  issue: Issue;
  status: string | undefined;
  selected: boolean;
  onSelect: () => void;
}) {
  const imp = importanceMeta(issue.importance);
  const barColor = imp.core ? "var(--role-judge)" : "var(--border-default)";

  // 选中态：填充次级面板底色 + 2px 黄铜底线；未选中：透明底、无底线。
  const tabStyle: CSSProperties = {
    backgroundColor: selected ? "var(--bg-surface-alt)" : "transparent",
    borderBottom: `2px solid ${selected ? "var(--role-judge)" : "transparent"}`,
  };

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      style={tabStyle}
      className="flex max-w-[15rem] items-stretch gap-2 rounded-sm px-3 py-2 text-left transition-colors duration-150 hover:bg-surface-alt"
    >
      {/* 左侧 3px 色条 */}
      <span
        aria-hidden="true"
        className="w-[3px] shrink-0 self-stretch rounded-sm"
        style={{ backgroundColor: barColor }}
      />
      <span className="flex min-w-0 flex-col">
        <span className="flex items-baseline gap-1.5">
          <span className="font-mono text-xs text-ink-caption">
            {issue.issue_id}
          </span>
          <span
            className="truncate font-body text-sm font-medium text-ink"
            title={issue.issue_text}
          >
            {issue.issue_text}
          </span>
        </span>
        <span className="font-label text-xs text-ink-caption">
          <span
            aria-hidden="true"
            style={{ color: imp.core ? "var(--role-judge)" : undefined }}
          >
            {imp.core ? "●" : "○"}
          </span>{" "}
          {imp.label} · {status ? issueStatusLabel(status) : "待审"}
        </span>
      </span>
    </button>
  );
}

export default function IssueBar({
  issues,
  responseIndex,
  selectedIssueId,
  onSelect,
}: IssueBarProps) {
  return (
    <div className="shrink-0 border-b border-border bg-surface p-4">
      <div className="flex flex-wrap items-end gap-x-1 gap-y-2">
        {issues.map((issue) => (
          <IssueTab
            key={issue.issue_id}
            issue={issue}
            status={responseIndex[issue.issue_id]?.current_status}
            selected={selectedIssueId === issue.issue_id}
            onSelect={() => onSelect(issue.issue_id)}
          />
        ))}
      </div>
    </div>
  );
}
