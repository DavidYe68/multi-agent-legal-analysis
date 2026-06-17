from openai import OpenAI
import json
import time
from config.settings import  BASE_URL, MODEL, TEMPERATURE, MAX_TOKENS, MAX_RETRIES, INPUT_CACHE_HIT_PRICE, INPUT_PRICE, OUTPUT_PRICE

import os
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("API_KEY")
if not API_KEY:
    raise ValueError("请输入DeepSeek的API KEY")


client = OpenAI(api_key=API_KEY, base_url=BASE_URL)

def clean_response(text):
    text = text.strip()
    if "```json" in text:
        text = text.split("```json", 1)[1]

    if "```" in text:
        text = text.split("```", 1)[0]

    return text.strip()

def estimate_cost(cache_hit_tokens, cache_miss_tokens, completion_tokens):
    input_cost = cache_hit_tokens / 1000000 * INPUT_CACHE_HIT_PRICE + cache_miss_tokens / 1000000 * INPUT_PRICE
    output_cost = completion_tokens / 1000000 * OUTPUT_PRICE
    return round(input_cost + output_cost, 6)

def call_llm(system_prompt, user_message):
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_message}
    ]

    for attempt in range(MAX_RETRIES):
        try:
            response = client.chat.completions.create(
                model=MODEL,
                messages=messages,
                temperature=TEMPERATURE,
                max_tokens=MAX_TOKENS,
                response_format={"type": "json_object"}
            )

            raw_text = response.choices[0].message.content
            clean_text = clean_response(raw_text)
            result = json.loads(clean_text)

            cache_hit_tokens = getattr(response.usage, "prompt_cache_hit_tokens", 0)
            cache_miss_tokens = response.usage.prompt_tokens - cache_hit_tokens
            usage = {
                "model": MODEL,
                "temperature": TEMPERATURE,
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
                "total_tokens": response.usage.total_tokens,
                "cache_hit_tokens": cache_hit_tokens,
                "cache_miss_tokens": cache_miss_tokens,
                "estimated_cost": estimate_cost(cache_hit_tokens, cache_miss_tokens, response.usage.completion_tokens),
            }
            return result, usage
        
        # AIGC 报错补丁
        except json.JSONDecodeError as e:
            print(f"[LLM]第{attempt + 1}次尝试失败 JSON 解析错误: {e}")
            print(f"[LLM]原始返回: {raw_text!r}")
            time.sleep(1)
        except Exception as e:
            print(f"[LLM]第{attempt + 1}次尝试失败: {type(e).__name__}: {e}")
            time.sleep(1)

    raise RuntimeError("LLM call failed after all retries") 
