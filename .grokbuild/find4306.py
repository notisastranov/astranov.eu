import sys,re
p=sys.argv[1]; s=open(p,encoding='utf-8').read()
def rep(old,new,count=1):
    global s
    assert s.count(old)==count,(s.count(old),old[:80]); s=s.replace(old,new)
helpers = r'''function greekAthens(e){var t=String(e||"");return/\bathens\b|\bathina\b|\u03b1\u03b8\u03ae\u03bd|\u03b1\u03b8\u03b7\u03bd/i.test(t)&&!/georgia|ohio|texas|alabama|tennessee|\busa\b|u\.s\.|united states|america|\bga\b|\boh\b|\btx\b|\bal\b|\btn\b|\bny\b|new york|virginia|wisconsin|ontario|canada/i.test(t)}function athensQueries(e,t,n){var a=String(e||"").replace(/\b(greece|hellas|athens|athina)\b|\u03b5\u03bb\u03bb\u03ac\u03b4\u03b1|\u03b1\u03b8\u03ae\u03bd\u03b1/gi," ").replace(/\s+/g," ").trim()||String(e||""),r=n?["pizza Athina","pizzeria Athina","pizza \u0391\u03b8\u03ae\u03bd\u03b1",a+" "+t]:[a+" Athina",a+" \u0391\u03b8\u03ae\u03bd\u03b1",a+" "+t,a+" Athens"];return r.filter(function(e,t,n){return n.indexOf(e)===t})}var OVERPASS=["https://overpass.kumi.systems/api/interpreter","https://overpass-api.de/api/interpreter","https://lz4.overpass-api.de/api/interpreter"];async function opGrab(e,t){var n,a,r=Date.now();for(n=0;n<OVERPASS.length;n++){var i=24e3-(Date.now()-r);if(i<1500)break;a=await grab(OVERPASS[n]+"?data="+encodeURIComponent(e),n?Math.min(8e3,i):Math.min(t||14e3,i));try{if(Array.isArray(JSON.parse(a).elements))return a}catch(e){}}return""}async function overpassTag(e,t,n){var a={the:1,and:1,best:1,near:1,find:1,who:1,for:1,want:1,need:1,good:1,around:1,here:1,greece:1,hellas:1,athens:1,athina:1},r=tokens(n).filter(function(e){return!a[e]&&/^[a-z0-9\u0370-\u03ff]+$/.test(e)}).sort(function(e,t){return t.length-e.length})[0]||"";if(r.length<3)return[];var i="[out:json][timeout:12];("+["shop","amenity","craft","office","cuisine","name"].map(function(n){return"nwr(around:6000,"+e+","+t+')["name"]["'+n+'"~"'+r+'",i];'}).join("")+");out center tags 20;",o=await opGrab(i,12e3);try{return(JSON.parse(o).elements||[]).map(function(e){var t=e.center||e,n=e.tags||{},a=n.craft||n.shop||n.amenity||n.office||"place";return{name:n.name,lat:Number(t.lat),lng:Number(t.lon||t.lng),raw:[n["addr:street"],a,n.cuisine||"",n["addr:city"]||""].filter(Boolean).join(", "),phone:n.phone||n["contact:phone"]||"",kind:a}}).filter(function(e){return e.name&&isFinite(e.lat)})}catch(e){return[]}}async function nominatimBox(e,t){var n=(+t.lng-.1).toFixed(4)+","+(+t.lat+.1).toFixed(4)+","+(+t.lng+.1).toFixed(4)+","+(+t.lat-.1).toFixed(4),a=await grab("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=10&addressdetails=0&bounded=1&viewbox="+n+"&q="+encodeURIComponent(e),8e3);try{return(JSON.parse(a)||[]).map(function(e){return{name:e.name||String(e.display_name||"").split(",")[0],lat:Number(e.lat),lng:Number(e.lon),raw:(e.display_name||"")+" "+(e.type||""),phone:""}}).filter(function(e){return e.name&&isFinite(e.lat)&&isFinite(e.lng)})}catch(e){return[]}}'''
anchor='function kenyaCity(e){return/nairobi|mombasa|kisumu|kenya/i.test(String(e||""))}'
rep(anchor, anchor+helpers)
# nominatim extra params
rep('async function nominatim(e){var t=await grab("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=10&addressdetails=1&q="+encodeURIComponent(e),8e3);',
    'async function nominatim(e,x){var t=await grab("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=10&addressdetails=1&q="+encodeURIComponent(e)+(x||""),8e3);')
# geocodeCity: Greek Athens default unless a country hint says otherwise
rep('async function geocodeCity(e){if(!e)return null;var t,n,a,r=[];',
    r'async function geocodeCity(e,x){if(!e)return null;var t,n,a,r=[];if(greekAthens(e+" "+(x||""))){var G0=await nominatim("\u0391\u03b8\u03ae\u03bd\u03b1","&countrycodes=gr");if(G0.length)return{lat:G0[0].lat,lng:G0[0].lng,name:e,raw:G0[0].raw}}')
# overpass via mirrors (primary unchanged first)
for q,ms in [('n','14e3'),('r','14e3'),('t','12e3')]:
    rep('grab("https://overpass.kumi.systems/api/interpreter?data="+encodeURIComponent(%s),%s)'%(q,ms),'opGrab(%s,%s)'%(q,ms))
# handler
rep('m=mentionsRhodes(r+" "+i+" "+String(n.q||"")),p=null;i&&(p=await geocodeCity(i)),',
    'm=mentionsRhodes(r+" "+i+" "+String(n.q||"")),p=null,G=!!i&&greekAthens(i+" "+r+" "+String(n.q||""));i&&(p=await geocodeCity(i,r+" "+String(n.q||""))),')
rep('wantsGreece(r+" "+i)&&!/greece|hellas/i.test(r)&&f.push(r+" Greece");var h,d=[],g={};for(h=0;h<f.length&&d.length<8;h++)y(await nominatim(f[h]));',
    'wantsGreece(r+" "+i)&&!/greece|hellas/i.test(r)&&f.push(r+" Greece"),G&&(f=athensQueries(r,i,l));var h,d=[],g={};for(h=0;h<f.length&&d.length<8;h++)y(await nominatim(f[h],G?"&countrycodes=gr":""));')
rep('l&&m&&d.length<3&&y(await overpassPizzaBbox("36.05,27.70,36.50,28.35")),',
    'l&&m&&d.length<3&&y(await overpassPizzaBbox("36.05,27.70,36.50,28.35")),!l&&p&&(i?d.length<4:!d.length)&&y(await overpassTag(p.lat,p.lng,r)),p&&!d.length&&y(await nominatimBox(r,p)),')
# pure city ask returns the geocode; overpass budget 18s
rep('(p={lat:o,lng:s,name:i||"here"});var f=[];','(p={lat:o,lng:s,name:i||"here"});if(p&&i&&r.toLowerCase()===i.toLowerCase()&&isFinite(p.lat))return void t.status(200).json({ok:!0,places:[{name:i,lat:p.lat,lng:p.lng,raw:p.raw||""}],meta:{q:r,city:i,build:BUILD}});var f=[];')
rep('var i=24e3-(Date.now()-r);','var i=18e3-(Date.now()-r);')
open(p,'w',encoding='utf-8').write(s); print('ok')
