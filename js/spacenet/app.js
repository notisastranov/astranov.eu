/* SpaceNet 4219 — sync z-join (monolithic equivalent, no document.write) */
(function () {
  if (window.__SN_4219) return;
  var parts = [];
  for (var i = 0; i < 8; i++) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", "/js/spacenet/_z" + i + ".js?v=4219", false);
    xhr.send(null);
    if (xhr.status < 200 || xhr.status >= 300) {
      console.error("SN z-join fail", i, xhr.status);
      return;
    }
    var t = xhr.responseText || "";
    var m = t.match(/__SN_P\[\d+\]=("(?:\\.|[^"\\])*")/);
    if (!m) { console.error("SN z-join parse", i); return; }
    try { parts[i] = JSON.parse(m[1]); } catch (e) { console.error("SN z-join json", i, e); return; }
  }
  (0, eval)(parts.join(""));
})();
