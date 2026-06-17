# 多智能体刑事案件分析系统

这个项目做的是一个面向刑事案件材料的多 Agent 分析流程。它不是直接让大模型给出“有罪/无罪”的一句话结论，而是把案件拆成几个角色依次处理：先整理事实，再识别争点，再做控辩分析，最后让多个 reviewer 进行两轮评议，生成一份结构化报告。

项目重点不在替代法律判断，而在展示：模型能不能围绕同一批证据稳定地组织争点、控辩理由、证据缺口和讨论过程。

## 系统流程

主流程在 `src/pipeline.py` 里，按下面顺序运行：

```text
Clerk
  整理案件材料

IssueSpotter
  提取核心争点

Prosecutor
  从公诉角度组织指控、证据和证明目的

DefenseLawyer
  从辩护角度回应指控，攻击证据的真实性、关联性和证明力

Defendant
  给出被告人视角的陈述

Judge
  归纳控辩争点、证据缺口和未决问题

Reviewers
  legal / social / expert / public 四个视角进行两轮评议

Foreperson
  汇总评议中的多数意见、少数意见和主要分歧

Writer
  生成最终案件分析报告
```

运行结束后，系统会保存两类结果：

- `state_final.json`：完整机器可读状态，包含所有 Agent 的结构化输出。
- `final_report.md`：给人看的 Markdown 报告。

## 教学 / 实务双模式

同一批事实、证据、争点、评议结果只跑一次，Writer 会根据 `task_mode` 组织成两种不同的报告。模式只是输出层的变量，不复制案件，也不改变上游推理：

- `teaching`：展示分析过程、争点结构、控辩对照、多视角评议和课堂讨论问题。
- `practice`：面向案件办理前期，提炼核心风险、关键证据缺口、不确定性、下一步调查建议和结论边界。

默认 12 个案件只生成 `teaching`。`datasets/splits/practice_validation.json` 里的验证案件（criminal_001a / 001b / 003a / 006a）会同时生成两份，分别写到：

```text
outputs/{exp_name}/{case_id}/final_report_teaching.md
outputs/{exp_name}/{case_id}/final_report_practice.md
```

`state_final.json` 里的 `final_reports` 字段按模式存放这两份报告。前端报告页可以在教学 / 实务之间切换，读取的是各自真实的 Writer 输出；若某个模式没有运行，会提示“该模式尚未运行”，不会拿另一模式的内容代替。

实务模式有专用的隐藏评价标准，只供评估脚本在运行结束后使用：

```bash
python scripts/evaluate_practice_outputs.py --exp full
```

## 数据集结构

当前数据集放在 `datasets/` 下，分成三块：

```text
datasets/
├── cases/
│   ├── processed/    # 模型真正读取的案件输入
│   └── gold/         # 隐藏金标准，只给评估脚本使用
├── schemas/          # processed 和 gold 的 JSON Schema
└── splits/           # development / test 案件划分
```

几个约定很重要：

- `processed` 是运行 pipeline 的输入，里面有案情、事实、主张、证据、程序信息和角色可见范围。
- `gold` 是评估用的隐藏答案，不能进入任何 Agent 的 prompt 或运行日志输入。
- `splits` 用来按开发集或测试集批量运行。

## Quickstart

### 1. 安装依赖

建议先建虚拟环境，再安装依赖：

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

如果你已经在项目虚拟环境里，可以直接运行：

```bash
pip install -r requirements.txt
```

### 2. 配置 API Key

在项目根目录创建 `.env`：

```env
API_KEY=your_deepseek_api_key
```

模型、温度、重试次数和价格参数在 `config/settings.py` 里配置。

### 3. 先校验数据

```bash
python scripts/validate_dataset.py
```

这个脚本会检查：

- processed / gold 是否都存在；
- JSON Schema 是否通过；
- fact_id、claim_id、evidence_id、issue_id 引用是否有效；
- split 里的 case_id 是否能找到；
- gold 文件是否和 processed 案件一一对应。

### 4. 跑一个案件

```bash
python main.py --case criminal_001a
```

默认实验名是 `full`，输出会写到：

```text
outputs/full/criminal_001a/state_final.json
outputs/full/criminal_001a/final_report.md
```

### 5. 跑一个 split

```bash
python main.py --split development
```

也可以运行测试集：

```bash
python main.py --split test
```

### 6. 跑全部案件

```bash
python main.py --all
```

`run.sh` 也会调用默认批量入口：

```bash
bash run.sh
```

### 7. 运行评估脚本

如果你刚跑的是默认 `full` 实验，用下面的命令：

```bash
python scripts/evaluate_outputs.py --outputs-dir outputs/full --out outputs/full/evaluation_results.json
```

评估结果会同时生成 JSON 和 Markdown：

```text
outputs/full/evaluation_results.json
outputs/full/evaluation_results.md
```

## 常用命令

