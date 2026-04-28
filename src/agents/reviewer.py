from src.agents.base_agent import BaseAgent

class ReviewerAgent(BaseAgent):
    def __init__(self, name, prompt_key):
        super().__init__(
            name=name,
            prompt_file="prompts/reviewer_prompts.json",
            prompt_key=prompt_key,
            input_fields=["judge_summary"],
            output_field="reviewer_output"
        )