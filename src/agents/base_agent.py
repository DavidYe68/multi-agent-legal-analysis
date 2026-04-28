import json
from src.llm_client import call_llm

class BaseAgent:
    def __init__(self, name, prompt_file, prompt_key, input_fields, output_field):
        self.name = name
        self.prompt_file = prompt_file
        self.prompt_key = prompt_key
        self.input_fields = input_fields
        self.output_field = output_field

    def run(self, state, logger):
        context = {field: state[field] for field in self.input_fields}

        with open(self.prompt_file, "r", encoding="utf-8") as f:
            all_prompts = json.load(f)
        prompt = all_prompts[self.prompt_key]

        print(f"[{self.name}] 开始调用 LLM...")
        result = call_llm(prompt, json.dumps(context, ensure_ascii=False))
        print(f"[{self.name}] 完成")

        state[self.output_field] = result
        logger.log(self.name, context, result)

        return state