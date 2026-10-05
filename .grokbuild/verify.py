import sys
assert open("VERSION").read().strip() == "4322"
assert open("api/version.js").read().count('latest: "4322"') == 1
idx = open("index.html").read()
for x in ['astranov-build" content="4322"', ">V4322<", "app.js?v=4322", "auth.js?v=4322", "guardian.js?v=4322", "leaflet.js?v=4322", "leaflet.css?v=4322"]:
    assert x in idx, x
app = open("js/spacenet/app.js").read()
assert app.count('var VER = "4322";') == 1
assert "<<<<<<<" not in app and ">>>>>>>" not in app
for k in ["isTestJob", "vendorPresent", "dismiss-job", "orderBit", "Move the driver here", "paintJobsChip", "cardsNow", "seated", "BRIEF", "Saved on this device only", "offerSplit", "ownShop", "junkPlace", "localOnlyNote"]:
    assert k in app, k
sw = open("sw.js").read()
assert "sn-shell-4322" in sw and 'VER = "4322"' in sw
v = open("vercel.json").read()
assert "4322-grok" in v
print("verify ok")
