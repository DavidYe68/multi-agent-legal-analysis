import { useCourtroom } from "./CourtroomContext";
import Timeline from "./Timeline";

/**
 * CaseSummarySection · 卷宗栏区域 A：案件摘要
 *
 * 自上而下：中立案情摘要 → 当事人列表 → 时间线。
 * 时间线「竖线 + 小圆点」的克制样式抽到了 <Timeline/>，与报告页共用。
 */

/** 当事人 role 英文 → 中文（覆盖数据中出现的取值，未知则原样显示）。 */
const PARTICIPANT_ROLE_LABELS: Record<string, string> = {
  defendant: "被告人",
  victim: "被害人",
  witness: "证人",
  plaintiff: "原告",
  co_defendant: "同案被告人",
};

export default function CaseSummarySection() {
  const { caseInput } = useCourtroom();
  const { neutral_summary, timeline } = caseInput.case_narrative;
  const participants = caseInput.participants;

  return (
    <div className="flex flex-col gap-4">
      {/* 中立摘要 */}
      <p className="text-sm text-ink">{neutral_summary}</p>

      {/* 当事人 */}
      {participants.length > 0 && (
        <div>
          <h4 className="mb-1 font-label text-xs text-ink-caption">当事人</h4>
          <ul className="flex flex-col gap-1">
            {participants.map((p) => {
              const roleLabel =
                PARTICIPANT_ROLE_LABELS[p.role] ?? p.role;
              const attrs = Object.entries(p.attributes ?? {});
              return (
                <li key={p.participant_id} className="text-sm text-ink">
                  <span className="text-ink">{p.anonymized_name}</span>
                  <span className="ml-2 font-label text-xs text-ink-caption">
                    {roleLabel}
                  </span>
                  {attrs.length > 0 && (
                    <span className="ml-2 font-label text-xs text-ink-caption">
                      {attrs.map(([k, v]) => `${k}：${v}`).join("·")}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* 时间线 */}
      {timeline.length > 0 && (
        <div>
          <h4 className="mb-2 font-label text-xs text-ink-caption">时间线</h4>
          <Timeline events={timeline} />
        </div>
      )}
    </div>
  );
}
