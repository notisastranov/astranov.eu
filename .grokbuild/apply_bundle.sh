#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
base64 -d bundle.b64 | tar xzf -
python3 resolve.py
python3 fix20.py
python3 fix21_hang_auth.py
bash stamp2.sh 4326
python3 verify.py
