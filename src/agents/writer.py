from src.agents.base_agent import BaseAgent

class WriterAgent(BaseAgent):
    ARRAY_FIELDS = {
        "core_issues",
        "prosecutor_view",
        "defense_view",
        "judge_summary",
        "evidence_gaps",
        "open_questions",
        "risk_flags",
        "next_step_suggestions",
    }

    def __init__(self):
        super().__init__(
            name="writer",
            input_fields=["case_structured", "issues", "judge_summary", "foreperson_summary", "task_mode"],
            output_field="final_report"
        )

    def resolve_prompt_file(self, state):
        task_mode = state.get("task_mode", "teaching")
        return f"prompts/writer_{task_mode}_prompt.txt"

    def postprocess_result(self, result):
        if not isinstance(result, dict):
            return result

        normalized = dict(result)
        for field in self.ARRAY_FIELDS:
            value = normalized.get(field)
            if isinstance(value, str):
                text = value.strip()
                normalized[field] = [text] if text else []

        return normalized
