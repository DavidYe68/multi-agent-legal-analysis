from src.agents.base_agent import BaseAgent

class IssueSpotterAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="issue_spotter",
            input_fields=["case_structured"],
            output_field="issues"
        )