from src.agents.base_agent import BaseAgent

class PlaintiffAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="plaintiff",
            prompt_file="prompts/core_agent_prompts.json",
            prompt_key="plaintiff",
            input_fields=["case_structured", "issues"],
            output_field="plaintiff_analysis"
        )