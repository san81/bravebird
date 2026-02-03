#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root/cdk"

outputs_file="cdk.out/outputs.json"
if [[ ! -f "$outputs_file" ]]; then
  echo "Missing $outputs_file. Run: make cdk-deploy"
  exit 1
fi

output_json="$(cat "$outputs_file")"

python3 - <<PY
import json, os, sys

data = json.loads('''${output_json}''')
stack = data.get('BravebirdStack') or next(iter(data.values()))

lines = [
    f"HIGH_QUEUE_URL={stack.get('HighPriorityQueueUrl','')}",
    f"NORMAL_QUEUE_URL={stack.get('NormalPriorityQueueUrl','')}",
    f"ARTIFACTS_BUCKET={stack.get('ArtifactsBucketName','')}",
    f"STATUS_TABLE={stack.get('JobStatusTableName','')}",
    f"RATE_LIMIT_TABLE={stack.get('RateLimitTableName','')}",
]

out_path = os.path.join(os.path.dirname(__file__), '..', '.env')
with open(out_path, 'w', encoding='utf-8') as f:
    f.write("\n".join(lines) + "\n")

print(out_path)
PY
