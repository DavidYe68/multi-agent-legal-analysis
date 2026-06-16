import json
import os

def create_state(case_data):
    return {
        #基础信息
        "case_id": case_data.get("case_id"),
        "user_mode": case_data.get("task_mode"),
        "domain_hint": case_data.get("domain", ""),

        "case_narrative": case_data.get("case_narrative", {}),
        "participants": case_data.get("participants", []),
        "facts": case_data.get("facts", []),
        "claims": case_data.get("claims", []),
        "evidence": case_data.get("evidence", []),
        "procedure": case_data.get("procedure", {}),
        "role_views": case_data.get("role_views", {}),

        # 角色信息与人格
        # "role_information": case_data.get("role_information", {}),
        # "personality_profiles": case_data.get("personality_profiles", {}),
        # "reviewer_personality_profiles": case_data.get("reviewer_personality_profiles", {}),
    }

def save_state(state, filepath):
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)

def load_state(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)