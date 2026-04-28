from src.agents.base_agent import BaseAgent

class ClerkAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="clerk",
            prompt_file="prompts/core_agent_prompts.json",
            prompt_key="clerk",
            input_fields=["raw_case_text"],
            output_field="case_structured"
        )