import { useMemo } from "react";

import { useCourtroom } from "./CourtroomContext";

/**
 * EvidenceList · 卷宗栏区域 C：证据列表
 *
 * 每条证据：evidence_id 标签 + 类型/真实性小标签 + 内容摘要（折叠时截断 80 字）。
 * 点击展开完整内容，同时通过 context 通知中央区域（选中态即展开态）。
 * 角色视图下不可见的证据降透明度 + 删除线。
 */

const TRUNCATE_LENGTH = 80;

/** 证据类型英文 → 中文（覆盖数据中出现的取值）。 */
const EVIDENCE_TYPE_LABELS: Record<string, string> = {
  documentary: "书证",
  physical_evidence: "物证",
  witness_testimony: "证人证言",
  defendant_statement: "被告人供述",
  co_defendant_statement: "同案人供述",
  expert_opinion: "鉴定意见",
  electronic_data: "电子数据",
  audio_visual: "视听资料",
  inspection_record: "勘验检查笔录",
};

/** 真实性状态英文 → 中文。 */
const AUTHENTICITY_LABELS: Record<string, string> = {
  confirmed: "真实性确认",
  disputed: "真实性存疑",
  unknown: "真实性未定",
};

/** 卷宗式小标签。 */
function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-sm border border-border bg-surface-alt px-1.5 font-label text-xs leading-normal text-ink-secondary">
      {children}
    </span>
  );
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export default function EvidenceList() {
  const { caseInput, roleView, selectedEvidenceId, selectEvidence } =
    useCourtroom();
  const evidence = caseInput.evidence;

  const visibleEvidenceIds = useMemo(() => {
    if (roleView === "all") return null;
    return new Set(caseInput.role_views[roleView].evidence_ids);
  }, [caseInput, roleView]);

  return (
    <ul className="flex flex-col gap-1">
      {evidence.map((ev) => {
        // 选中即展开：选中态既是中央联动的依据，也是「展开完整内容」的依据。
        const expanded = selectedEvidenceId === ev.evidence_id;
        const dimmed =
          visibleEvidenceIds !== null &&
          !visibleEvidenceIds.has(ev.evidence_id);

        const typeLabel = EVIDENCE_TYPE_LABELS[ev.evidence_type] ?? ev.evidence_type;
        const authLabel =
          AUTHENTICITY_LABELS[ev.authenticity_status] ?? ev.authenticity_status;
        const body = expanded ? ev.content : truncate(ev.content, TRUNCATE_LENGTH);

        return (
          <li key={ev.evidence_id}>
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => selectEvidence(ev.evidence_id)}
              style={{
                borderLeft: `3px solid ${
                  expanded ? "var(--border-emphasis)" : "transparent"
                }`,
                opacity: dimmed ? 0.25 : 1,
              }}
              className={[
                "w-full rounded-sm py-1.5 pl-2 pr-2 text-left transition-colors duration-200",
                expanded ? "bg-surface-alt" : "hover:bg-surface-alt",
              ].join(" ")}
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-sm bg-surface-alt px-1.5 font-mono text-xs text-ink-caption">
                  {ev.evidence_id}
                </span>
                <Chip>{typeLabel}</Chip>
                <Chip>{authLabel}</Chip>
              </div>
              <p
                className={[
                  "mt-1 text-sm text-ink",
                  dimmed ? "line-through" : "",
                ].join(" ")}
              >
                {body}
              </p>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
