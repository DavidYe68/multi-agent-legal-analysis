import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

/**
 * CollapsibleSection · 折叠区域
 *
 * 刻意不使用任何 Accordion 组件、不使用 chevron 图标：
 * 标题行左侧只是一个 ▸ / ▾ 符号，展开/收起通过 max-height 的 300ms 过渡完成。
 *
 * max-height 取内容的真实高度（用 ResizeObserver 跟踪），
 * 因此内容动态变化（如证据展开）时不会被裁剪，过渡也保持平滑。
 */

export interface CollapsibleSectionProps {
  title: string;
  /** 标题右侧的数量角标（如事实 / 证据条数）；不传则不显示。 */
  count?: number;
  /** 默认是否展开，默认 true。 */
  defaultOpen?: boolean;
  children: ReactNode;
}

export default function CollapsibleSection({
  title,
  count,
  defaultOpen = true,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const innerRef = useRef<HTMLDivElement>(null);
  // 内容真实高度；首帧为 undefined（不约束高度，避免初始裁剪）。
  const [contentHeight, setContentHeight] = useState<number | undefined>(
    undefined,
  );

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const measure = () => setContentHeight(el.scrollHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 收起时把内容标记为 inert：max-height:0 只在视觉上裁剪，内部按钮仍会被
  // Tab 聚焦、被屏幕阅读器朗读；inert 让折叠区域真正退出焦点序列与无障碍树。
  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    if (open) el.removeAttribute("inert");
    else el.setAttribute("inert", "");
  }, [open]);

  return (
    <section className="border-b border-border">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors duration-200 hover:bg-surface-alt"
      >
        <span
          aria-hidden="true"
          className="w-3 select-none text-center font-mono text-xs text-ink-caption"
        >
          {open ? "▾" : "▸"}
        </span>
        <span className="font-display text-base text-ink">{title}</span>
        {typeof count === "number" && (
          <span className="ml-1 rounded-sm border border-border bg-surface-alt px-1.5 font-label text-xs leading-normal text-ink-secondary">
            {count}
          </span>
        )}
      </button>

      <div
        style={{
          maxHeight: open ? contentHeight : 0,
          overflow: "hidden",
          transition: "max-height 300ms ease",
        }}
      >
        <div ref={innerRef} className="px-4 pb-4">
          {children}
        </div>
      </div>
    </section>
  );
}
