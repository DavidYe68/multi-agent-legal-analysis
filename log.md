# 记录
## 一、4.28 
- 重新开工，古法编程版
- 搭建项目骨架
![alt text](docx/image/image-1.png)
![alt text](docx/image/image.png)
- 添加data/ 包含raw_cases/ 和 gold_annotations/ 各10条

## 二、5.6
- 新的pipeline ![alt text](docx/image/image-2.png)

### 1.Agent 文件
- 删除 plaintiff.py，新建 prosecutor.py
- 原 defendant.py 改为 defense_lawyer.py
- 新建 defendant.py（被告人陈述角色）
- judge.py input_fields 更新：prosecutor_analysis + defense_analysis + defendant_statement
- reviewer.py 从四参数（含 prompt_file, prompt_key）简化为三参数
- 所有 Agent 去掉 prompt_file 和 prompt_key，统一用 name 自动推导 prompt 路径
### 2.base_agent.py
- prompt 读取方式从 JSON（prompt_file + prompt_key）改回 .txt（prompts/{name}_prompt.txt）
### 3.pipeline.py
- 导入更新：PlaintiffAgent → ProsecutorAgent + DefenseLawyerAgent + DefendantAgent
- 线性链路：Clerk → IssueSpotter → Prosecutor → DefenseLawyer → Defendant → Judge

### 4.main.py
- 入参从 case_id 改为完整文件路径（python -m src.main data/cases/xxx.json）
- case_id 从文件内容中读取

### 5.Prompt 文件
- 替换为 coworker 提供的刑事版 .txt prompt
- reviewer prompt 从 reviewer_prompts.json 拆分为 legal/social/expert/public 四个独立 .txt
- 修复 writer_prompt 和 foreperson_prompt 缺 JSON schema 的问题

### 6.数据
- data/raw_cases/ 替换为 data/cases/（刑事案例 5 个）
- 新增 case_input.json、role_information.json、personality_profiles.json

### 7.round2设计
- Round 2 deliberation 加入 pipeline.py（Round 1 独立发言 + Round 2 有限回应）
- foreperson 改为读取两轮输出（reviewer_outputs + round2_outputs）
- main.py 升级：支持 --all 批量跑、JSON + Markdown 双输出
- 加入 report_utils.py（Markdown 报告生成）

- 待办：批量跑全部案例、评估脚本、消融实验、Writer 双模式

## 三、5.7
- 完成Writer 双模式
- 增加角色信息读取和信息分化

