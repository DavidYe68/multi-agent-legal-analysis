from src.agents.base_agent import BaseAgent

class JudgeAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="judge",
            prompt_file="prompts/core_agent_prompts.json",
            prompt_key="judge",
            input_fields=["issues", "plaintiff_analysis", "defendant_analysis"] ,
            output_field="judge_summary"
        )