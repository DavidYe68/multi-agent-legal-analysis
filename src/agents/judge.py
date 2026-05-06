from src.agents.base_agent import BaseAgent

class JudgeAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="judge",
            input_fields=["issues", "prosecutor_analysis", "defense_analysis", "defendant_statement"] ,
            output_field="judge_summary"
        )