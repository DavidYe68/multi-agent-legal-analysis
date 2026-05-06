from src.agents.base_agent import BaseAgent

class ForepersonAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="foreperson",
            input_fields=["judge_summary", "reviewer_outputs", "round2_outputs"],
            output_field="foreperson_summary"
        )