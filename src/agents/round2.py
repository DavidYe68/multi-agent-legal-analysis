import json
from datetime import datetime
from src.agents.base_agent import BaseAgent
from src.llm_client import call_llm

class Round2ReviewerAgent(BaseAgent):
    def __init__(self, role, proof_state=True, adversarial_exchange=True):
        name = f"{role}_reviewer_round2"
        schema_key = "reviewer_round2"
        if not proof_state:
            schema_key = "reviewer_round2_no_proof"

        super().__init__(
            name=name,
            input_fields=["case_structured", "issues", "prosecutor_analysis", "defense_analysis", "judge_summary"],
            output_field="current_round2_review",
            schema_key=schema_key
        )
        self.role = role
        self.proof_state = proof_state
        self.adversarial_exchange = adversarial_exchange
        self.prompt_file = f"prompts/round2_prompt.txt"

    def run(self, state, logger, my_round1_review, other_round1_reviews):
        context = {
            "case_id": state.get("case_id", ""),
            "issues": state.get("issues", {}),
            "judge_summary": state.get("judge_summary", {}),
            "my_round1_review": my_round1_review,
            "other_round1_reviews": other_round1_reviews,
            "reviewer_personality": {}
        }

        with open(self.prompt_file, "r", encoding="utf-8") as f:
            prompt = f.read()
        prompt = self.add_ablation_constraints(prompt, other_round1_reviews)

        start = datetime.now()
        start_time = start.isoformat()
        retry_count = 0
        result = {}
        usage = {}

        print(f"开始调用{self.name}...")
        try:
            result, usage = call_llm(prompt, json.dumps(context, ensure_ascii=False))

            error = self.validate(result, state)
            if error:
                retry_count = 1
                print(f"{self.name} 输出校验失败: {error}，重试中...")
                result, usage = call_llm(prompt, json.dumps(context, ensure_ascii=False))
                error = self.validate(result, state)

            if error:
                raise ValueError(f"{self.name} 输出校验失败: {error}")

            print(f"[{self.name}] 完成")
            state[self.output_field] = result

            end = datetime.now()
            logger.log(self.name, context, result,  round_id=2,  start_time=start_time,
                       end_time=end.isoformat(),  latency_sec=round((end - start).total_seconds(), 3),
                        retry_count=retry_count, validation_passed=True, error="", usage=usage)
            return state
        except Exception as e:
            end = datetime.now()
            logger.log(self.name, context, result,  round_id=2, start_time=start_time,
                       end_time=end.isoformat(), latency_sec=round((end - start).total_seconds(), 3),
                       retry_count=retry_count, validation_passed=False, error=str(e), usage=usage)
            raise

    def add_ablation_constraints(self, prompt, other_round1_reviews):
        extras = []

        if not other_round1_reviews:
            extras.append("""
                【消融实验约束：no_adversarial】
                本实验不进行 reviewer 间交叉回应。
                本段约束覆盖上方“至少回应一位其他评议者”的要求。
                不要回应其他评议者，也不要编造其他评议者观点。
                respond_to 必须输出空数组 []。
                new_allies 和 new_opponents 必须输出空数组 []。
                只基于 my_round1_review、judge_summary 和 issues 进行独立二次判断。
                """)

        if not self.proof_state:
            extras.append("""
                【消融实验约束：no_proofstate】
                本实验关闭 proof-state tracking。
                本段约束覆盖上方任务和 JSON 示例。
                不要输出 open_proof_gap 字段。
                不要输出 issue_status_after_response 字段。
                不要输出 issue_status_updates 字段。
                最终 JSON 中不得包含任何证明状态字段。
                """)

        return prompt + "".join(extras)
