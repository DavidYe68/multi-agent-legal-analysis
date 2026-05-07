import json
from src.llm_client import call_llm

class BaseAgent:
    def __init__(self, name, input_fields, output_field):
        self.name = name
        self.prompt_file = f"prompts/{name}_prompt.txt"
        self.input_fields = input_fields
        self.output_field = output_field

    def run(self, state, logger):
        context = {field: state[field] for field in self.input_fields}
        with open(self.prompt_file, "r", encoding="utf-8") as f:
            prompt = f.read()

        print(f"[{self.name}] 开始调用 LLM...")
        result = call_llm(prompt, json.dumps(context, ensure_ascii=False))

        # 校验输出字段
        missing = self.validate(result)
        if missing:
            print(f"[{self.name}] 输出缺少字段: {missing}，重试中...")
            result = call_llm(prompt, json.dumps(context, ensure_ascii=False))

        print(f"[{self.name}] 完成")

        state[self.output_field] = result
        logger.log(self.name, context, result)
        return state
    
    def validate(self, result):
        try:
            with open("data/schemas/agent_output_schemas.json", "r", encoding="utf-8") as f:
                schemas = json.load(f)
            required = schemas.get(self.name, [])
            missing = [field for field in required if field not in result]
            return missing
        except FileNotFoundError:
            return []