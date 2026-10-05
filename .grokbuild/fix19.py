def rep(p, old, new, n=1):
    s = open(p, encoding="utf-8").read()
    c = s.count(old)
    if c == 0:
        print("skip", p, old[:60].replace("\n", " "))
        return
    assert c == n, (p, old[:90], c)
    open(p, "w", encoding="utf-8").write(s.replace(old, new))

# (b) moveDriver must allow signed-in driver role (HERE Move the driver was a no-op)
rep("js/spacenet/app.js", ''' function moveDriver(pt) {
 if (!isAdmin() || !pt) return;
 driverPin = { lat: pt.lat, lng: pt.lng, name: pt.name || (driverPin && driverPin.name) || "motorbike", photo: pt.photo || (driverPin && driverPin.photo) || "" };
''', ''' function moveDriver(pt) {
 if (!(isAdmin() || myRole() === "driver") || !pt) return;
 driverPin = { lat: pt.lat, lng: pt.lng, name: pt.name || (driverPin && driverPin.name) || "motorbike", photo: pt.photo || (driverPin && driverPin.photo) || "" };
''')
print("ok19")
