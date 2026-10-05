#!/usr/bin/env python3
"""4325 layout regressions a–g on merged tree."""
import re

def must(cond, msg):
    if not cond:
        raise SystemExit("FAIL: " + msg)

# ---------- index.html: #top at 56px; Account aria ----------
idx = open("index.html", encoding="utf-8").read()
idx2 = idx
idx2 = idx2.replace("#top{top:0 !important", "#top{top:0 !important")
idx2 = idx2.replace("#top{top:0!important", "#top{top:0!important")
must("top:0" in idx2, "index #top 0")
idx2 = idx2.replace('id="sn-me" class="out" aria-label="Login"', 'id="sn-me" class="out" aria-label="Account"')
open("index.html", "w", encoding="utf-8").write(idx2)
print("ok index")

# ---------- app.js ----------
A = "js/spacenet/app.js"
s = open(A, encoding="utf-8").read()
must("<<<<<<<" not in s, "conflict markers still in app.js")

# moveDriver driver role
if re.search(r"function moveDriver\(pt\)\s*\{\s*if \(!isAdmin\(\) \|\| !pt\) return;", s):
    s = re.sub(
        r"(function moveDriver\(pt\)\s*\{\s*)if \(!isAdmin\(\) \|\| !pt\) return;",
        r'\1if (!(isAdmin() || myRole() === "driver") || !pt) return;',
        s, count=1)
    print("ok moveDriver")
elif 'myRole() === "driver"' in s and "moveDriver" in s:
    print("moveDriver already allows driver")
else:
    print("WARN moveDriver pattern")

# (e) FIND → LIST for showFound
s2, n = re.subn(
    r'openSheet\("FIND · " \+ view\.length,\s*html\);',
    r'openTile({ kind: "list", title: "LIST · " + view.length, html: html });',
    s)
if n:
    s = s2
    print("ok showFound LIST", n)
else:
    s2, n = re.subn(
        r'openSheet\("FIND · " \+ ([^,]+),\s*html\);',
        r'openTile({ kind: "list", title: "LIST · " + \1, html: html });',
        s)
    if n:
        s = s2
        print("ok showFound LIST alt", n)
    else:
        print("WARN showFound FIND not found")

# closeFind also matches LIST
if "closeFind" in s and "/^FIND\\b/" in s and "/^LIST\\b/" not in s:
    s = s.replace(
        "/^FIND\\b/.test(String(mid.textContent || \"\"))",
        "/^(FIND|LIST)\\b/.test(String(mid.textContent || \"\"))"
    )
    print("ok closeFind LIST")

# (c) pill fill: name + right-aligned distance only
old_fill = '''        pills[i].querySelector("b").textContent = s.name;
        var from = named || here;
        pills[i].querySelector("span").textContent = (s.kind || "shop") + (realPhone(s.phone) ? " · " + realPhone(s.phone) : "") + (from ? " · " + haversineKm(from, s).toFixed(1) + " km" : "");'''
new_fill = '''        pills[i].querySelector("b").textContent = s.name;
        var from = named || here;
        var dist = from ? haversineKm(from, s).toFixed(1) + " km" : "";
        pills[i].querySelector("span").textContent = dist;
        pills[i].title = (s.kind || "shop") + (realPhone(s.phone) ? " · " + realPhone(s.phone) : "") + (dist ? " · " + dist : "");'''
if old_fill in s:
    s = s.replace(old_fill, new_fill, 1)
    print("ok pill distance-only")
elif "haversineKm(from, s).toFixed(1) + \" km\"" in s and "pills[i].title" in s:
    print("pill fill already patched")
else:
    print("WARN pill fill pattern")

# (d) tileContact separators
if "return tel + addr;" in s:
    s = s.replace("return tel + addr;", 'return tel + \'<span class="sn-gap"> · </span>\' + addr;', 1)
    print("ok tileContact")
elif "sn-gap" in s:
    print("tileContact already spaced")
else:
    print("WARN tileContact")

# Inject layout CSS (a)(c)(f) after first #top{top:0!important}
LAYOUT = (
    '"#top{top:0!important}",'
    '"#sn-sheet .card,#sn-sheet.tile .card,#sn-sheet.tall .card{bottom:calc(var(--dock,78px) + 120px)!important;'
    'max-height:min(42vh, calc(100dvh - var(--dock,78px) - 160px))!important}",'
    '"#dock,#sn-above,#gps,#sn-me{z-index:92!important}",'
    '"#sn-sheet{z-index:70!important}",'
    '"#sn-sheet.on{pointer-events:none!important}",'
    '"#sn-sheet.on .card{pointer-events:auto!important}",'
    '"#sn-sheet .pill{display:grid!important;grid-template-columns:36px minmax(0,1fr)!important;'
    'align-items:center!important;gap:8px!important;width:100%!important;text-align:left!important}",'
    '"#sn-sheet .pill > div{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;'
    'column-gap:8px!important;align-items:baseline!important;min-width:0!important;width:100%!important}",'
    '"#sn-sheet .pill b{display:block!important;min-width:0!important;overflow:hidden!important;'
    'text-overflow:ellipsis!important;white-space:nowrap!important;grid-column:1!important;'
    'color:#e8fbff!important;font:700 14px/1.2 system-ui!important}",'
    '"#sn-sheet .pill > div > span{display:block!important;grid-column:2!important;justify-self:end!important;'
    'white-space:nowrap!important;color:#7ee9ff!important;font:700 11px/1.2 system-ui!important}",'
    '"#sn-sheet .sn-miss{display:block!important;margin-top:2px!important}",'
    '"#sn-sheet .sn-gap{display:inline!important;margin:0 2px!important}",'
    '"#sn-sheet .sn-tel + .sn-miss,#sn-sheet .sn-miss + .sn-miss{margin-top:4px!important}",'
)

