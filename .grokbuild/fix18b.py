# ---- (b) driver role: YOU's GPS counts; HERE offers Move the driver here (no auto-teleport)
def rep(p, old, new, n=1):
    s = open(p, encoding="utf-8").read()
    assert s.count(old) == n, (p, old[:90], s.count(old))
    open(p, "w", encoding="utf-8").write(s.replace(old, new))
A = "js/spacenet/app.js"
rep(A, r'''  function atShop(job) {
    if (isAdmin()) {
      if (nearPt(here, job.vendor) || nearPt(driverPin, job.vendor)) return true;
      say("Move yourself or the driver onto the vendor. Long-tap, then MOVE.");
      return false;
    }
    if (standAt(job.vendor)) return true;
    say("Your GPS is not at the vendor.");
    return false;
  }
  function atDrop(job) {
    if (isAdmin()) {
      if (nearPt(here, job.drop) || nearPt(driverPin, job.drop) || nearPt(homeDrop, job.drop)) return true;
      say("Move yourself, the driver, or the client onto the delivery. Long-tap, then MOVE.");
      return false;
    }
    if (standAt(job.drop)) return true;
    say("Your GPS is not at the delivery location.");
    return false;
  }''', r'''  function atShop(job) {
    if (myRole() === "driver" && (nearPt(hereLive, job.vendor) || nearPt(here, job.vendor) || nearPt(driverPin, job.vendor))) return true;
    if (isAdmin()) {
      if (nearPt(here, job.vendor) || nearPt(driverPin, job.vendor)) return true;
      say("Move yourself or the driver onto the vendor. Long-tap HERE for Move me / Move the driver, or MOVE.");
      return false;
    }
    if (standAt(job.vendor)) return true;
    say("Your GPS is not at the vendor.");
    return false;
  }
  function atDrop(job) {
    if (myRole() === "driver" && (nearPt(hereLive, job.drop) || nearPt(here, job.drop) || nearPt(driverPin, job.drop))) return true;
    if (isAdmin()) {
      if (nearPt(here, job.drop) || nearPt(driverPin, job.drop) || nearPt(homeDrop, job.drop)) return true;
      say("Move yourself, the driver, or the client onto the delivery. Long-tap, then MOVE.");
      return false;
    }
    if (standAt(job.drop)) return true;
    say("Your GPS is not at the delivery location.");
    return false;
  }''')
rep(A, r'''    if (isAdmin()) {
      html += '<button type="button" class="sheet-go" data-act="run-offer">Send the offer · closest free driver</button>' +
        '<button type="button" class="sheet-go" data-act="admin-gps">Move me here</button>';
    }
    openSheet("HERE", html, true);''', r'''    if (isAdmin()) {
      html += '<button type="button" class="sheet-go" data-act="run-offer">Send the offer · closest free driver</button>' +
        '<button type="button" class="sheet-go" data-act="admin-gps">Move me here</button>';
    }
    if ((isAdmin() || myRole() === "driver") && driverPin && isFinite(+driverPin.lat)) {
      html += '<button type="button" class="sheet-go" data-act="move-driver">Move the driver here</button>';
    }
    openSheet("HERE", html, true);''')
rep(A, r'''      if (act === "move-driver") {
        if (!listPt) { say("Long-tap the new spot first."); return; }
        moveDriver(listPt);
      }''', r'''      if (act === "move-driver") {
        if (!(isAdmin() || myRole() === "driver")) { say("Only the driver moves their own pin."); return; }
        if (!listPt) { say("Long-tap the new spot first."); return; }
        moveDriver(listPt);
        say("Driver pin is on this long tap. GPS still has to match for a real pickup.");
      }''')
print("ok18b")
