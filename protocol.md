# 通信协议（消息格式定义）

本文件定义系统内各 Agent 之间如何传递信息：消息怎么组织、写到共享状态的哪个位置、谁能读到、按什么顺序触发。所有字段以 `schemas/agent_output_schemas.json` 和 `schemas/state_schema.json` 为准，本文件是它们的说明与索引。

## 1. 通信模型

各 Agent 不直接互相发消息，而是围绕一个共享的 `state` 对象读写，由编排器 `src/pipeline.py` 按固定顺序调度。一次完整运行的流程如下：

```
案件输入 + 运行配置
      │
      ▼
[issue_spotter] 争点识别
      │
      ▼
[prosecutor] 公诉论证 ──► [defense_lawyer] 辩护论证 ──► [defendant] 被告陈述
      │
      ▼
[judge] 争点回应表 / 证据缺口 / 倾向
      │
      ▼
评议室：round1 四位评议员独立发言 ──► round2 相互回应
      │
      ▼
[foreperson] 多数/少数意见收束
      │
      ▼
[writer] teaching / practice 两份报告
```

每个 Agent 做三件事：

1. 从 `state` 取一份**按角色裁剪的视图**（`src/role_view.py`，见第 5 节）。
2. 产出一段**符合自身 schema 的结构化 JSON**（第 3 节）。
3. 把结果写回 `state` 的约定 key（第 4 节），并留下一条日志（第 2 节）。

`clerk` 在 schema 与 `role_views` 中有定义，但当前 `full` 流程未启用它，运行从 `issue_spotter` 开始。

## 2. 消息信封

每次 Agent 调用都会追加一条日志记录（`src/logger.py`），一个案件的全部记录按调用顺序存成一个数组，落到 `multi_agent_logs/{config_name}/{case_id}_log.json`。信封字段固定如下：

| 字段 | 类型 | 含义 |
|---|---|---|
| `agent_name` | string | 发出该消息的 Agent，如 `prosecutor`、`legal_reviewer_round1` |
| `timestamp` | string | 记录写入时间（ISO 8601） |
| `input` | object | 传给该 Agent 的角色视图（裁剪后的输入） |
| `output` | object | 该 Agent 产出的结构化 JSON（消息体，格式见第 3 节） |
| `case_id` | string | 案件编号 |
| `round_id` | number/string | 评议轮次；`round1` 为 1，`round2` 为 2，非评议阶段为空 |
| `model` | string | 使用的模型名 |
| `temperature` | number | 采样温度 |
| `start_time` / `end_time` | string | 该次调用起止时间 |
| `latency_sec` | number | 单次耗时（秒） |
| `prompt_tokens` / `completion_tokens` / `total_tokens` | number | token 用量 |
| `cache_hit_tokens` / `cache_miss_tokens` | number | 缓存命中/未命中 token |
| `estimated_cost` | number | 该次调用估算成本 |
| `retry_count` | number | 因校验失败重试的次数 |
| `validation_passed` | bool | 输出是否通过 schema 校验 |
| `error` | string | 错误信息，正常为空串 |

一条真实信封（取自 `multi_agent_logs/full/criminal_001a_log.json`，`input`/`output` 略）：

```json
{
  "agent_name": "prosecutor",
  "timestamp": "2026-06-30T21:45:16.639970",
  "case_id": "criminal_001a",
  "round_id": "",
  "model": "deepseek-v4-flash",
  "temperature": 0,
  "latency_sec": 21.195,
  "prompt_tokens": 4201,
  "completion_tokens": 2262,
  "total_tokens": 6463,
  "retry_count": 0,
  "validation_passed": true,
  "error": ""
}
```

## 3. 消息体：各角色输出格式

以下为各 Agent 写入 `output` 的字段。带 `[]` 为数组，带 `{}` 为对象，`?` 为可选字段。完整 JSON Schema 见 `schemas/agent_output_schemas.json`。

### issue_spotter

| 字段 | 说明 |
|---|---|
| `issues[]` | 争点列表，每项 `{issue_id(形如 I1), issue_text, issue_type?, related_fact_ids[], related_evidence_ids[], importance?, rationale?}` |
| `main_issues[]` / `sub_issues[]` | 主争点 / 子争点 |
| `issue_candidates?[]` | 候选争点 |
| `issue_notes[]` | 补充说明 |

