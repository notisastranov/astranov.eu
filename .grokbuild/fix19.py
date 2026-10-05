import re
A = "js/spacenet/app.js"
s = open(A, encoding="utf-8").read()
m = re.search(r"function moveDriver\(pt\)\s*\{.{0,180}", s, re.S)
snippet = m.group(0) if m else "NO moveDriver"
print("moveDriver snippet:", repr(snippet[:180]))
if re.search(r"function moveDriver\(pt\)\s*\{\s*if \(!\(isAdmin\(\) \|\| myRole\(\) === \"driver\"\) \|\| !pt\) return;", s):
    print("already driver-capable")
elif re.search(r"function moveDriver\(pt\)\s*\{\s*if \(!isAdmin\(\) \|\| !pt\) return;", s):
    s2, n = re.subn(
        r"(function moveDriver\(pt\)\s*\{\s*)if \(!isAdmin\(\) \|\| !pt\) return;",
        r'\1if (!(isAdmin() || myRole() === "driver") || !pt) return;',
        s, count=1)
    assert n == 1, n
    open(A, "w", encoding="utf-8").write(s2)
    print("ok19 patched")
else:
    # last resort: any admin-only gate right after moveDriver
    s2, n = re.subn(
        r"(function moveDriver\(pt\)\s*\{\s*)if\s*\(\s*!isAdmin\(\)\s*\|\|\s*!pt\s*\)\s*return\s*;",
        r'\1if (!(isAdmin() || myRole() === "driver") || !pt) return;',
        s, count=1)
    if n != 1:
        raise SystemExit("moveDriver admin gate not found; snippet=" + repr(snippet[:200]))
    open(A, "w", encoding="utf-8").write(s2)
    print("ok19 patched loose")
print("ok19")
