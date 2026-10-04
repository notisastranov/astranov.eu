#!/bin/bash
# usage: stamp.sh NEW  (run in repo)
set -e
N=$1
echo -n "$N" > VERSION.tmp; printf "%s\n" "$N" > VERSION; rm -f VERSION.tmp
sed -i -E "s/latest: \"[0-9]+\"/latest: \"$N\"/" api/version.js
sed -i -E "s/var VER = \"[0-9]+\";/var VER = \"$N\";/" js/spacenet/app.js
sed -i -E "s/<meta name=\"astranov-build\" content=\"[0-9]+\"\/>/<meta name=\"astranov-build\" content=\"$N\"\/>/; s/<span id=\"ver\">V[0-9]+<\/span>/<span id=\"ver\">V$N<\/span>/; s#/js/spacenet/app.js\?v=[0-9]+#/js/spacenet/app.js?v=$N#" index.html
AUTHV=$(grep -oE 'auth\.js\?v=[0-9]+' index.html | head -1 | cut -d= -f2)
sed -i -E "1s/SW [0-9]+/SW $N/; s/sn-shell-[0-9]+/sn-shell-$N/; s/^var VER = \"[0-9]+\";/var VER = \"$N\";/; s#app\.js\?v=[0-9]+#app.js?v=$N#; s#auth\.js\?v=[0-9]+#auth.js?v=$AUTHV#; s/TREE LOCK [0-9]+:/TREE LOCK $N:/" sw.js
sed -i -E "s/\"X-Astranov-Build\", \"value\": \"[0-9]+\"/\"X-Astranov-Build\", \"value\": \"$N\"/g; s/\"X-Astranov-Ship\", \"value\": \"[^\"]+\"/\"X-Astranov-Ship\", \"value\": \"$N-grok\"/g" vercel.json
