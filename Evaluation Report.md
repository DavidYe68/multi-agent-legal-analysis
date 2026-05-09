# Evaluation

## Evaluation Goal

本项目当前采用人工评估（manual evaluation）方式，对多个刑事案件案例进行检查。

评估重点并不是判断系统给出的法律结论是否“绝对正确”，而是观察系统是否能够：

* 识别案件核心争点；
* 展示公诉与辩护之间的结构化对抗过程；
* 保留证据缺口与未决问题；
* 展示不同 reviewer 在 Deliberation Room 中的分歧与协商；
* 对每个争点进行动态证明状态追踪（proof-state tracking）。

---

# Evaluation Dimensions

| Evaluation Dimension      | Description                                 |
| ------------------------- | ------------------------------------------- |
| Issue Identification      | 是否能够识别案件中的核心争点                              |
| Evidence-to-Issue Mapping | 是否能够将证据映射到具体争点                              |
| Adversarial Analysis      | 是否能够围绕同一争点形成公诉 / 辩护对抗                       |
| Evidence Challenge        | 是否能够从真实性、关联性、证明力角度攻击证据                      |
| Judge Summarization       | 是否能够生成未决问题、证据缺口与不确定性理由                      |
| Deliberation Dynamics     | 是否能够展示 reviewer 之间的分歧、联盟、立场变化               |
| Proof-State Tracking      | 是否能够记录争点从 open → partly_closed → closed 的变化 |
| Report Readability        | Markdown 报告是否结构清晰、便于阅读                      |

---

# Case Evaluation Table

评分范围：1–5 分。

* 1 = 较弱
* 3 = 基本完成
* 5 = 表现较好

| Case ID      | Case Type         | Issue Identification | Evidence Mapping | Evidence Challenge | Judge Summarization | Deliberation Dynamics | Proof-State Tracking | Report Readability | Notes         |
| ------------ | ----------------- | -------------------: | ---------------: | -----------------: | ------------------: | --------------------: | -------------------: | -----------------: | ------------- |
| criminal_001 | 帮信罪：主观明知争议        |                    5 |                5 |                  5 |                   5 |                     5 |                    5 |                  5 | 当前主展示案例       |
| criminal_002 | 盗窃罪：非法占有目的争议      |                    4 |                4 |                  4 |                   4 |                     4 |                    4 |                  4 | 展示主观目的争议      |
| criminal_003 | 故意伤害罪：因果关系与伤情争议   |                    4 |                4 |                  4 |                   4 |                     4 |                    4 |                  4 | 展示因果关系争议      |
| criminal_004 | 交通肇事罪：过失与责任比例争议   |                    4 |                4 |                  4 |                   4 |                     4 |                    4 |                  4 | 展示责任分配问题      |
| criminal_005 | 诈骗罪：非法占有目的与认识错误争议 |                    5 |                4 |                  5 |                   5 |                     4 |                    5 |                  5 | 展示主观故意与认识错误争议 |

---

# Current Observations

从当前案例运行结果来看，系统已经能够完成以下流程：

## Structured Criminal Case Analysis

* 从案件事实中提取基础信息；
* 识别不同案件中的核心争点；
* 建立 evidence-to-issue mapping；
* 围绕同一争点生成公诉与辩护路径。

## Judge Summarization

Judge Agent 已能够：

* 生成 issue_response_table；
* 标记 unresolved_points；
* 归纳 evidence_gaps；
* 输出 uncertainty_reasons；
* 避免直接采纳公诉结论。

## Deliberation Room

Reviewer 已能够：

* 阅读其他 reviewer 的观点；
* 更新自身 position；
* 形成 alliance / disagreement；
* 记录 vote history 与 state changes；
* 对 issue proof status 进行动态更新。

## Proof-State Tracking

系统已经能够记录：

```text
Issue A:
open → partly_closed

Issue B:
still open
```

而不是直接输出单一 verdict。

---

# Current Limitations

当前系统仍存在以下局限：

* 当前评估主要依赖人工观察，尚未建立自动化 benchmark；
* 部分 Agent 输出仍依赖 prompt 质量与 LLM 稳定性；
* 当前系统主要用于教学展示与结构化分析，不用于正式法律结论；
* 目前尚未接入真实庭审数据的大规模验证；
* 当前 proof-state tracking 仍属于启发式结构，而非严格法律证明模型。

---

# Future Improvements

后续计划包括：

* 引入更多真实案例；
* 建立自动评估指标；
* 增加错误分析与 failure cases；
* 增加 deliberation 可视化；
* 增强程序约束与证据校验；
* 尝试引入更严格的 proof-state update mechanism。
