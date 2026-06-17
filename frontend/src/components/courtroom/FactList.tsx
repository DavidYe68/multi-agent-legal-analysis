import { useMemo } from "react";

import { useCourtroom } from "./CourtroomContext";

/**
 * FactList · 卷宗栏区域 B：事实列表
 *
 * 每条事实：fact_id 灰色小标签 + 争议状态文字标签 + 正文 + 关联证据数量。
 * 点击高亮（加左侧 3px 色条）并通过 context 通知中央区域。
 * 在某个角色视图下，该角色不可见的事实降透明度 + 删除线。
 */

/** 事实争议状态 → {标签, 颜色}。兼容 schema 别名（one_party_claim / unclear）。 */
const FACT_STATUS: Record<string, { label: string; color: string }> = {
  undisputed: { label: "无争议", color: "var(--text-caption)" },
  disputed: { label: "有争议", color: "var(--role-prosecutor)" },
  alleged: { label: "一方主张", color: "var(--relation-partial)" },
  one_party_claim: { label: "一方主张", color: "var(--relation-partial)" },
  unknown: { label: "待明确", color: "var(--status-pending)" },
  unclear: { label: "待明确", color: "var(--status-pending)" },
};

function FactStatusTag({ status }: { status: string }) {
  const meta = FACT_STATUS[status] ?? {
    label: status,
    color: "var(--text-caption)",
  };
  return (
    <span
      className="inline-flex items-center gap-1 font-label text-xs"
      style={{ color: meta.color }}
    >
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: meta.color }}
      />
      {meta.label}
    </span>
  );
}

export default function FactList() {
  const { caseInput, roleView, selectedFactId, selectFact } = useCourtroom();
  const facts = caseInput.facts;

  // 角色视图下的可见事实集合；"all" 时为 null（全部可见）。
  const visibleFactIds = useMemo(() => {
    if (roleView === "all") return null;
    return new Set(caseInput.role_views[roleView].fact_ids);
  }, [caseInput, roleView]);

  return (
    <ul className="flex flex-col gap-1">
      {facts.map((fact) => {
        const selected = selectedFactId === fact.fact_id;
        const dimmed =
          visibleFactIds !== null && !visibleFactIds.has(fact.fact_id);

        return (
          <li key={fact.fact_id}>
            <button
              type="button"
              aria-pressed={selected}
              onClick={() => selectFact(fact.fact_id)}
              style={{
                borderLeft: `3px solid ${
                  selected ? "var(--border-emphasis)" : "transparent"
                }`,
                opacity: dimmed ? 0.25 : 1,
              }}
              className={[
                "w-full rounded-sm py-1.5 pl-2 pr-2 text-left transition-colors duration-200",
                selected ? "bg-surface-alt" : "hover:bg-surface-alt",
              ].join(" ")}
            >
              <div className="flex items-center gap-2">
                <span className="rounded-sm bg-surface-alt px-1.5 font-mono text-xs text-ink-caption">
                  {fact.fact_id}
                </span>
                <FactStatusTag status={fact.status} />
              </div>
              <p className={["mt-1 text-sm text-ink", dimmed ? "line-through" : ""].join(" ")}>
                {fact.content}
              </p>
              <div className="mt-0.5 font-label text-xs text-ink-caption">
                关联证据 {fact.evidence_ids.length}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
