import { useMemo } from "react";

import type { VoteHistory, VoteTally } from "../../types";
import { positionLabel, positionVoteColor } from "./reviewerMeta";

/**
 * VotePanel · 投票结果
 *
 * 从 deliberation_room.vote_history 读取两轮票数，各画一条水平堆叠条（flexbox 按比例分段）：
 *   guilty → 公诉色 · not_guilty → 辩护色 · partial → 琥珀 · unclear → 待定灰。
 * 下方给出（以第二轮为准）是否达成多数 / 是否存在少数意见。
 */

interface VotePanelProps {
  voteHistory: VoteHistory;
}

/** 立场展示顺序（有罪 → 部分成立 → 存疑 → 无罪 的连续谱）。 */
const POSITION_ORDER = ["guilty", "partial", "unclear", "not_guilty"];

function tallyTotal(tally: VoteTally): number {
  return Object.values(tally).reduce((s, n) => s + n, 0);
}

/** 一条堆叠条 + 其下的票数图例。 */
function VoteBar({ label, tally }: { label: string; tally: VoteTally }) {
  const total = tallyTotal(tally);
  const entries = POSITION_ORDER.filter((p) => (tally[p] ?? 0) > 0).map((p) => ({
    position: p,
    count: tally[p],
  }));

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="font-label text-xs text-ink-caption">{label}</span>
        <span className="font-mono text-xs text-ink-caption">{total} 票</span>
      </div>
      <div
        className="flex h-5 w-full overflow-hidden rounded-sm"
        style={{ backgroundColor: "var(--bg-surface-alt)" }}
      >
        {total === 0 ? null : (
          entries.map((e) => (
            <div
              key={e.position}
              className="flex items-center justify-center"
              style={{
                width: `${(e.count / total) * 100}%`,
                backgroundColor: positionVoteColor(e.position),
              }}
              title={`${positionLabel(e.position)} ${e.count}`}
            >
              {e.count / total >= 0.18 && (
                <span
                  className="px-1 font-label text-xs"
                  style={{ color: "var(--text-on-dark)" }}
                >
                  {e.count}
                </span>
              )}
            </div>
          ))
        )}
      </div>
      {/* 图例：色块 + 立场(票数) */}
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
        {entries.map((e) => (
          <span key={e.position} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: positionVoteColor(e.position) }}
            />
            <span className="font-label text-xs text-ink-secondary">
              {positionLabel(e.position)}（{e.count}）
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function VotePanel({ voteHistory }: VotePanelProps) {
  const round2 = voteHistory?.round2 ?? {};

  /** 以第二轮为准：是否形成多数、是否存在少数意见。 */
  const conclusion = useMemo(() => {
    const total = tallyTotal(round2);
    if (total === 0) return null;
    const sorted = Object.entries(round2).sort((a, b) => b[1] - a[1]);
    const [topPos, topCount] = sorted[0];
    const isMajority = topCount * 2 > total;
    const minority = sorted
      .slice(1)
      .filter(([, n]) => n > 0)
      .map(([p, n]) => `${positionLabel(p)}（${n}）`);
    return { total, topPos, topCount, isMajority, minority };
  }, [round2]);

  return (
    <div className="flex flex-col gap-4">
      <VoteBar label="第一轮" tally={voteHistory?.round1 ?? {}} />
      <VoteBar label="第二轮（最终）" tally={round2} />

      {conclusion && (
        <div
          className="rounded border bg-surface-alt p-3"
          style={{ borderColor: "var(--border-default)" }}
        >
          <p className="font-body text-sm text-ink-secondary">
            {conclusion.isMajority ? (
              <>
                已形成多数意见：
                <span
                  className="font-medium"
                  style={{ color: positionVoteColor(conclusion.topPos) }}
                >
                  {positionLabel(conclusion.topPos)}
                </span>
                （{conclusion.topCount}/{conclusion.total}）。
              </>
            ) : (
              <>
                未形成绝对多数意见（最高：
                {positionLabel(conclusion.topPos)} {conclusion.topCount}/
                {conclusion.total}）。
              </>
            )}
          </p>
          <p className="mt-1 font-body text-sm text-ink-secondary">
            {conclusion.minority.length > 0
              ? `存在少数意见：${conclusion.minority.join("、")}。`
              : "无少数意见，评议意见一致。"}
          </p>
        </div>
      )}
    </div>
  );
}
