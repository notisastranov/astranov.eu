def rep(p, old, new):
    s = open(p, encoding='utf-8').read()
    assert s.count(old) == 1, (p, s.count(old))
    open(p, 'w', encoding='utf-8').write(s.replace(old, new))
rep('api/find.js',
    'G&&(f=athensQueries(r,i,l));',
    'G&&(f=athensQueries(r,i,l).concat(f).filter(function(e,t,n){return n.indexOf(e)===t}));')
print('ok')
