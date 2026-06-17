import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Bar, BarChart, LabelList, XAxis, YAxis } from "recharts";

import StatusDot from "../components/ui/StatusDot";
import { listCases } from "../services/caseService";
import type { CaseSummary } from "../types";

/**
 * DatasetPage · 数据集概览（/dataset）
 *
 * 一个简洁的展示页，服务答辩。三段：
 *   1. 统计数字横排——案例 / A·B 组 / 类别 / 开发 / 测试，· 分隔，无图标卡片、无圆形数字。
 *   2. 数据处理流程图——纯 HTML/CSS，节点样式复用 PipelineHeader（小圆点 + 连线 + 名称）。
 *   3. 案件类型分布——Recharts 水平条形图，配色取自 --bg-shell / --border-emphasis，
 *      无渐变、无 3D、无圆角条。
 *
 * 所有数字与分布均由 caseService.listCases() 派生，不硬编码。
 */

/* ===========================================================================
 * CSS 令牌取值
 *
 * Recharts 渲染到 SVG，fill/stroke 作为「表现属性」不解析 var()，
 * 因此这里用 getComputedStyle 把令牌解析成具体色值再交给图表——
 * 取值仍来自 tokens.css 这一唯一真源，不在组件里硬编码十六进制。
 * ======================================================================== */

interface TokenColors {
  shell: string;
  emphasis: string;
  border: string;
  text: string;
  caption: string;
}

function readToken(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function useTokenColors(): TokenColors {
  const [colors, setColors] = useState<TokenColors>({
    shell: "#1b2838",
    emphasis: "#8b7355",
    border: "#d6cfc5",
    text: "#5c5c5c",
    caption: "#8c8c8c",
  });
  useEffect(() => {
    setColors({
      shell: readToken("--bg-shell", "#1b2838"),
      emphasis: readToken("--border-emphasis", "#8b7355"),
      border: readToken("--border-default", "#d6cfc5"),
      text: readToken("--text-secondary", "#5c5c5c"),
      caption: readToken("--text-caption", "#8c8c8c"),
    });
  }, []);
  return colors;
}

/* ===========================================================================
 * 测量容器宽度（避免 ResponsiveContainer 在隐藏标签页里量到 0 而不渲染）
 * ======================================================================== */

function useElementWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/* ===========================================================================
 * 统计派生
 * ======================================================================== */

interface DatasetStats {
  total: number;
  pairs: number;
  categories: number;
  dev: number;
  test: number;
}

interface CategoryCount {
  name: string;
  count: number;
}

function deriveStats(cases: CaseSummary[]): DatasetStats {
  const pairBases = new Set<string>();
  for (const c of cases) {
    if (c.pair_variant && c.paired_case_id) {
      pairBases.add(c.case_id.replace(/[ab]$/i, ""));
    }
  }
  const categories = new Set(cases.map((c) => c.case_category).filter(Boolean));
  return {
    total: cases.length,
    pairs: pairBases.size,
    categories: categories.size,
    dev: cases.filter((c) => c.split === "dev").length,
    test: cases.filter((c) => c.split === "test").length,
  };
}

function deriveCategoryCounts(cases: CaseSummary[]): CategoryCount[] {
  const counts = new Map<string, number>();
  for (const c of cases) {
    if (!c.case_category) continue;
    counts.set(c.case_category, (counts.get(c.case_category) ?? 0) + 1);
  }
  return Array.from(counts, ([name, count]) => ({ name, count })).sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  );
}

/* ===========================================================================
 * 数据处理流程图
 *
 * 节点样式与 PipelineHeader 一致：StatusDot（此处统一为 done） + 名称，
 * 节点之间以 1px 横线相连。
 * ======================================================================== */

const PIPELINE_STEPS = [
  "材料整理",
  "匿名化",
  "事实/主张/证据分离",
  "编号",
  "Gold 标注",
  "A/B 构造",
  "泄漏检查",
  "划分",
];

function PipelineDiagram() {
  return (
    <nav aria-label="数据处理流程" className="flex flex-wrap items-center gap-y-3">
      {PIPELINE_STEPS.map((step, i) => (
        <Fragment key={step}>
          {i > 0 && (
            <span
              aria-hidden="true"
              className="mx-2 h-px w-6 shrink-0 bg-border"
            />
          )}
          <div className="flex shrink-0 items-center gap-1.5">
            <StatusDot status="done" label={`${step}（已完成）`} />
            <span className="whitespace-nowrap font-label text-sm text-ink-secondary">
              {step}
            </span>
          </div>
        </Fragment>
      ))}
    </nav>
  );
}

/* ===========================================================================
 * 统计数字横排
 * ======================================================================== */

