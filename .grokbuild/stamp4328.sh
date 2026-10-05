#!/bin/bash
set -euo pipefail
STAMP=4328
if [ -f index.html ]; then
  sed -i -E "s/content=\"432[0-9]\"/content=\"$STAMP\"/g" index.html
  sed -i -E "s/(\?v=)432[0-9]/g1$STAMP/g" index.html
  sed -i -E "s|js/spacenet/app\.js\?v=[0-9]+|js/spacenet/app.js?v=$STAMP|g" index.html
fi
if [ -f sw.js ]; then
  sed -i -E "s/4327/$STAMP/g" sw.js || true
  sed -i -E "s/4328/$STAMP/g" sw.js || true
fi
if [ -f api/version.js ]; then
  sed -i -E "s/\"4327\"/\"$STAMP\"/g; s/'4327'/'$STAMP'/g; s/4327/$STAMP/g" api/version.js
  sed -i -E "s/\"4328\"/\"$STAMP\"/g; s/'4328'/'$STAMP'/g" api/version.js
fi
echo "stamped $STAMP"
