/**
 * 多智能体法律协商系统 · 领域类型定义
 *
 * 这些类型与后端产物一一对应：
 *  - CaseInput   ←→ datasets/cases/processed/{caseId}.json
 *  - CaseOutput  ←→ outputs/{caseId}/state_final.json（src/state_manager.create_state 后的完整 state）
 *  - 各 Agent 输出 ←→ schemas/agent_output_schemas.json
 *
 * 约定：所有字段都显式列出，不使用 any。对来自 schema 的枚举值用字面量联合类型，
 * 但对模型自由生成、取值不固定的字段（如 issue_type / importance）保留为 string。
 */

/* ===========================================================================
 * 0. 公共枚举 / 别名
 * ======================================================================== */

/** 任务模式：教学 / 实务。 */
export type TaskMode = "teaching" | "practice";

/** 争点证明状态。 */
export type IssueStatus = "open" | "partly_closed" | "closed";

/** 四类评议者角色。 */
export type ReviewerRole = "legal" | "social" | "expert" | "public";

/** 评议立场。 */
export type Position = "guilty" | "not_guilty" | "partial" | "unclear";

/** 第二轮回应关系。 */
export type Relation = "agree" | "disagree" | "partially_agree";

/** 事实争议状态。 */
export type FactStatus = "undisputed" | "disputed" | "alleged" | "unknown";

/** 流水线运行模式。 */
export type PipelineMode = "full" | "linear" | "baseline";

/** 数据集划分归属：开发集 / 测试集。 */
export type CaseSplit = "dev" | "test";

/* ===========================================================================
 * 1. 案件输入（processed JSON）
 * ======================================================================== */

/** 领域信息。 */
export interface Domain {
  jurisdiction: string;
  case_category: string;
  primary_issue_type: string;
  secondary_issue_types: string[];
}

/** 案件来源 / 改编说明。 */
export interface CaseSource {
  source_id: string;
  source_type: string;
  citation: string;
  url: string;
  retrieval_date: string;
  original_case_number: string;
  adaptation_type: string;
  adaptation_notes: string;
  anonymized: boolean;
}

/**
 * 时间线事件。
 * 案件输入里带 fact_ids；clerk 重新整理的 case_structured.timeline 不带 fact_ids，
 * 因此此处可选。
 */
export interface TimelineEvent {
  event_id: string;
  order: number;
  time_label: string;
  content: string;
  fact_ids?: string[];
}

/** 案情叙述。 */
export interface CaseNarrative {
  neutral_summary: string;
  timeline: TimelineEvent[];
}

/** 诉讼参与人。 */
export interface Participant {
  participant_id: string;
  role: string;
  anonymized_name: string;
  attributes: Record<string, string>;
}

/** 事实条目。 */
export interface Fact {
  fact_id: string;
  content: string;
  status: FactStatus;
  asserted_by: string[];
  evidence_ids: string[];
  notes: string;
}

/** 主张条目。 */
export interface Claim {
  claim_id: string;
  /** prosecution / defense / defendant */
  actor_role: string;
  content: string;
  supporting_evidence_ids: string[];
  /** asserted 等 */
  claim_status: string;
}

/** 证据条目。 */
export interface Evidence {
  evidence_id: string;
  evidence_type: string;
  content: string;
  source_actor: string;
  collection_context: string;
  /** confirmed / unknown 等 */
  authenticity_status: string;
  /** summary_only / partial 等 */
  availability: string;
  notes: string;
}

/** 单条证据质证记录。 */
export interface EvidenceExamination {
  evidence_id: string;
  status: string;
  notes: string;
}

/** 程序信息。 */
export interface Procedure {
  current_stage: string;
  completed_actions: string[];
  missing_or_disputed_actions: string[];
  evidence_examination: EvidenceExamination[];
}

/** 单个角色对材料的可见范围。 */
export interface RoleView {
  fact_ids: string[];
  claim_ids: string[];
  evidence_ids: string[];
  procedure_access: boolean;
  notes: string;
}

/** 所有角色的可见范围集合。 */
export interface RoleViews {
  clerk: RoleView;
  issue_spotter: RoleView;
  prosecutor: RoleView;
  defense_lawyer: RoleView;
  defendant: RoleView;
  judge: RoleView;
  reviewers: RoleView;
  foreperson: RoleView;
  writer: RoleView;
}

/** 案件元数据。 */
export interface CaseMetadata {
  difficulty: string;
  /** 配对案件 id（最小对照组的另一半）。 */
  paired_case_id: string;
  /** "A" | "B" */
  pair_variant: string;
  target_capabilities: string[];
  created_by: string[];
  review_status: string;
}

