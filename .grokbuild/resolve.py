import re, subprocess
p = "js/spacenet/app.js"
s = open(p, encoding="utf-8").read()
END = r">>>>>>> [^\n]+\n"
pat = re.compile(r"<<<<<<< HEAD\n(.*?)=======\n(.*?)" + END, re.S)

def pick(m):
    ours, theirs = m.group(1), m.group(2)
    blob = ours + "\n" + theirs
    if "var VER" in blob and "var VER" in ours and "var VER" in theirs:
        return theirs
    if "function layoutChrome" in blob:
        return theirs
    if "#sn-row{" in theirs or "#sn-pulse,#sn-tester{top:108px" in theirs:
        return theirs
    # keep talk-city / honesty / seated / offer / LIVE labels
    return ours

s2, n = pat.subn(pick, s)
if n:
    print("resolved", n, "app.js conflict(s)")
s = s2
assert "<<<<<<<" not in s and ">>>>>>>" not in s, "unresolved markers remain"
open(p, "w", encoding="utf-8").write(s)
for f in ["VERSION", "api/version.js", "index.html", "vercel.json"]:
    subprocess.check_call(["git", "checkout", "--theirs", "--", f])
    subprocess.check_call(["git", "add", "--", f])
subprocess.check_call(["git", "add", "--", p])
print("resolved")
