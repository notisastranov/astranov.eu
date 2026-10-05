def rep(p, old, new, n=1):
    s = open(p, encoding="utf-8").read()
    assert s.count(old) == n, (p, old[:90], s.count(old))
    open(p, "w", encoding="utf-8").write(s.replace(old, new))
A = "js/spacenet/app.js"

# ---- (d) orphaned local orders whose vendor is gone: honest label + local dismiss
rep(A, r'''      else list.innerHTML = jobs.map(function (j) {
        var admin = isAdmin();
        var role = myRole();
        var flags = [
          j.ready ? "READY" : "ORDER",
          j.pickup ? "PICKUP VERIFIED" : "",
          j.got ? "ON THE BIKE" : "",
          j.delivered ? "DELIVERED" : "",
          j.received ? "RECEIVED" : ""
        ].filter(Boolean).join(" · ");
        var html = '<div class="pill" style="display:block"><b>' + String(j.vendor && j.vendor.name || "job").replace(/</g, "") + "</b><span>" + flags + " · " + (offerSplit(j) ? offerSplit(j).text : j.fee + " AV€") + " · " + (j.km || 0).toFixed(1) + " km · " + (j.driver || "driver") + "</span>";
        function go(act, label) { return '<button type="button" class="sheet-go" data-act="' + act + '" data-id="' + j.id + '">' + label + "</button>"; }
        if (!j.ready && (admin || role === "vendor")) html += go("mark-ready", admin ? "MARK READY · VENDOR" : "MARK READY");
        if (j.ready && !j.pickup && (admin || role === "vendor")) html += go("verify-pickup", admin ? "VERIFY PICKUP · VENDOR" : "VERIFY PICKUP");
        if (j.ready && !j.got && (admin || role === "driver")) html += go("driver-got", admin ? "I PICKED UP · DRIVER" : "I PICKED UP");
        if (j.got && !j.delivered && (admin || role === "driver")) html += go("driver-delivered", admin ? "DELIVERED · DRIVER" : "DELIVERED");
        if (j.delivered && !j.received && (admin || role === "client")) html += go("client-got", admin ? "RECEIVED · CLIENT" : "I RECEIVED");
        if (j.received) html += go("review", "REVIEW");
        return html + "</div>";
      }).join("");''', r'''      else list.innerHTML = jobs.map(function (j) {
        var admin = isAdmin();
        var role = myRole();
        var gone = !j.received && !vendorPresent(j);
        if (gone) j.vendorGone = true;
        var flags = [
          gone ? "VENDOR GONE" : "",
          j.ready ? "READY" : "ORDER",
          j.pickup ? "PICKUP VERIFIED" : "",
          j.got ? "ON THE BIKE" : "",
          j.delivered ? "DELIVERED" : "",
          j.received ? "RECEIVED" : "",
          j.cancelled ? "CANCELLED" : "",
          isTestJob(j) ? "TEST · this device" : (j.live ? "live" : "this device")
        ].filter(Boolean).join(" · ");
        var html = '<div class="pill" style="display:block"><b>' + String(j.vendor && j.vendor.name || "job").replace(/</g, "") + "</b><span>" + flags + " · " + (offerSplit(j) ? offerSplit(j).text : j.fee + " AV€") + " · " + (j.km || 0).toFixed(1) + " km · " + (j.driver || "driver") + "</span>";
        function go(act, label) { return '<button type="button" class="sheet-go" data-act="' + act + '" data-id="' + j.id + '">' + label + "</button>"; }
        if (gone || j.cancelled) {
          html += go("dismiss-job", "DISMISS · this device");
          return html + "</div>";
        }
        if (!j.ready && (admin || role === "vendor")) html += go("mark-ready", admin ? "MARK READY · VENDOR" : "MARK READY");
        if (j.ready && !j.pickup && (admin || role === "vendor")) html += go("verify-pickup", admin ? "VERIFY PICKUP · VENDOR" : "VERIFY PICKUP");
        if (j.ready && !j.got && (admin || role === "driver")) html += go("driver-got", admin ? "I PICKED UP · DRIVER" : "I PICKED UP");
        if (j.got && !j.delivered && (admin || role === "driver")) html += go("driver-delivered", admin ? "DELIVERED · DRIVER" : "DELIVERED");
        if (j.delivered && !j.received && (admin || role === "client")) html += go("client-got", admin ? "RECEIVED · CLIENT" : "I RECEIVED");
        if (j.received) html += go("review", "REVIEW");
        return html + "</div>";
      }).join("");''')
rep(A, r'''      if (act === "verify-pickup") verifyPickup(id);''', r'''      if (act === "verify-pickup") verifyPickup(id);
      if (act === "dismiss-job") {
        var dj = jobBy(id);
        if (!dj) return;
        dj.received = true;
        dj.cancelled = true;
        dj.vendorGone = true;
        saveJobs();
        openJobs();
        paintPulse();
        say("Cleared on this device only. No vendor was invented.");
      }''')
print("ok18c")
