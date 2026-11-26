const https = require('node:https');
const dns = require('node:dns/promises');
const net = require('node:net');

async function readPage(url) {
  if (url.protocol !== 'https:' || url.username || url.password || url.port || net.isIP(url.hostname)) return '';
  const ips = await dns.resolve4(url.hostname);
  const ip = ips[0];
  if (!ip || /^(0|10|127|169|172\.(1[6-9]|2\d|3[01])|192|198|203\.0\.113|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])|22[4-9]|23\d|24\d|25\d)\./.test(ip)) return '';
  return new Promise(resolve => {
    const req = https.get(url,{family:4,lookup:(_host,opts,cb)=>opts.all?cb(null,[{address:ip,family:4}]):cb(null,ip,4),
      signal:AbortSignal.timeout(4000),headers:{'User-Agent':'AstranovSpaceNet/1.0 menu discovery'}},res=>{
      if (res.statusCode!==200 || !String(res.headers['content-type']).includes('text/html')) {res.destroy();resolve('');return;}
      let size=0;const chunks=[];
      res.on('data',chunk=>{size+=chunk.length;if(size>1000000){res.destroy();resolve('');}else chunks.push(chunk);});
      res.on('end',()=>resolve(Buffer.concat(chunks).toString()));
      res.on('error',()=>resolve(''));
    });
    req.on('error',()=>resolve(''));
  });
}
function safeUrl(value,base) {
  try {
    const url=new URL(value,base);
    if(value && url.protocol==='https:' && !url.username && !url.password) return url.href;
  } catch {}
  return '';
}
function image(value,base) {
  const img=Array.isArray(value)?value[0]:value;
  return safeUrl(typeof img==='string'?img:img?.url || img?.contentUrl,base);
}
function extract(html,source) {
  const items=new Map(),links=new Set();
  let logo='',cover='',messaging='',email='',phone='';
  function visit(value) {
    if(!value || typeof value!=='object') return;
    const types=[].concat(value['@type'] || []);
    if(types.some(t=>['Restaurant','CafeOrCoffeeShop','Store','Organization','LocalBusiness','Bakery','FoodEstablishment'].includes(t))){
      logo ||= image(value.logo,source);
      if(typeof value.telephone==='string') phone ||= value.telephone;
      if(typeof value.email==='string') email ||= value.email.replace(/^mailto:/i,'');
      cover ||= image(value.image,source);
      const menu=safeUrl(value.hasMenu?.url || (typeof value.hasMenu==='string' && value.hasMenu),source);
      if(menu) links.add(menu);
    }
    if(types.some(t=>['MenuItem','Product'].includes(t)) && typeof value.name==='string'){
      for(const offer of [].concat(value.offers || [])){
        const price=Number(offer?.price ?? offer?.priceSpecification?.price);
        if((offer?.priceCurrency || offer?.priceSpecification?.priceCurrency)!=='EUR' || !Number.isFinite(price) || price<=0) continue;
        items.set(value.name,{name:value.name.slice(0,80),price,note:String(offer.description || value.description || '').slice(0,300),photo:image(value.image,source),stock:/OutOfStock|SoldOut/.test(offer.availability || '')?'out':'in',source});
        break;
      }
    }
    Object.values(value).forEach(visit);
  }
  for(const m of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { visit(JSON.parse(m[1])); } catch {}
  }
  // Some menus publish prices and photos in product cards without JSON-LD.
  for(const match of html.matchAll(/<(article|li)\b[^>]*>([\s\S]*?)<\/\1>/gi)){
    const card=match[2];
    const clean=text=>text.replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
    const name=clean(card.match(/<h[2-6]\b[^>]*>([\s\S]*?)<\/h[2-6]>/i)?.[1] || '');
    const prices=Array.from(clean(card).matchAll(/(?:€\s*(\d+(?:[.,]\d{1,2})?)|(\d+(?:[.,]\d{1,2})?)\s*(?:€|EUR\b))/gi));
    if (!name || prices.length!==1 || items.has(name)) continue;
    const price=Number((prices[0][1] || prices[0][2]).replace(',','.'));
    if(price>0) items.set(name,{name:name.slice(0,80),price,photo:image(card.match(/<img\b[^>]*?\s(?:data-src|src)=["']([^"']+)/i)?.[1],source),
      note:clean(card.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1] || '').slice(0,300),source});
  }
  for(const m of html.matchAll(/<(meta|link|img|a)\b[^>]*>/gi)){
    const attrs=Object.fromEntries(Array.from(m[0].matchAll(/\s([\w:-]+)\s*=\s*(["'])(.*?)\2/gs),a=>[a[1].toLowerCase(),a[3].replace(/&amp;/g,'&')]));
    if(attrs.property==='og:image') cover ||= image(attrs.content,source);
    if(/\blogo\b/i.test(attrs.alt || attrs.class || '')) logo ||= image(attrs.src,source);
    if(/^(apple-touch-icon|icon|shortcut icon)$/i.test(attrs.rel || '')) logo ||= image(attrs.href,source);
    if(/^mailto:/i.test(attrs.href || '')) email ||= attrs.href.slice(7).split('?')[0];
    const href=safeUrl(attrs.href,source);
    if(!href) continue;
    const url=new URL(href);
    if(['wa.me','api.whatsapp.com','m.me','t.me'].includes(url.hostname)) messaging ||= href;
    if(/menu|shop|catalog|offers|contact|products|μενού/i.test(url.pathname)) links.add(href);
  }
  return {items:[...items.values()].slice(0,100),logo,cover,messaging,links:[...links],email,phone:phone || html.match(/href=["']tel:([+0-9 ().-]{5,40})["']/i)?.[1] || ''};
}
const cache=new Map();
module.exports=async function publishedMenu(website){
  const previous=cache.get(website);
  if(previous?.until>Date.now()) return previous.result;
  const result=(async()=>{
    try {
      const url=new URL(website);
      const home=extract(await readPage(url),url.href);
      const links=home.links.map(link=>new URL(link)).filter(link=>link.origin===url.origin && link.pathname!==url.pathname).slice(0,3);
      const pages=await Promise.all(links.map(async link=>extract(await readPage(link).catch(()=>''),link.href)));
      const items=new Map();
      for(const page of [home,...pages]) for(const item of page.items) items.set(item.name,item);
      const result={...home,items:[...items.values()].slice(0,100)};
      for(const page of pages) for(const key of ['logo','cover','email','phone','messaging']) result[key] ||= page[key];
      return result;
    } catch {return {items:[]};}
  })();
  if(cache.size>=256) cache.delete(cache.keys().next().value);
  cache.set(website,{until:Date.now()+3600000,result});
  return result;
};
module.exports.extract=extract;
