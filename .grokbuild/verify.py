assert open("VERSION").read().strip() == "4324"
assert open("api/version.js").read().count('latest: "4324"') == 1
idx = open("index.html").read()
for x in ['astranov-build" content="4324"', ">V4324<", "app.js?v=4324", "auth.js?v=4324", "guardian.js?v=4324", "leaflet.js?v=4324", "leaflet.css?v=4324"]:
    assert x in idx, x
assert "id=\"sn-row\"" in idx or 'id="sn-row"' in idx or "sn-row" in idx
app = open("js/spacenet/app.js").read()
assert app.count('var VER = "4324";') == 1
assert "<<<<<<<" not in app and ">>>>>>>" not in app
for k in ["isTestJob", "vendorPresent", "dismiss-job", "orderBit", "Move the driver here", "paintJobsChip", "cardsNow", "seated", "BRIEF", "Saved on this device only", "offerSplit", "ownShop", "junkPlace", "localOnlyNote", "armPinch", "openRouteTile", "#sn-row{", "myRole() === \"driver\""]:
    assert k in app, k
assert "if (!(isAdmin() || myRole() === \"driver\") || !pt) return;" in app
sw = open("sw.js").read()
assert "sn-shell-4324" in sw and 'VER = "4324"' in sw
v = open("vercel.json").read()
assert "4324-grok" in v
print("verify ok")
