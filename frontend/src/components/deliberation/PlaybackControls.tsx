import type { ReactNode } from "react";

/**
 * PlaybackControls · 评议发言播放控制条
 *
 * 固定在 Deliberation Room 底部（sticky）：
 *   [▶ 播放 / ⏸ 暂停] [◀ 上一步] [▶ 下一步] [⏩ 跳过]，右侧显示进度。
 */

interface PlaybackControlsProps {
  isPlaying: boolean;
  canPrev: boolean;
  canNext: boolean;
  /** 进度文本，如「第 1 轮 · 发言 2/4」。 */
  progressText: string;
  onPlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSkip: () => void;
}

function CtrlButton({
  onClick,
  disabled,
  emphasis,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  emphasis?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1 rounded-sm border px-3 py-1 font-label text-sm transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40"
      style={{
        borderColor: emphasis
          ? "var(--border-emphasis)"
          : "var(--border-default)",
        color: emphasis ? "var(--border-emphasis)" : "var(--text-secondary)",
        backgroundColor: "transparent",
      }}
      onMouseEnter={(e) => {
        if (!disabled)
          e.currentTarget.style.backgroundColor = "var(--bg-surface-alt)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      {children}
    </button>
  );
}

export default function PlaybackControls({
  isPlaying,
  canPrev,
  canNext,
  progressText,
  onPlayPause,
  onPrev,
  onNext,
  onSkip,
}: PlaybackControlsProps) {
  return (
    <div
      className="sticky bottom-0 z-20 flex items-center gap-2 border-t bg-surface px-4 py-2"
      style={{ borderColor: "var(--border-default)" }}
    >
      <CtrlButton onClick={onPlayPause} emphasis>
        <span aria-hidden="true">{isPlaying ? "⏸" : "▶"}</span>
        {isPlaying ? "暂停" : "播放"}
      </CtrlButton>
      <CtrlButton onClick={onPrev} disabled={!canPrev}>
        <span aria-hidden="true">◀</span>
        上一步
      </CtrlButton>
      <CtrlButton onClick={onNext} disabled={!canNext}>
        <span aria-hidden="true">▶</span>
        下一步
      </CtrlButton>
      <CtrlButton onClick={onSkip} disabled={!canNext}>
        <span aria-hidden="true">⏩</span>
        跳过
      </CtrlButton>

      <span className="ml-auto font-label text-xs text-ink-caption">
        {progressText}
      </span>
    </div>
  );
}
