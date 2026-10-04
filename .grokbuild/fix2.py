def rep(p, old, new):
    s = open(p, encoding='utf-8').read()
    assert s.count(old) == 1, (p, s.count(old))
    open(p, 'w', encoding='utf-8').write(s.replace(old, new))
rep('api/find.js',
    '!l&&p&&(i?d.length<4:!d.length)&&y(await overpassTag(p.lat,p.lng,r)),p&&!d.length&&y(await nominatimBox(r,p)),',
    'p&&!d.length&&y(await nominatimBox(r,p)),!l&&p&&(i?d.length<4:!d.length)&&y(await overpassTag(p.lat,p.lng,r)),')
rep('js/spacenet/app.js',
    '''    var urls = ["https://overpass-api.de/api/interpreter"].concat(OVERPASS_MIRRORS);
    function next(i) {
      if (i >= urls.length) return Promise.resolve(null);
      return fetchJson(urls[i], { method: "POST", body: data }, i ? 8000 : 13000).then(function (j) {''',
    '''    var urls = ["https://overpass-api.de/api/interpreter"].concat(OVERPASS_MIRRORS), t0 = Date.now();
    function next(i) {
      var left = 15000 - (Date.now() - t0);
      if (i >= urls.length || (i && left < 1500)) return Promise.resolve(null);
      return fetchJson(urls[i], { method: "POST", body: data }, i ? Math.min(8000, left) : 13000).then(function (j) {''')
print('ok')
