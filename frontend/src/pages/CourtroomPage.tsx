import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import CaseDocket from "../components/courtroom/CaseDocket";
import CourtroomCenter from "../components/courtroom/CourtroomCenter";
import {
  CourtroomContext,
  type CourtroomContextValue,
  type RoleViewKey,
} from "../components/courtroom/CourtroomContext";
import PipelineHeader from "../components/courtroom/PipelineHeader";
import { getCase, getCaseOutput } from "../services/caseService";
import type { CaseInput, CaseOutput } from "../types";

/**
 * CourtroomPage · 庭审主工作台
 *
 * 三栏布局，本任务实现顶部状态条 + 左侧卷宗栏；中央区域暂为占位（下一任务实现）。
 *   顶部：PipelineHeader（56px）
 *   左侧：CaseDocket（320px 固定宽，独立滚动）
 *   中央：flex-1 占位
 *
 * 数据：并行加载案件输入与运行产物，经 CourtroomContext 下发给各子组件。
 */
export default function CourtroomPage() {
  const { caseId } = useParams<{ caseId: string }>();

  const [caseInput, setCaseInput] = useState<CaseInput | null>(null);
  const [caseOutput, setCaseOutput] = useState<CaseOutput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [roleView, setRoleView] = useState<RoleViewKey>("all");
  const [selectedFactId, setSelectedFactId] = useState<string | null>(null);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!caseId) return;
    let alive = true;
    setCaseInput(null);
    setCaseOutput(null);
    setError(null);
    Promise.all([getCase(caseId), getCaseOutput(caseId)])
      .then(([input, output]) => {
        if (!alive) return;
        setCaseInput(input);
        setCaseOutput(output);
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      alive = false;
    };
  }, [caseId]);

  const selectFact = useCallback((factId: string) => {
    setSelectedFactId((cur) => (cur === factId ? null : factId));
  }, []);

  const selectEvidence = useCallback((evidenceId: string) => {
    setSelectedEvidenceId((cur) => (cur === evidenceId ? null : evidenceId));
  }, []);

  const value = useMemo<CourtroomContextValue | null>(() => {
    if (!caseInput) return null;
    return {
      caseInput,
      caseOutput,
      roleView,
      setRoleView,
      selectedFactId,
      selectedEvidenceId,
      selectFact,
      selectEvidence,
    };
  }, [
    caseInput,
    caseOutput,
    roleView,
    selectedFactId,
    selectedEvidenceId,
    selectFact,
    selectEvidence,
  ]);

  if (error) {
    return (
      <div className="p-8">
        <p className="font-label text-sm text-ink-secondary">
          案件载入失败：{error}
        </p>
      </div>
    );
  }

  if (!value) {
    return (
      <div className="p-8">
        <p className="font-label text-sm text-ink-secondary">正在载入案件…</p>
      </div>
    );
  }

  return (
    <CourtroomContext.Provider value={value}>
      {/* 整页高度 = 视口减去 AppShell 顶栏（48px）。 */}
      <div className="flex h-[calc(100vh-48px)] flex-col">
        <PipelineHeader />

        <div className="flex min-h-0 flex-1">
          {/* 左：卷宗栏（固定 320px，独立滚动） */}
          <aside className="w-80 shrink-0 overflow-y-auto border-r border-border bg-surface">
            <CaseDocket />
          </aside>

          {/* 中：争点对抗区（IssueBar 固定 + IssueDetail 三栏滚动） */}
          <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface-alt">
            <CourtroomCenter />
          </main>
        </div>
      </div>
    </CourtroomContext.Provider>
  );
}
