# ICAD 数据集说明（Dataset Description）

## 一、数据集概述

ICAD（Issue-Centered Adversarial Deliberation）数据集是一个面向多 Agent 法律推理与协商分析的结构化刑事案件数据集。

与传统法律问答（Legal QA）或法律分类数据集不同，ICAD 不仅关注最终结论，而是重点关注：

* 争点（issue）层面的法律推理；
* 公诉 / 辩护之间的对抗式论证；
* 证据与争点之间的映射关系；
* 证明状态（proof state）的动态变化；
* 多 reviewer 之间的 deliberation（协商评议）过程。

当前数据集主要用于：

* 多 Agent 法律系统实验；
* 法律推理过程展示；
* Deliberation Room 协商机制研究；
* 教学演示与课程项目。

---

# 二、数据集目标

ICAD 数据集重点支持以下研究方向：

* 刑事法律推理（criminal legal reasoning）
* 对抗式论证（adversarial argumentation）
* 证据不足场景下的推理
* 主观状态（subjective intent / knowledge）争议
* 动态证明状态更新（proof-state tracking）
* 多 Agent deliberation interaction

数据集特别关注以下类型的问题：

* 证据链不完整；
* 主观故意 / 明知难以证明；
* 存在多种竞争性解释；
* 不应过早下结论（premature commitment）。

---

# 三、当前案件类型

| Case ID      | 案件类型  | 核心争议             |
| ------------ | ----- | ---------------- |
| criminal_001 | 帮信罪   | 主观明知争议           |
| criminal_002 | 盗窃罪   | 非法占有目的争议         |
| criminal_003 | 故意伤害罪 | 因果关系与伤情争议        |
| criminal_004 | 交通肇事罪 | 过失与责任比例争议        |
| criminal_005 | 诈骗罪   | 非法占有目的与被害人认识错误争议 |

---

# 四、数据结构

每个案件当前包含以下字段：

```json
{
  "case_id": "",
  "raw_case_text": "",

  "public_info": {},
  "judge_info": {},

  "prosecutor_info": {},
  "defense_lawyer_info": {},
  "defendant_info": {},

  "personality_profiles": {},
  "reviewer_personality_profiles": {}
}
```

---

# 五、核心设计特点

## 1. 角色信息差异（Role-Constrained Information）

不同 Agent 并不共享完整案件信息，而是根据其程序身份读取不同内容。

例如：

* Prosecutor 读取 prosecutor_info
* Defense Lawyer 读取 defense_lawyer_info
* Defendant 读取 defendant_info
* Judge 读取双方论证与程序状态
* Reviewer 仅读取 Judge 收束结果与必要中间状态

这种设计模拟了真实刑事诉讼中的信息位置差异。

---

## 2. 对抗式结构（Adversarial Structure）

数据集显式支持公诉与辩护之间的对抗式推理。

双方需要：

* 围绕同一争点展开论证；
* 构建不同推理路径；
* 对证据进行支持或攻击；
* 明确各自 weak points。

---

## 3. Deliberation 协商机制

数据集支持多轮 reviewer 协商。

Reviewer 可以：

* 阅读其他 reviewer 的观点；
* 调整自身 position；
* 形成 alliance / disagreement；
* 更新 proof-state judgment。

系统不仅保留最终意见，也保留 deliberation 过程本身。

---

## 4. 证明状态跟踪（Proof-State Tracking）

系统不直接预测单一 verdict，而是对每个争点记录证明状态：

```text
open
partly_closed
closed
```

例如：

```text
Issue A:
open → partly_closed

Issue B:
still open
```

该机制用于避免法律推理中的“过早定性”。

---

# 六、数据来源

当前案例主要来源于：

* 公开刑事案例改写；
* 教学案例整理；
* 人工结构化构建。

当前版本主要用于：

* 系统原型开发；
* 教学展示；
* 多 Agent 互动实验。

当前数据集尚不构成正式法律 benchmark。

---

# 七、当前局限

当前数据集仍存在以下限制：

* 数据规模较小；
* 主要依赖人工结构化；
* 尚未建立大规模标注流程；
* 当前 proof-state label 仍属于启发式结构；
* 尚未接入真实裁判文书的大规模验证。

---

# 八、未来工作

后续计划包括：

* 扩展更多刑事案件；
* 引入真实裁判文书；
* 增加人工标注；
* 建立 benchmark 与自动评估指标；
* 增加 consistency check；
* 增强 deliberation interaction 的真实性；
* 尝试更严格的 proof-state update mechanism。
