/* SpaceNet 4253 — one-entity OS (inline gz inflate; never set __SN_4252 before eval). */
window.__SN4252_GZ = "SEE_FILE";
(async function () {
  "use strict";
  try {
    var b64 = window.__SN4252_GZ || "";
    if (!b64) throw new Error("4252 gz missing");
    var b = Uint8Array.from(atob(b64), function (c) { return c.charCodeAt(0); });
    var code = await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
    if (code.indexOf("function talk(") < 0) throw new Error("4252 inflate fail");
    (0, eval)(code);
  } catch (e) {
    var el = document.getElementById("line");
    if (el) el.textContent = "4252 OS load failed.";
    console.error(e);
  }
})();
