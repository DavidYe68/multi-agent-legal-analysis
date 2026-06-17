import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";

import { firstRunCaseId } from "../services/caseService";

/**
 * AppShell · 应用外壳
 *
 * 最外层深色背景（--bg-shell）+ 顶部 48px 深色条，中间区域承载 children。
 * 没有侧边栏导航、没有 footer——页面内部各自处理布局。
 *
 * 顶栏：
 *   左侧——项目名称（衬线 display 字体，--text-lg，深色背景上的浅色文字）
 *   右侧——「演示模式」按钮 + 当前模式/数据来源标签（演示模式下隐藏后者这类开发信息）
 *
 * 演示模式（服务答辩）：
 *   - 进入全屏（document.documentElement.requestFullscreen）
 *   - 整体放大 10%
 *   - 隐藏顶栏里的开发信息标签
 *   - 自动导航到第一个已运行的案例
 *   - 退出全屏时自动关闭演示模式
 */

export type AppMode = "teaching" | "practice";
export type DataSource = "demo" | "live";

export interface AppShellProps {
  children: ReactNode;
  /** 当前模式，默认教学。后续任务可由具体页面/案件驱动。 */
  mode?: AppMode;
  /** 数据来源，默认演示（读本地 JSON）。 */
  dataSource?: DataSource;
}

const MODE_LABELS: Record<AppMode, string> = {
  teaching: "教学",
  practice: "实务",
};

const SOURCE_LABELS: Record<DataSource, string> = {
  demo: "演示",
  live: "实时",
};

/** 顶栏右侧的小标签：深色条上的浅色描边胶囊。 */
function TopBarTag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-sm border border-white/20 px-2 py-0.5 font-label text-xs text-ink-on-dark">
      {children}
    </span>
  );
}

/**
 * 整体放大用 zoom 实现，而非 html font-size。
 * 设计令牌（--text-* 等）都是绝对 px，改 font-size 不会让这些 px 字号变化；
 * zoom 才能对整个 px 体系等比放大，得到答辩所需的「全局放大 10%」效果。
 */
const DEMO_ZOOM = "1.1";

function setZoom(on: boolean) {
  const root = document.documentElement;
  if (on) root.style.setProperty("zoom", DEMO_ZOOM);
  else root.style.removeProperty("zoom");
}

export function AppShell({
  children,
  mode = "teaching",
  dataSource = "demo",
}: AppShellProps) {
  const navigate = useNavigate();
  const [demo, setDemo] = useState(false);
  // 演示是否仍开启的活性标志：enterDemo 在两次 await 后据此判断要不要跳转，
  // 避免「await 期间用户已退出（按 ESC / 点退出）」时仍强行导航的竞态。
  const demoActiveRef = useRef(false);

  /** 关闭演示模式的副作用（复位缩放、退出全屏）。可被按钮或 ESC 触发。 */
  const teardownDemo = useCallback(() => {
    demoActiveRef.current = false;
    setZoom(false);
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const enterDemo = useCallback(async () => {
    demoActiveRef.current = true;
    setDemo(true);
    setZoom(true);
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      // 浏览器拒绝全屏（无手势 / 不支持）时，放大与隐藏开发信息仍然生效。
    }
    const firstCase = await firstRunCaseId();
    // 仅当演示在整个异步过程中始终开启时才跳转。
    if (demoActiveRef.current && firstCase) navigate(`/case/${firstCase}`);
  }, [navigate]);

  const exitDemo = useCallback(() => {
    setDemo(false);
    teardownDemo();
  }, [teardownDemo]);

  // 退出全屏（含按 ESC）时自动关闭演示模式。
  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement) {
        demoActiveRef.current = false;
        setDemo(false);
        setZoom(false);
      }
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // 组件卸载时兜底复位缩放，避免遗留全局 zoom。
  useEffect(() => () => setZoom(false), []);

  return (
    <div className="min-h-screen bg-shell">
      <header className="flex h-12 items-center justify-between border-b border-white/10 px-6">
        <Link to="/" className="font-display text-lg text-ink-on-dark">
          多智能体法律协商系统
        </Link>
        <div className="flex items-center gap-2">
          {/* 演示模式下隐藏开发信息（模式 / 数据来源标签） */}
          {!demo && (
            <>
              <TopBarTag>{MODE_LABELS[mode]}</TopBarTag>
              <TopBarTag>{SOURCE_LABELS[dataSource]}</TopBarTag>
            </>
          )}
          <button
            type="button"
            onClick={demo ? exitDemo : enterDemo}
            aria-pressed={demo}
            className="inline-flex items-center rounded-sm border border-white/20 px-2 py-0.5 font-label text-xs text-ink-on-dark transition-colors hover:border-white/40"
          >
            {demo ? "退出演示" : "演示模式"}
          </button>
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
}

export default AppShell;
