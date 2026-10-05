def rep(p, old, new, n=1):
    s = open(p, encoding="utf-8").read()
    assert s.count(old) == n, (p, old[:90], s.count(old))
    open(p, "w", encoding="utf-8").write(s.replace(old, new))

# moveDriver was still admin-only, so HERE "Move the driver here" for a driver role was a no-op
rep("js/spacenet/app.js", '''  function moveDriver(pt) {
    if (!isAdmin() || !pt) return;
    driverPin = { lat: pt.lat, lng: pt.lng, name: pt.name || (driverPin && driverPin.name) || "motorbike", photo: pt.photo || (driverPin && driverPin.photo) || "" };
''', '''  function moveDriver(pt) {
    if (!(isAdmin() || myRole() === "driver") || !pt) return;
    driverPin = { lat: pt.lat, lng: pt.lng, name: pt.name || (driverPin && driverPin.name) || "motorbike", photo: pt.photo || (driverPin && driverPin.photo) || "" };
''')
print("ok19")
