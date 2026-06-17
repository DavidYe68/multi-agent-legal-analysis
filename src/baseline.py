import json
from src.llm_client import call_llm
from src.state_manager import create_state

def run_baseline(case_data, config):
    state = create_state(case_data, config)
    
    with open("prompts/baseline.txt", "r", encoding="utf-8") as f:
        prompt = f.read()
     
    baseline_input = json.dumps({
        "case_narrative": state["case_narrative"],
        "facts": state["facts"],
        "claims": state["claims"],
        "evidence": state["evidence"],
        "procedure": state["procedure"],
        "domain": state["domain"],
        "task_mode": state["task_mode"]
    }, ensure_ascii=False)

    print("开始调用Baseline LLM")
    report = call_llm(prompt, baseline_input)
    print("完成")

    state["final_report"] = report
    return state