import json
import os
from datetime import datetime

class Logger():
    def __init__(self):
        self.logs = []
    
    def log(self, agent_name, input_data, output_data):
        entry = {
            "agent_name": agent_name,
            "timestamp": datetime.now().isoformat(),
            "input": input_data,
            "output": output_data
        }

        self.logs.append(entry)

    def save(self, filepath):
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(self.logs, f, ensure_ascii=False, indent=2)