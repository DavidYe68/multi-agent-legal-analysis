from src.agents.base_agent import BaseAgent

class DefendantAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="defendant",
            prompt_file="prompts/core_agent_prompts.json",
            prompt_key="defendant",
            input_fields=["case_structured", "issues", "plaintiff_analysis"],
            output_field="defendant_analysis"
        )