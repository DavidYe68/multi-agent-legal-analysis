# Multi-Agent Legal Analysis System
## 1. Project Overview

本项目构建了一个多 Agent 法律推理系统，目前主要面向刑事案件。系统并不直接根据案件材料输出是否有罪的结论，而是模拟刑事案件中不同角色之间的程序化互动过程，包括事实整理、争点识别、公诉方论证、辩护方回应、Judge收束以及 Deliberation Room的多视角评议。

与普通角色扮演式的multi-agent项目 不同，本系统强调：

* 不同 Agent 的信息位置差异（role-constrained reasoning）
* 围绕同一争点展开的对抗式论证（adversarial analysis）
* 刑事程序约束下的互动流程（procedure-aware interaction）
* Deliberation Room 中的动态协商与立场变化
* 对每个争点进行 issue-level proof tracking，而不是直接输出最终结论


---

## 2. Key Features

### 2.1 Role-Constrained Reasoning

不同 Agent 不共享完整案件信息，而是根据其程序角色读取不同内容，模拟真实庭审情况，进行角色分化：

* Prosecutor：读取 prosecutor_info
* Defense Lawyer：读取 defense_lawyer_info 与部分公诉材料
* Defendant：读取 defendant_info 与personality_profile
* Judge：读取双方论证与程序状态
* Reviewer：读取 Judge 收束结果与必要中间状态

系统通过 role_view.py 对不同 Agent 的可见信息进行约束。

---

### 2.2 Structured Adversarial Analysis

系统不是简单自由对话，而是围绕同一争点展开结构化对抗论证：

* claim
* evidence
* reasoning
* weak_points

公诉方需要将证据映射到具体争点（evidence-to-issue mapping），辩护方则从真实性、关联性和证明力角度对证据进行攻击。

---

### 2.3 Procedure-Aware Criminal Court Simulation

系统引入刑事庭审流程文件：

* criminal_court_procedure.json
* checklists.json
* allowed_actions.json

不同 Agent 在不同阶段受到程序约束，而不是无限制自由聊天。

---

### 2.4 Deliberation Room

在 Judge 收束后，系统进入 Deliberation Room。

不同 reviewer（legal / social / expert / public）会：

* 进行两轮评议
* 阅读其他 reviewer 的观点
* 更新自身立场
* 形成联盟与分歧
* 记录 vote history 与 state changes

系统不仅保存最终意见，还保存 deliberation 过程本身。

---

### 2.5 Personality-Driven Deliberation

Reviewer 的人格不仅影响表达风格，还影响：

* 是否容易改变立场
* 是否接受 partial / unclear
* 是否提高证明标准
* 是否强调误判风险

当前人格维度包括：

* strictness
* agreeableness
* openness
* risk_aversion

---

### 2.6 Issue-Level Proof Tracking

系统不会直接输出单一 verdict，而是对每个争点记录证明状态：

* open
* partly_closed
* closed

并在 deliberation 过程中动态更新：

```text
Issue A:
open → partly_closed

Issue B:
still open
```

系统最终会生成争点证明状态总表（final_issue_status）。

---

### 2.7 Markdown Case Report

系统会自动生成：

* JSON 状态文件
* Markdown 案件分析报告

报告中包含：

* 争点分析
* 公诉/辩护路径
* Judge 收束
* Deliberation Room 分歧
* 争点证明状态总表
