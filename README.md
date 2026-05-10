# Multi-Agent Legal Analysis System

## 1. Project Overview

本项目构建了一个面向**刑事案件**的多 Agent 法律推理系统。系统并不直接根据案件材料输出"是否有罪"的结论，而是模拟刑事庭审流程中不同角色之间的程序化互动，覆盖：事实整理 → 争点识别 → 公诉方论证 → 辩护方回应 → 被告人陈述 → 法官归纳 → Deliberation Room 多视角两轮评议 → Foreperson 汇总 → Writer 出具报告。

与普通的角色扮演式 multi-agent 项目不同，本系统强调：

* **Role-constrained reasoning**：不同 Agent 通过 `role_view.py` 只读取与其程序角色相符的字段，模拟庭审中的信息隔离
* **Adversarial analysis**：公诉与辩护围绕同一争点结构化对抗（claim / evidence / reasoning / weak_points）
* **Personality-driven deliberation**：4 位 Reviewer 拥有可配置的人格参数（严格度、顺从度、风险厌恶、开放度），影响其立场迁移和证明标准
* **Issue-level proof tracking**：对每个争点单独追踪 `open / partly_closed / closed` 状态，并在两轮评议中动态更新
* **JSON + Markdown 双输出**：所有 state 以 JSON 持久化，并自动生成可读的 Markdown 案件分析报告

---

## 2. System Architecture

整体 pipeline 由 [src/pipeline.py](src/pipeline.py) 编排，分为三段：

**线性庭审段**（按顺序串行调用）：

```
Clerk → IssueSpotter → Prosecutor → DefenseLawyer → Defendant → Judge
```

**Deliberation Room 段**（两轮评议）：

```
Round 1：Legal / Social / Expert / Public 四位 Reviewer 独立发言
Round 2：每位 Reviewer 阅读其余三人 Round 1 输出，进行回应 / 立场更新 / 证明状态更新
```

**汇总输出段**：

```
Foreperson（汇总两轮评议）→ Writer（生成最终结构化报告）
```

Pipeline 在 Round 2 结束后会基于全部 `round2_outputs` 计算 `deliberation_room` 字段，包括：

* `participants`、`rounds`（两轮发言原文）
* `vote_history`（基于 `position_after` 的统计）
* `alliance_map`（每个 Reviewer 的 `new_allies`）
* `disagreement_map`（按 agent 的总结 + 显式 `respond_to` 关系）
* `state_changes`（立场或争点状态发生变化的记录）
* `issue_status_timeline`（Round 1 / Round 2 各自的争点状态快照）
* `final_meeting_result.final_issue_status`（按多数票合并的争点最终状态总表）

---

## 3. Key Features

### 3.1 Role-Constrained Reasoning

不同 Agent 不共享完整 state，而是通过 [role_view.py](src/role_view.py) 拿到对应子集：

| Agent          | 可见信息                                                                                |
| -------------- | ----------------------------------------------------------------------------------- |
| clerk          | `raw_case_text` + `public_info`                                                     |
| issue_spotter  | `case_structured` + `domain_hint`                                                   |
| prosecutor     | `case_structured` + `issues` + `prosecutor_info`                                    |
| defense_lawyer | `case_structured` + `issues` + `prosecutor_analysis` + `defense_lawyer_info`        |
| defendant      | `case_structured` + `defendant_info` + `personality_profile`                        |
| judge          | `issues` + `prosecutor_analysis` + `defense_analysis` + `defendant_statement`       |
| reviewer       | 上述判决前内容 + `judge_summary` + `reviewer_personality`（按角色取）                            |
| foreperson     | `judge_summary` + `reviewer_outputs` + `round2_outputs` + `deliberation_room`       |
| writer         | `case_structured` + `issues` + `judge_summary` + `foreperson_summary` + `user_mode` |

### 3.2 Structured Adversarial Analysis

公诉与辩护必须围绕争点结构化输出：

* Prosecutor：`accusation`、`evidence_issue_map`、`arguments_by_issue`、`overall_weak_points`、`confidence`
* Defense Lawyer：`rebuttals_to_accusation`、`evidence_challenges`（真实性 / 关联性 / 证明力）、`alternative_explanations`
* Judge：`issue_response_table`、`unresolved_points`、`evidence_gaps`、`uncertainty_reasons`，并刻意避免直接采纳公诉结论

输出字段由 [schemas/agent_output_schemas.json](schemas/agent_output_schemas.json) 定义；[base_agent.py](src/agents/base_agent.py) 在 `run()` 中执行字段缺失校验，缺字段时自动重试一次。

### 3.3 Personality-Driven Deliberation

4 位 Reviewer 各自拥有 4 维人格参数（在 case JSON 的 `reviewer_personality_profiles` 中配置）：

* `strictness`：高 → 更严格地要求证明标准
* `agreeableness`：高 → 更容易吸收他人合理观点
* `risk_aversion`：高 → 证据不足时更倾向 `unclear` / `not_guilty`
* `openness`：高 → 更容易接受 `partial` 等中间立场

人格通过 `role_view` 与 `pipeline` 同时注入到 Round 1 和 Round 2 的 prompt 中。被告人则使用 Big Five 五维人格（见 [data/personality_profiles.json](data/personality_profiles.json)）。

### 3.4 Issue-Level Proof Tracking

系统不会直接输出单一 verdict，而是对每个争点记录：

