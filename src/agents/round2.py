import json
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
        # personality = state.get("reviewer_personality_profiles", {}).get(f"{self.role}_reviewer", {})
        context = {
            "judge_summary": state.get("judge_summary", {}),
            "my_round1_review": my_round1_review,
            "other_round1_reviews": other_round1_reviews
            #"reviewer_personality": personality
        }

        with open(self.prompt_file, "r", encoding="utf-8") as f:
            prompt = f.read()

        print(f"开始调用{self.name}...")
        result = call_llm(prompt, json.dumps(context, ensure_ascii=False))
        print(f"[{self.name}] 完成")

        missing = self.validate(result)
        if missing:
            print(f"{self.name}缺少{missing}输出字段，重试中...")
            result = call_llm(prompt, json.dumps(context, ensure_ascii=False))

        print(f"[{self.name}] 完成")

        state[self.output_field] = result
        logger.log(self.name, context, result)
        return state
