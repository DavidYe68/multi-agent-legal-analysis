import type { ReactNode } from "react";

import type { ArgumentByIssue, Evidence, Rebuttal } from "../../types";
import RoleBadge from "../ui/RoleBadge";
import IssueArgumentBody from "./IssueArgumentBody";

/**
 * DefensePanel · 右列 · 辩护方席
 *
 * 顶部 RoleBadge(defense) +「辩护回应」，正文为该争点的辩护论证。
 * 右侧 3px 靛蓝边框（--role-defense），与左侧公诉方席镜像对峙。
 *
 * 若存在针对公诉主张的逐项反驳（rebuttals_to_accusation 匹配 issue_id），
 * 追加「针对公诉方主张的回应」一节：引用的公诉原文用灰色竖线 + 斜体标示。
 */

interface DefensePanelProps {
  argument: ArgumentByIssue | undefined;
  rebuttal: Rebuttal | undefined;
  conflictIds: Set<string>;
  evidenceIndex: Record<string, Evidence>;
  selectedEvidenceId: string | null;
  onEvidenceClick: (evidenceId: string) => void;
  onEvidenceHover: (evidenceId: string | null) => void;
  buildTooltip: (evidenceId: string) => ReactNode;
  registerRef: (evidenceId: string, el: HTMLButtonElement | null) => void;
}

export default function DefensePanel({
  argument,
  rebuttal,
  conflictIds,
  evidenceIndex,
  selectedEvidenceId,
  onEvidenceClick,
  onEvidenceHover,
  buildTooltip,
  registerRef,
}: DefensePanelProps) {
  return (
    <section
      className="flex flex-col gap-4 py-4 pl-6 pr-4"
      style={{ borderRight: "3px solid var(--role-defense)" }}
    >
      <header className="flex items-center gap-2">
        <RoleBadge role="defense" />
        <span className="font-display text-base text-ink">辩护回应</span>
      </header>

      <IssueArgumentBody
        side="defense"
        argument={argument}
        conflictIds={conflictIds}
        evidenceIndex={evidenceIndex}
        selectedEvidenceId={selectedEvidenceId}
        onEvidenceClick={onEvidenceClick}
        onEvidenceHover={onEvidenceHover}
        buildTooltip={buildTooltip}
        registerRef={registerRef}
      />

      {rebuttal && (
        <div className="border-t border-border pt-4">
          <h4 className="mb-2 font-label text-xs text-ink-caption">
            针对公诉方主张的回应
          </h4>

          {/* 引用的公诉原文：灰色竖线 + 斜体 */}
          {rebuttal.prosecution_claim && (
            <blockquote
              className="mb-2 pl-3 text-sm italic text-ink-secondary"
              style={{ borderLeft: "2px solid var(--border-default)" }}
            >
              {rebuttal.prosecution_claim}
            </blockquote>
          )}

          {rebuttal.defense_rebuttal && (
            <p className="text-sm text-ink">{rebuttal.defense_rebuttal}</p>
          )}

          {rebuttal.core_response && (
            <p className="mt-2 text-sm text-ink-secondary">
              <span className="font-label text-xs text-ink-caption">
                核心回应：
              </span>
              {rebuttal.core_response}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