### prosecutor

| 字段 | 说明 |
|---|---|
| `accusation` | 指控罪名 |
| `prosecutor_opinion` | 公诉意见 |
| `claims[]` | `{issue_id, claim, basis}` |
| `evidence_issue_map[]` | `{evidence_id, issue_ids[], proving_purpose, prosecution_strength}` |
| `arguments_by_issue[]` | `{issue_id, claim, evidence_ids[], reasoning, weak_points[]}` |
| `overall_weak_points[]` | 整体薄弱环节 |
| `confidence` | 置信度，0–1 |

### defense_lawyer

| 字段 | 说明 |
|---|---|
| `defense_opinion` | 辩护意见 |
| `claims[]` | `{issue_id, claim, basis}` |
| `rebuttals_to_accusation[]` | `{issue_id, prosecution_claim, defense_rebuttal, core_response}` |
| `evidence_challenges[]` | `{evidence_id, authenticity_challenge, relevance_challenge, probative_value_challenge, defense_conclusion}` |
| `arguments_by_issue[]` | `{issue_id, claim, evidence_ids[], reasoning, weak_points[]}` |
| `alternative_explanations[]` | 替代解释 |
| `overall_weak_points[]` | 整体薄弱环节 |
| `confidence` | 置信度，0–1 |

### defendant

| 字段 | 说明 |
|---|---|
| `identity_confirmation` | 身份确认 |
| `attitude_to_accusation` | 对指控的态度 |
| `personal_statement` | 个人陈述 |
| `response_style` | 回应风格 |
| `uncertain_or_avoided_points[]` | 不确定或回避的点 |

### judge

| 字段 | 说明 |
|---|---|
| `final_main_issues[]` | 最终主争点 |
| `issue_response_table[]` | `{issue_id, current_status(open/partly_closed/closed), supporting_evidence_ids[], opposing_evidence_ids[], reason, remaining_gap}` |
| `attacked_prosecution_evidence[]` | 被攻击的控方证据 |
| `resolved_points[]` / `unresolved_points[]` | 已解决 / 未解决的点 |
| `evidence_gaps[]` | `{issue_id, gap}` |
| `judge_observations[]` | 法官观察 |
| `discussion_focus[]` | 建议讨论焦点 |
| `uncertainty_reasons[]` | 不确定性理由 |
| `preliminary_judgment_tendency` | 初步倾向 |

### reviewer_round1（评议第一轮，四位评议员各一条）

| 字段 | 说明 |
|---|---|
| `agent_id` | 评议员标识 |
| `role` | `legal` / `social` / `expert` / `public` |
| `position` | `guilty` / `not_guilty` / `partial` / `unclear` |
| `core_claim` | 核心主张 |
| `supporting_reasons[]` | 支持理由 |
| `main_concern` | 主要关切 |
| `evidence_gap_focus[]` | 关注的证据缺口 |
| `issue_proof_status[]` | `{issue_id, status(open/partly_closed/closed), reason}` |
| `confidence` | 置信度，0–1 |

当运行配置 `proof_state=false` 时，本条改用 `reviewer_round1_no_proof`，去掉 `issue_proof_status`。

### reviewer_round2（评议第二轮）

| 字段 | 说明 |
|---|---|
| `agent_id` / `role` | 同上 |
| `respond_to[]` | `{target_agent, relation(agree/disagree/partially_agree), issue_id, target_point, accepted_part, rejected_part, response_reason}` |
| `position_before` / `position_after` | 回应前后的立场（取值同 `position`） |
| `position_changed` | 立场是否改变（bool） |
| `change_reason` | 改变理由 |
| `new_allies[]` / `new_opponents[]` | 新结盟 / 新对立 |
| `remaining_disagreement` | 剩余分歧 |
| `open_proof_gap` | 尚存的证明缺口 |
| `issue_status_after_response` | 回应后争点状态（open/partly_closed/closed） |
| `issue_status_updates[]` | `{issue_id, before_status, after_status, change_reason}` |
| `confidence_after` | 回应后置信度，0–1 |