* Round 1：每位 Reviewer 给出 `issue_proof_status`（initial 判断）
* Round 2：每位 Reviewer 给出 `issue_status_updates`（含 `before_status`、`after_status`、`change_reason`）
* Pipeline 末尾：按多数票合并，得到 `final_issue_status`，写入 Markdown 报告的争点状态总表

```text
Issue A: open → partly_closed
Issue B: still open
```

### 3.5 Markdown Case Report

[report_utils.py](src/report_utils.py) 将 state 渲染为 Markdown 报告，包括：案件摘要、核心争点、公诉/辩护观点、法官归纳、**Deliberation Room 争点证明状态总表**、多视角评议结果（多数/少数 + 共识/分歧）、证据缺口、待讨论问题、风险提示和下一步建议。

---

## 4. Project Structure

```
project/
├── README.md
├── Evaluation Report.md            # 5 个案例的人工评估表与维度
├── log.md                          # 开发日志
├── run.sh                          # 一键批量入口
├── requirements.txt
│
├── config/
│   └── settings.py                 # DeepSeek API 配置（model / temperature / retries）
│
├── data/
│   ├── case_input.json             # 案件输入模板
│   ├── role_information.json       # 角色信息字段说明
│   ├── personality_profiles.json   # 人格字段说明
│   ├── dataset_description.md      # ICAD 数据集说明
│   └── cases/                      # 5 个刑事案例
│       ├── case_001_helping_network_crime.json
│       ├── case_002_theft_intent.json
│       ├── case_003_injury_causation.json
│       ├── case_004_traffic_negligence.json
│       └── case_005_fraud_intent.json
│
├── prompts/
│   ├── clerk_prompt.txt
│   ├── issue_spotter_prompt.txt
│   ├── prosecutor_prompt.txt
│   ├── defense_lawyer_prompt.txt
│   ├── defendant_prompt.txt
│   ├── judge_prompt.txt
│   ├── legal_prompt.txt            # round1 reviewer
│   ├── social_prompt.txt           # round1 reviewer
│   ├── expert_prompt.txt           # round1 reviewer
│   ├── public_prompt.txt           # round1 reviewer
│   ├── round2_prompt.txt           # round2 共用
│   ├── foreperson_prompt.txt
│   └── writer_prompt.txt
│
├── schemas/
│   ├── agent_output_schemas.json   # 各 agent 必需字段（用于运行时校验）
│   ├── state_schema.json
│   └── final_report_schema.json
│
├── scripts/
│   └── compute_dataset_stats.py    # 计算数据集统计，输出到 outputs/
│
├── src/
│   ├── main.py                     # 入口：单案件 / --all 批量
│   ├── pipeline.py                 # 三段 pipeline 编排
│   ├── state_manager.py            # state 初始化
│   ├── role_view.py                # 按角色裁剪可见 state
│   ├── llm_client.py               # DeepSeek 调用 + JSON mode + 重试
│   ├── logger.py                   # 每个 agent 的输入/输出日志
│   ├── report_utils.py             # Markdown 报告渲染
│   └── agents/
│       ├── base_agent.py           # 统一加载 prompt / 调 LLM / schema 校验
│       ├── clerk.py
│       ├── issue_spotter.py
│       ├── prosecutor.py
│       ├── defense_lawyer.py
│       ├── defendant.py
│       ├── judge.py
│       ├── reviewer.py             # 4 个 round1 + round2 共用
│       ├── foreperson.py
│       └── writer.py
│
├── docx/image/                     # README / log 使用的图片
├── outputs/                        # 运行产物：state_final.json + final_report.md
└── multi_agent_logs/               # 每次运行的逐 agent 调用日志
```

---

## 5. Setup

### 5.1 安装依赖

```bash
pip install -r requirements.txt
```

### 5.2 配置 API Key

在项目根目录创建 `.env` 文件：

```env
API_KEY=your_deepseek_api_key
```

模型与采样参数在 [config/settings.py](config/settings.py) 中调整（默认使用 DeepSeek `response_format=json_object`）。

---

## 6. Run

### 6.1 单个案件

```bash
python -m src.main data/cases/case_001_helping_network_crime.json
```

### 6.2 批量全部 5 个案件

```bash
python -m src.main --all
# 或
bash run.sh
```

### 6.3 计算数据集统计

```bash
python scripts/compute_dataset_stats.py
```

输出位于 `outputs/dataset_statistics.json` 与 `outputs/dataset_statistics.md`。

---

## 7. Output Files

每次运行结束后，按 `case_id` 在以下位置生成产物：

| 路径                                   | 内容                                                                                                |
| ------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `outputs/{case_id}/state_final.json` | 完整的最终 state，包括 `case_structured`、`issues`、各 agent 输出、`deliberation_room`、`foreperson_summary` 等  |
| `outputs/{case_id}/final_report.md`  | 面向阅读的 Markdown 报告（含争点证明状态总表）                                                                     |
| `multi_agent_logs/{case_id}_log.json` | 该次运行中每个 agent 的输入与输出全量日志，便于复盘和调试                                                                 |

---

## 8. Evaluation

当前采用人工评估方式，对 5 个刑事案例从 8 个维度（争点识别、证据-争点映射、对抗分析、证据攻击、法官归纳、Deliberation 动态、证明状态追踪、报告可读性）打分。详细评分表与现有局限见 [Evaluation Report.md](Evaluation%20Report.md)。
