import type { ReactNode } from "react";

import type { ArgumentByIssue, Evidence } from "../../types";
import EvidenceRefChip from "./EvidenceRefChip";
import FieldLabel from "./FieldLabel";
import { compareEvidenceId } from "./issueMeta";

/**
 * IssueArgumentBody · 控辩席共用的论证正文
 *
 * 自上而下：主张（claim）→ 引用证据（evidence_ids）→ 推理（reasoning）→ 薄弱环节（weak_points）。
 * 公诉/辩护通过 side 区分证据底色与文字色；争议证据带虚线下划线与 hover tooltip。
 * 无对应论证时给出占位提示，保证布局稳定。
 */

type Side = "prosecutor" | "defense";

interface IssueArgumentBodyProps {
  side: Side;
  argument: ArgumentByIssue | undefined;
  /** 争议证据 id 集合（控辩同时引用）。 */
  conflictIds: Set<string>;
  evidenceIndex: Record<string, Evidence>;
  selectedEvidenceId: string | null;
  onEvidenceClick: (evidenceId: string) => void;
  onEvidenceHover: (evidenceId: string | null) => void;
  /** 构造争议证据的手写 tooltip 内容。 */
  buildTooltip: (evidenceId: string) => ReactNode;
  /** 注册争议证据标签 DOM（连线端点）；非争议证据不注册。 */
  registerRef: (evidenceId: string, el: HTMLButtonElement | null) => void;
}

export default function IssueArgumentBody({
  side,
  argument,
  conflictIds,
  evidenceIndex,
  selectedEvidenceId,
  onEvidenceClick,
  onEvidenceHover,
  buildTooltip,
  registerRef,
}: IssueArgumentBodyProps) {
  const tooltipAlign = side === "prosecutor" ? "left" : "right";

  if (!argument) {
    const who = side === "prosecutor" ? "公诉论证" : "辩护论证";
    return (
      <p className="font-label text-sm text-ink-caption">
        该争点暂无{who}。
      </p>
    );
  }

  const evidenceIds = [...argument.evidence_ids].sort(compareEvidenceId);

  return (
    <div className="flex flex-col gap-4">
      {/* 主张 */}
      <p className="text-base font-medium text-ink">{argument.claim}</p>

      {/* 引用证据 */}
      {evidenceIds.length > 0 && (
        <div>
          <FieldLabel>引用证据</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {evidenceIds.map((id) => {
              const conflict = conflictIds.has(id);
              return (
                <EvidenceRefChip
                  key={id}
                  evidenceId={id}
                  side={side}
                  conflict={conflict}
                  active={selectedEvidenceId === id}
                  title={evidenceIndex[id]?.content}
                  tooltip={conflict ? buildTooltip(id) : undefined}
                  tooltipAlign={tooltipAlign}
                  onClick={() => onEvidenceClick(id)}
                  onHoverChange={(h) => onEvidenceHover(h ? id : null)}
                  innerRef={
                    conflict ? (el) => registerRef(id, el) : undefined
                  }
                />
              );
            })}
          </div>
        </div>
      )}

      {/* 推理 */}
      {argument.reasoning && (
        <div>
          <FieldLabel>论证</FieldLabel>
          <p className="text-sm text-ink-secondary">{argument.reasoning}</p>
        </div>
      )}

      {/* 薄弱环节 */}
      {argument.weak_points.length > 0 && (
        <div>
          <FieldLabel>薄弱环节</FieldLabel>
          <ul className="flex flex-col gap-1">
            {argument.weak_points.map((wp, i) => (
              <li key={i} className="flex gap-1.5 text-sm text-ink-secondary">
                <span aria-hidden="true" className="shrink-0">
                  ⚠
                </span>
                <span>{wp}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