当 `proof_state=false` 时改用 `reviewer_round2_no_proof`，去掉 `open_proof_gap`、`issue_status_after_response`、`issue_status_updates`。

### foreperson（评议收束）

| 字段 | 说明 |
|---|---|
| `majority_view` / `minority_view` | 多数 / 少数意见 |
| `vote_summary` | 投票汇总（对象） |
| `consensus_points[]` / `disagreement_points[]` | 共识 / 分歧点 |
| `reserved_points?[]` | 保留意见 |
| `evidence_gap_summary[]` | 证据缺口汇总 |
| `final_deliberation_note` | 评议结论说明 |

### writer_teaching / writer_practice（报告）

两种模式共有：`mode_hint`（`teaching` 或 `practice`）、`case_summary`、`core_issues[]`、`prosecutor_view[]`、`defense_view[]`、`judge_summary[]`、`reviewer_summary{}`、`evidence_gaps[]`。

差异：

| 模式 | 附加约束 |
|---|---|
| `teaching` | `open_questions[]` 必填；`risk_flags[]`、`next_step_suggestions[]` 可选 |
| `practice` | `risk_flags[]` 与 `next_step_suggestions[]` 必填，各 3–6 条、每条至少 8 字；`core_issues[]`、`evidence_gaps[]` 至少 1 条 |

## 4. 共享状态与写入位置

每个 Agent 的输出写回 `state` 的固定 key，供后续 Agent 读取。生产者与写入位置对应关系：

| 生产者 | 写入 `state` key |
|---|---|
| issue_spotter | `issues` |
| prosecutor | `prosecutor_analysis` |
| defense_lawyer | `defense_analysis` |
| defendant | `defendant_statement` |
| judge | `judge_summary` |
| reviewer_round1 ×4 | 逐条经 `current_round1_review` 收集进 `reviewer_outputs` |
| reviewer_round2 ×4 | 逐条经 `current_round2_review` 收集进 `round2_outputs` |
| 编排器（汇总 round1/round2） | `deliberation_room`（见第 6 节） |
| foreperson | `foreperson_summary` |
| writer | `final_report`，并按模式存入 `final_reports.teaching` / `final_reports.practice` |

`state` 的必备字段与运行配置由 `schemas/state_schema.json` 约束。运行配置 `config`：

| 字段 | 取值 | 作用 |
|---|---|---|
| `mode` | `baseline` / `linear` / `full` | 运行档位 |
| `role_separation` | bool | 是否按角色裁剪事实/证据可见范围（见第 5 节） |
| `enable_round2` | bool | 是否进行评议第二轮 |
| `adversarial_exchange` | bool | 第二轮评议员是否读到其他评议员的第一轮发言 |
| `proof_state` | bool | 评议员是否输出争点证明状态字段 |
| `name` | string | 该配置名，决定日志目录 |

## 5. 角色可见性

`get_role_view(state, role)` 决定每个角色能读到哪些内容。基础视图含案件叙事、当事人、事实、主张、证据、程序；在此之上按角色叠加：

| 角色 | 在基础视图外可读 |
|---|---|
| issue_spotter | 仅基础视图（争点由它产出） |
| prosecutor | `issues` |
| defense_lawyer | `issues`、`prosecutor_analysis` |
| defendant | 仅基础视图（不读争点与控方分析） |
| judge | `issues`、`prosecutor_analysis`、`defense_analysis`、`defendant_statement`、程序 |
| reviewers | `issues`、`prosecutor_analysis`、`defense_analysis`、`defendant_statement`、`judge_summary` |
| foreperson | `judge_summary`、`reviewer_outputs`、`round2_outputs`、`deliberation_room` |
| writer | `issues`、`prosecutor_analysis`、`defense_analysis`、`defendant_statement`、`judge_summary`、`foreperson_summary`、`deliberation_room` |

事实/主张/证据的裁剪由 `config.role_separation` 控制：

- 为 `true` 时，各角色只看到案件文件 `role_views[role]` 里列出的 `fact_ids` / `claim_ids` / `evidence_ids`，程序是否可读由该规则的 `procedure_access` 决定。
- 为 `false` 时，各角色看到全部事实、主张、证据与程序。

