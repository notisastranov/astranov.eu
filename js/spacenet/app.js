/* SpaceNet 4228 app loader — sync join of patched parts */
(function () {
  "use strict";
  if (window.__SN_4228) return;
  function load(url) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, false);
    xhr.send(null);
    if (xhr.status >= 200 && xhr.status < 300) return xhr.responseText;
    throw new Error("load fail " + url + " " + xhr.status);
  }
  var src = "";
  for (var i = 0; i < 3; i++) {
    src += load("/js/spacenet/app.p" + i + ".js?v=4228");
  }
  (0, eval)(src);
})();
