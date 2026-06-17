import type { Position, Relation } from "../../types";

/**
 * reviewerMeta · 评议室共享元数据
 *
 * 评议室（Deliberation Room）所有组件共用的一套映射：四类评议者的座次、中文名、
 * 角色色与人格倾向；以及立场 / 回应关系的中文标签与配色。集中在此，避免在
 * ReviewerSeat / AllianceGraph / VotePanel / 连线 等多处重复同一套字典。
 *
 * 取色一律走 tokens.css 的 CSS 变量（--role-* / --relation-* / --status-*），
 * 不在此硬编码任何色值。
 */

/** 评议者 agent_id（与 deliberation_room 数据中的 agent_id 一致）。 */
export type ReviewerId =
  | "legal_reviewer"
  | "social_reviewer"
  | "expert_reviewer"
  | "public_reviewer";

/**
 * 固定座次：菱形四席。
 *   - 上：法律评议者
 *   - 左：公众评议者
 *   - 右：专家评议者
 *   - 下：社会评议者
 * 与需求图示一致。AllianceGraph 的节点初始坐标也沿用同一菱形。
 */
export type SeatSlot = "top" | "left" | "right" | "bottom";

export const SEAT_LAYOUT: Record<SeatSlot, ReviewerId> = {
  top: "legal_reviewer",
  left: "public_reviewer",
  right: "expert_reviewer",
  bottom: "social_reviewer",
};

/** 发言/座次的稳定顺序：法律 → 社会 → 专家 → 公众（数据通常即此序）。 */
export const REVIEWER_ORDER: ReviewerId[] = [
  "legal_reviewer",
  "social_reviewer",
  "expert_reviewer",
  "public_reviewer",
];

/** 取评议者在固定座次中的序号（未知 id 排到末尾）。 */
export function reviewerOrderIndex(agentId: string): number {
  const i = (REVIEWER_ORDER as string[]).indexOf(agentId);
  return i === -1 ? REVIEWER_ORDER.length : i;
}

/** 评议者中文名。 */
const REVIEWER_LABELS: Record<string, string> = {
  legal_reviewer: "法律评议者",
  social_reviewer: "社会评议者",
  expert_reviewer: "专家评议者",
  public_reviewer: "公众评议者",
};

/**
 * 人格倾向（一行小字）。
 *
 * 取自 prompts/{role}_prompt.txt 中各评议者的视角设定与 reviewer_personality
 * 字段（strictness / agreeableness / risk_aversion）。运行产物里不持久化具体取值，
 * 故此处按角色固定一句概括其协商性格，作为 config/personality_profiles.json 之外的
 * 前端补充字典。
 */
const REVIEWER_PERSONALITY: Record<string, string> = {
  legal_reviewer: "严格度偏高 · 重证明标准与举证责任",
  social_reviewer: "重程序公平 · 关注弱势与现实影响",
  expert_reviewer: "风险厌恶 · 重司法实践与系统性风险",
  public_reviewer: "凭常识直觉 · 看重朴素公平感",
};

/** 取评议者中文名；未知 id 原样返回。 */
export function reviewerLabel(agentId: string): string {
  return REVIEWER_LABELS[agentId] ?? agentId;
}

/** 取评议者人格倾向一行字；未知 id 返回空串。 */
export function reviewerPersonality(agentId: string): string {
  return REVIEWER_PERSONALITY[agentId] ?? "";
}

/**
 * 评议者角色色 CSS 变量。
 * tokens 里角色变量用连字符（--role-legal-reviewer），agent_id 用下划线，做一次转换。
 */
export function reviewerColorVar(agentId: string): string {
  return `var(--role-${agentId.replace(/_/g, "-")})`;
}

/** 评议者角色色低透明度铺底（用于立场标签 / 节点背景等小面积着色）。 */
export function reviewerTint(agentId: string, percent = 12): string {
  return `color-mix(in srgb, ${reviewerColorVar(agentId)} ${percent}%, transparent)`;
}

/* ===========================================================================
 * 立场（position）
 * ======================================================================== */

const POSITION_LABELS: Record<Position, string> = {
  guilty: "有罪",
  not_guilty: "无罪",
  partial: "部分成立",
  unclear: "存疑",
};

/** 取立场中文标签；未知取值原样返回。 */
export function positionLabel(position: string): string {
  return POSITION_LABELS[position as Position] ?? position;
}

/**
 * 立场在投票统计中的配色（VotePanel 专用，按需求约定）：
 *   guilty → 公诉色 · not_guilty → 辩护色 · partial → 琥珀 · unclear → 待定灰。
 */
export function positionVoteColor(position: string): string {
  switch (position) {
    case "guilty":
      return "var(--role-prosecutor)";
    case "not_guilty":
      return "var(--role-defense)";
    case "partial":
      return "var(--relation-partial)";
    case "unclear":
    default:
      return "var(--status-pending)";
  }
}

/* ===========================================================================
 * 回应关系（relation）
 * ======================================================================== */

const RELATION_LABELS: Record<Relation, string> = {
  agree: "同意",
  partially_agree: "部分同意",
  disagree: "反对",
};

/** 取回应关系中文标签；未知取值原样返回。 */
export function relationLabel(relation: string): string {
  return RELATION_LABELS[relation as Relation] ?? relation;
}

/** 回应关系连线色：同意绿 / 部分琥珀 / 反对暗红。 */
export function relationColor(relation: string): string {
  switch (relation) {
    case "agree":
      return "var(--relation-agree)";
    case "partially_agree":
      return "var(--relation-partial)";
    case "disagree":
      return "var(--relation-disagree)";
    default:
      return "var(--border-default)";
  }
}

/** 回应关系是否用虚线（仅 partially_agree 用虚线，其余实线）。 */
export function relationDashed(relation: string): boolean {
  return relation === "partially_agree";
}