/** 案件完整输入，对应 datasets/cases/processed/{caseId}.json。 */
export interface CaseInput {
  case_id: string;
  version: string;
  language: string;
  task_mode: TaskMode;
  domain: Domain;
  title: string;
  source: CaseSource;
  case_narrative: CaseNarrative;
  participants: Participant[];
  facts: Fact[];
  claims: Claim[];
  evidence: Evidence[];
  procedure: Procedure;
  role_views: RoleViews;
  metadata: CaseMetadata;
}

/* ===========================================================================
 * 2. 上游 Agent 输出
 * ======================================================================== */

/* ---- Clerk（书记员）：case_structured ---------------------------------- */

export interface ClerkParty {
  id: string;
  role: string;
  anonymized_name: string;
}

export interface ClerkTimelineEvent {
  event_id: string;
  order: number;
  time_label: string;
  content: string;
}

export interface ClerkEvidenceItem {
  evidence_id: string;
  evidence_type: string;
  content: string;
  notes: string;
}

/** 书记员结构化输出（state.case_structured）。 */
export interface ClerkOutput {
  parties: ClerkParty[];
  timeline: ClerkTimelineEvent[];
  key_facts: string[];
  evidence_items: ClerkEvidenceItem[];
  uncertain_facts: string[];
  criminal_charge_hint: string;
  fact_source_notes: string[];
}

/* ---- Issue Spotter（争点识别）：issues ---------------------------------- */

/** 单个争点。 */
export interface Issue {
  issue_id: string;
  issue_text: string;
  issue_type: string;
  related_fact_ids: string[];
  related_evidence_ids: string[];
  /** core / secondary 等 */
  importance: string;
  rationale: string;
}

/** 候选争点（未纳入主表）。 */
export interface IssueCandidate {
  issue_text: string;
  rationale: string;
}

/** 争点识别整体输出（state.issues）。 */
export interface IssueSpotterOutput {
  issues: Issue[];
  main_issues: string[];
  sub_issues: string[];
  issue_candidates: IssueCandidate[];
  issue_notes: string[];
}

/* ---- 控辩共用结构 ------------------------------------------------------- */

/** 按争点提出的主张（控方/辩方 claims 元素）。 */
export interface IssueClaim {
  issue_id: string;
  claim: string;
  basis: string;
}

/** 按争点组织的论证（控辩共用）。 */
export interface ArgumentByIssue {
  issue_id: string;
  claim: string;
  evidence_ids: string[];
  reasoning: string;
  weak_points: string[];
}

/* ---- Prosecutor（公诉方）：prosecutor_analysis ------------------------- */

/** 证据—争点映射表条目（控方）。 */
export interface EvidenceIssueMapItem {
  evidence_id: string;
  issue_ids: string[];
  proving_purpose: string;
  prosecution_strength: string;
}

/** 公诉方完整分析（state.prosecutor_analysis）。 */
export interface ProsecutorOutput {
  accusation: string;
  prosecutor_opinion: string;
  claims: IssueClaim[];
  evidence_issue_map: EvidenceIssueMapItem[];
  arguments_by_issue: ArgumentByIssue[];
  overall_weak_points: string[];
  confidence: number;
}

/* ---- Defense（辩护方）：defense_analysis ------------------------------- */

/** 对指控的逐项反驳。 */
export interface Rebuttal {
  issue_id: string;
  prosecution_claim: string;
  defense_rebuttal: string;
  core_response: string;
}

/** 对单份证据的质证。 */
export interface EvidenceChallenge {
  evidence_id: string;
  authenticity_challenge: string;
  relevance_challenge: string;
  probative_value_challenge: string;
  defense_conclusion: string;
}

/** 辩护方完整分析（state.defense_analysis）。 */
export interface DefenseOutput {
  defense_opinion: string;
  claims: IssueClaim[];
  rebuttals_to_accusation: Rebuttal[];
  evidence_challenges: EvidenceChallenge[];
  arguments_by_issue: ArgumentByIssue[];
  alternative_explanations: string[];
  overall_weak_points: string[];
  confidence: number;
}

/* ---- Defendant（被告人）：defendant_statement ------------------------- */

export interface DefendantStatement {
  identity_confirmation: string;
  attitude_to_accusation: string;
  personal_statement: string;
  response_style: string;
  uncertain_or_avoided_points: string[];
}

/* ---- Judge（法官）：judge_summary ------------------------------------- */

/** 法官争点回应表条目。 */
export interface IssueResponseRow {
  issue_id: string;
  current_status: IssueStatus;
  supporting_evidence_ids: string[];
  opposing_evidence_ids: string[];
  reason: string;
  remaining_gap: string;
}

