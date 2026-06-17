import type {
  IssueResponseRow,
  IssueStatus,
  JudgeSummary,
} from "../../types";

/**
 * issueMeta · 中央争点区共享的标签、配色与索引工具
 *
 * 这里集中放置「争点状态 / 重要性」的中文标签与配色规则，
 * 以及把法官争点回应表按 issue_id 建索引、把证据 id 数值排序等纯函数，
 * 供 IssueBar / IssueDetail / 控辩席各组件复用，避免在多处重复同一套映射。
 */

/** 争点证明状态 → 中文标签。仅用文字区分，不用颜色（符合需求）。 */
export const ISSUE_STATUS_LABELS: Record<IssueStatus, string> = {
  open: "未决",
  partly_closed: "部分明确",
  closed: "已明确",
};

/** 取争点状态中文标签；未知取值原样返回。 */
export function issueStatusLabel(status: string): string {
  return ISSUE_STATUS_LABELS[status as IssueStatus] ?? status;
}

/** 争点重要性元信息：中文标签 + 是否核心（核心用黄铜实心标识，其余用暖灰空心）。 */
export interface ImportanceMeta {
  label: string;
  core: boolean;
}

const IMPORTANCE_META: Record<string, ImportanceMeta> = {
  core: { label: "核心", core: true },
  secondary: { label: "次要", core: false },
  contextual: { label: "背景", core: false },
};

/** 取重要性元信息；未知取值视为非核心并原样显示文本。 */
export function importanceMeta(importance: string): ImportanceMeta {
  return IMPORTANCE_META[importance] ?? { label: importance, core: false };
}

/** 把法官争点回应表按 issue_id 建索引，便于 O(1) 查某争点的审理状态。 */
export function indexIssueResponses(
  judge: JudgeSummary | null | undefined,
): Record<string, IssueResponseRow> {
  const table = judge?.issue_response_table ?? [];
  const index: Record<string, IssueResponseRow> = {};
  for (const row of table) index[row.issue_id] = row;
  return index;
}

/**
 * 证据 id 数值排序比较器（E1 < E2 < E10）。
 * 取末尾数字段比较，无数字时回退到字典序，保证渲染顺序稳定。
 */
export function compareEvidenceId(a: string, b: string): number {
  const na = Number.parseInt(a.replace(/^\D+/, ""), 10);
  const nb = Number.parseInt(b.replace(/^\D+/, ""), 10);
  if (Number.isNaN(na) || Number.isNaN(nb)) return a.localeCompare(b);
  return na - nb;
}

/**
 * 角色证据底色：取角色色并以低透明度铺底（公诉/辩护各 ~10%）。
 * 用 color-mix 直接基于 CSS 令牌混合，避免在别处硬编码 rgba。
 */
export function roleTint(
  role: "prosecutor" | "defense",
  percent = 10,
): string {
  return `color-mix(in srgb, var(--role-${role}) ${percent}%, transparent)`;
}
