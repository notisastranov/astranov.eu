def rep(p, old, new):
    s = open(p, encoding='utf-8').read()
    assert s.count(old) == 1, (p, s.count(old))
    open(p, 'w', encoding='utf-8').write(s.replace(old, new))
rep('js/spacenet/app.js',
    '          say("GPS " + here.lat.toFixed(4) + "," + here.lng.toFixed(4) + " · " + shops.length + " places around you. Talk a hunt or tap a pin.");',
    '          if (!placeSeq) say("GPS " + here.lat.toFixed(4) + "," + here.lng.toFixed(4) + " · " + shops.length + " places around you. Talk a hunt or tap a pin.");')
print('ok')
