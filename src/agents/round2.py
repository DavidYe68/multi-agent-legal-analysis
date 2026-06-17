import json
from datetime import datetime
from src.agents.base_agent import BaseAgent
from src.llm_client import call_llm

class Round2ReviewerAgent(BaseAgent):
    def __init__(self, role):
        name = f"{role}_reviewer_round2"
        super().__init__(
            name=name,
            input_fields=["case_structured", "issues", "prosecutor_analysis", "defense_analysis", "judge_summary"],
            output_field="current_round2_review",
            schema_key=f"reviewer_round2"
        )
        self.role=role
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
