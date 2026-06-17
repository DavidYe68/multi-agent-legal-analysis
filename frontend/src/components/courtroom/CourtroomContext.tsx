import { createContext, useContext } from "react";

import type { CaseInput, CaseOutput } from "../../types";

/**
 * CourtroomContext · 庭审工作台共享状态
 *
 * 承载主工作台三栏共用的数据与联动状态：
 *   - 当前案件输入 / 运行产物；
 *   - 角色信息视图（left 卷宗栏的视图切换，影响事实/证据的可见性）；
 *   - 当前高亮的事实 / 证据 id —— 由左侧卷宗栏点击设置，
 *     供中央争点区域订阅高亮（中央区域在下一任务实现）。
 *
 * 之所以用 context 而非 props 透传：左栏（设置选中）与中央（消费选中）相距较远，
 * 且未来还会有更多区域订阅同一份选中状态。
 */

/** 角色信息视图：全部 + 五类可切换视角（对应 role_views 的键）。 */
export type RoleViewKey =
  | "all"
  | "prosecutor"
  | "defense_lawyer"
  | "defendant"
  | "judge"
  | "reviewers";

export interface CourtroomContextValue {
  /** 当前案件输入（卷宗栏的全部数据来源）。 */
  caseInput: CaseInput;
  /** 运行产物（state_final.json）；未运行的案件为 null。 */
  caseOutput: CaseOutput | null;

  /** 当前角色信息视图。 */
  roleView: RoleViewKey;
  setRoleView: (next: RoleViewKey) => void;

  /** 当前高亮的事实 id（无则 null）。 */
  selectedFactId: string | null;
  /** 当前高亮的证据 id（无则 null）。 */
  selectedEvidenceId: string | null;

  /** 选中/取消选中一条事实（再次点击同一条则取消）。 */
  selectFact: (factId: string) => void;
  /** 选中/取消选中一条证据（再次点击同一条则取消）。 */
  selectEvidence: (evidenceId: string) => void;
}

export const CourtroomContext = createContext<CourtroomContextValue | null>(null);

/** 读取庭审工作台上下文；必须在 CourtroomContext.Provider 内调用。 */
export function useCourtroom(): CourtroomContextValue {
  const ctx = useContext(CourtroomContext);
  if (!ctx) {
    throw new Error("useCourtroom 必须在 CourtroomContext.Provider 内使用");
  }
  return ctx;
}
