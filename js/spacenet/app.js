/* SpaceNet 4253 — one-entity OS (fetch gz8 + inflate; never set __SN_4252 before eval). */
(async function () {
  "use strict";
  try {
    for (var i = 0; i < 8; i++) {
      var t = await (await fetch("/js/spacenet/gz8-" + i + ".js?v=4253", { cache: "no-store" })).text();
      (0, eval)(t);
    }
    var b64 = window.__SN4252_GZ || "";
    if (!b64) throw new Error("4253 gz missing");
    var b = Uint8Array.from(atob(b64), function (c) { return c.charCodeAt(0); });
    var code = await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
    if (code.indexOf("function talk(") < 0) throw new Error("4253 inflate fail");
    (0, eval)(code);
  } catch (e) {
    var el = document.getElementById("line");
    if (el) el.textContent = "4252 OS load failed.";
    console.error(e);
  }
})();
