from pathlib import Path
import re
p = Path("js/spacenet/app.js")
s = p.read_text(encoding="utf-8")
old = """      if (act === \"sheet-x\") {
        if (Date.now() < sheetArm) return;
        var shx = $(\"sn-sheet\");
        sheetHold = true;
        if (shx && shx.classList.contains(\"offer\")) {
          var dropId = dockFocus;
          try { if (dropId) sessionStorage.setItem(\"sn:offer-x:\" + dropId, \"1\"); } catch (e) {}
          dockTabs = dockTabs.filter(function (t) { return !(t && t.kind === \"offer\" && (!dropId || t.id === dropId)); });
          dockFocus = \"\";
          paintDockTabs();
        }
        closeSheet();
        sheetHold = true;
        return;
      }"""
new = """      if (act === \"sheet-x\") {
        if (Date.now() < sheetArm) return;
        var shx = $(\"sn-sheet\");
        sheetHold = true;
        if (shx && shx.classList.contains(\"offer\")) {
          var dropId = dockFocus;
          dockTabs.forEach(function (t) {
            if (t && t.kind === \"offer\" && t.id) {
              try { sessionStorage.setItem(\"sn:offer-x:\" + t.id, \"1\"); } catch (e) {}
            }
          });
          try { if (dropId) sessionStorage.setItem(\"sn:offer-x:\" + dropId, \"1\"); } catch (e) {}
          try {
            (jobs || []).forEach(function (j) {
              if (j && j.id) sessionStorage.setItem(\"sn:offer-x:offer-\" + j.id, \"1\");
            });
          } catch (e) {}
          dockTabs = dockTabs.filter(function (t) { return !(t && t.kind === \"offer\"); });
          dockFocus = \"\";
          paintDockTabs();
        }
        closeSheet();
        sheetHold = true;
        return;
      }"""
if "sn:offer-x:offer-\" + j.id" in s or 'sn:offer-x:offer-" + j.id' in s:
    print("offer-x persist already present")
else:
    if old not in s:
        raise SystemExit("exact old sheet-x block missing")
    s = s.replace(old, new, 1)
    if 'sn:offer-x:offer-" + j.id' not in s:
        raise SystemExit("patch did not land")
    print("ok patched sheet-x dismiss-all + jobs mute")
ver = re.search(r'var VER = "(\d+)"', s)
if not ver or ver.group(1) != "4326":
    raise SystemExit("stamp drifted: " + (ver.group(1) if ver else "?"))
if 'sessionStorage.getItem("sn:offer-x:" + id)' not in s:
    raise SystemExit("throwOffer dismiss guard missing")
p.write_text(s, encoding="utf-8")
print("VER 4326 lockstep ok")
