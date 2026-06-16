from src.agents.base_agent import BaseAgent

class Round1ReviewerAgent(BaseAgent):
    def __init__(self, role):
        name = f"{role}_reviewer_round1"
        super().__init__(
            name=name,
            input_fields=["case_structured", "issues", "prosecutor_analysis", "defense_analysis", "judge_summary"],
            output_field="current_round1_review",
            schema_key=f"reviewer_round1"
        )
        self.prompt_file = f"prompts/{role}_prompt.txt"