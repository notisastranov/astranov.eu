def rep(p, old, new, n=1):
    s = open(p, encoding='utf-8').read()
    assert s.count(old) == n, (p, old[:80], s.count(old))
    open(p, 'w', encoding='utf-8').write(s.replace(old, new))
A = 'js/spacenet/app.js'
# ---- the JOBS chip sits under the Power button (10,69 48x48), never on top of it
rep(A, '''chip.style.cssText = "position:fixed;top:68px;left:8px;z-index:91;''', '''chip.style.cssText = "position:fixed;top:124px;left:10px;z-index:91;''')
print('ok17')
