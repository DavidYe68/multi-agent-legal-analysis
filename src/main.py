import json
import sys
import os
from src.pipeline import run_pipeline
from src.report_utils import render_markdown_report
from pathlib import Path


def save_outputs(state, case_id):
    os.makedirs(f"outputs/{case_id}", exist_ok=True)
    json_path = f"outputs/{case_id}/state_final.json"
    md_path = f"outputs/{case_id}/final_report.md"

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)

    with open(md_path, "w", encoding="utf-8") as f:
        f.write(render_markdown_report(state))

    print(f"JSON: {json_path}")
    print(f"报告: {md_path}")

def run_all_cases():
    for case_path in sorted(Path("data/cases").glob("*.json")):
        print(f"\n正在处理 {case_path.name}...")
        with open(case_path, "r", encoding="utf-8") as f:
            case_data = json.load(f)
        case_id = case_data["case_id"]
        raw_case_text = case_data["raw_case_text"]
        user_mode = case_data.get("user_mode", "teaching")
        state = run_pipeline(case_data)
        save_outputs(state, case_id)



if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--all":
        run_all_cases()
        print("全部完成")
    else:
        filepath = sys.argv[1]
        with open(filepath, "r", encoding="utf-8") as f:
            case_data = json.load(f)

        case_id = case_data["case_id"]
        raw_case_text = case_data["raw_case_text"]
        user_mode = case_data.get("user_mode", "teaching")
        state = run_pipeline(case_data)
        save_outputs(state, case_id)

        print(f"完成：{case_id}")