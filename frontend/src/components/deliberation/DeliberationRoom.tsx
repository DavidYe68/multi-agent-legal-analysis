import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";

import type {
  DeliberationRoom as DeliberationRoomData,
  ReviewerRound1,
  ReviewerRound2,
} from "../../types";
import { issueStatusLabel } from "../courtroom/issueMeta";
import AllianceGraph from "./AllianceGraph";
import PlaybackControls from "./PlaybackControls";
import ReviewerSeat, { type SeatStatus } from "./ReviewerSeat";
import VotePanel from "./VotePanel";
import {
  positionLabel,
  relationColor,
  relationDashed,
  relationLabel,
  reviewerColorVar,
  reviewerLabel,
  reviewerOrderIndex,
  REVIEWER_ORDER,
  SEAT_LAYOUT,
} from "./reviewerMeta";

/**
 * DeliberationRoom · 评议室
 *
 * 四席围坐 + 中央议题的菱形布局（CSS Grid）：上=法律、左=公众、右=专家、下=社会，
 * 中心为「未决争点」。提供发言播放（第一轮开场陈述 → 第二轮回应），第二轮以 SVG
 * 连线呈现「谁回应了谁」（同意/部分同意/反对）。下方为 React Flow 联盟分歧图与投票结果。
 *
 * 仅本区域使用 framer-motion，且遵循用户的「减少动态效果」偏好（MotionConfig reducedMotion）。
 */

interface DeliberationRoomProps {
  room: DeliberationRoomData;
  /** issue_id → 争点文本。 */
  issueTextById: Record<string, string>;
}

const ROUND_TYPE_LABELS: Record<string, string> = {
  opening_statement: "开场陈述",
  response: "回应",
};

interface Step {
  globalIndex: number;
  roundId: number;
  roundType: string;
  turnInRound: number;
  turnsInRound: number;
  agentId: string;
  speech: ReviewerRound1 | ReviewerRound2;
}

interface LineSeg {
  key: string;
  d: string;
  color: string;
  dashed: boolean;
  label: string;
  labelX: number;
  labelY: number;
}

const ADVANCE_MS = 3000;

