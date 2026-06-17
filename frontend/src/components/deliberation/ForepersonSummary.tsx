import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import type { ForepersonSummary as ForepersonSummaryData, VoteTally } from "../../types";
import { positionLabel, positionVoteColor } from "./reviewerMeta";

/**
 * ForepersonSummary · 首席评议总结
 *
 * 坐落在评议室（Deliberation Room）下方，视觉语言是「从讨论收束为纪要」：
 * 以黄金色（--role-foreperson）描边的框，与法官席的黄铜框互为呼应——两块「权威收束」区。
 *
 * 自上而下（区块间以 1px 横线分隔，呼应纪要的分条）：
 *   ┌ 标题：首席评议总结
 *   ├ 三列：多数意见 / 少数意见 / 分歧与保留（grid 1fr 1fr 1fr）
 *   ├ 共识要点（有序列表，不用 bullet）
 *   ├ 证据缺口摘要（bullet）
 *   └ 评议说明（final_deliberation_note 正文）
 *
 * 注意数据语义：foreperson_summary.majority_view / minority_view 是「立场枚举」
 * （not_guilty / guilty / …），不是长文本；长文本在 final_deliberation_note 里。
 * 因此两列以立场标签 + 票数呈现，正文留给底部「评议说明」。
 */

interface ForepersonSummaryProps {
  summary: ForepersonSummaryData;
  /** 若提供，则在底部渲染「查看最终报告」入口（写作 Agent 产物存在时）。 */
  reportTo?: string;
}

function tallyTotal(tally: VoteTally): number {
  return Object.values(tally).reduce((s, n) => s + n, 0);
}

/** 一列：左侧 3px 色条 + 标题 + 内容。 */
function Column({
  accent,
  title,
  children,
}: {
  accent: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div
      className="bg-surface-alt"
      style={{
        borderLeft: `3px solid ${accent}`,
        paddingLeft: "var(--space-4)",
        paddingTop: "var(--space-3)",
        paddingBottom: "var(--space-3)",
        paddingRight: "var(--space-3)",
      }}
    >
      <h4 className="mb-2 font-label text-xs text-ink-caption">{title}</h4>
      {children}
    </div>
  );
}

/** 立场标签（衬线大字）+ 票数说明，多数 / 少数意见两列共用。 */
function PositionVerdict({
  position,
  tally,
}: {
  position: string;
  tally: VoteTally;
}) {
  const total = tallyTotal(tally);
  const count = tally[position] ?? 0;
  return (
    <div>
      <div
        className="font-display"
        style={{ fontSize: "var(--text-lg)", color: positionVoteColor(position) }}
      >
        {positionLabel(position)}
      </div>
      {total > 0 && (
        <p className="mt-0.5 font-label text-xs text-ink-caption">
          第二轮 {count}/{total} 票
        </p>
      )}
    </div>
  );
}

