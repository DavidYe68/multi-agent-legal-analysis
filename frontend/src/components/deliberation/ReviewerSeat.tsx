import { motion } from "framer-motion";

import RoleBadge from "../ui/RoleBadge";
import {
  positionLabel,
  reviewerColorVar,
  reviewerPersonality,
  reviewerTint,
} from "./reviewerMeta";

/**
 * ReviewerSeat · 评议者席位
 *
 * 固定 200px 宽的一席，自上而下：
 *   角色标签 → 人格倾向(一行) → 当前立场(角色色浅底标签) → 置信度(数字+3px 进度条)
 *   → 核心主张(最多 3 行截断) → 发言状态。
 *
 * 发言中：边框变为 2px 角色色；非发言（且有人正在发言）时整体降到 opacity 0.6。
 * 透明度切换走 framer-motion（opacity + 轻微 translateY），300ms / easeOut。
 */

export type SeatStatus = "speaking" | "waiting" | "done";

export interface SeatPositionChange {
  before: string;
  after: string;
  reason: string;
}

interface ReviewerSeatProps {
  agentId: string;
  /** 当前立场（随播放进度可能从一轮的立场更新为二轮的 position_after）。 */
  position: string;
  /** 置信度 0..1。 */
  confidence: number;
  /** 核心主张（来自第一轮 core_claim）。 */
  coreClaim: string;
  status: SeatStatus;
  /** 是否处于降透明（有他人发言时）。 */
  dimmed: boolean;
  /** 第二轮若发生立场变化则展示在席位下方。 */
  change?: SeatPositionChange | null;
  /** 暴露 DOM 节点供回应连线取端点。 */
  seatRef?: (el: HTMLDivElement | null) => void;
}

const STATUS_META: Record<
  SeatStatus,
  { label: string; dotClass: string; color: string }
> = {
  speaking: {
    label: "发言中",
    dotClass: "status-dot-pulse",
    color: "var(--status-running)",
  },
  waiting: { label: "等待", dotClass: "", color: "var(--status-pending)" },
  done: { label: "已发言", dotClass: "", color: "var(--status-done)" },
};

export default function ReviewerSeat({
  agentId,
  position,
  confidence,
  coreClaim,
  status,
  dimmed,
  change,
  seatRef,
}: ReviewerSeatProps) {
  const color = reviewerColorVar(agentId);
  const speaking = status === "speaking";
  const pct = Math.max(0, Math.min(100, Math.round((confidence ?? 0) * 100)));
  const statusMeta = STATUS_META[status];

  return (
    <motion.div
      ref={seatRef}
      className="box-border w-[200px] rounded bg-surface"
      style={{
        border: speaking
          ? `2px solid ${color}`
          : "1px solid var(--border-default)",
        padding: "var(--space-3)",
      }}
      animate={{ opacity: dimmed ? 0.6 : 1, y: speaking ? -2 : 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <RoleBadge role={agentId} />

      {/* 人格倾向 */}
      <p className="mt-2 font-label text-xs text-ink-caption">
        {reviewerPersonality(agentId)}
      </p>

      {/* 当前立场 */}
      <div className="mt-2 flex items-center gap-1.5">
        <span className="font-label text-xs text-ink-caption">立场</span>
        <span
          className="inline-flex items-center rounded-sm px-1.5 font-label text-xs"
          style={{ backgroundColor: reviewerTint(agentId), color: "var(--text-primary)" }}
        >
          {positionLabel(position)}
        </span>
      </div>

      {/* 置信度：数字 + 3px 进度条 */}
      <div className="mt-2">
        <div className="flex items-center justify-between">
          <span className="font-label text-xs text-ink-caption">置信度</span>
          <span className="font-mono text-xs text-ink-secondary">{pct}%</span>
        </div>
        <div
          className="mt-1 w-full overflow-hidden rounded-sm"
          style={{ height: "3px", backgroundColor: "var(--bg-surface-alt)" }}
        >
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              backgroundColor: color,
              transition: "width 300ms ease-out",
            }}
          />
        </div>
      </div>

      {/* 核心主张：最多 3 行截断 */}
      <p
        className="mt-2 font-body text-sm text-ink-secondary"
        style={{
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
        title={coreClaim}
      >
        {coreClaim || "—"}
      </p>

      {/* 发言状态 */}
      <div className="mt-2 flex items-center gap-1.5">
        <span
          className={statusMeta.dotClass}
          style={{
            display: "inline-block",
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            backgroundColor: statusMeta.color,
          }}
          aria-hidden="true"
        />
        <span className="font-label text-xs text-ink-caption">
          {statusMeta.label}
        </span>
      </div>

      {/* 立场变化（第二轮） */}
      {change && (
        <div
          className="mt-2 border-t pt-2"
          style={{ borderColor: "var(--border-default)" }}
        >
          <div className="flex items-center gap-1.5 font-label text-xs">
            <span className="text-ink-caption">{positionLabel(change.before)}</span>
            <span aria-hidden="true" className="text-ink-caption">
              →
            </span>
            <span style={{ color: "var(--relation-agree)" }}>
              {positionLabel(change.after)}
            </span>
          </div>
          {change.reason && (
            <p className="mt-1 font-body text-xs text-ink-caption">
              {change.reason}
            </p>
          )}
        </div>
      )}
    </motion.div>
  );
}
