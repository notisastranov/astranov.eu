#!/bin/bash
set -e
cd "$(dirname "$0")"
cat fix20.py.part0 fix20.py.part1 fix20.py.part2 > fix20.py
cat fix21_hang_auth.py.part0 fix21_hang_auth.py.part1 fix21_hang_auth.py.part2 fix21_hang_auth.py.part3 fix21_hang_auth.py.part4 > fix21_hang_auth.py
cat fix22_live_priority.py.part0 fix22_live_priority.py.part1 fix22_live_priority.py.part2 > fix22_live_priority.py
rm -f fix20.py.b64.c0 2>/dev/null || true
