import json
from src.llm_client import call_llm
from src.state_manager import create_state

def run_baseline(case_data):
    state = create_state(case_data)
    
    with open("prompts/baseline.txt", "r", encoding="utf-8") as f:
        prompt = f.read()
     
    baseline_input = json.dumps({
        "raw_case_text": state["raw_case_text"],
        "domain_hint": state["domain_hint"],
        "role_information": state["role_information"],
        "user_mode": state["user_mode"]
    }, ensure_ascii=False)

    print("开始调用Baseline LLM")
    report = call_llm(prompt, baseline_input)
    print("完成")

    state["final_report"] = report
    return state