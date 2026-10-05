import re, subprocess
p = "js/spacenet/app.js"
s = open(p, encoding="utf-8").read()
END = r">>>>>>> [^\n]+\n"

def take(body_head, body_main, out, label):
    global s
    pat = r"<<<<<<< HEAD\n" + re.escape(body_head) + r"=======\n" + re.escape(body_main) + END
    s2, n = re.subn(pat, out, s, count=1)
    assert n == 1, (label, n)
    s = s2

take('  var VER = "4314";\n', '  var VER = "4322";\n', '  var VER = "4322";\n', "ver")

take('''  var hereHow = "";
  var userSpoke = false;
  var lastCat = "";
  function hereLabel() {
    if (!here) return "Location unknown";
    if (hereHow === "gps") return "GPS " + here.lat.toFixed(4) + "," + here.lng.toFixed(4);
    if (hereHow === "admin") return "Admin pin " + here.lat.toFixed(4) + "," + here.lng.toFixed(4);
    if (hereHow === "saved") return "Saved location " + here.lat.toFixed(4) + "," + here.lng.toFixed(4);
    return "Approx. location (IP) " + here.lat.toFixed(2) + "," + here.lng.toFixed(2);
  }
  function land(pt, open, keepView, hush) {
    if (!keepView) intro = false;
''', '''  function land(pt, open) {
    seated = true;
    intro = false;
''', '''  var hereHow = "";
  var userSpoke = false;
  var lastCat = "";
  function hereLabel() {
    if (!here) return "Location unknown";
    if (hereHow === "gps") return "GPS " + here.lat.toFixed(4) + "," + here.lng.toFixed(4);
    if (hereHow === "admin") return "Admin pin " + here.lat.toFixed(4) + "," + here.lng.toFixed(4);
    if (hereHow === "saved") return "Saved location " + here.lat.toFixed(4) + "," + here.lng.toFixed(4);
    return "Approx. location (IP) " + here.lat.toFixed(2) + "," + here.lng.toFixed(2);
  }
  function land(pt, open, keepView, hush) {
    seated = true;
    if (!keepView) intro = false;
''', "land")

take('''    var peopleN = people.length;
    people = dedupePeople(people);
    if (people.length !== peopleN) savePeople();
    dedupeMine();
    paintJobsChip();
    try {
      var savedHere = JSON.parse(localStorage.getItem("sn:here") || "null");
      if (savedHere && isFinite(+savedHere.lat) && isFinite(+savedHere.lng)) land({ lat: +savedHere.lat, lng: +savedHere.lng, how: "saved" }, false);
    } catch (e) {}
    locate(function (pt) { land(pt, false, placeSeq > 0 || viewMoved, userSpoke); }, true);
''', '''    locate(function (pt) {
      if (seated || !pt) return;
      here = { lat: pt.lat, lng: pt.lng };
      window.__SN_HERE = here;
      try { localStorage.setItem("sn:here", JSON.stringify(here)); } catch (e) {}
    }, true);
    fetch("/agenda.json", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (j) {
      if (j && j.cards && j.cards.length) BRIEF = j.cards;
    }).catch(function () {});
''', '''    var peopleN = people.length;
    people = dedupePeople(people);
    if (people.length !== peopleN) savePeople();
    dedupeMine();
    paintJobsChip();
    try {
      var savedHere = JSON.parse(localStorage.getItem("sn:here") || "null");
      if (savedHere && isFinite(+savedHere.lat) && isFinite(+savedHere.lng)) land({ lat: +savedHere.lat, lng: +savedHere.lng, how: "saved" }, false);
    } catch (e) {}
    locate(function (pt) { land(pt, false, placeSeq > 0 || viewMoved, userSpoke); }, true);
    fetch("/agenda.json", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (j) {
      if (j && j.cards && j.cards.length) BRIEF = j.cards;
    }).catch(function () {});
''', "boot")

assert "<<<<<<<" not in s and ">>>>>>>" not in s
open(p, "w", encoding="utf-8").write(s)
for f in ["VERSION", "api/version.js", "index.html", "vercel.json"]:
    subprocess.check_call(["git", "checkout", "--theirs", "--", f])
print("resolved")
