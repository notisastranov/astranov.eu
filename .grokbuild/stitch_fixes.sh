#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
cat fix20.part00 fix20.part01 fix20.part02 fix20.part03 fix20.part04 fix20.part05 fix20.part06 > fix20.py
cat fix21_hang_auth.part00 fix21_hang_auth.part01 fix21_hang_auth.part02 fix21_hang_auth.part03 fix21_hang_auth.part04 fix21_hang_auth.part05 fix21_hang_auth.part06 fix21_hang_auth.part07 fix21_hang_auth.part08 fix21_hang_auth.part09 fix21_hang_auth.part10 fix21_hang_auth.part11 fix21_hang_auth.part12 fix21_hang_auth.part13 > fix21_hang_auth.py
cat fix22_live_priority.part00 fix22_live_priority.part01 fix22_live_priority.part02 fix22_live_priority.part03 fix22_live_priority.part04 fix22_live_priority.part05 > fix22_live_priority.py
echo "stitched ok"
