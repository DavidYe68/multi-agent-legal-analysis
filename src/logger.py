import json
import os
from datetime import datetime

class Logger():
    def __init__(self, case_id=""):
        self.case_id = case_id
        self.logs = []
    
    def log(self, agent_name, input_data, output_data, round_id="",
            start_time="", end_time="",  latency_sec=None, retry_count=0,
            validation_passed=True, error="", usage=None):
        if usage is None:
            usage = {}
        entry = {
            "agent_name": agent_name,
            "timestamp": datetime.now().isoformat(),
            "input": input_data,
            "output": output_data,
            "case_id": self.case_id,
            "round_id": round_id,
            "model": usage.get("model", ""),
            "temperature": usage.get("temperature", None),
            "start_time": start_time,
            "end_time": end_time,
            "latency_sec": latency_sec,
            "prompt_tokens": usage.get("prompt_tokens", 0),
            "completion_tokens": usage.get("completion_tokens", 0),
            "total_tokens": usage.get("total_tokens", 0),
            "cache_hit_tokens": usage.get("cache_hit_tokens", 0),
            "cache_miss_tokens": usage.get("cache_miss_tokens", 0),
            "estimated_cost": usage.get("estimated_cost", 0),
            "retry_count": retry_count,
            "validation_passed": validation_passed,
            "error": error,
        }

        self.logs.append(entry)

    def save(self, filepath):
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(self.logs, f, ensure_ascii=False, indent=2)