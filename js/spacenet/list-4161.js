(function(){
  if(window.__SN_LIST_4161) return;
  window.__SN_LIST_4161=true;
  var RHODES_PHONE="302241601878";
  function digPhone(p){ return String(p==null?"":p).replace(/\D/g,""); }
  function isPizzariumAnalipsi(shop){
    var n=String((shop&&(shop.name||shop.place))||"").toLowerCase();
    return /pizzarium/.test(n) && /analipsi|αναλυψ|ανάλυψ/.test(n);
  }
  function isRhodesBleed(phone, shop){
    var d=digPhone(phone);
    if(!d) return false;
    if(d===RHODES_PHONE || d.slice(-10)==="2241601878") return !isPizzariumAnalipsi(shop);
    if(/^302241/.test(d) && shop && isFinite(+shop.lat) && (+shop.lat < 20 || +shop.lat > 42 || +shop.lng < 19 || +shop.lng > 30)){
      return !isPizzariumAnalipsi(shop);
    }
    return false;
  }
  function scrubDishes(dishes){
    return (dishes||[]).map(function(it){
      if(!it||!(it.name||it.desc)) return null;
      var row={
        name:String(it.name||it.desc||"").trim(),
        price:Number(it.price)||0,
        hours:it.hours||"",
        stock:it.stock||20,
        stock0:it.stock0||it.stock||20,
        photo:it.photo||"",
        sample:false
      };
      return row.name?row:null;
    }).filter(Boolean);
  }
  function scrubFill(s, shopHint){
    if(!s||typeof s!=="object") return s;
    var shop=shopHint||{name:s.name,lat:s.lat,lng:s.lng,place:s.place};
    var out={};
    for(var k in s){ if(Object.prototype.hasOwnProperty.call(s,k)) out[k]=s[k]; }
    if(out.phone && isRhodesBleed(out.phone, shop)){
      try{ console.warn("[list-4161] dropped Rhodes phone bleed on", shop&&shop.name, out.phone); }catch(e){}
      delete out.phone;
    }
    var dishes=scrubDishes(out.dishes||out.items);
    out.dishes=dishes;
    out.items=dishes;
    delete out.sample;
    return out;
  }
  function scrubStoredShops(){
    try{
      var raw=localStorage.getItem("sn:shops");
      if(!raw) return;
      var list=JSON.parse(raw);
      if(!Array.isArray(list)) return;
      var changed=false;
      list.forEach(function(s){
        if(!s) return;
        if(s.phone && isRhodesBleed(s.phone, s)){ s.phone=""; changed=true; }
        if(s.dishes&&s.dishes.length){
          var next=scrubDishes(s.dishes);
          if(next.length!==s.dishes.length || s.dishes.some(function(d){ return d&&d.sample; })){
            s.dishes=next;
            s.menu=next.map(function(d){ return d.name+" — "+d.price; }).join("\n");
            changed=true;
          }
        }
      });
      if(changed) localStorage.setItem("sn:shops", JSON.stringify(list));
    }catch(e){}
  }
  function cleanListingPrompt(p){
    var name=String((p&&(p.name||p.place))||"shop").trim();
    var raw=String((p&&(p.raw||p.place))||"").trim();
    return "LISTING FILL act=listing for ONLY this shop: "+name+
      " at "+raw+" lat "+(p&&p.lat)+" lng "+(p&&p.lng)+
      ". Return official phone, hours, and published dishes/prices for THIS shop alone from public listings."+
      " Do NOT use Rhodes Pizzarium Analipsi, +302241601878, or any other shop's phone."+
      " Do NOT set sample=true. Include dishes with sample=false even if price is an estimate.";
  }
  function bindGrokListing(){
    if(!window.SN) return setTimeout(bindGrokListing, 40);
    SN.grokListing=function(p){
      if(!p) return;
      if(typeof SN.grok==="function") SN.grok(cleanListingPrompt(p));
    };
  }
  function bindApplyFill(){
    if(!window.SNWork||!SNWork.applyFill) return setTimeout(bindApplyFill, 40);
    if(SNWork.__list4161) return;
    SNWork.__list4161=true;
    var orig=SNWork.applyFill.bind(SNWork);
    SNWork.applyFill=function(s){
      var hint=s||{};
      try{
        var all=(SNWork.all&&SNWork.all().shops)||[];
        if(s&&s.name){
          for(var i=0;i<all.length;i++){
            if(all[i]&&String(all[i].name).toLowerCase()===String(s.name).toLowerCase()){ hint=all[i]; break; }
          }
        }else if(all[0]) hint=all[0];
      }catch(e){}
      return orig(scrubFill(s, hint));
    };
  }
  var ofetch=window.fetch;
  window.fetch=function(input, init){
    var url=typeof input==="string"?input:(input&&input.url)||"";
    var u=String(url);
    if(u.indexOf("/api/find")!==-1){
      try{
        var q="";
        if(init&&init.body){
          var b=typeof init.body==="string"?JSON.parse(init.body):init.body;
          q=String((b&&(b.q||b.query||b.prompt))||"");
        }else{
          try{ q=decodeURIComponent((u.split("q=")[1]||"").split("&")[0]||""); }catch(e){}
        }
        if(/\b(pizza|burger|coffee|food|pizzeria)\b/i.test(q)){
          return Promise.resolve(new Response(JSON.stringify({ok:false,error:"use_hunt",places:[]}),{status:200,headers:{"Content-Type":"application/json"}}));
        }
      }catch(e){}
    }
    var p=ofetch.apply(this, arguments);
    if(u.indexOf("/api/ai")===-1) return p;
    return p.then(function(res){
      var clone=res.clone();
      return clone.json().then(function(j){
        try{
          var a=String(j&&(j.act||j.action)||"").toLowerCase();
          if(a==="listing" || (j && (j.phone || j.dishes || j.items) && (j.name||a==="listing"))){
            var scrubbed=scrubFill(j, {name:j.name,lat:j.lat,lng:j.lng,place:j.place||j.raw});
            return new Response(JSON.stringify(scrubbed),{status:res.status,headers:{"Content-Type":"application/json"}});
          }
        }catch(e){}
        return res;
      }).catch(function(){ return res; });
    });
  };
  scrubStoredShops();
  bindGrokListing();
  bindApplyFill();
})();
