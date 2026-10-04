def rep(p, old, new, n=1):
    s = open(p, encoding='utf-8').read()
    assert s.count(old) == n, (p, old[:80], s.count(old))
    open(p, 'w', encoding='utf-8').write(s.replace(old, new))
A = 'js/spacenet/app.js'
# ---- the IP fallback runs once per locate: the denied-GPS path and the 14 s timer both called it, so the boot landed twice and re-said its line
rep(A, r'''    var gotGps = false;
    function gps(pos) {''', r'''    var gotGps = false, coarseRan = false;
    function gps(pos) {''')
rep(A, r'''    function coarse() {
      if (gotGps) return;''', r'''    function coarse() {
      if (gotGps || coarseRan) return;
      coarseRan = true;''')
print('ok15')
