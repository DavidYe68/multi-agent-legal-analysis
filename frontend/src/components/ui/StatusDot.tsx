import type { CSSProperties } from "react";

/**
 * StatusDot · 状态圆点
 *
 * 一个 8px 的小圆点，用颜色表示流程状态。
 *   done / running / error：用 --status-{status} 实心填充；
 *   pending（未开始）：透明填充 + 1px --status-pending 描边（空心），
 *     以此把「未开始」与已填充的其余状态在视觉语言上区分开。
 * 「running」状态做 opacity 0.4 → 1 → 0.4 的呼吸动画（1.5s，ease-in-out），
 * 动画定义在 global.css 的 .status-dot-pulse / @keyframes status-dot-pulse，
 * 并在 prefers-reduced-motion 下自动关闭。
 *
 * 刻意不使用 animate-pulse / animate-spin / animate-bounce —— 那是「AI 味」的标志。
 */

export type Status = "pending" | "running" | "done" | "error";

const STATUS_LABELS: Record<Status, string> = {
  pending: "待处理",
  running: "进行中",
  done: "已完成",
  error: "出错",
};

export interface StatusDotProps {
  status: Status;
  /** 直径，默认 8px。 */
  size?: number;
  /** 透传额外类名。 */
  className?: string;
  /**
   * 无障碍标签。默认取状态的中文名（颜色不是唯一的状态信号）。
   * 传入空串可显式关闭（仅当外部已另行标注状态时）。
   */
  label?: string;
}

export function StatusDot({ status, size = 8, className, label }: StatusDotProps) {
  const dotStyle: CSSProperties = {
    display: "inline-block",
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: "50%",
    boxSizing: "border-box",
    flex: "0 0 auto",
    // pending = 未开始：空心描边；其余状态实心填充。
    ...(status === "pending"
      ? {
          backgroundColor: "transparent",
          border: "1px solid var(--status-pending)",
        }
      : { backgroundColor: `var(--status-${status})` }),
  };

  const accessibleLabel = label ?? STATUS_LABELS[status];
  const dotClassName = [status === "running" ? "status-dot-pulse" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      className={dotClassName || undefined}
      style={dotStyle}
      data-status={status}
      role="img"
      aria-label={accessibleLabel || undefined}
      title={accessibleLabel || undefined}
    />
  );
}

export default StatusDot;