案件文件中一条 `role_views` 规则示例：

```json
"issue_spotter": {
  "fact_ids": ["F1", "F2", "F3", "F4", "F5", "F6"],
  "claim_ids": ["C1", "C2", "C3"],
  "evidence_ids": ["E1", "E2", "E3", "E4", "E5"],
  "procedure_access": true,
  "notes": "只识别争点，不读取金标准。"
}
```

评议阶段是唯一存在 Agent 之间直接读取彼此消息的环节：当 `adversarial_exchange=true` 时，第二轮每位评议员会收到自己的第一轮发言加上其他三位的第一轮发言，据此产生 `respond_to`。

## 6. 交互时序与聚合规则

一次 `full` 运行的消息顺序（与日志逐条对应）：

```
1  issue_spotter
2  prosecutor
3  defense_lawyer
4  defendant
5  judge
6  legal_reviewer_round1     round_id=1
7  social_reviewer_round1    round_id=1
8  expert_reviewer_round1    round_id=1
9  public_reviewer_round1    round_id=1
10 legal_reviewer_round2     round_id=2
11 social_reviewer_round2    round_id=2
12 expert_reviewer_round2    round_id=2
13 public_reviewer_round2    round_id=2
14 foreperson
15 writer  (teaching)
16 writer  (practice)
```

`writer` 出现两次，是因为同一案件产出 teaching 与 practice 两份报告，各记一条。

编排器在评议两轮结束后聚合出 `deliberation_room`，它不是某个 Agent 的输出，而是对评议消息的汇总：

| 字段 | 内容 |
|---|---|
| `participants` | 四位评议员标识 |
| `rounds` | 两轮发言：`{round_id, round_type(opening_statement/response), speeches[]}` |
| `vote_history` | 每轮各立场的计数 |
| `alliance_map` | 结盟/对立关系（需 `enable_round2` 且 `adversarial_exchange`） |
| `disagreement_map` | 分歧关系（需 `adversarial_exchange`） |
| `state_changes` | 立场与争点状态的变化 |
| `issue_status_timeline` | 争点状态随轮次的变化（需 `proof_state`） |
| `final_meeting_result.final_issue_status` | 各争点最终状态（需 `proof_state`） |

单个争点的最终状态由各评议员该争点的状态聚合而来，规则为：只要有一人判 `open` 则最终为 `open`；否则有 `partly_closed` 则为 `partly_closed`；否则为 `closed`；无有效状态时默认 `open`。

## 7. 取值约定

| 名称 | 取值 |
|---|---|
| `position` / `position_before` / `position_after` | `guilty`、`not_guilty`、`partial`、`unclear` |
| 争点状态 `status` / `current_status` / `after_status` / `issue_status_after_response` | `open`、`partly_closed`、`closed` |
| `relation` | `agree`、`disagree`、`partially_agree` |
| `mode_hint` | `teaching`、`practice` |
| `config.mode` | `baseline`、`linear`、`full` |
| 评议员 `role` | `legal`、`social`、`expert`、`public` |
| `confidence` / `confidence_after` | 0 到 1 的数值 |
| `issue_id` | 形如 `I1`、`I2` |

## 8. 校验与容错

- 每个 Agent 的 `output` 在写回前按 `schemas/agent_output_schemas.json` 中对应的 schema 校验，结果记入信封的 `validation_passed`。
- 校验失败会触发重试，次数记入 `retry_count`；仍失败则 `error` 记录原因。
- 一次运行结束后，整体 `state` 按 `schemas/state_schema.json` 校验：不同 `mode` 要求的字段不同，`linear` 与 `full` 需含从 `issues` 到 `foreperson_summary` 的全部中间结果，`baseline` 需含 `baseline_usage`。

## 9. 日志与本协议的关系

`multi_agent_logs/{config_name}/{case_id}_log.json` 是本协议的运行记录：文件是一个按调用顺序排列的信封数组，每条信封的 `input` 是该 Agent 收到的角色视图，`output` 是它按第 3 节格式产出的消息体。对照一个日志文件即可还原该案件从争点识别到报告生成的完整消息流。
