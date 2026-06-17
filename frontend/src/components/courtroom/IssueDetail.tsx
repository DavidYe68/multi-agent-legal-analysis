import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

import type {
  CaseOutput,
  EvidenceChallenge,
  EvidenceIssueMapItem,
  Issue,
  IssueResponseRow,
} from "../../types";
import { useCourtroom } from "./CourtroomContext";
import DefensePanel from "./DefensePanel";
import EvidenceRefChip from "./EvidenceRefChip";
import FieldLabel from "./FieldLabel";
import {
  compareEvidenceId,
  importanceMeta,
  issueStatusLabel,
} from "./issueMeta";
import ProsecutorPanel from "./ProsecutorPanel";

/**
 * IssueDetail · 争点详情 · 三栏对抗结构
 *
 *   ┌──────────────┬──────────────┬──────────────┐
 *   │  公诉方席 40% │ 争点中心 20% │  辩护方席 40% │
 *   └──────────────┴──────────────┴──────────────┘
 *
 * 中间列汇集争点本体信息（名称 / 重要性 / 理由 / 关联事实与证据 / 法官认定 / 遗留缺口）；
 * 左右两列分别呈现公诉论证与辩护回应。
 *
 * 争议证据（同一证据被控辩双方在本争点同时引用）：
 *   - 中间列对应证据旁标「争议证据」(--relation-disagree)；
 *   - 控辩两侧该证据标签加虚线下划线，hover 弹出双方解释对照的手写 tooltip；
 *   - 中间列证据作为「枢纽」，用 1px SVG 曲线连向左右两侧对应标签
 *     （公诉侧线 --role-prosecutor，辩护侧线 --role-defense）。
 */

interface IssueDetailProps {
  issue: Issue;
  caseOutput: CaseOutput;
  responseRow: IssueResponseRow | undefined;
}

/** 一条证据引用连线（中央枢纽 → 某一侧标签）。 */
interface LineSeg {
  evidenceId: string;
  color: string;
  d: string;
}

/** 把元素登记/注销进 ref 映射表。 */
function setMapEl(
  map: Map<string, HTMLElement>,
  id: string,
  el: HTMLElement | null,
) {
  if (el) map.set(id, el);
  else map.delete(id);
}

/** 水平走向的三次贝塞尔曲线路径，端点处保持水平切线，连线更顺滑。 */
function curvePath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.max(16, Math.abs(x2 - x1) * 0.5);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

