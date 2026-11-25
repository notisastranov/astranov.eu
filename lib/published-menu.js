const https = require('node:https');
const dns = require('node:dns/promises');
const net = require('node:net');

async function readPage(url) {
  if (url.protocol !== 'https:' || url.username || url.password || url.port || net.isIP(url.hostname)) return '';
  const ips = await dns.resolve4(url.hostname);
  const ip = ips[0];
  if (!ip || /^(0|10|127|169|172\.(1[6-9]|2\d|3[01])|192|198|203\.0\.113|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])|22[4-9]|23\d|24\d|25\d)\./.test(ip)) return '';
  return new Promise(resolve => {
    const req = https.get(url,{family:4,lookup:(_host,_opts,cb)=>cb(null,ip,4),
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
function menuItems(html,source) {
  const items=new Map();
  function visit(value) {
    if (!value || typeof value!=='object') return;
    if ([].concat(value['@type']).includes('MenuItem') && typeof value.name==='string') {
      const offer=[].concat(value.offers || []).find(o=>o && o.priceCurrency==='EUR' && Number(o.price)>0);
      if(offer) items.set(value.name,{name:value.name.slice(0,80),price:Number(offer.price),note:String(value.description || '').slice(0,300),source});
    }
    Object.values(value).forEach(visit);
  }
  for(const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
    try{visit(JSON.parse(match[1]));}catch{}
  }
  return Array.from(items.values()).slice(0,100);
}
module.exports = async function publishedMenu(website) {
  try {
    const url=new URL(website);
    const html=await readPage(url);
    const items=menuItems(html,url.href);
    if(items.length) return items;
    for(const link of html.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)){
      if(!/menu|μενού/i.test(link[1])) continue;
      const menu=new URL(link[1],url);
      if(menu.origin===url.origin && menu.pathname!==url.pathname) return menuItems(await readPage(menu),menu.href);
    }
  }catch{}
  return [];
};
