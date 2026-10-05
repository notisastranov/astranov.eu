assert open("VERSION").read().strip() == "4324"
assert open("api/version.js").read().count('latest: "4324"') == 1
idx = open("index.html").read()
for x in ['astranov-build" content="4324"', ">V4324<", "app.js?v=4324", "auth.js?v=4324", "guardian.js?v=4324", "leaflet.js?v=4324", "leaflet.css?v=4324"]:
    assert x in idx, x
assert "sn-row" in idx
app = open("js/spacenet/app.js").read()
assert app.count('var VER = "4324";') == 1
assert "<<<<<<<" not in app and ">>>>>>>" not in app
for k in ["isTestJob", "vendorPresent", "dismiss-job", "orderBit", "Move the driver here", "paintJobsChip", "cardsNow", "seated", "BRIEF", "junkPlace", "armPinch", "openRouteTile", "#sn-row{"]:
    assert k in app, k
assert 'myRole() === "driver"' in app
import re
assert re.search(r"function moveDriver\(pt\)\s*\{\s*if \(!\(isAdmin\(\) \|\| myRole\(\) === \"driver\"\) \|\| !pt\) return;", app), "moveDriver still admin-only"
sw = open("sw.js").read()
assert "sn-shell-4324" in sw and 'VER = "4324"' in sw
v = open("vercel.json").read()
assert "4324-grok" in v
print("verify ok")
