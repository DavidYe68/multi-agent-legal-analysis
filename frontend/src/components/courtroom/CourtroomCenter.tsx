import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import DeliberationRoom from "../deliberation/DeliberationRoom";
import ForepersonSummary from "../deliberation/ForepersonSummary";
import { useCourtroom } from "./CourtroomContext";
import IssueBar from "./IssueBar";
import IssueDetail from "./IssueDetail";
import JudgeBench from "./JudgeBench";
import { importanceMeta, indexIssueResponses } from "./issueMeta";

/**
 * CourtroomCenter · 中央争点对抗区
 *
 * 自上而下：IssueBar（固定争点总览）+ IssueDetail（可滚动三栏对抗）。
 * 选中争点本地维护：默认选中第一个核心争点，无核心则取第一个；切换案件时重置。
 *
 * 数据全部来自运行产物（CaseOutput）；案件未运行（caseOutput 为 null）或无争点时给出占位。
 */
export default function CourtroomCenter() {
  const { caseOutput } = useCourtroom();

  // 「进入评议室」滚动目标。
  const deliberationRef = useRef<HTMLDivElement>(null);
  const scrollToDeliberation = useCallback(() => {
    deliberationRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  const issues = caseOutput?.issues?.issues ?? [];

  // issue_id → 争点文本，供评议室标注争点。
  const issueTextById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const i of issues) map[i.issue_id] = i.issue_text;
    return map;
  }, [issues]);

  // 法官争点回应表按 issue_id 索引，供总览条状态与详情区法官认定取用。
  const responseIndex = useMemo(
    () => indexIssueResponses(caseOutput?.judge_summary),
    [caseOutput],
  );

  // 默认争点：第一个核心争点，否则第一个争点。
  const defaultIssueId = useMemo(() => {
    if (issues.length === 0) return null;
    const core = issues.find((i) => importanceMeta(i.importance).core);
    return (core ?? issues[0]).issue_id;
  }, [issues]);

  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(
    defaultIssueId,
  );

  // 案件切换 / 争点集合变化时，若当前选中已失效则回退到默认争点。
  useEffect(() => {
    setSelectedIssueId((cur) => {
      if (cur && issues.some((i) => i.issue_id === cur)) return cur;
      return defaultIssueId;
    });
  }, [defaultIssueId, issues]);

  if (!caseOutput) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center bg-surface-alt p-8">
        <p className="max-w-md text-center font-display text-base text-ink-secondary">
          该案件尚未运行，暂无争点对抗分析。
        </p>
      </div>
    );
  }

  if (issues.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center bg-surface-alt p-8">
        <p className="max-w-md text-center font-display text-base text-ink-secondary">
          本案运行产物中未识别出争点。
        </p>
      </div>
    );
  }

  const selectedIssue =
    issues.find((i) => i.issue_id === selectedIssueId) ?? issues[0];

  const hasJudge = (caseOutput.judge_summary?.issue_response_table?.length ?? 0) > 0 ||
    (caseOutput.judge_summary?.resolved_points?.length ?? 0) > 0 ||
    (caseOutput.judge_summary?.unresolved_points?.length ?? 0) > 0;
  const hasDeliberation =
    (caseOutput.deliberation_room?.rounds?.length ?? 0) > 0;
  const fore = caseOutput.foreperson_summary;
  const hasForeperson = Boolean(
    fore &&
      (fore.majority_view ||
        (fore.consensus_points?.length ?? 0) > 0 ||
        fore.final_deliberation_note),
  );
  // 写作 Agent 产物存在时，首席总结底部出现「查看最终报告」入口。
  const reportTo =
    (caseOutput.final_report?.case_summary?.trim()?.length ?? 0) > 0
      ? `/case/${caseOutput.case_id}/report`
      : undefined;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface">
      <IssueBar
        issues={issues}
        responseIndex={responseIndex}
        selectedIssueId={selectedIssue.issue_id}
        onSelect={setSelectedIssueId}
      />
      {/* 单一滚动容器：争点详情 → 法官席 → 评议室，使「进入评议室」可平滑滚动。 */}
      <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
        <IssueDetail
          issue={selectedIssue}
          caseOutput={caseOutput}
          responseRow={responseIndex[selectedIssue.issue_id]}
        />
        {hasJudge && (
          <JudgeBench
            caseOutput={caseOutput}
            onEnterDeliberation={scrollToDeliberation}
          />
        )}
        {hasDeliberation && (
          <DeliberationRoom
            ref={deliberationRef}
            room={caseOutput.deliberation_room}
            issueTextById={issueTextById}
          />
        )}
        {hasForeperson && (
          <ForepersonSummary summary={fore} reportTo={reportTo} />
        )}
      </div>
    </div>
  );
}
