import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import { roleTint } from "./issueMeta";

/**
 * EvidenceRefChip · 证据引用小标签（控辩席 / 中央列共用）
 *
 * 三种形态：
 *   - prosecutor / defense：角色色 10% 透明度铺底，证据号用角色色，用于控辩席引用列表；
 *   - neutral：暖灰底，用于中央列「相关证据」。
 *
 * 争议证据（同一证据被控辩双方同时引用）会：
 *   - 在证据号上加 --relation-disagree 色的虚线下划线、鼠标变 help；
 *   - hover 时弹出手写 tooltip（不依赖 Radix / Tippy），展示双方对该证据的不同解释。
 *
 * 点击标签 → 联动左侧卷宗高亮（由父组件通过 onClick 调 selectEvidence 实现）。
 * innerRef 把按钮 DOM 暴露给父组件，作为证据引用连线的端点。
 */

type Side = "prosecutor" | "defense" | "neutral";

export interface EvidenceRefChipProps {
  evidenceId: string;
  side: Side;
  /** 是否为争议证据（控辩同时引用）。 */
  conflict?: boolean;
  /** 是否与左侧卷宗当前选中的证据一致（联动高亮）。 */
  active?: boolean;
  /** 原生 title（通常填证据正文摘要），非争议证据也能看到内容。 */
  title?: string;
  /** 争议证据的手写 tooltip 内容；仅 conflict 时使用。 */
  tooltip?: ReactNode;
  /** tooltip 贴靠方向：左列贴左、右列贴右，避免溢出。 */
  tooltipAlign?: "left" | "right";
  onClick?: () => void;
  /** hover 变化回调，供父组件联动证据引用连线的强调。 */
  onHoverChange?: (hovered: boolean) => void;
  /** 暴露按钮 DOM，作为连线端点。 */
  innerRef?: (el: HTMLButtonElement | null) => void;
}

const SIDE_BG: Record<Side, string> = {
  prosecutor: roleTint("prosecutor"),
  defense: roleTint("defense"),
  neutral: "var(--bg-surface-alt)",
};

const SIDE_FG: Record<Side, string> = {
  prosecutor: "var(--role-prosecutor)",
  defense: "var(--role-defense)",
  neutral: "var(--text-secondary)",
};

const SIDE_BORDER: Record<Side, string> = {
  prosecutor: roleTint("prosecutor", 28),
  defense: roleTint("defense", 28),
  neutral: "var(--border-default)",
};

export default function EvidenceRefChip({
  evidenceId,
  side,
  conflict = false,
  active = false,
  title,
  tooltip,
  tooltipAlign = "left",
  onClick,
  onHoverChange,
  innerRef,
}: EvidenceRefChipProps) {
  const [hovered, setHovered] = useState(false);

  const setHover = (next: boolean) => {
    setHovered(next);
    onHoverChange?.(next);
  };

  const chipStyle: CSSProperties = {
    backgroundColor: SIDE_BG[side],
    border: `1px solid ${active ? "var(--border-emphasis)" : SIDE_BORDER[side]}`,
    color: SIDE_FG[side],
    cursor: conflict ? "help" : "pointer",
  };

  // 争议证据：证据号加虚线下划线（--relation-disagree）。
  const labelStyle: CSSProperties = conflict
    ? {
        textDecorationLine: "underline",
        textDecorationStyle: "dashed",
        textDecorationColor: "var(--relation-disagree)",
        textUnderlineOffset: "3px",
      }
    : {};

  const showTooltip = conflict && tooltip != null && hovered;

  return (
    <span className="relative inline-flex">
      <button
        ref={innerRef}
        type="button"
        title={title}
        aria-label={`证据 ${evidenceId}`}
        onClick={onClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        style={chipStyle}
        className="inline-flex items-center rounded-sm px-1.5 font-mono text-xs leading-normal transition-colors duration-150"
      >
        <span style={labelStyle}>{evidenceId}</span>
      </button>

      {showTooltip && (
        <div
          role="tooltip"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            [tooltipAlign]: 0,
            zIndex: 50,
            maxWidth: "320px",
            width: "max-content",
            backgroundColor: "var(--bg-elevated)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-4)",
            fontSize: "var(--text-sm)",
            lineHeight: "var(--leading-base)",
            color: "var(--text-primary)",
          }}
        >
          {tooltip}
        </div>
      )}
    </span>
  );
}
