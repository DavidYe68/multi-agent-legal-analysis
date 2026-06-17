import type { ReactNode } from "react";

/**
 * PagePlaceholder · 页面占位骨架
 *
 * 仅用于本阶段：每个路由页面渲染一块象牙白面板，标注页面名称与路由参数，
 * 证明路由与外壳已经跑通。后续任务会用真正的业务 UI 替换。
 */
export interface PagePlaceholderProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}

export function PagePlaceholder({
  title,
  subtitle,
  children,
}: PagePlaceholderProps) {
  return (
    <div className="p-8">
      <div className="panel mx-auto max-w-3xl p-8">
        <h1 className="font-display text-2xl text-ink">{title}</h1>
        {subtitle && (
          <p className="mt-2 font-mono text-sm text-ink-secondary">{subtitle}</p>
        )}
        {children && <div className="mt-6">{children}</div>}
      </div>
    </div>
  );
}

export default PagePlaceholder;
