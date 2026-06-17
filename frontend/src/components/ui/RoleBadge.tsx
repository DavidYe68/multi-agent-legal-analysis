import type { CSSProperties } from "react";

/**
 * RoleBadge · 角色标签
 *
 * 一枚小型文书式标签：左侧 3px 宽角色色条 + 角色中文名。
 * 颜色仅出现在那条 3px 色条上（仅用于小面积标识，不铺满），
 * 文字保持中性的墨色，整体读起来像卷宗上的角色批注。
 *
 * 颜色通过 inline style 绑定到 --role-{role} 这一 CSS 变量，
 * 因此只要 tokens.css 已加载即可正确取色，不依赖 Tailwind。
 */

const ROLE_LABELS: Record<string, string> = {
  prosecutor: "公诉方",
  defense: "辩护方",
  defendant: "被告人",
  judge: "法官",
  legal_reviewer: "法律评议",
  social_reviewer: "社会评议",
  expert_reviewer: "专家评议",
  public_reviewer: "公众评议",
  foreperson: "首席评议",
  writer: "报告撰写",
};

export interface RoleBadgeProps {
  /** 角色标识，如 "prosecutor" / "legal_reviewer"（下划线写法）。 */
  role: string;
  /** 透传额外的类名，便于在外层做定位 / 间距调整。 */
  className?: string;
}

export function RoleBadge({ role, className }: RoleBadgeProps) {
  const label = ROLE_LABELS[role] ?? role;
  // 令牌里的角色变量用连字符（--role-legal-reviewer），prop 用下划线，做一次转换。
  const colorVar = `var(--role-${role.replace(/_/g, "-")})`;

  const wrapperStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    height: "24px",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border-default)",
    backgroundColor: "var(--bg-surface-alt)",
    overflow: "hidden",
    // 让色条与文字垂直撑满标签
    lineHeight: 1,
    verticalAlign: "middle",
  };

  const barStyle: CSSProperties = {
    flex: "0 0 auto",
    alignSelf: "stretch",
    width: "3px",
    backgroundColor: colorVar,
  };

  const labelStyle: CSSProperties = {
    padding: "0 8px",
    fontFamily: "var(--font-label)",
    fontSize: "var(--text-xs)",
    color: "var(--text-primary)",
    whiteSpace: "nowrap",
  };

  return (
    <span className={className} style={wrapperStyle} data-role={role}>
      <span aria-hidden="true" style={barStyle} />
      <span style={labelStyle}>{label}</span>
    </span>
  );
}

export default RoleBadge;
