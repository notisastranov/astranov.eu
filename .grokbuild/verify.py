import re
assert open("VERSION").read().strip() == "4326"
assert open("api/version.js").read().count('latest: "4326"') == 1
idx = open("index.html").read()
for x in ['astranov-build" content="4326"', ">V4326<", "app.js?v=4326", "auth.js?v=4326"]:
    assert x in idx, x
assert "top:56px" in idx
app = open("js/spacenet/app.js").read()
assert app.count('var VER = "4326";') == 1
assert "<<<<<<<" not in app
for k in ["isTestJob", "vendorPresent", "dismiss-job", "junkPlace", "Move the driver here", "lastSeat", "huntDone", "locateSettled", "FIND is empty here", "seatedCat"]:
    assert k in app, k
assert 'myRole() === "driver"' in app
assert "LIST ·" in app or 'title: "LIST' in app
assert "bottom:calc(var(--dock,78px) + 120px)" in app
assert "text-overflow:ellipsis" in app
assert "once(\"timeout\")" in app or 'once("timeout")' in app
auth = open("js/spacenet/auth.js").read()
assert "aria-label" in auth and "Escape" in auth
assert 'setAttribute("aria-label"' in auth
assert "location.origin" in auth
assert "without the local key" in auth
assert 'grant_type: "authorization_code"' not in auth
assert "astranov.eu" not in auth
sw = open("sw.js").read()
assert "sn-shell-4326" in sw
v = open("vercel.json").read()
assert "4326-grok" in v
print("verify ok")
