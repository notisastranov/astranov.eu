assert open("VERSION").read().strip() == "4323"
app = open("js/spacenet/app.js").read()
assert 'if (!(isAdmin() || myRole() === "driver") || !pt) return;' in app
assert app.count('function moveDriver(pt)') == 1
assert 'var VER = "4323";' in app
print("verify ok")