export default function IssueDetail({
  issue,
  caseOutput,
  responseRow,
}: IssueDetailProps) {
  const { selectedFactId, selectedEvidenceId, selectFact, selectEvidence } =
    useCourtroom();

  const [hoveredEvidence, setHoveredEvidence] = useState<string | null>(null);
  const [lines, setLines] = useState<LineSeg[]>([]);

  const wrapRef = useRef<HTMLDivElement>(null);
  const pRefs = useRef(new Map<string, HTMLElement>());
  const dRefs = useRef(new Map<string, HTMLElement>());
  const hubRefs = useRef(new Map<string, HTMLElement>());

  const { fact_index, evidence_index, prosecutor_analysis, defense_analysis } =
    caseOutput;

  /* ---- 按争点取控辩论证与逐项反驳 ---- */
  const pArg = useMemo(
    () =>
      prosecutor_analysis.arguments_by_issue.find(
        (a) => a.issue_id === issue.issue_id,
      ),
    [prosecutor_analysis, issue.issue_id],
  );
  const dArg = useMemo(
    () =>
      defense_analysis.arguments_by_issue.find(
        (a) => a.issue_id === issue.issue_id,
      ),
    [defense_analysis, issue.issue_id],
  );
  const rebuttal = useMemo(
    () =>
      defense_analysis.rebuttals_to_accusation.find(
        (r) => r.issue_id === issue.issue_id,
      ),
    [defense_analysis, issue.issue_id],
  );

  /* ---- 争议证据：控辩在本争点共同引用的证据 ---- */
  const conflictIds = useMemo(() => {
    const dSet = new Set(dArg?.evidence_ids ?? []);
    return (pArg?.evidence_ids ?? [])
      .filter((id) => dSet.has(id))
      .sort(compareEvidenceId);
  }, [pArg, dArg]);
  const conflictSet = useMemo(() => new Set(conflictIds), [conflictIds]);

  /* ---- 中间列证据：争点相关 ∪ 争议证据，数值排序 ---- */
  const middleEvidenceIds = useMemo(() => {
    const set = new Set<string>(issue.related_evidence_ids);
    conflictIds.forEach((id) => set.add(id));
    return [...set].sort(compareEvidenceId);
  }, [issue.related_evidence_ids, conflictIds]);

  /* ---- 控方证明目的 / 辩方质证 的按证据索引（供 tooltip 取双方解释）---- */
  const eimIndex = useMemo(() => {
    const index: Record<string, EvidenceIssueMapItem> = {};
    for (const item of prosecutor_analysis.evidence_issue_map ?? [])
      index[item.evidence_id] = item;
    return index;
  }, [prosecutor_analysis]);
  const ecIndex = useMemo(() => {
    const index: Record<string, EvidenceChallenge> = {};
    for (const item of defense_analysis.evidence_challenges ?? [])
      index[item.evidence_id] = item;
    return index;
  }, [defense_analysis]);

  /* ---- 争议证据 tooltip：左右两侧对同一证据的不同解释 ---- */
  const buildTooltip = useCallback(
    (evidenceId: string): ReactNode => {
      const eim = eimIndex[evidenceId];
      const ec = ecIndex[evidenceId];
      const ev = evidence_index[evidenceId];
      const defenseText =
        ec?.probative_value_challenge ||
        ec?.relevance_challenge ||
        ec?.defense_conclusion ||
        "—";

      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-ink-caption">
              {evidenceId}
            </span>
            <span
              className="font-label text-xs"
              style={{ color: "var(--relation-disagree)" }}
            >
              争议证据
            </span>
          </div>
          {ev?.content && (
            <p className="text-xs text-ink-caption">{ev.content}</p>
          )}
          <div>
            <div
              className="font-label text-xs"
              style={{ color: "var(--role-prosecutor)" }}
            >
              公诉方 · 证明目的
            </div>
            <p className="text-sm text-ink">{eim?.proving_purpose ?? "—"}</p>
          </div>
          <div>
            <div
              className="font-label text-xs"
              style={{ color: "var(--role-defense)" }}
            >
              辩护方 · 质证意见
            </div>
            <p className="text-sm text-ink">{defenseText}</p>
          </div>
        </div>
      );
    },
    [eimIndex, ecIndex, evidence_index],
  );

  /* ---- ref 登记（仅争议证据需要，作为连线端点）---- */
  const registerP = useCallback((id: string, el: HTMLButtonElement | null) => {
    setMapEl(pRefs.current, id, el);
  }, []);
  const registerD = useCallback((id: string, el: HTMLButtonElement | null) => {
    setMapEl(dRefs.current, id, el);
  }, []);
  const registerHub = useCallback(
    (id: string, el: HTMLButtonElement | null) => {
      setMapEl(hubRefs.current, id, el);
    },
    [],
  );

  // 当前争议证据 id 列表存入 ref，使 recompute 保持稳定（空依赖），
  // 避免每次切换争点都重订 ResizeObserver / resize 监听。
  const conflictIdsRef = useRef<string[]>(conflictIds);
  conflictIdsRef.current = conflictIds;

  /* ---- 重算证据引用连线 ---- */
  const recompute = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const wr = wrap.getBoundingClientRect();
    const segs: LineSeg[] = [];
    for (const id of conflictIdsRef.current) {
      const hub = hubRefs.current.get(id);
      if (!hub) continue;
      const h = hub.getBoundingClientRect();
      const hy = h.top + h.height / 2 - wr.top;
      const hLeft = h.left - wr.left;
      const hRight = h.right - wr.left;

      const p = pRefs.current.get(id);
      if (p) {
        const pr = p.getBoundingClientRect();
        segs.push({
          evidenceId: id,
          color: "var(--role-prosecutor)",
          d: curvePath(pr.right - wr.left, pr.top + pr.height / 2 - wr.top, hLeft, hy),
        });
      }
      const dd = dRefs.current.get(id);
      if (dd) {
        const drr = dd.getBoundingClientRect();
        segs.push({
          evidenceId: id,
          color: "var(--role-defense)",
          d: curvePath(hRight, hy, drr.left - wr.left, drr.top + drr.height / 2 - wr.top),
        });
      }
    }
    setLines(segs);
  }, []);

  // 布局提交后立即重算（争点切换 / 内容变化）。
  useLayoutEffect(() => {
    recompute();
  }, [recompute, issue.issue_id, middleEvidenceIds]);

  // 尺寸变化、窗口缩放、字体加载完成后重算（字体 swap 会改变行高，影响端点位置）。
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => recompute());
    ro.observe(wrap);
    window.addEventListener("resize", recompute);
    let cancelled = false;
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    fonts?.ready.then(() => {
      if (!cancelled) recompute();
    });
    return () => {
      cancelled = true;
      ro.disconnect();
      window.removeEventListener("resize", recompute);
    };
  }, [recompute]);

  const imp = importanceMeta(issue.importance);

  return (
    <div className="bg-surface">
      <div ref={wrapRef} className="relative">
        {/* 证据引用连线：置于内容之下（z-0），透传指针事件 */}
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 h-full w-full"
        >
          {lines.map((l) => {
            const opacity =
              hoveredEvidence === null
                ? 0.32
                : hoveredEvidence === l.evidenceId
                  ? 0.95
                  : 0.1;
            return (
              <path
                key={`${l.evidenceId}-${l.color}`}
                d={l.d}
                fill="none"
                stroke={l.color}
                strokeWidth={1}
                style={{ opacity, transition: "opacity 150ms ease" }}
              />
            );
          })}
        </svg>

        {/* 三栏：40% / 20% / 40%（2fr / 1fr / 2fr），等高拉伸使分隔线贯穿全高 */}
        <div className="relative z-10 grid grid-cols-[2fr_1fr_2fr]">
          <ProsecutorPanel
            argument={pArg}
            conflictIds={conflictSet}
            evidenceIndex={evidence_index}
            selectedEvidenceId={selectedEvidenceId}
            onEvidenceClick={selectEvidence}
            onEvidenceHover={setHoveredEvidence}
            buildTooltip={buildTooltip}
            registerRef={registerP}
          />

          {/* ── 中间列：争点中心 ── */}
          <div
            className="flex flex-col gap-4 px-4 py-4"
            style={{
              borderLeft: "1px solid var(--border-default)",
              borderRight: "1px solid var(--border-default)",
            }}
          >
            <div>
              <div className="font-mono text-xs text-ink-caption">
                {issue.issue_id}
              </div>
              <h3 className="font-display text-lg text-ink">
                {issue.issue_text}
              </h3>
            </div>

            {/* 重要性 */}
            <span
              className="inline-flex w-fit items-center gap-1 rounded-sm border px-1.5 font-label text-xs"
              style={{
                borderColor: imp.core
                  ? "var(--role-judge)"
                  : "var(--border-default)",
                color: imp.core ? "var(--role-judge)" : "var(--text-secondary)",
              }}
            >
              <span aria-hidden="true">{imp.core ? "●" : "○"}</span>
              {imp.label}争点
            </span>

            {/* 争点理由 */}
            {issue.rationale && (
              <div>
                <FieldLabel>争点理由</FieldLabel>
                <p className="text-sm text-ink-secondary">{issue.rationale}</p>
              </div>
            )}

            {/* 关联事实 */}
            {issue.related_fact_ids.length > 0 && (
              <div>
                <FieldLabel>关联事实</FieldLabel>
                <div className="flex flex-wrap gap-1.5">
                  {issue.related_fact_ids.map((id) => (
                    <button
                      key={id}
                      type="button"
                      title={fact_index[id]?.content}
                      onClick={() => selectFact(id)}
                      style={{
                        borderColor:
                          selectedFactId === id
                            ? "var(--border-emphasis)"
                            : "var(--border-default)",
                      }}
                      className="rounded-sm border bg-surface-alt px-1.5 font-mono text-xs text-ink-secondary transition-colors duration-150 hover:bg-surface"
                    >
                      {id}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 关联证据（争议证据带「争议证据」标 + 作为连线枢纽）*/}
            {middleEvidenceIds.length > 0 && (
              <div>
                <FieldLabel>关联证据</FieldLabel>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                  {middleEvidenceIds.map((id) => {
                    const conflict = conflictSet.has(id);
                    return (
                      <span key={id} className="inline-flex items-center gap-1">
                        <EvidenceRefChip
                          evidenceId={id}
                          side="neutral"
                          conflict={conflict}
                          active={selectedEvidenceId === id}
                          title={evidence_index[id]?.content}
                          tooltip={conflict ? buildTooltip(id) : undefined}
                          tooltipAlign="left"
                          onClick={() => selectEvidence(id)}
                          onHoverChange={(h) =>
                            setHoveredEvidence(h ? id : null)
                          }
                          innerRef={
                            conflict ? (el) => registerHub(id, el) : undefined
                          }
                        />
                        {conflict && (
                          <span
                            className="font-label text-xs"
                            style={{ color: "var(--relation-disagree)" }}
                          >
                            争议证据
                          </span>
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 法官认定 */}
            {responseRow && (
              <div>
                <FieldLabel>法官认定</FieldLabel>
                <span
                  className="mb-1 inline-flex w-fit items-center rounded-sm border px-1.5 font-label text-xs"
                  style={{
                    borderColor: "var(--border-emphasis)",
                    color: "var(--role-judge)",
                  }}
                >
                  {issueStatusLabel(responseRow.current_status)}
                </span>
                {responseRow.reason && (
                  <p className="text-sm text-ink-secondary">
                    {responseRow.reason}
                  </p>
                )}
              </div>
            )}

            {/* 遗留缺口 */}
            {responseRow?.remaining_gap && (
              <div>
                <FieldLabel>遗留缺口</FieldLabel>
                <p className="text-sm text-ink-secondary">
                  {responseRow.remaining_gap}
                </p>
              </div>
            )}
          </div>

          <DefensePanel
            argument={dArg}
            rebuttal={rebuttal}
            conflictIds={conflictSet}
            evidenceIndex={evidence_index}
            selectedEvidenceId={selectedEvidenceId}
            onEvidenceClick={selectEvidence}
            onEvidenceHover={setHoveredEvidence}
            buildTooltip={buildTooltip}
            registerRef={registerD}
          />
        </div>
      </div>
    </div>
  );
}
