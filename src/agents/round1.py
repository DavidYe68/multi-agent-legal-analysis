from src.agents.base_agent import BaseAgent

class Round1ReviewerAgent(BaseAgent):
    def __init__(self, role, proof_state=True):
        name = f"{role}_reviewer_round1"
        schema_key = "reviewer_round1"
        if not proof_state:
            schema_key = "reviewer_round1_no_proof"

        super().__init__(
            name=name,
            input_fields=["case_structured", "issues", "prosecutor_analysis", "defense_analysis", "judge_summary"],
            output_field="current_round1_review",
            schema_key=schema_key
        )
        self.prompt_file = f"prompts/{role}_prompt.txt"
        self.prompt_extra = ""
        if not proof_state:
            self.prompt_extra = """
            【消融实验约束】
            本实验关闭 proof-state tracking。
            本段约束覆盖上方任务和 JSON 示例。
            不要输出 issue_proof_status 字段。
            最终 JSON 中不得包含任何证明状态字段。
            """
