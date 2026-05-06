import json
import sys
from src.pipeline import run_pipeline


if __name__ == "__main__":
    filepath = sys.argv[1]
    with open(filepath, "r", encoding="utf-8") as f:
        case_data = json.load(f)

    case_id = case_data["case_id"]
    raw_case_text = case_data["raw_case_text"]
    state = run_pipeline(case_id, raw_case_text)

    print(f"完成：{case_id}")