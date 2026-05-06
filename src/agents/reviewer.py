from src.agents.base_agent import BaseAgent

class ReviewerAgent(BaseAgent):
    def __init__(self, role, name):
        super().__init__(
            name=name,
            input_fields=["case_structured", "issues", "prosecutor_analysis", "defense_analysis", "judge_summary"],
            output_field="reviewer_output"
        )
        self.prompt_file = f"prompts/{role}_prompt.txt"