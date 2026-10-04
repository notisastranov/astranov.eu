import re, subprocess
p = 'js/spacenet/app.js'
s = open(p, encoding='utf-8').read()
def blk(ours, theirs, out):
    global s
    pat = re.compile(r'<<<<<<< [^\n]*\n' + re.escape(ours) + r'=======\n' + re.escape(theirs) + r'>>>>>>> [^\n]*\n')
    s, n = pat.subn(lambda m: out, s)
    assert n == 1, (ours[:50], n)
blk('  var VER = "4314";\n', '  var VER = "4313";\n', '  var VER = "4313";\n')
blk('    s.menu = menuList(s.menu);\n    s.phone = realPhone(s.phone);\n', '    if (!s) return;\n',
    '    if (!s) return;\n    s.menu = menuList(s.menu);\n    s.phone = realPhone(s.phone);\n')
theirs = '''      if (act === "vendor" && isFinite(i) && shops[i]) openVendor(shops[i]);
      if (act === "order-here") {
        if (!vendor || !isFinite(+vendor.lat)) { say("Tap the vendor again."); return; }
        var dest = (homeDrop && isFinite(+homeDrop.lat)) ? homeDrop : (here && isFinite(+here.lat) ? here : null);
        if (!dest) { say("List a delivery address, or tap GPS, then start the order."); return; }
        drop = { lat: +dest.lat, lng: +dest.lng, name: dest.name || "client", address: dest.address || "", phone: dest.phone || "" };
        showQuote();
        return;
      }
'''
ours = '      if (act === "vendor" && isFinite(i) && (foundView[i] || shops[i])) openVendor(foundView[i] || shops[i]);\n'
blk(ours, theirs, ours + theirs.split('\n', 1)[1])
assert '<<<<<<<' not in s and '>>>>>>>' not in s and '\n=======\n' not in s
open(p, 'w', encoding='utf-8').write(s)
for f in ['VERSION', 'api/version.js', 'index.html', 'vercel.json']:
    subprocess.check_call(['git', 'checkout', '--theirs', f])
print('resolved')
