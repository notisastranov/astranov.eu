#!/bin/bash
# usage: stamp2.sh NEW  (run in repo) — every stamp in lockstep
set -e
N=$1
printf "%s\n" "$N" > VERSION
sed -i -E "s/latest: \"[0-9]+\"/latest: \"$N\"/" api/version.js
sed -i -E "s/var VER = \"[0-9]+\";/var VER = \"$N\";/" js/spacenet/app.js
sed -i -E "s/<meta name=\"astranov-build\" content=\"[0-9]+\"\\/>/<meta name=\"astranov-build\" content=\"$N\"\\/>/; s/<span id=\"ver\">V[0-9]+<\\/span>/<span id=\"ver\">V$N<\\/span>/; s#(/js/spacenet/app\\.js|/js/spacenet/auth\\.js|/guardian\\.js|/js/vendor/leaflet\\.js|/js/vendor/leaflet\\.css)\\?v=[0-9]+#\\1?v=$N#g" index.html
sed -i -E "1s/SW [0-9]+/SW $N/; s/sn-shell-[0-9]+/sn-shell-$N/; s/^var VER = \"[0-9]+\";/var VER = \"$N\";/; s#(/js/spacenet/app\\.js|/js/spacenet/auth\\.js|/js/vendor/leaflet\\.js|/js/vendor/leaflet\\.css)\\?v=[0-9]+#\\1?v=$N#g; s/TREE LOCK [0-9]+:/TREE LOCK $N:/" sw.js
sed -i -E "s/\"X-Astranov-Build\", \"value\": \"[0-9]+\"/\"X-Astranov-Build\", \"value\": \"$N\"/g; s/\"X-Astranov-Ship\", \"value\": \"[^\"]+\"/\"X-Astranov-Ship\", \"value\": \"$N-grok\"/g" vercel.json
