assert open("VERSION").read().strip() == "4323"
assert open("api/version.js").read().count('latest: "4323"') == 1
idx = open("index.html").read()
for x in ['astranov-build" content="4323"', ">V4323<", "app.js?v=4323", "auth.js?v=4323", "guardian.js?v=4323", "leaflet.js?v=4323", "leaflet.css?v=4323"]:
    assert x in idx, x
app = open("js/spacenet/app.js").read()
assert app.count('var VER = "4323";') == 1
assert "<<<<<<<" not in app and ">>>>>>>" not in app
for k in ["isTestJob", "vendorPresent", "dismiss-job", "orderBit", "Move the driver here", "paintJobsChip", "cardsNow", "seated", "BRIEF", "Saved on this device only", "offerSplit", "ownShop", "junkPlace", "localOnlyNote", "armPinch", "openRouteTile"]:
    assert k in app, k
sw = open("sw.js").read()
assert "sn-shell-4323" in sw and 'VER = "4323"' in sw
v = open("vercel.json").read()
assert "4323-grok" in v
print("verify ok")
