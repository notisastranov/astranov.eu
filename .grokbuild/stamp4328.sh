#!/bin/bash
set -euo pipefail
STAMP=4328
# index.html meta + ?v=
if [ -f index.html ]; then
  sed -i -E "s/content=\"432[0-9]\"/content=\"$STAMP\"/g" index.html
  sed -i -E "s/(\?v=)432[0-9]/g1$STAMP/g" index.html
  # only bump app.js query if present as 4327
  sed -i -E "s|js/spacenet/app\.js\?v=[0-9]+|js/spacenet/app.js?v=$STAMP|g" index.html
fi
if [ -f sw.js ]; then
  sed -i -E "s/4327/$STAMP/g" sw.js
  sed -i -E "s/(CACHE|VERSION|SN_SHELL)[^\n]{0,40}432[0-9]/\0/g" sw.js || true
fi
if [ -f api/version.js ]; then
  sed -i -E "s/\"4327\"/\"$STAMP\"/g; s/'4327'/'$STAMP'/g; s/4327/$STAMP/g" api/version.js
fi
# auth.js cache bust only if stamped
if [ -f js/spacenet/auth.js ]; then
  sed -i -E "s/VER ?= ?\"4327\"/VER = \"$STAMP\"/g" js/spacenet/auth.js || true
fi
echo "stamped $STAMP"
