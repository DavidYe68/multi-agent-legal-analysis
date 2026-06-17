import type { TimelineEvent } from "../../types";

/**
 * Timeline · 克制时间线（竖线 + 小圆点）
 *
 * 从卷宗栏「案件摘要」抽出的纯展示组件，供卷宗栏与最终报告页共用：
 *   - 左侧 2px 暖灰竖线（--border-default）贯穿整列；
 *   - 每个事件一枚 6px 圆点，填充深色 shell（--bg-shell）盖住竖线；
 *   - 时间标签（caption）+ 事件内容（secondary）。
 *
 * 不引入彩色渐变、不加阴影——与设计系统的克制气质一致。
 */

interface TimelineProps {
  events: TimelineEvent[];
}

export default function Timeline({ events }: TimelineProps) {
  if (events.length === 0) return null;

  return (
    <ol className="relative">
      {/* 竖线：2px 宽、暖灰色，贯穿整列 */}
      <span
        aria-hidden="true"
        className="absolute bottom-1 left-0.5 top-1 w-0.5"
        style={{ backgroundColor: "var(--border-default)" }}
      />
      {events.map((ev) => (
        <li key={ev.event_id} className="relative pb-3 pl-5 last:pb-0">
          {/* 圆点：6px、填充深色 shell，盖住竖线 */}
          <span
            aria-hidden="true"
            className="absolute left-0 top-[7px] h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: "var(--bg-shell)" }}
          />
          <div className="font-label text-xs text-ink-caption">
            {ev.time_label}
          </div>
          <div className="text-sm text-ink-secondary">{ev.content}</div>
        </li>
      ))}
    </ol>
  );
}
