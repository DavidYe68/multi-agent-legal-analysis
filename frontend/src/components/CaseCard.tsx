import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import type { CaseSummary } from "../types";

/**
 * CaseCard · 案例卡片
 *
 * 一张克制的文书式卡片：象牙白底、暖灰边框、4px 圆角，无阴影、无缩放。
 * hover 时仅边框转为次级文字色（200ms）。所有字段都来自 caseService.listCases()
 * 返回的 CaseSummary——不存在的字段不渲染，不虚构数据。
 *
 * 自上而下：
 *   1. 编号（mono caption）+ 案件类型标签
 *   2. 案例标题（衬线 display）
 *   3. 核心争点类型
 *   4. 横排小标签：难度 / 变体 / 数据集 / 运行状态
 *   5. 底部操作：已运行→「查看庭审分析」；未运行→灰色禁用「尚未运行」
 *
 * 对照组（有 pair_variant 的案例）右上角额外有一个「A/B」入口，跳到 /compare/:pairId。
 */

/** primary_issue_type 是模型用的英文枚举，这里映射成中文展示。 */
const ISSUE_TYPE_LABELS: Record<string, string> = {
  mens_rea: "主观明知",
  actus_reus: "客观行为",
  causation: "因果关系",
  evidence_admissibility: "证据可采性",
};

/** 难度英文 → 中文。 */
const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "简单",
  medium: "中等",
  hard: "困难",
};

/** 数据集划分 → 中文。 */
const SPLIT_LABELS: Record<string, string> = {
  dev: "开发集",
  test: "测试集",
};

/** 卡片内的小标签：暖灰描边、浅羊皮纸底、无图标。 */
function Chip({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-sm border border-border bg-surface-alt px-2 py-0.5 font-label text-xs text-ink-secondary ${className}`}
    >
      {children}
    </span>
  );
}

export interface CaseCardProps {
  caseSummary: CaseSummary;
}

export function CaseCard({ caseSummary: c }: CaseCardProps) {
  const issueType = ISSUE_TYPE_LABELS[c.primary_issue_type] ?? c.primary_issue_type;
  const difficulty = DIFFICULTY_LABELS[c.difficulty] ?? c.difficulty;
  const splitLabel = c.split ? SPLIT_LABELS[c.split] : null;

  // 对照组：有 variant 且有配对案件时，提供 A/B 对照入口。
  const isPaired = Boolean(c.pair_variant && c.paired_case_id);
  // 配对基名：去掉末尾的变体字母（criminal_001a → criminal_001）。
  const pairId = c.case_id.replace(/[ab]$/i, "");

  return (
    <div className="relative flex flex-col rounded-md border border-border bg-surface p-6 transition-colors duration-200 hover:border-ink-secondary">
      {isPaired && (
        <Link
          to={`/compare/${pairId}`}
          title="查看 A/B 对照"
          className="absolute right-3 top-3 rounded-sm border border-border px-1.5 py-0.5 font-label text-xs text-ink-secondary transition-colors duration-200 hover:border-ink-secondary hover:text-ink"
        >
          A/B
        </Link>
      )}

      {/* 1. 编号 + 类型 */}
      <div className="flex flex-wrap items-center gap-2 pr-12">
        <span className="font-mono text-xs text-ink-caption">{c.case_id}</span>
        {c.case_category && <Chip>{c.case_category}</Chip>}
      </div>

      {/* 2. 标题 */}
      <h3 className="mt-3 font-display text-lg font-bold text-ink">{c.title}</h3>

      {/* 3. 核心争点类型 */}
      {issueType && <p className="mt-1 text-sm text-ink-secondary">{issueType}</p>}

      {/* 4. 横排小标签 */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {difficulty && <Chip>{difficulty}</Chip>}
        {c.pair_variant && <Chip>变体 {c.pair_variant}</Chip>}
        {splitLabel && <Chip>{splitLabel}</Chip>}
        <Chip className={c.has_output ? "text-ink" : "text-ink-caption"}>
          {c.has_output ? "已运行" : "未运行"}
        </Chip>
      </div>

      {/* 5. 底部操作 */}
      <div className="mt-auto pt-6">
        {c.has_output ? (
          <Link
            to={`/case/${c.case_id}`}
            className="inline-flex items-center rounded-sm bg-shell px-4 py-2 font-label text-sm text-ink-on-dark transition-opacity duration-200 hover:opacity-90"
          >
            查看庭审分析
          </Link>
        ) : (
          <span className="inline-flex cursor-not-allowed items-center rounded-sm border border-border bg-surface-alt px-4 py-2 font-label text-sm text-ink-caption">
            尚未运行
          </span>
        )}
      </div>
    </div>
  );
}

export default CaseCard;
