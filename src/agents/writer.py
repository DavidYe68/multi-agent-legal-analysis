from src.agents.base_agent import BaseAgent

class WriterAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="writer",
            input_fields=["case_structured", "issues", "judge_summary", "foreperson_summary", "user_mode"],
            output_field="final_report"
        )