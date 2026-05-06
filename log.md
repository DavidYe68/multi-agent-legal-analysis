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

### 6.数据
- data/raw_cases/ 替换为 data/cases/（刑事案例 5 个）
- 新增 case_input.json、role_information.json、personality_profiles.json


- 合并 coworker 刑事版本，待办：
  - 角色改动：plaintiff→prosecutor，defendant→defense_lawyer，新建 defendant，改 judge 和 pipeline
  - Layer 3 架构改动：旧版 reviewer×4 + foreperson 改为 deliberation_room 统一处理（Round 1 独立发言 + Round 2 有限回应 + 投票 + Chair 汇总）
  - prompt 替换：换成 coworker 提供的刑事版 JSON（含 Round 2 prompt）
  - Writer 双模式：teaching / practice 两套输出
  - report_utils：Markdown 报告生成
  - 评估脚本：6 项指标
  - 消融实验：至少 3 组（旧版 reviewer+foreperson 保留作为 ablation 对照）
  - 可选：role_view 信息分化、personality_utils 被告人人格、protocol 庭审流程约束

