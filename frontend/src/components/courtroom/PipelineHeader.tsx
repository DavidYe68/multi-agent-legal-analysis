import { Fragment } from "react";

import type { CaseOutput } from "../../types";
import StatusDot, { type Status } from "../ui/StatusDot";
import { useCourtroom } from "./CourtroomContext";

/**
 * PipelineHeader · 顶部状态条（56px）
 *
 * 左：案件编号 + 标题。
 * 中：Pipeline 流程节点（合并为 7 个节点，节点间以 1px 横线相连）。
 * 右：教学/实务模式标签 +（从已有产物加载时）「演示回放」标签。
 *
 * 流程节点状态由 state_final.json 推断：有对应 agent 产物则视为已完成。
 * 「控辩分析」是一个合并节点，代表 Prosecutor + Defense + Defendant 三个 agent，
 * 三者齐备才算 done，部分齐备显示 running，全无则 pending。
 */

interface NodeDef {
  id: string;
  label: string;
  /** 该节点对应的 state 字段（合并节点有多个）。 */
  keys: (keyof CaseOutput)[];
}

/** 7 个合并后的流程节点，从左到右即流水线顺序。 */
const NODES: NodeDef[] = [
  { id: "clerk", label: "书记员", keys: ["case_structured"] },
  { id: "issue_spotter", label: "争点识别", keys: ["issues"] },
  {
    id: "adversary",
    label: "控辩分析",
    keys: ["prosecutor_analysis", "defense_analysis", "defendant_statement"],
  },
  { id: "judge", label: "法官", keys: ["judge_summary"] },
  { id: "deliberation", label: "评议室", keys: ["deliberation_room"] },
  { id: "foreperson", label: "首席评议", keys: ["foreperson_summary"] },
  { id: "writer", label: "报告撰写", keys: ["final_report"] },
];

const STATUS_TEXT: Record<Status, string> = {
  pending: "未开始",
  running: "进行中",
  done: "已完成",
  error: "出错",
};

/** 字段是否有实际内容（空对象 / 空数组 / 空串都视为「无」）。 */
function hasContent(value: unknown): boolean {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

/** 由产物推断单个节点状态。 */
function nodeStatus(
  output: CaseOutput | null,
  keys: (keyof CaseOutput)[],
): Status {
  if (!output) return "pending";
  const present = keys.filter((k) => hasContent(output[k])).length;
  if (present === 0) return "pending";
  if (present === keys.length) return "done";
  return "running";
}

/** 顶栏右侧的小标签：暖灰描边、象牙白底。 */
function HeaderTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-sm border border-border bg-surface px-2 py-0.5 font-label text-xs text-ink-secondary">
      {children}
    </span>
  );
}

export default function PipelineHeader() {
  const { caseInput, caseOutput } = useCourtroom();

  const modeLabel = caseInput.task_mode === "teaching" ? "教学模式" : "实务模式";
  const isReplay = caseOutput !== null;

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-surface-alt px-6">
      {/* 左：案件编号 + 标题 */}
      <div className="flex w-56 shrink-0 flex-col justify-center">
        <span className="font-mono text-xs leading-none text-ink-caption">
          {caseInput.case_id}
        </span>
        <span
          title={caseInput.title}
          className="truncate font-display text-lg leading-tight text-ink"
        >
          {caseInput.title}
        </span>
      </div>

      {/* 中：Pipeline 流程节点 */}
      <nav
        aria-label="流水线进度"
        className="flex min-w-0 flex-1 items-center justify-center"
      >
        {NODES.map((node, i) => {
          const status = nodeStatus(caseOutput, node.keys);
          return (
            <Fragment key={node.id}>
              {i > 0 && (
                <span
                  aria-hidden="true"
                  className="mx-1 h-px min-w-[8px] max-w-[28px] flex-1 bg-border"
                />
              )}
              <div className="flex shrink-0 items-center gap-1.5">
                <StatusDot
                  status={status}
                  label={`${node.label}（${STATUS_TEXT[status]}）`}
                />
                <span className="whitespace-nowrap text-xs text-ink-secondary">
                  {node.label}
                </span>
              </div>
            </Fragment>
          );
        })}
      </nav>

      {/* 右：模式 + 数据来源标签 */}
      <div className="flex shrink-0 items-center gap-2">
        <HeaderTag>{modeLabel}</HeaderTag>
        {isReplay && <HeaderTag>演示回放</HeaderTag>}
      </div>
    </header>
  );
}