function StatItem({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span
        className="font-display tabular-nums text-ink"
        style={{ fontSize: "var(--text-2xl)" }}
      >
        {value}
      </span>
      <span className="font-label text-sm text-ink-secondary">{label}</span>
    </div>
  );
}

function StatsRow({ stats }: { stats: DatasetStats }) {
  const items: { value: number; label: string }[] = [
    { value: stats.total, label: "案例" },
    { value: stats.pairs, label: "组 A/B" },
    { value: stats.categories, label: "类争点" },
    { value: stats.dev, label: "开发" },
    { value: stats.test, label: "测试" },
  ];
  return (
    <div className="flex flex-wrap items-baseline gap-x-5 gap-y-3">
      {items.map((it, i) => (
        <Fragment key={it.label}>
          {i > 0 && (
            <span aria-hidden="true" className="font-display text-lg text-ink-caption">
              ·
            </span>
          )}
          <StatItem value={it.value} label={it.label} />
        </Fragment>
      ))}
    </div>
  );
}

/* ===========================================================================
 * 案件类型分布（Recharts 水平条形图）
 * ======================================================================== */

function CategoryChart({ data }: { data: CategoryCount[] }) {
  const colors = useTokenColors();
  const [ref, measured] = useElementWidth<HTMLDivElement>();
  // 隐藏标签页里 measured 可能为 0，回退到一个合理默认宽度，保证条形图始终渲染。
  const width = measured || 680;
  const rowHeight = 40;
  const height = data.length * rowHeight + 24;
  const maxCount = Math.max(1, ...data.map((d) => d.count));

  return (
    <div ref={ref} className="w-full">
      {width > 0 && (
        <BarChart
          width={width}
          height={height}
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 32, bottom: 4, left: 8 }}
          barCategoryGap={12}
        >
          <XAxis
            type="number"
            domain={[0, maxCount]}
            allowDecimals={false}
            hide
          />
          <YAxis
            type="category"
            dataKey="name"
            width={132}
            tickLine={false}
            // 轴线用黄铜强调色（--border-emphasis）：与条形的 --bg-shell 一起，
            // 落实规格「配色用 --bg-shell 和 --border-emphasis」。
            axisLine={{ stroke: colors.emphasis }}
            tick={{ fill: colors.text, fontSize: 13 }}
          />
          {/* isAnimationActive 关闭：避免隐藏标签页里动画测量异常，也更克制 */}
          <Bar
            dataKey="count"
            fill={colors.shell}
            isAnimationActive={false}
            maxBarSize={18}
          >
            <LabelList
              dataKey="count"
              position="right"
              fill={colors.caption}
              style={{ fontSize: 12 }}
            />
          </Bar>
        </BarChart>
      )}
    </div>
  );
}

/* ===========================================================================
 * 卡片容器
 * ======================================================================== */

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel" style={{ padding: "var(--space-8)" }}>
      <h2 className="font-display text-lg text-ink">{title}</h2>
      <div style={{ marginTop: "var(--space-6)" }}>{children}</div>
    </section>
  );
}

/* ===========================================================================
 * 页面
 * ======================================================================== */

export default function DatasetPage() {
  const [cases, setCases] = useState<CaseSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listCases()
      .then((list) => {
        if (alive) setCases(list);
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      alive = false;
    };
  }, []);

  const stats = useMemo(() => (cases ? deriveStats(cases) : null), [cases]);
  const categoryCounts = useMemo(
    () => (cases ? deriveCategoryCounts(cases) : []),
    [cases],
  );

  return (
    <div className="min-h-[calc(100vh-48px)] bg-surface">
      <div
        className="mx-auto max-w-[1000px] px-8 pb-12"
        style={{ paddingTop: "var(--space-12)" }}
      >
        {/* 题首 */}
        <header>
          <h1 className="font-display text-3xl text-ink">数据集概览</h1>
          <p className="mt-2 font-body text-base text-ink-secondary">
            争点中心的对抗—协商式法律推理 · 最小对照组数据集
          </p>
        </header>

        {error ? (
          <p className="mt-8 font-label text-sm text-ink-secondary">
            数据载入失败：{error}
          </p>
        ) : !cases || !stats ? (
          <p className="mt-8 font-label text-sm text-ink-secondary">正在载入数据集…</p>
        ) : (
          <div className="mt-8 flex flex-col gap-6">
            {/* 1. 统计数字 */}
            <div style={{ paddingBottom: "var(--space-2)" }}>
              <StatsRow stats={stats} />
            </div>

            {/* 2. 数据处理流程图 */}
            <Card title="数据处理流程">
              <PipelineDiagram />
            </Card>

            {/* 3. 案件类型分布 */}
            <Card title="案件类型分布">
              {categoryCounts.length === 0 ? (
                <p className="font-label text-sm text-ink-caption">暂无分布数据。</p>
              ) : (
                <CategoryChart data={categoryCounts} />
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