/** 证据缺口条目（法官）。 */
export interface EvidenceGap {
  issue_id: string;
  gap: string;
}

/** 法官庭审小结（state.judge_summary）。 */
export interface JudgeSummary {
  final_main_issues: string[];
  issue_response_table: IssueResponseRow[];
  attacked_prosecution_evidence: string[];
  resolved_points: string[];
  unresolved_points: string[];
  evidence_gaps: EvidenceGap[];
  judge_observations: string[];
  discussion_focus: string[];
  uncertainty_reasons: string[];
  preliminary_judgment_tendency: string;
}

/* ===========================================================================
 * 3. 评议（两轮）
 * ======================================================================== */

/** 评议者对单个争点的证明状态判断（round1）。 */
export interface IssueProofStatus {
  issue_id: string;
  status: IssueStatus;
  reason: string;
}

/** 第一轮评议发言。 */
export interface ReviewerRound1 {
  agent_id: string;
  role: ReviewerRole;
  round: number;
  speech_type: string;
  position: Position;
  core_claim: string;
  supporting_reasons: string[];
  main_concern: string;
  evidence_gap_focus: string[];
  issue_proof_status: IssueProofStatus[];
  confidence: number;
}

/** round2.respond_to 数组元素：对某个评议者某个观点的回应。 */
export interface ResponseTo {
  target_agent: string;
  relation: Relation;
  issue_id: string;
  target_point: string;
  accepted_part: string;
  rejected_part: string;
  response_reason: string;
}

/** 第二轮中对某争点状态的更新。 */
export interface IssueStatusUpdate {
  issue_id: string;
  before_status: IssueStatus;
  after_status: IssueStatus;
  change_reason: string;
}

/** 第二轮评议发言。 */
export interface ReviewerRound2 {
  agent_id: string;
  role: ReviewerRole;
  round: number;
  speech_type: string;
  respond_to: ResponseTo[];
  position_before: Position;
  position_after: Position;
  position_changed: boolean;
  change_reason: string;
  new_allies: string[];
  new_opponents: string[];
  remaining_disagreement: string;
  open_proof_gap: string;
  issue_status_after_response: IssueStatus;
  issue_status_updates: IssueStatusUpdate[];
  confidence_after: number;
}

/* ===========================================================================
 * 4. 评议室（deliberation_room，由 pipeline.build_deliberation_room 构造）
 * ======================================================================== */

/** 评议室中的一轮（speeches 在 round1 是 ReviewerRound1，round2 是 ReviewerRound2）。 */
export interface DeliberationRound {
  round_id: number;
  /** opening_statement / response */
  round_type: string;
  speeches: Array<ReviewerRound1 | ReviewerRound2>;
}

/** 立场 → 票数。 */
export type VoteTally = Record<string, number>;

/** 两轮投票统计。 */
export interface VoteHistory {
  round1: VoteTally;
  round2: VoteTally;
}

/** 单个评议者的联盟条目。 */
export interface AllianceEntry {
  position_before: string;
  position_after: string;
  position_changed: boolean;
  allies: string[];
  opponents: string[];
}

/** 联盟图：agent_id → 联盟条目。 */
export type AllianceMap = Record<string, AllianceEntry>;

/** 分歧图条目（来自 build_disagreement_map）。 */
export interface DisagreementEntry {
  agent_id: string;
  target_agent: string;
  relation: string;
  issue_id: string;
  response_reason: string;
}

/** 分歧图（一个扁平数组）。 */
export type DisagreementMap = DisagreementEntry[];

/**
 * 状态变化条目（来自 build_state_changes）。
 * change_type === "position" 时无 issue_id；=== "issue_status" 时带 issue_id。
 */
export interface StateChange {
  agent_id: string;
  /** position | issue_status */
  change_type: string;
  issue_id?: string;
  before: string;
  after: string;
  reason: string;
}

/** 争点状态时间线条目。 */
export interface IssueStatusTimelineEntry {
  round_id: number;
  agent_id: string;
  issue_id: string;
  status: string;
  reason: string;
}

/** 评议最终的争点状态（聚合后）。 */
export interface FinalIssueStatus {
  issue_id: string;
  issue: string;
  issue_text: string;
  final_status: IssueStatus;
  supporting_reason: string;
  remaining_gap: string;
}

/** 评议最终结果。 */
export interface FinalMeetingResult {
  final_issue_status: FinalIssueStatus[];
}

/** 评议室完整结构（state.deliberation_room）。 */
export interface DeliberationRoom {
  participants: string[];
  rounds: DeliberationRound[];
  vote_history: VoteHistory;
  /** enable_round2 关闭时为空对象。 */
  alliance_map: AllianceMap;
  disagreement_map: DisagreementMap;
  state_changes: StateChange[];
  issue_status_timeline: IssueStatusTimelineEntry[];
  final_meeting_result: FinalMeetingResult;
}