if "bottom:calc(var(--dock,78px) + 120px)" not in s:
    # Prefer insert after a known CSS top:56 string
    m = re.search(r'"#top\{top:0!important[^"]*"', s)
    if m:
        s = s[: m.end()] + "," + LAYOUT + s[m.end() :]
        print("ok inject layout CSS")
    else:
        m = re.search(r'"#top\{top:[^"]+"', s)
        if m:
            s = s[: m.end()] + "," + LAYOUT + s[m.end() :]
            print("ok inject layout CSS (alt)")
        else:
            raise SystemExit("no CSS insert point for layout")
else:
    print("layout CSS already present")

open(A, "w", encoding="utf-8").write(s)
print("ok app.js")

# ---------- auth.js ----------
B = "js/spacenet/auth.js"
a = open(B, encoding="utf-8").read()

# CSS block for who + backdrop that leaves GPS free + close size
needle = '#sn-me-sheet .note{margin:8px 0 0;font:500 12px/1.35 system-ui;color:#8ec8d8}";'
if needle in a and "#sn-me-sheet .who b{display:block" not in a:
    a = a.replace(
        needle,
        '#sn-me-sheet .note{margin:8px 0 0;font:500 12px/1.35 system-ui;color:#8ec8d8}" +'
        '"#sn-me-sheet .who > div{min-width:0;flex:1}" +'
        '"#sn-me-sheet .who b{display:block;font:800 15px/1.2 system-ui;color:#e8fbff}" +'
        '"#sn-me-sheet .who span{display:block;margin-top:4px;font:600 12px/1.3 system-ui;color:#7ee9ff}" +'
        '"#sn-me-sheet{z-index:88}" +'
        '"#sn-me-sheet .bg{position:absolute;left:0;right:0;top:0;bottom:calc(var(--dock,78px) + 120px)}" +'
        '"#sn-me-sheet .x{min-width:72px;font:700 12px/1 system-ui}" +'
        '"#gps,#sn-me,#dock,#sn-above{z-index:92!important}";'
    )
    print("ok auth CSS")
elif "#sn-me-sheet .who b{display:block" in a:
    print("auth CSS already")
else:
    print("WARN auth CSS needle")

# Close button labelled
a = a.replace(
    '<button type="button" class="x" data-act="close">✕</button>',
    '<button type="button" class="x" data-act="close" aria-label="Close">✕ Close</button>',
)

# paintMe aria-label
if 'btn.setAttribute("aria-label"' not in a:
    old = '''    btn.className = inNow ? "in" : "out";
    btn.innerHTML = '<span class="lbl">' + (inNow ? "YOU" : "LOGIN") + '</span><span class="tgt">' + (inNow ? face(u) : '<span class="ph">IN</span>') + "</span>";
    if (window.SN && SN.paintMoney) SN.paintMoney();'''
    new = '''    btn.className = inNow ? "in" : "out";
    btn.setAttribute("aria-label", inNow ? ("You · " + (u.name || u.email || "account")) : "Login");
    btn.innerHTML = '<span class="lbl">' + (inNow ? "YOU" : "LOGIN") + '</span><span class="tgt">' + (inNow ? face(u) : '<span class="ph">IN</span>') + "</span>";
    if (window.SN && SN.paintMoney) SN.paintMoney();'''
    if old in a:
        a = a.replace(old, new)
        print("ok paintMe aria")
    else:
        print("WARN paintMe")

# Esc to close
if "Escape" not in a:
    hook = '''    fillBody();
    sh.classList.add("on");
  }
  function boot() {'''
    rep = '''    fillBody();
    sh.classList.add("on");
    if (!sh.__esc) {
      sh.__esc = true;
      document.addEventListener("keydown", function (ev) {
        if (ev.key === "Escape" && sh.classList.contains("on")) {
          sh.classList.remove("on");
        }
      });
    }
  }
  function boot() {'''
    if hook in a:
        a = a.replace(hook, rep, 1)
        print("ok Esc")
    else:
        # looser
        if "sh.classList.add(\"on\");\n  }\n  function boot()" in a:
            a = a.replace(
                "sh.classList.add(\"on\");\n  }\n  function boot()",
                "sh.classList.add(\"on\");\n    if (!sh.__esc) {\n      sh.__esc = true;\n      document.addEventListener(\"keydown\", function (ev) {\n        if (ev.key === \"Escape\" && sh.classList.contains(\"on\")) sh.classList.remove(\"on\");\n      });\n    }\n  }\n  function boot()",
                1,
            )
            print("ok Esc loose")
        else:
            print("WARN Esc")

open(B, "w", encoding="utf-8").write(a)
print("ok auth.js")
print("fix20 done")
