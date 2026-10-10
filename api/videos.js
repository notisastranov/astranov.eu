/** Globe videos from the SpaceNet channel. No cache. */
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  var places = [
    ["rhodes", 36.43, 28.22], ["greece", 37.98, 23.73], ["paris", 48.86, 2.35],
    ["london", 51.51, -0.13], ["rome", 41.9, 12.5], ["berlin", 52.52, 13.4],
    ["tokyo", 35.68, 139.69], ["kyiv", 50.45, 30.52], ["gaza", 31.5, 34.45]
  ];
  try {
    var r = await fetch("https://www.youtube.com/feeds/videos.xml?channel_id=UChqUTb7kYRX8-EiaN3XFrSQ", { headers: { "user-agent": "SpaceNet" } });
    if (!r.ok) { res.status(200).json({ cards: [] }); return; }
    var xml = await r.text();
    var cards = [];
    var re = /<entry>([\s\S]*?)<\/entry>/g;
    var m, i = 0;
    while ((m = re.exec(xml)) && cards.length < 3) {
      var block = m[1];
      var id = (block.match(/<yt:videoId>([^<]+)<\/yt:videoId>/) || [])[1];
      var title = (block.match(/<media:title>([^<]+)<\/media:title>/) || block.match(/<title>([^<]+)<\/title>/) || [])[1];
      if (!id || !title || !/^[\w-]{6,16}$/.test(id)) continue;
      var low = String(title).toLowerCase();
      var lat = 12 + i * 22, lng = -40 + i * 60;
      for (var p = 0; p < places.length; p++) {
        if (low.indexOf(places[p][0]) >= 0) { lat = places[p][1]; lng = places[p][2]; break; }
      }
      cards.push({ k: "VIDEO", t: title, v: id, lat: lat, lng: lng });
      i++;
    }
    res.status(200).json({ cards: cards });
  } catch (e) {
    res.status(200).json({ cards: [] });
  }
};
