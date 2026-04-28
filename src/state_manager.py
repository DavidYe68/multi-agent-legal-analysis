import json
import os

def create_state(case_id, raw_case_text):
    return {
        "case_id": case_id,
        "raw_case_text": raw_case_text
    }

def save_state(state, filepath):
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)

def load_state(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)