const DeliberationRoom = forwardRef<HTMLDivElement, DeliberationRoomProps>(
  function DeliberationRoom({ room, issueTextById }, ref) {
    /* ---- 轮次与发言（按固定座次排序）---- */
    const rounds = useMemo(
      () => [...(room.rounds ?? [])].sort((a, b) => a.round_id - b.round_id),
      [room.rounds],
    );

    const r1Round = useMemo(
      () =>
        rounds.find((r) => r.round_type === "opening_statement") ?? rounds[0],
      [rounds],
    );
    const r2Round = useMemo(
      () => rounds.find((r) => r.round_type === "response"),
      [rounds],
    );

    const round1ById = useMemo(() => {
      const m: Record<string, ReviewerRound1> = {};
      for (const s of r1Round?.speeches ?? [])
        m[s.agent_id] = s as ReviewerRound1;
      return m;
    }, [r1Round]);

    const round2ById = useMemo(() => {
      const m: Record<string, ReviewerRound2> = {};
      for (const s of r2Round?.speeches ?? [])
        m[s.agent_id] = s as ReviewerRound2;
      return m;
    }, [r2Round]);

    const steps = useMemo<Step[]>(() => {
      const out: Step[] = [];
      for (const r of rounds) {
        const ordered = [...r.speeches].sort(
          (a, b) => reviewerOrderIndex(a.agent_id) - reviewerOrderIndex(b.agent_id),
        );
        ordered.forEach((sp, idx) => {
          out.push({
            globalIndex: out.length,
            roundId: r.round_id,
            roundType: r.round_type,
            turnInRound: idx + 1,
            turnsInRound: ordered.length,
            agentId: sp.agent_id,
            speech: sp,
          });
        });
      }
      return out;
    }, [rounds]);

    /** 各评议者第二轮发言对应的全局步序（用于判断「是否已二轮发言」）。 */
    const r2StepIndexById = useMemo(() => {
      const m: Record<string, number> = {};
      steps.forEach((s) => {
        if (r2Round && s.roundId === r2Round.round_id)
          m[s.agentId] = s.globalIndex;
      });
      return m;
    }, [steps, r2Round]);

    const lastStep = steps.length - 1;

    /* ---- 播放状态 ---- */
    const [step, setStep] = useState(-1); // -1 = 未开始
    const [isPlaying, setIsPlaying] = useState(false);

    // 自动推进：每 ADVANCE_MS 前进一步，到末步停止。
    useEffect(() => {
      if (!isPlaying) return;
      if (step >= lastStep) {
        setIsPlaying(false);
        return;
      }
      const t = setTimeout(
        () => setStep((s) => Math.min(lastStep, s + 1)),
        ADVANCE_MS,
      );
      return () => clearTimeout(t);
    }, [isPlaying, step, lastStep]);

    const onPlayPause = useCallback(() => {
      if (isPlaying) {
        setIsPlaying(false);
        return;
      }
      setStep((s) => (s >= lastStep ? 0 : s < 0 ? 0 : s));
      setIsPlaying(true);
    }, [isPlaying, lastStep]);

    const onPrev = useCallback(() => {
      setIsPlaying(false);
      setStep((s) => Math.max(0, s - 1));
    }, []);
    const onNext = useCallback(() => {
      setIsPlaying(false);
      setStep((s) => Math.min(lastStep, s + 1));
    }, [lastStep]);
    const onSkip = useCallback(() => {
      setIsPlaying(false);
      setStep(lastStep);
    }, [lastStep]);

    const activeAgent = step >= 0 ? steps[step].agentId : null;
    const curStep = step >= 0 ? steps[step] : null;

    /* ---- 连线（第二轮）：speaker → 各 respond_to target ---- */
    const diagramRef = useRef<HTMLDivElement>(null);
    const seatRefs = useRef(new Map<string, HTMLDivElement>());
    const [lines, setLines] = useState<LineSeg[]>([]);
    const [drawn, setDrawn] = useState(false);

    const registerSeat = useCallback(
      (id: string) => (el: HTMLDivElement | null) => {
        if (el) seatRefs.current.set(id, el);
        else seatRefs.current.delete(id);
      },
      [],
    );

    const recompute = useCallback(() => {
      const wrap = diagramRef.current;
      if (!wrap || !curStep || curStep.roundType !== "response") {
        setLines([]);
        return;
      }
      const speech = round2ById[curStep.agentId];
      const speakerEl = seatRefs.current.get(curStep.agentId);
      if (!speech || !speakerEl) {
        setLines([]);
        return;
      }
      const wr = wrap.getBoundingClientRect();
      const cx = wr.width / 2;
      const cy = wr.height / 2;
      const centerOf = (el: HTMLElement) => {
        const r = el.getBoundingClientRect();
        return {
          x: r.left - wr.left + r.width / 2,
          y: r.top - wr.top + r.height / 2,
        };
      };
      const p1 = centerOf(speakerEl);
      const segs: LineSeg[] = [];
      speech.respond_to?.forEach((rt, i) => {
        const targetEl = seatRefs.current.get(rt.target_agent);
        if (!targetEl) return;
        const p2 = centerOf(targetEl);
        const mx = (p1.x + p2.x) / 2;
        const my = (p1.y + p2.y) / 2;
        // 控制点：自弦中点沿垂直方向向「远离图心」一侧外凸，避开中央议题面板。
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy) || 1;
        let px = -dy / len;
        let py = dx / len;
        if (px * (mx - cx) + py * (my - cy) < 0) {
          px = -px;
          py = -py;
        }
        const off = 46;
        const ctrlX = mx + px * off;
        const ctrlY = my + py * off;
        // 二次贝塞尔 t=0.5 处坐标（放标签）。
        const labelX = 0.25 * p1.x + 0.5 * ctrlX + 0.25 * p2.x;
        const labelY = 0.25 * p1.y + 0.5 * ctrlY + 0.25 * p2.y;
        segs.push({
          key: `${curStep.agentId}-${rt.target_agent}-${i}`,
          d: `M ${p1.x} ${p1.y} Q ${ctrlX} ${ctrlY} ${p2.x} ${p2.y}`,
          color: relationColor(rt.relation),
          dashed: relationDashed(rt.relation),
          label: relationLabel(rt.relation),
          labelX,
          labelY,
        });
      });
      setLines(segs);
    }, [curStep, round2ById]);

    // 步进 / 布局变化后重算连线几何。
    useLayoutEffect(() => {
      recompute();
    }, [recompute]);

    // 连线「画入」动画：步进时重置后于稍后置真，触发 400ms 过渡。
    // 用 setTimeout 而非 rAF —— 后者在页面不可见时会被浏览器暂停。
    useEffect(() => {
      setDrawn(false);
      const id = window.setTimeout(() => setDrawn(true), 30);
      return () => window.clearTimeout(id);
    }, [step]);

    // 尺寸 / 窗口变化后重算（不重放动画）。
    useEffect(() => {
      const wrap = diagramRef.current;
      if (!wrap) return;
      const ro = new ResizeObserver(() => recompute());
      ro.observe(wrap);
      window.addEventListener("resize", recompute);
      return () => {
        ro.disconnect();
        window.removeEventListener("resize", recompute);
      };
    }, [recompute]);

    /* ---- 每席派生显示 ---- */
    const seatProps = useCallback(
      (id: string) => {
        const r1 = round1ById[id];
        const r2 = round2ById[id];
        const r2StepIdx = r2StepIndexById[id];
        const hasSpokenR2 =
          r2 !== undefined && r2StepIdx !== undefined && step >= r2StepIdx;

        const position = hasSpokenR2
          ? r2.position_after
          : (r1?.position ?? "unclear");
        const confidence = hasSpokenR2
          ? r2.confidence_after
          : (r1?.confidence ?? 0);

        // 状态：speaking / done（本轮已轮到过）/ waiting。
        let status: SeatStatus = "waiting";
        if (activeAgent === id) status = "speaking";
        else if (curStep) {
          const turnIdx = steps.findIndex(
            (s) => s.agentId === id && s.roundId === curStep.roundId,
          );
          if (turnIdx >= 0 && turnIdx < step) status = "done";
        }

        const change =
          hasSpokenR2 && r2?.position_changed
            ? {
                before: r2.position_before,
                after: r2.position_after,
                reason: r2.change_reason,
              }
            : null;

        return {
          agentId: id,
          position,
          confidence,
          coreClaim: r1?.core_claim ?? "",
          status,
          dimmed: activeAgent !== null && activeAgent !== id,
          change,
        };
      },
      [round1ById, round2ById, r2StepIndexById, step, activeAgent, curStep, steps],
    );

    /* ---- 联盟图最终立场 ---- */
    const finalPositions = useMemo(() => {
      const m: Record<string, string> = {};
      for (const id of REVIEWER_ORDER) {
        m[id] =
          room.alliance_map?.[id]?.position_after ??
          round2ById[id]?.position_after ??
          round1ById[id]?.position ??
          "unclear";
      }
      return m;
    }, [room.alliance_map, round1ById, round2ById]);

    /* ---- 中央：未决争点 ---- */
    const unresolvedIssues = useMemo(
      () =>
        (room.final_meeting_result?.final_issue_status ?? []).filter(
          (s) => s.final_status !== "closed",
        ),
      [room.final_meeting_result],
    );

    const progressText =
      step < 0
        ? `未开始 · 共 ${steps.length} 段发言`
        : `第 ${curStep!.roundId} 轮 ${ROUND_TYPE_LABELS[curStep!.roundType] ?? ""} · 发言 ${curStep!.turnInRound}/${curStep!.turnsInRound}`;

    if (steps.length === 0) {
      return (
        <section
          ref={ref}
          className="bg-surface"
          style={{
            marginTop: "var(--space-12)",
            padding: "var(--space-8)",
          }}
        >
          <p className="font-body text-sm text-ink-caption">
            本案暂无评议室记录。
          </p>
        </section>
      );
    }

    return (
      <MotionConfig reducedMotion="user">
        <section
          ref={ref}
          className="bg-surface"
          style={{
            marginTop: "var(--space-12)",
            paddingLeft: "var(--space-8)",
            paddingRight: "var(--space-8)",
            paddingTop: "var(--space-8)",
            paddingBottom: 0,
          }}
          aria-label="评议室"
        >
          {/* 标题 */}
          <div className="flex items-baseline gap-3">
            <h3
              className="font-display"
              style={{ fontSize: "var(--text-xl)", color: "var(--text-primary)" }}
            >
              评议室
            </h3>
            <span className="font-label text-xs text-ink-caption">
              四席围坐 · 两轮评议
            </span>
          </div>

          {/* ── 菱形四席 + 中央议题 ── */}
          <div ref={diagramRef} className="relative" style={{ marginTop: "var(--space-6)" }}>
            {/* 连线层（第二轮）：置于座席之上，透传指针事件 */}
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-10 h-full w-full"
            >
              {lines.map((l) => (
                <g key={l.key}>
                  <path
                    d={l.d}
                    fill="none"
                    stroke={l.color}
                    strokeWidth={1.5}
                    style={
                      l.dashed
                        ? {
                            strokeDasharray: "6 4",
                            opacity: drawn ? 1 : 0,
                            transition: "opacity 400ms ease-out",
                          }
                        : {
                            strokeDasharray: 600,
                            strokeDashoffset: drawn ? 0 : 600,
                            transition: "stroke-dashoffset 400ms ease-out",
                          }
                    }
                  />
                  <rect
                    x={l.labelX - 22}
                    y={l.labelY - 9}
                    width={44}
                    height={18}
                    rx={2}
                    fill="var(--bg-surface)"
                    opacity={drawn ? 0.95 : 0}
                    style={{ transition: "opacity 400ms ease-out" }}
                  />
                  <text
                    x={l.labelX}
                    y={l.labelY}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={l.color}
                    style={{
                      fontSize: 11,
                      fontFamily: "var(--font-label)",
                      opacity: drawn ? 1 : 0,
                      transition: "opacity 400ms ease-out",
                    }}
                  >
                    {l.label}
                  </text>
                </g>
              ))}
            </svg>

            <div
              className="relative z-0 grid"
              style={{
                gridTemplateColumns:
                  "minmax(200px,1fr) minmax(300px,1.3fr) minmax(200px,1fr)",
                gridTemplateAreas: `". top ." "left center right" ". bottom ."`,
                gap: "var(--space-6)",
                alignItems: "center",
                justifyItems: "center",
              }}
            >
              {(["top", "left", "right", "bottom"] as const).map((slot) => {
                const id = SEAT_LAYOUT[slot];
                return (
                  <div key={slot} style={{ gridArea: slot }}>
                    <ReviewerSeat {...seatProps(id)} seatRef={registerSeat(id)} />
                  </div>
                );
              })}

              {/* 中央议题 + 当前发言 */}
              <div
                style={{ gridArea: "center" }}
                className="w-full self-stretch"
              >
                <div
                  className="flex h-full flex-col rounded border bg-surface-alt"
                  style={{ borderColor: "var(--border-default)", padding: "var(--space-4)" }}
                >
                  <h4 className="font-label text-xs text-ink-caption">未决争点</h4>
                  {unresolvedIssues.length === 0 ? (
                    <p className="mt-1 font-body text-sm text-ink-caption">
                      所有争点已明确。
                    </p>
                  ) : (
                    <ul className="mt-1 flex flex-col gap-1.5">
                      {unresolvedIssues.map((s) => (
                        <li key={s.issue_id} className="flex items-baseline gap-2">
                          <span className="font-mono text-xs text-ink-caption">
                            {s.issue_id}
                          </span>
                          <span
                            className="min-w-0 flex-1 truncate font-body text-sm text-ink"
                            title={s.issue_text}
                          >
                            {s.issue_text}
                          </span>
                          <span
                            className="shrink-0 rounded-sm border px-1 font-label text-xs"
                            style={{
                              borderColor: "var(--border-emphasis)",
                              color: "var(--role-judge)",
                            }}
                          >
                            {issueStatusLabel(s.final_status)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* 当前发言 */}
                  <div
                    className="mt-3 border-t pt-3"
                    style={{ borderColor: "var(--border-default)" }}
                  >
                    <AnimatePresence mode="wait">
                      {curStep ? (
                        <motion.div
                          key={step}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.3, ease: "easeOut" }}
                        >
                          <SpeechPanel
                            step={curStep}
                            issueTextById={issueTextById}
                          />
                        </motion.div>
                      ) : (
                        <motion.p
                          key="idle"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="font-body text-sm text-ink-caption"
                        >
                          点击「播放」依次回放四位评议者的开场陈述与回应。
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── 联盟与分歧图 ── */}
          <div style={{ marginTop: "var(--space-12)" }}>
            <h4 className="mb-2 font-label text-xs text-ink-caption">
              联盟与分歧
            </h4>
            <AllianceGraph
              allianceMap={room.alliance_map ?? {}}
              disagreementMap={room.disagreement_map ?? []}
              finalPositions={finalPositions}
            />
          </div>

          {/* ── 投票结果 ── */}
          <div style={{ marginTop: "var(--space-8)", paddingBottom: "var(--space-8)" }}>
            <h4 className="mb-2 font-label text-xs text-ink-caption">投票结果</h4>
            <VotePanel voteHistory={room.vote_history} />
          </div>

          {/* ── 播放控制条（固定底部）── */}
          <PlaybackControls
            isPlaying={isPlaying}
            canPrev={step > 0}
            canNext={step < lastStep}
            progressText={progressText}
            onPlayPause={onPlayPause}
            onPrev={onPrev}
            onNext={onNext}
            onSkip={onSkip}
          />
        </section>
      </MotionConfig>
    );
  },
);

export default DeliberationRoom;

/* ===========================================================================
 * 当前发言面板
 * ======================================================================== */

function SpeechPanel({
  step,
  issueTextById,
}: {
  step: Step;
  issueTextById: Record<string, string>;
}) {
  const color = reviewerColorVar(step.agentId);

  if (step.roundType === "response") {
    const s = step.speech as ReviewerRound2;
    return (
      <div>
        <div className="flex items-center gap-2">
          <span className="font-body text-sm font-medium" style={{ color }}>
            {reviewerLabel(step.agentId)}
          </span>
          <span className="font-label text-xs text-ink-caption">回应</span>
        </div>

        <ul className="mt-2 flex flex-col gap-2">
          {(s.respond_to ?? []).map((rt, i) => (
            <li key={i} className="flex flex-col gap-0.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span aria-hidden="true" className="text-ink-caption">
                  →
                </span>
                <span className="font-body text-sm text-ink">
                  {reviewerLabel(rt.target_agent)}
                </span>
                <span
                  className="rounded-sm px-1 font-label text-xs"
                  style={{
                    color: relationColor(rt.relation),
                    backgroundColor: `color-mix(in srgb, ${relationColor(rt.relation)} 12%, transparent)`,
                  }}
                >
                  {relationLabel(rt.relation)}
                </span>
                {rt.issue_id && (
                  <span
                    className="font-mono text-xs text-ink-caption"
                    title={issueTextById[rt.issue_id]}
                  >
                    {rt.issue_id}
                  </span>
                )}
              </div>
              {rt.target_point && (
                <p className="font-body text-sm text-ink-secondary">
                  {rt.target_point}
                </p>
              )}
              {rt.rejected_part && rt.rejected_part !== "无" && (
                <p
                  className="font-body text-xs"
                  style={{ color: "var(--relation-disagree)" }}
                >
                  分歧：{rt.rejected_part}
                </p>
              )}
            </li>
          ))}
        </ul>

        {s.remaining_disagreement && (
          <p className="mt-2 font-body text-xs text-ink-caption">
            遗留分歧：{s.remaining_disagreement}
          </p>
        )}
      </div>
    );
  }

  // 第一轮：开场陈述
  const s = step.speech as ReviewerRound1;
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="font-body text-sm font-medium" style={{ color }}>
          {reviewerLabel(step.agentId)}
        </span>
        <span
          className="rounded-sm px-1 font-label text-xs"
          style={{
            color,
            backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
          }}
        >
          {positionLabel(s.position)}
        </span>
      </div>

      <p className="mt-2 font-body text-base text-ink">{s.core_claim}</p>

      {(s.supporting_reasons?.length ?? 0) > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {s.supporting_reasons.map((r, i) => (
            <li key={i} className="flex gap-2">
              <span
                aria-hidden="true"
                className="mt-[9px] h-[5px] w-[5px] shrink-0 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="font-body text-sm text-ink-secondary">{r}</span>
            </li>
          ))}
        </ul>
      )}

      {s.main_concern && (
        <p className="mt-2 font-body text-xs text-ink-caption">
          主要顾虑：{s.main_concern}
        </p>
      )}
    </div>
  );
}
