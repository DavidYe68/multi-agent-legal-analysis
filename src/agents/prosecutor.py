from src.agents.base_agent import BaseAgent

class ProsecutorAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="prosecutor",
            input_fields=["case_structured", "issues"],
            output_field="prosecutor_analysis"
        )