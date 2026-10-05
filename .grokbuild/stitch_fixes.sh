#!/bin/bash
set -e
cd "$(dirname "$0")"
base64 -d fix20.py.b64 > fix20.py
cat fix21.b64.p0 fix21.b64.p1 fix21.b64.p2 | base64 -d > fix21_hang_auth.py
base64 -d fix22_live_priority.py.b64 > fix22_live_priority.py
