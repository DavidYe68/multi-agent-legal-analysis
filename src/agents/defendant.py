from src.agents.base_agent import BaseAgent

class DefendantAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="defendant",
            input_fields=["case_structured"],
            output_field="defendant_statement"
        )