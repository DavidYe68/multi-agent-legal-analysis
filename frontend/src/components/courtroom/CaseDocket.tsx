import CaseSummarySection from "./CaseSummarySection";
import CollapsibleSection from "./CollapsibleSection";
import { useCourtroom } from "./CourtroomContext";
import EvidenceList from "./EvidenceList";
import FactList from "./FactList";
import RoleViewSelector from "./RoleViewSelector";

/**
 * CaseDocket · 左侧卷宗栏
 *
 * 顶部角色视图切换 + 三个默认展开的折叠区域：案件摘要 / 事实 / 证据。
 * 全部数据来自当前案件的 CaseInput（经 CourtroomContext 提供）。
 */
export default function CaseDocket() {
  const { caseInput } = useCourtroom();

  return (
    <div className="flex flex-col">
      <RoleViewSelector />

      <CollapsibleSection title="案件摘要">
        <CaseSummarySection />
      </CollapsibleSection>

      <CollapsibleSection title="事实" count={caseInput.facts.length}>
        <FactList />
      </CollapsibleSection>

      <CollapsibleSection title="证据" count={caseInput.evidence.length}>
        <EvidenceList />
      </CollapsibleSection>
    </div>
  );
}
