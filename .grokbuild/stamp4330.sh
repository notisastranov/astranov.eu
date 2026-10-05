#!/bin/bash
set -euo pipefail
STAMP=4330

if [ -f vercel.json ]; then
  python3 - <<'PY'
from pathlib import Path
import re
p=Path("vercel.json")
s=p.read_text(encoding="utf-8")
s=re.sub(r'(\"X-Astranov-Build\",\s*\"value\":\s*\")[^"]+(\")', r'\g<1>4330\2', s)
s=re.sub(r'(\"X-Astranov-Ship\",\s*\"value\":\s*\")[^"]+(\")', r'\g<1>4330-real\2', s)
p.write_text(s, encoding="utf-8")
print("ok vercel headers 4330")
PY
fi

if [ -f index.html ]; then
  python3 - <<'PY'
from pathlib import Path
import re
p=Path("index.html")
s=p.read_text(encoding="utf-8")
s=re.sub(r'(name="astranov-build"\s+content=")[^"]+(")', r'\g<1>4330\2', s)
s=re.sub(r'(<span id="ver">)V?[0-9]+(</span>)', r'\g<1>V4330\2', s)
s=re.sub(r'/js/spacenet/app\.jsg1[0-9]+', '/js/spacenet/app.js?v=4330', s)
s=re.sub(r'/js/spacenet/app\.js\?v=[0-9]+', '/js/spacenet/app.js?v=4330', s)
s=re.sub(r'/js/spacenet/auth\.js\?v=[0-9]+', '/js/spacenet/auth.js?v=4330', s)
s=re.sub(r'/js/vendor/leaflet\.js\?v=[0-9]+', '/js/vendor/leaflet.js?v=4330', s)
s=re.sub(r'/js/vendor/leaflet\.css\?v=[0-9]+', '/js/vendor/leaflet.css?v=4330', s)
s=re.sub(r'/guardian\.js\?v=[0-9]+', '/guardian.js?v=4330', s)
s=re.sub(r'(\?v=)[0-9]+', r'\g<1>4330', s)
p.write_text(s, encoding="utf-8")
print("ok index 4330")
PY
fi

if [ -f sw.js ]; then
  python3 - <<'PY'
from pathlib import Path
import re
p=Path("sw.js")
s=p.read_text(encoding="utf-8")
s=re.sub(r'/\* SpaceNet SW [0-9]+', '/* SpaceNet SW 4330', s)
s=re.sub(r'var CACHE = "sn-shell-[0-9]+"', 'var CACHE = "sn-shell-4330"', s)
s=re.sub(r'var VER = "[0-9]+"', 'var VER = "4330"', s)
s=re.sub(r'(\?v=)[0-9]+', r'\g<1>4330', s)
s=re.sub(r'TREE LOCK [0-9]+', 'TREE LOCK 4330', s)
p.write_text(s, encoding="utf-8")
print("ok sw 4330")
PY
fi

if [ -f api/version.js ]; then
  python3 - <<'PY'
from pathlib import Path
import re
p=Path("api/version.js")
s=p.read_text(encoding="utf-8")
s=re.sub(r'(latest:\s*")[0-9]+(")', r'\g<1>4330\2', s)
p.write_text(s, encoding="utf-8")
print("ok api/version 4330")
PY
fi

if [ -f js/spacenet/app.js ]; then
  python3 - <<'PY'
from pathlib import Path
import re
p=Path("js/spacenet/app.js")
s=p.read_text(encoding="utf-8")
s2,n=re.subn(r'var VER = "[0-9]+"', 'var VER = "4330"', s, count=1)
if not n:
  raise SystemExit("VER missing in app.js")
s2=re.sub(r'location\.href = "/\?v=[0-9]+', 'location.href = "/?v=4330', s2)
s2=re.sub(r'window\.__SN_[0-9]+', 'window.__SN_4330', s2)
p.write_text(s2, encoding="utf-8")
print("ok app VER+crumbs 4330")
PY
fi

if [ -f js/spacenet/auth.js ]; then
  python3 - <<'PY'
from pathlib import Path
import re
p=Path("js/spacenet/auth.js")
s=p.read_text(encoding="utf-8")
if re.search(r'VER\s*=\s*"[0-9]+"', s):
  s=re.sub(r'(VER\s*=\s*")[0-9]+(")', r'\g<1>4330\2', s)
  p.write_text(s, encoding="utf-8")
  print("ok auth VER 4330")
else:
  print("skip auth VER")
PY
fi

if [ -f VERSION ] || true; then
  printf '4330\n' > VERSION
  echo "ok VERSION 4330"
fi

echo "stamped 4330"
