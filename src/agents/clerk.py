from src.agents.base_agent import BaseAgent

class ClerkAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="clerk",
            input_fields=["case_narrative", "facts", "claims", "evidence", "procedure"],
            output_field="case_structured"
        )