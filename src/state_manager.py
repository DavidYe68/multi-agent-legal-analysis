import json
import os
from jsonschema import validate as jsonschema_validate, ValidationError

STATE_SCHEMA_PATH = "schemas/state_schema.json"

def create_state(case_data, config):
    task_mode = case_data["task_mode"]
    domain = case_data["domain"]

    return {
        # 基础信息
        "case_id": case_data["case_id"],
        "task_mode": task_mode,
        "domain": domain,

        "case_narrative": case_data["case_narrative"],
        "participants": case_data["participants"],
        "facts": case_data["facts"],
        "claims": case_data["claims"],
        "evidence": case_data["evidence"],
        "procedure": case_data["procedure"],
        "role_views": case_data["role_views"],

        "fact_index": case_data["fact_index"],
        "claim_index": case_data["claim_index"],
        "evidence_index": case_data["evidence_index"],

        "config": config,
    }

def save_state(state, filepath):
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)

def load_state(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)

def validate_state_schema(state, schema_path=STATE_SCHEMA_PATH):
    with open(schema_path, "r", encoding="utf-8") as f:
        schema = json.load(f)

    try:
        jsonschema_validate(instance=state, schema=schema)
    except ValidationError as e:
        path = ".".join(str(item) for item in e.absolute_path)
        location = f" at {path}" if path else ""
        raise ValueError(f"state schema validation failed{location}: {e.message}") from e

    return True