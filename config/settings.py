# ds 配置
BASE_URL = "https://api.deepseek.com" 

MODEL = "deepseek-v4-flash" # "deepseek-v4-pro"

TEMPERATURE = 0     #thinking mode温度设置不生效
MAX_TOKENS = 4096
MAX_RETRIES = 2

#价格按每百万token统计。可查https://api-docs.deepseek.com/zh-cn/quick_start/pricing/
if MODEL == "deepseek-v4-flash":
    INPUT_CACHE_HIT_PRICE = 0.02
    INPUT_PRICE = 1
    OUTPUT_PRICE = 2
elif MODEL == "deepseek-v4-pro":
    INPUT_CACHE_HIT_PRICE = 0.025
    INPUT_PRICE = 3
    OUTPUT_PRICE = 6