/* ===========================================================================
 * 5. 首席评议（foreperson）与最终报告（writer）
 * ======================================================================== */

/** 首席评议汇总（state.foreperson_summary）。 */
export interface ForepersonSummary {
  majority_view: string;
  minority_view: string;
  vote_summary: VoteHistory;
  consensus_points: string[];
  disagreement_points: string[];
  reserved_points: string[];
  evidence_gap_summary: string[];
  final_deliberation_note: string;
}

/** 最终报告里的评议小结（与 ForepersonSummary 不同，仅含多数/少数意见文本）。 */
export interface ReportReviewerSummary {
  majority_view: string;
  minority_view: string;
}

/** 最终报告（state.final_report，writer 输出，teaching/practice 字段一致）。 */
export interface FinalReport {
  mode_hint: string;
  case_summary: string;
  core_issues: string[];
  prosecutor_view: string[];
  defense_view: string[];
  judge_summary: string[];
  reviewer_summary: ReportReviewerSummary;
  evidence_gaps: string[];
  open_questions: string[];
  risk_flags: string[];
  next_step_suggestions: string[];
}

/* ===========================================================================
 * 6. 运行配置 与 完整 state（CaseOutput）
 * ======================================================================== */

/** 流水线运行配置（state.config）。 */
export interface PipelineConfig {
  mode: PipelineMode;
  role_separation: boolean;
  enable_round2: boolean;
  adversarial_exchange: boolean;
  proof_state: boolean;
  name: string;
}

/**
 * 完整运行产物，对应 outputs/{caseId}/state_final.json。
 *
 * 注意：这是 create_state 之后又被各 Agent 逐步写入的 state，
 * 因此既包含案件输入的大部分字段（但不含 version/language/title/source/metadata），
 * 也包含 *_index 与所有 Agent 输出。
 */
export interface CaseOutput {
  case_id: string;
  task_mode: TaskMode;
  domain: Domain;
  case_narrative: CaseNarrative;
  participants: Participant[];
  facts: Fact[];
  claims: Claim[];
  evidence: Evidence[];
  procedure: Procedure;
  role_views: RoleViews;

  fact_index: Record<string, Fact>;
  claim_index: Record<string, Claim>;
  evidence_index: Record<string, Evidence>;

  config: PipelineConfig;

  /* 上游 Agent 产物 */
  case_structured: ClerkOutput;
  issues: IssueSpotterOutput;
  prosecutor_analysis: ProsecutorOutput;
  defense_analysis: DefenseOutput;
  defendant_statement: DefendantStatement;
  judge_summary: JudgeSummary;

  /* 评议（当前 + 全量） */
  current_round1_review: ReviewerRound1;
  current_round2_review: ReviewerRound2;
  reviewer_outputs: ReviewerRound1[];
  round2_outputs: ReviewerRound2[];

  /* 评议室 + 汇总 + 报告 */
  deliberation_room: DeliberationRoom;
  foreperson_summary: ForepersonSummary;
  final_report: FinalReport;
  /** 双模式报告（state.final_reports），按 task_mode 索引；验证集案件含 teaching + practice。 */
  final_reports?: Partial<Record<TaskMode, FinalReport>>;
}

/* ===========================================================================
 * 7. 前端数据服务辅助类型
 * ======================================================================== */

/** 案件列表摘要（listCases 返回元素）。 */
export interface CaseSummary {
  case_id: string;
  title: string;
  task_mode: TaskMode;
  case_category: string;
  primary_issue_type: string;
  difficulty: string;
  paired_case_id: string;
  pair_variant: string;
  neutral_summary: string;
  /** 是否已有运行产物（state_final.json）。 */
  has_output: boolean;
  /** 是否有实务模式报告（final_reports.practice）。 */
  has_practice: boolean;
  /** 数据集划分归属（开发集 / 测试集）；不在任何划分中时为 null。 */
  split: CaseSplit | null;
}

/** manifest.json 里的数据集划分（开发集 / 测试集的 id 列表）。 */
export interface ManifestSplits {
  development: string[];
  test: string[];
}

/** public/data/manifest.json：可用案件、已有产物与数据集划分。 */
export interface DataManifest {
  cases: string[];
  outputs: string[];
  /** 运行产物里真的含 practice 报告的案件；旧版 manifest 可能没有，故可选。 */
  practice?: string[];
  /** 数据集划分；旧版 manifest 可能没有此字段，故可选。 */
  splits?: ManifestSplits;
}
