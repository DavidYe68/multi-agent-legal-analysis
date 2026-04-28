from src.agents.base_agent import BaseAgent

class WriterAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="writer",
            prompt_file="prompts/core_agent_prompts.json",
            prompt_key="writer",
            input_fields=["case_structured", "issues", "judge_summary", "foreperson_summary"],
            output_field="final_report"
        )