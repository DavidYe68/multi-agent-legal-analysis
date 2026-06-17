import type { ReactNode } from "react";

import type { ArgumentByIssue, Evidence } from "../../types";
import RoleBadge from "../ui/RoleBadge";
import IssueArgumentBody from "./IssueArgumentBody";

/**
 * ProsecutorPanel · 左列 · 公诉方席
 *
 * 顶部 RoleBadge(prosecutor) +「指控论证」，正文为该争点的公诉论证。
 * 左侧 3px 暗红边框（--role-prosecutor），与右侧辩护方席镜像对峙。
 */

interface ProsecutorPanelProps {
  argument: ArgumentByIssue | undefined;
  conflictIds: Set<string>;
  evidenceIndex: Record<string, Evidence>;
  selectedEvidenceId: string | null;
  onEvidenceClick: (evidenceId: string) => void;
  onEvidenceHover: (evidenceId: string | null) => void;
  buildTooltip: (evidenceId: string) => ReactNode;
  registerRef: (evidenceId: string, el: HTMLButtonElement | null) => void;
}

export default function ProsecutorPanel({
  argument,
  conflictIds,
  evidenceIndex,
  selectedEvidenceId,
  onEvidenceClick,
  onEvidenceHover,
  buildTooltip,
  registerRef,
}: ProsecutorPanelProps) {
  return (
    <section
      className="flex flex-col gap-4 py-4 pl-4 pr-6"
      style={{ borderLeft: "3px solid var(--role-prosecutor)" }}
    >
      <header className="flex items-center gap-2">
        <RoleBadge role="prosecutor" />
        <span className="font-display text-base text-ink">指控论证</span>
      </header>

      <IssueArgumentBody
        side="prosecutor"
        argument={argument}
        conflictIds={conflictIds}
        evidenceIndex={evidenceIndex}
        selectedEvidenceId={selectedEvidenceId}
        onEvidenceClick={onEvidenceClick}
        onEvidenceHover={onEvidenceHover}
        buildTooltip={buildTooltip}
        registerRef={registerRef}
      />
    </section>
  );
}
