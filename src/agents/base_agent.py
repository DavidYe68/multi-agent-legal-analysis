import json
from datetime import datetime
from jsonschema import validate as jsonschema_validate, ValidationError
from src.llm_client import call_llm
from src.role_view import get_role_view

class BaseAgent:
    def __init__(self, name, input_fields, output_field, schema_key=None):
        self.name = name
        self.prompt_file = f"prompts/{name}_prompt.txt"
        self.input_fields = input_fields
        self.output_field = output_field
        self.schema_key = schema_key if schema_key else name


    def run(self, state, logger):
        context = get_role_view(state, self.name)
        with open(self.prompt_file, "r", encoding="utf-8") as f:
            prompt = f.read()

        start = datetime.now()
        start_time = start.isoformat()
        retry_count = 0
        result = {}

        print(f"[{self.name}] 开始调用 LLM...")
        try:
            result = call_llm(prompt, json.dumps(context, ensure_ascii=False))
            result = self.postprocess_result(result)

            error = self.validate(result, state)
            if error:
                retry_count = 1
                print(f"[{self.name}] 输出校验失败: {error}，重试中...")
                result = call_llm(prompt, json.dumps(context, ensure_ascii=False))
                result = self.postprocess_result(result)
                error = self.validate(result, state)

            if error:
                raise ValueError(f"{self.name} 输出校验失败: {error}")

            print(f"[{self.name}] 完成")
            state[self.output_field] = result

            end = datetime.now()
            logger.log(
                self.name,
                context,
                result,
                round_id=self.get_round_id(),
                start_time=start_time,
                end_time=end.isoformat(),
                latency_sec=round((end - start).total_seconds(), 3),
                retry_count=retry_count,
                validation_passed=True,
                error=""
            )
            return state
        except Exception as e:
            end = datetime.now()
            logger.log(
                self.name,
                context,
                result,
                round_id=self.get_round_id(),
                start_time=start_time,
                end_time=end.isoformat(),
                latency_sec=round((end - start).total_seconds(), 3),
                retry_count=retry_count,
                validation_passed=False,
                error=str(e)
            )
            raise
    
    def get_round_id(self):
        if "round1" in self.name:
            return 1
        if "round2" in self.name:
            return 2
        return ""

    def postprocess_result(self, result):
        return result

    def validate(self, result, state):
        try:
            with open("schemas/agent_output_schemas.json", "r", encoding="utf-8") as f:
                schemas = json.load(f)
            schema_key = self.schema_key
            if schema_key == "writer":
                task_mode = state.get("task_mode", "teaching")
                schema_key = f"writer_{task_mode}"
            schema = schemas.get(schema_key)
            if not schema:
                return ""

            jsonschema_validate(instance=result, schema=schema)
            return self.validate_ids(result, state)
        except FileNotFoundError:
            return ""
        except ValidationError as e:
            path = ".".join(str(item) for item in e.absolute_path)
            if path:
                return f"{path}: {e.message}"
            return e.message

    def validate_ids(self, result, state):
        valid_facts = set(state.get("fact_index", {}).keys())
        valid_evidence = set(state.get("evidence_index", {}).keys())
        valid_issues = self.get_valid_issue_ids(result, state)

        errors = []
        self.check_ids(result, valid_facts, valid_evidence, valid_issues, errors)
        if errors:
            return "；".join(errors[:5])
        return ""

    def get_valid_issue_ids(self, result, state):
        if self.schema_key == "issue_spotter":
            issue_ids = []
            for item in result.get("issues", []):
                issue_ids.append(item.get("issue_id"))
            if len(issue_ids) != len(set(issue_ids)):
                return set()
            return set(issue_ids)

        issue_ids = set()
        issues = state.get("issues", {})
        for item in issues.get("issues", []):
            issue_id = item.get("issue_id")
            if issue_id:
                issue_ids.add(issue_id)
        return issue_ids

    def check_ids(self, data, valid_facts, valid_evidence, valid_issues, errors):
        if isinstance(data, dict):
            for key, value in data.items():
                if key == "fact_id" and value not in valid_facts:
                    errors.append(f"fact_id 不存在: {value}")
                elif key == "evidence_id" and value not in valid_evidence:
                    errors.append(f"evidence_id 不存在: {value}")
                elif key == "issue_id" and valid_issues and value not in valid_issues:
                    errors.append(f"issue_id 不存在: {value}")
                elif key.endswith("fact_ids") and isinstance(value, list):
                    self.check_id_list(value, valid_facts, key, errors)
                elif key.endswith("evidence_ids") and isinstance(value, list):
                    self.check_id_list(value, valid_evidence, key, errors)
                elif key.endswith("issue_ids") and isinstance(value, list) and valid_issues:
                    self.check_id_list(value, valid_issues, key, errors)
                else:
                    self.check_ids(value, valid_facts, valid_evidence, valid_issues, errors)
        elif isinstance(data, list):
            for item in data:
                self.check_ids(item, valid_facts, valid_evidence, valid_issues, errors)

    def check_id_list(self, ids, valid_ids, label, errors):
        for item_id in ids:
            if item_id not in valid_ids:
                errors.append(f"{label} 引用了不存在的 ID: {item_id}")
