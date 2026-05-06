from src.agents.base_agent import BaseAgent

class DefenseLawyerAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="defense_lawyer",
            input_fields=["case_structured", "issues", "prosecutor_analysis"],
            output_field="defense_analysis"
        )