```bash
# 校验数据集
python scripts/validate_dataset.py

# 单案运行
python main.py --case criminal_001a

# 跑 development split
python main.py --split development

# 跑 test split
python main.py --split test

# 跑全部案件
python main.py --all

# 跑 baseline
python main.py --case criminal_001a --exp baseline

# 跑线性流程，不进入 reviewer deliberation
python main.py --case criminal_001a --exp linear

# 关闭第二轮评议
python main.py --case criminal_001a --exp no_round2

# 评估 full 实验输出
python scripts/evaluate_outputs.py --outputs-dir outputs/full --out outputs/full/evaluation_results.json

# 统计数据集规模
python scripts/compute_dataset_stats.py
```

可用实验配置在 `config/experiment.py`：

- `full`：完整多 Agent 流程。
- `baseline`：单模型基线。
- `linear`：只跑线性庭审段和最终总结。
- `no_role_separate`：关闭角色信息隔离。
- `no_round2`：关闭第二轮评议。
- `no_adversarial`：关闭第二轮中的对抗交换。
- `no_proofstate`：关闭部分证明状态汇总。

## 输出文件说明

一次运行会以实验名和案件编号组织输出：

```text
outputs/{exp_name}/{case_id}/state_final.json
outputs/{exp_name}/{case_id}/final_report.md
```

例如：

```text
outputs/full/criminal_001a/state_final.json
outputs/full/criminal_001a/final_report.md
```

`state_final.json` 适合调试和后续分析，里面包括：

- 案件输入和索引；
- `issues`；
- 公诉、辩护、被告人、法官输出；
- reviewer 第一轮和第二轮输出；
- `deliberation_room`；
- foreperson 汇总；
- writer 最终报告结构。

`final_report.md` 适合直接阅读，主要包括：

- 案件摘要；
- 核心争点；
- 控辩意见；
- 证据和争点的对应关系；
- 法官归纳；
- 评议室中的分歧、共识和证明状态；
- 证据缺口和后续讨论问题。

Agent 调用日志会写到：

```text
multi_agent_logs/{exp_name}/{case_id}_log.json
```

日志里能看到每个 Agent 的输入、输出、耗时、重试情况和 token 用量。

## 评估说明

本项目里有两类评估。

第一类是程序性检查，主要由脚本完成：

- 数据格式是否合法；
- 输出文件是否存在；
- evidence_id、fact_id、issue_id 等引用是否有效；
- gold 有没有误进模型输入；
- 报告里有没有明显不安全的结论表达。

第二类是法律语义评估，需要人工参与。尤其是争点相关指标，不能只看 `I1`、`I2` 这样的编号。

原因很简单：模型会自己拆争点，gold 里也有人工争点。两边的 `I1` 不一定天然是同一个争点，`I2` 也不一定天然对应。比如模型的 `I2` 可能讨论“聊天记录能不能证明明知”，gold 的 `I2` 可能讨论“客观帮助行为是否充分证明”。它们编号一样，但法律含义不一样。

所以正式分析时，建议先做一张人工 issue alignment 表：

```text
模型争点 -> 对应的 gold 争点 / 无对应项
```

再基于这张表计算：

- 核心争点覆盖率；
- 额外争点或漏掉的争点；
- 证据到争点的映射是否合理；
- 最终证明状态是否接近 gold 判断。

也就是说，`scripts/evaluate_outputs.py` 可以作为自动化评估入口，但争点类指标要结合人工语义对齐后再解释。不要把原始编号匹配结果直接写成最终准确率。

## 代码结构

```text
project/
├── main.py                    # 根目录入口，默认转到 src.main
├── run.sh                     # 批量运行入口
├── requirements.txt
├── config/
│   ├── settings.py            # 模型和 API 配置
│   └── experiment.py          # full / baseline / ablation 配置
├── datasets/
│   ├── cases/
│   │   ├── processed/         # 模型输入案件
│   │   └── gold/              # 评估金标准
│   ├── schemas/               # 数据集 schema
│   └── splits/                # development / test
├── prompts/                   # 各 Agent 的 prompt
├── schemas/
│   └── agent_output_schemas.json
├── scripts/
│   ├── validate_dataset.py
│   ├── evaluate_outputs.py
│   └── compute_dataset_stats.py
├── src/
│   ├── main.py                # 参数解析和运行入口
│   ├── pipeline.py            # 多 Agent 流程编排
│   ├── data_loader.py         # 读取 processed 数据和 split
│   ├── state_manager.py       # 初始化 state
│   ├── role_view.py           # 按角色裁剪输入
│   ├── llm_client.py          # LLM 调用
│   ├── logger.py              # 运行日志
│   ├── report_utils.py        # Markdown 报告渲染
│   └── agents/                # 各 Agent 实现
├── outputs/                   # 运行输出
└── multi_agent_logs/          # Agent 调用日志
```

## 注意事项

- 正常 pipeline 只读取 `datasets/cases/processed`，不要把 gold 塞进 prompt。
- 评估脚本可以读取 `datasets/cases/gold`，但它应该只在模型运行结束后使用。
- 每次换实验配置后，注意评估时的 `--outputs-dir` 要和输出目录一致。
- 争点识别是开放生成任务，正式报告里不要只用编号匹配来解释能力。
- `final_report.md` 适合展示，`state_final.json` 更适合 debug 和统计分析。
- 这个系统用于课程项目和结构化分析展示，不用于真实案件的法律结论。
