import { Fragment, useEffect, useMemo, useState } from "react";

import CaseCard from "../components/CaseCard";
import { listCases } from "../services/caseService";
import type { CaseSummary, TaskMode } from "../types";

/**
 * HomePage · 案件选择
 *
 * 自上而下：
 *   1. 标题区——深色 shell 上的衬线主标题 + 四个能力标签（→ 连接），不套白卡片。
 *   2. 操作条——48px 象牙白条：左侧教学/实务模式切换，右侧案件类型/变体/数据集筛选。
 *   3. 案例网格——3 列，每张卡片由 CaseCard 渲染。
 *
 * 数据全部来自 caseService.listCases()。
 */

/** 系统能力标签，横排以 → 连接（无图标、无 emoji）。 */
const CAPABILITIES = ["事实结构化", "双边对抗", "法官收束", "多视角协商"];

/** 左侧模式切换。 */
const MODE_TABS: { value: TaskMode; label: string }[] = [
  { value: "teaching", label: "教学模式" },
  { value: "practice", label: "实务模式" },
];

type VariantFilter = "all" | "A" | "B";
type SplitFilter = "all" | "dev" | "test";

interface SegOption<T extends string> {
  value: T;
  label: string;
}

/** 右侧筛选用的分段切换：原生 <button>，无组件库。 */
function SegFilter<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: SegOption<T>[];
  onChange: (next: T) => void;
}) {
  return (
    <div className="flex items-center gap-2 font-label text-xs text-ink-secondary">
      <span>{label}</span>
      <div className="flex items-center overflow-hidden rounded-sm border border-border">
        {options.map((opt, i) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(opt.value)}
              className={[
                i > 0 ? "border-l border-border" : "",
                "px-2 py-1 text-xs transition-colors duration-200",
                active
                  ? "bg-surface-alt text-ink"
                  : "bg-surface text-ink-secondary hover:text-ink",
              ].join(" ")}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function HomePage() {
  const [cases, setCases] = useState<CaseSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<TaskMode>("teaching");
  const [category, setCategory] = useState<string>("all");
  const [variant, setVariant] = useState<VariantFilter>("all");
  const [split, setSplit] = useState<SplitFilter>("all");

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

  /** 当前模式下的案件（其余筛选的基集，也是类型下拉的取值来源）。 */
  const modeCases = useMemo(
    () => (cases ?? []).filter((c) => mode === "teaching" || c.has_practice),
    [cases, mode],
  );

  const categories = useMemo(() => {
    const set = new Set<string>();
    modeCases.forEach((c) => c.case_category && set.add(c.case_category));
    return Array.from(set);
  }, [modeCases]);

  const visible = useMemo(
    () =>
      modeCases.filter(
        (c) =>
          (category === "all" || c.case_category === category) &&
          (variant === "all" || c.pair_variant === variant) &&
          (split === "all" || c.split === split),
      ),
    [modeCases, category, variant, split],
  );

  /** 切模式时重置其余筛选，避免残留无意义的选择。 */
  function changeMode(next: TaskMode) {
    setMode(next);
    setCategory("all");
    setVariant("all");
    setSplit("all");
  }

  return (
    <div>
      {/* 1. 标题区 */}
      <section className="bg-shell px-8 pb-6 pt-8">
        <h1 className="font-display text-2xl text-ink-on-dark">
          ICAD · 争点中心的对抗—协商式法律推理
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {CAPABILITIES.map((cap, i) => (
            <Fragment key={cap}>
              {i > 0 && (
                <span aria-hidden="true" className="text-sm text-white/40">
                  →
                </span>
              )}
              <span className="rounded-sm border border-white/20 px-2 py-0.5 text-sm text-ink-on-dark">
                {cap}
              </span>
            </Fragment>
          ))}
        </div>
      </section>

      {/* 2. 操作条 */}
      <div className="flex h-12 items-center justify-between gap-4 border-b border-border bg-surface px-8">
        {/* 左：模式切换 */}
        <div className="flex items-center gap-1">
          {MODE_TABS.map((t) => {
            const active = mode === t.value;
            return (
              <button
                key={t.value}
                type="button"
                aria-pressed={active}
                onClick={() => changeMode(t.value)}
                className={[
                  "rounded-sm px-3 py-1 font-label text-sm transition-colors duration-200",
                  active
                    ? "bg-shell text-ink-on-dark"
                    : "bg-transparent text-ink-secondary hover:text-ink",
                ].join(" ")}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* 右：筛选 */}
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 font-label text-xs text-ink-secondary">
            <span>案件类型</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-sm border border-border bg-surface px-2 py-1 font-label text-sm text-ink"
            >
              <option value="all">全部</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </label>

          <SegFilter<VariantFilter>
            label="变体"
            value={variant}
            onChange={setVariant}
            options={[
              { value: "all", label: "全部" },
              { value: "A", label: "A" },
              { value: "B", label: "B" },
            ]}
          />

          <SegFilter<SplitFilter>
            label="数据集"
            value={split}
            onChange={setSplit}
            options={[
              { value: "all", label: "全部" },
              { value: "dev", label: "开发集" },
              { value: "test", label: "测试集" },
            ]}
          />
        </div>
      </div>

      {/* 3. 案例网格 */}
      <div className="p-8">
        {error ? (
          <p className="font-label text-sm text-ink-secondary">
            案件载入失败：{error}
          </p>
        ) : cases === null ? (
          <p className="font-label text-sm text-ink-secondary">正在载入案件…</p>
        ) : visible.length === 0 ? (
          <p className="font-label text-sm text-ink-secondary">
            没有符合当前筛选条件的案例。
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {visible.map((c) => (
              <CaseCard key={c.case_id} caseSummary={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
