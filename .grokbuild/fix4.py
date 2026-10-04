def rep(p, old, new):
    s = open(p, encoding='utf-8').read()
    assert s.count(old) == 1, (p, s.count(old))
    open(p, 'w', encoding='utf-8').write(s.replace(old, new))
rep('api/find.js',
    'p&&!d.length&&y(await nominatimBox(r,p)),!l&&p&&(i?d.length<4:!d.length)&&y(await overpassTag(p.lat,p.lng,r)),',
    'i&&p&&!d.length&&y(await nominatimBox(r,p)),!l&&i&&p&&d.length<4&&y(await overpassTag(p.lat,p.lng,r)),')
print('ok')
