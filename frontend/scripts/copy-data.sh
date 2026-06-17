#!/usr/bin/env bash
#
# copy-data.sh
#
# 把项目根的案件数据拷贝到 frontend/public/data/ 下，供前端通过 fetch 读取。
#
#   datasets/cases/processed/*.json   →  public/data/cases/{caseId}.json
#   outputs/{caseId}/state_final.json →  public/data/outputs/{caseId}.json
#
# 并生成 public/data/manifest.json（案件 id 清单 + 有产物的 id 清单），
# 因为浏览器无法列目录，listCases() 需要一份显式清单。
#
# 注意：运行产物实际位于 outputs/{caseId}/state_final.json
# （不是 outputs/full/...——项目里并没有 full/ 这一层目录）。
#
# 用法：bash frontend/scripts/copy-data.sh   或   (cd frontend && npm run copy-data)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$FRONTEND_DIR/.." && pwd)"

SRC_CASES="$PROJECT_ROOT/datasets/cases/processed"
SRC_OUTPUTS="$PROJECT_ROOT/outputs"
SRC_SPLITS="$PROJECT_ROOT/datasets/splits"
DEST_DATA="$FRONTEND_DIR/public/data"
DEST_CASES="$DEST_DATA/cases"
DEST_OUTPUTS="$DEST_DATA/outputs"

if [ ! -d "$SRC_CASES" ]; then
  echo "找不到案件目录：$SRC_CASES" >&2
  exit 1
fi

mkdir -p "$DEST_CASES" "$DEST_OUTPUTS"
# 清掉旧的拷贝，避免残留已删除的案件。
rm -f "$DEST_CASES"/*.json "$DEST_OUTPUTS"/*.json 2>/dev/null || true

case_ids=()
output_ids=()

for f in "$SRC_CASES"/*.json; do
  [ -e "$f" ] || continue
  base="$(basename "$f" .json)"

  cp "$f" "$DEST_CASES/$base.json"
  case_ids+=("$base")

  out="$SRC_OUTPUTS/$base/state_final.json"
  if [ -f "$out" ]; then
    cp "$out" "$DEST_OUTPUTS/$base.json"
    output_ids+=("$base")
  fi
done

# ---- 生成 manifest.json -----------------------------------------------------
join_json_array() {
  local first=1
  local item
  printf '['
  for item in "$@"; do
    if [ "$first" -eq 1 ]; then
      first=0
    else
      printf ', '
    fi
    printf '"%s"' "$item"
  done
  printf ']'
}

# 读取一个划分文件（本身就是 JSON 数组），压成单行内联进 manifest。
# 文件不存在时回退为空数组。划分文件只含不带空格的 id，故用 tr 去空白即可，
# 不引入 jq 依赖。
read_split_array() {
  local f="$SRC_SPLITS/$1"
  if [ -f "$f" ]; then
    tr -d ' \t\r\n' < "$f"
  else
    printf '[]'
  fi
}

{
  printf '{\n'
  printf '  "cases": %s,\n' "$(join_json_array "${case_ids[@]}")"
  printf '  "outputs": %s,\n' "$(join_json_array "${output_ids[@]}")"
  printf '  "splits": { "development": %s, "test": %s }\n' \
    "$(read_split_array development.json)" "$(read_split_array test.json)"
  printf '}\n'
} > "$DEST_DATA/manifest.json"

echo "已拷贝 ${#case_ids[@]} 个案件、${#output_ids[@]} 份运行产物 → $DEST_DATA"
