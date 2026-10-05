#!/usr/bin/env python3
"""Resolve merge conflicts: Notis layout + our honesty/talk-city."""
import re, subprocess

def strip_markers(blob):
    return re.sub(r"<<<<<<< HEAD\n|=======\n|>>>>>>> [^\n]+\n", "", blob)

# ---- VERSION / api / vercel / index: prefer theirs, stamp later ----
for f in ["VERSION", "api/version.js", "vercel.json", "index.html"]:
    try:
        subprocess.check_call(["git", "checkout", "--theirs", "--", f])
        subprocess.check_call(["git", "add", "--", f])
        print("theirs", f)
    except Exception as e:
        print("skip", f, e)

# ---- app.js: surgical ----
p = "js/spacenet/app.js"
s = open(p, encoding="utf-8").read()
END = r">>>>>>> [^\n]+\n"
pat = re.compile(r"<<<<<<< HEAD\n(.*?)=======\n(.*?)" + END, re.S)

def pick(m):
    ours, theirs = m.group(1), m.group(2)
    blob = ours + "\n" + theirs
    # VER stamp — take theirs (restamped later)
    if "var VER" in ours and "var VER" in theirs:
        print("pick VER theirs")
        return theirs
    # listAt: keep move-driver from ours + openTile LIST from theirs
    if "Move the driver here" in ours or ("openTile" in theirs and "LIST" in theirs and "listAt" in s[max(0,m.start()-80):m.start()+20]):
        if "Move the driver here" in ours and "openTile" in theirs:
            combo = ""
            # keep driver button block from ours
            for line in ours.splitlines(True):
                if "openSheet" in line:
                    continue
                combo += line
            # ensure move-driver present
            if "Move the driver here" not in combo:
                combo += '    if ((isAdmin() || myRole() === "driver") && driverPin && isFinite(+driverPin.lat)) {\n'
                combo += '      html += \'<button type="button" class="sheet-go" data-act="move-driver">Move the driver here</button>\';\n'
                combo += "    }\n"
            # append theirs openTile line(s)
            for line in theirs.splitlines(True):
                if "openTile" in line or "openSheet" in line:
                    combo += line if "openTile" in line else '    openTile({ kind: "list", title: "LIST", html: html });\n'
            print("pick listAt combo")
            return combo
        if "openTile" in theirs and "LIST" in theirs:
            print("pick listAt theirs + inject driver")
            inj = theirs
            if "Move the driver here" not in inj:
                inj = (
                    '    if ((isAdmin() || myRole() === "driver") && driverPin && isFinite(+driverPin.lat)) {\n'
                    '      html += \'<button type="button" class="sheet-go" data-act="move-driver">Move the driver here</button>\';\n'
                    "    }\n" + inj
                )
            return inj
    # honesty / talk-city markers → ours
    if any(k in ours for k in ("isTestJob", "junkPlace", "VENDOR GONE", "dismiss-job", "seated", "BRIEF")):
        print("pick honesty ours")
        return ours
    # layoutChrome / CSS → theirs
    if "layoutChrome" in blob or "#sn-above" in theirs or "#top{top:56" in theirs:
        print("pick layout theirs")
        return theirs
    print("pick default ours")
    return ours

s2, n = pat.subn(pick, s)
print("resolved", n, "conflict(s) in app.js")
s = s2
if "<<<<<<<" in s or ">>>>>>>" in s:
    raise SystemExit("unresolved markers remain in app.js")
open(p, "w", encoding="utf-8").write(s)
subprocess.check_call(["git", "add", "--", p])

# auth.js: no conflict expected; leave ours/branch version
print("resolve done")