/** 第三列内的小分组：标签 + bullet 列表（点的颜色随主题）。 */
function PointGroup({
  label,
  items,
  dot,
}: {
  label: string;
  items: string[];
  dot: string;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <h5 className="font-label text-xs text-ink-caption">{label}</h5>
      <ul className="mt-1 flex flex-col gap-1">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2">
            <span
              aria-hidden="true"
              className="mt-[9px] h-[5px] w-[5px] shrink-0 rounded-full"
              style={{ backgroundColor: dot }}
            />
            <span className="font-body text-sm text-ink-secondary">{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 主体区块：上方 1px 分隔线 + 小标题 + 内容（呼应纪要分条）。 */
function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div
      style={{
        marginTop: "var(--space-6)",
        paddingTop: "var(--space-6)",
        borderTop: "1px solid var(--border-default)",
      }}
    >
      <h4 className="mb-2 font-label text-xs text-ink-caption">{title}</h4>
      {children}
    </div>
  );
}

export default function ForepersonSummary({
  summary,
  reportTo,
}: ForepersonSummaryProps) {
  const round2 = summary.vote_summary?.round2 ?? {};
  const hasMinority = Boolean(summary.minority_view?.trim());
  const disagreements = summary.disagreement_points ?? [];
  const reserved = summary.reserved_points ?? [];
  const consensus = summary.consensus_points ?? [];
  const gaps = summary.evidence_gap_summary ?? [];

  return (
    <section
      // 与上方评议室以 --space-12 分隔；金色描边框，与法官席的黄铜框互为呼应。
      className="overflow-hidden rounded bg-surface"
      style={{
        marginTop: "var(--space-12)",
        marginLeft: "var(--space-6)",
        marginRight: "var(--space-6)",
        marginBottom: "var(--space-12)",
        border: "1px solid var(--border-default)",
      }}
      aria-label="首席评议总结"
    >
      {/* 顶部 3px 金色条，标志「这是收束后的纪要」。 */}
      <span
        aria-hidden="true"
        className="block h-[3px] w-full"
        style={{ backgroundColor: "var(--role-foreperson)" }}
      />

      <div style={{ padding: "var(--space-8)" }}>
        {/* ── 标题 ── */}
        <div className="flex items-baseline gap-3">
          <h3
            className="font-display"
            style={{ fontSize: "var(--text-xl)", color: "var(--role-foreperson)" }}
          >
            首席评议总结
          </h3>
          <span className="font-label text-xs text-ink-caption">
            评议意见收束为纪要
          </span>
        </div>

        {/* ── 三列：多数意见 / 少数意见 / 分歧与保留 ── */}
        <div
          className="grid grid-cols-1 gap-4 md:grid-cols-3"
          style={{
            marginTop: "var(--space-6)",
            paddingTop: "var(--space-6)",
            borderTop: "1px solid var(--border-default)",
          }}
        >
          <Column accent="var(--role-judge)" title="多数意见">
            <PositionVerdict position={summary.majority_view} tally={round2} />
          </Column>

          <Column accent="var(--text-secondary)" title="少数意见">
            {hasMinority ? (
              <PositionVerdict position={summary.minority_view} tally={round2} />
            ) : (
              <p className="font-body text-sm text-ink-caption">
                全体一致 · 无少数意见
              </p>
            )}
          </Column>

          <Column accent="var(--relation-disagree)" title="分歧与保留">
            {disagreements.length === 0 && reserved.length === 0 ? (
              <p className="font-body text-sm text-ink-caption">
                无分歧 · 无保留意见
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                <PointGroup
                  label="分歧点"
                  items={disagreements}
                  dot="var(--relation-disagree)"
                />
                <PointGroup
                  label="保留问题"
                  items={reserved}
                  dot="var(--text-caption)"
                />
              </div>
            )}
          </Column>
        </div>

        {/* ── 共识要点（有序列表，不用 bullet）── */}
        <Block title="共识要点">
          {consensus.length === 0 ? (
            <p className="font-body text-sm text-ink-caption">—</p>
          ) : (
            <ol className="flex flex-col gap-1.5">
              {consensus.map((c, i) => (
                <li key={i} className="flex gap-2.5">
                  <span
                    aria-hidden="true"
                    className="shrink-0 font-mono text-sm tabular-nums"
                    style={{ color: "var(--role-foreperson)" }}
                  >
                    {i + 1}.
                  </span>
                  <span className="font-body text-base text-ink">{c}</span>
                </li>
              ))}
            </ol>
          )}
        </Block>

        {/* ── 证据缺口摘要（bullet）── */}
        <Block title="证据缺口摘要">
          {gaps.length === 0 ? (
            <p className="font-body text-sm text-ink-caption">—</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {gaps.map((g, i) => (
                <li key={i} className="flex gap-2">
                  <span
                    aria-hidden="true"
                    className="mt-[9px] h-[5px] w-[5px] shrink-0 rounded-full"
                    style={{ backgroundColor: "var(--relation-disagree)" }}
                  />
                  <span className="font-body text-sm text-ink-secondary">{g}</span>
                </li>
              ))}
            </ul>
          )}
        </Block>

        {/* ── 评议说明（final_deliberation_note 正文）── */}
        {summary.final_deliberation_note?.trim() && (
          <Block title="评议说明">
            <div
              className="bg-surface-alt"
              style={{
                borderLeft: "3px solid var(--role-foreperson)",
                padding: "var(--space-4)",
              }}
            >
              <p className="font-body text-base text-ink">
                {summary.final_deliberation_note}
              </p>
            </div>
          </Block>
        )}

        {/* ── 查看最终报告 ── */}
        {reportTo && (
          <div
            className="flex justify-center"
            style={{ marginTop: "var(--space-8)" }}
          >
            <Link
              to={reportTo}
              className="inline-flex items-center gap-2 rounded border px-6 py-2 font-label text-sm transition-colors duration-150"
              style={{
                borderColor: "var(--role-foreperson)",
                color: "var(--role-foreperson)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor =
                  "color-mix(in srgb, var(--role-foreperson) 10%, transparent)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              查看最终报告
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
