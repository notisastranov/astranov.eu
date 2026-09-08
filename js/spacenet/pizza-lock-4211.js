/* SpaceNet 4211 — Nairobi pizza hunt lock; kill vendor-picker Rhodes bleed */
(function(){
  if(window.__SN_PIZZA_4211) return;
  window.__SN_PIZZA_4211=true;

  var BRAND=/\b(pizza\s*inn|domino'?s?|papa\s*john'?s?|pizza\s*hut|little\s*caesars?|sbarro|california\s*pizza|pepino'?s?)\b/i;
  var FOOD=/\b(pizza|pizzeria|πιτσ|burger|coffee|cafe|gyro|souvlaki|kebab|sushi|beer|pharm|pharmacy|ice\s*cream|restaurant|food|φαγη)\b/i;

  function isFoodOrBrand(t){
    t=String(t||"");
    return FOOD.test(t) || BRAND.test(t);
  }
  function lastPlace(){
    try{
      var sp=JSON.parse(localStorage.getItem("sn:place")||"null");
      if(sp && isFinite(+sp.lat) && isFinite(+sp.lng)){
        return {lat:+sp.lat,lng:+sp.lng,name:String(sp.name||sp.place||"here")};
      }
    }catch(e){}
    return null;
  }
  function isRhodesPin(v){
    if(!v||!isFinite(+v.lat)||!isFinite(+v.lng)) return false;
    var lat=+v.lat, lng=+v.lng;
    return lat>35.7 && lat<37.2 && lng>27.3 && lng<28.9;
  }
  function placeIsRhodes(p){
    if(!p) return false;
    if(/rhodes|ρόδος|rodos|analipsi|ανάληψ/i.test(String(p.name||""))) return true;
    return isRhodesPin(p);
  }
  function isNairobi(p){
    if(!p) return false;
    if(/nairobi/i.test(String(p.name||""))) return true;
    var lat=+p.lat, lng=+p.lng;
    return lat>-1.45 && lat<-1.15 && lng>36.65 && lng<37.05;
  }

  var NAIROBI_PIZZA=[
    {id:"seed-pi-lusaka",name:"Pizza Inn Lusaka Road",lat:-1.3162,lng:36.8219,raw:"Lusaka Road, Nairobi"},
    {id:"seed-pi-waiyaki",name:"Pizza Inn Waiyaki Way",lat:-1.2631,lng:36.8045,raw:"Waiyaki Way, Nairobi"},
    {id:"seed-dom-west",name:"Domino's Westlands",lat:-1.2676,lng:36.8110,raw:"Westlands, Nairobi"}
  ];

  function paintSeed(place, q){
    if(!window.SN || !place || placeIsRhodes(place)) return false;
    if(!isNairobi(place) && !/nairobi/i.test(String(place.name||""))){
      /* still seed when landed city is non-Rhodes and coords look East Africa-ish */
      var lat=+place.lat, lng=+place.lng;
      if(!(lat>-5 && lat<5 && lng>30 && lng<42)) return false;
    }
    var list=NAIROBI_PIZZA.map(function(v){
      return {id:v.id,name:v.name,lat:v.lat,lng:v.lng,raw:v.raw,tags:{},grok:false,kind:"shop",sn:true};
    });
    window.__SN_LAST_HUNT={q:q||"pizza",from:place,list:list.slice(),at:Date.now()};
    try{ SN.lastHunt=window.__SN_LAST_HUNT; }catch(e){}
    try{ if(SN.showCity) SN.showCity(place); }catch(e){}
    try{ if(SN.showMap) SN.showMap(list[0], 14); }catch(e){}
    try{ if(SN.selectVendor) SN.selectVendor(list[0]); }catch(e){}
    try{
      if(SN.talk) SN.talk((list[0].name)+" + "+(list.length-1)+" more near Nairobi. Pins on the map.");
    }catch(e){}
    return true;
  }

  function foodHunt(raw, placeName, place){
    place=place||lastPlace();
    if(!place){
      if(window.SN&&SN.talk) SN.talk("Land a city first, or say pizza near Nairobi.");
      return;
    }
    if(typeof SN.foodHunt==="function"){
      try{ return SN.foodHunt(raw, placeName||place.name, place); }catch(e){}
    }
    if(typeof window.__SN_FOOD_HUNT==="function"){
      try{ return window.__SN_FOOD_HUNT(raw, placeName||place.name, place); }catch(e){}
    }
    /* land-4162 keeps foodHunt private — drive its wrap when present */
    if(window.__SN_LAND_4162 && typeof foodHunt._origRun==="function"){
      var q=String(raw||"pizza");
      if(!FOOD.test(q)) q="pizza "+q;
      if(place.name && q.toLowerCase().indexOf(String(place.name).toLowerCase())===-1){
        q=q+" near "+place.name;
      }
      try{ return foodHunt._origRun.call(SN, q); }catch(e){}
    }
    paintSeed(place, String(raw||"pizza"));
  }

  function wrapTalk(){
    if(!window.SN||typeof SN.talk!=="function") return setTimeout(wrapTalk, 40);
    if(SN.__pizza4211Talk) return;
    SN.__pizza4211Talk=true;
    var ot=SN.talk.bind(SN);
    SN.talk=function(msg){
      var s=String(msg==null?"":msg);
      if(/Pick:\s*my location,\s*vendor/i.test(s)){
        var place=lastPlace();
        if(place && !placeIsRhodes(place)){
          foodHunt("pizza", place.name, place);
          return;
        }
      }
      return ot(msg);
    };
  }

  function wrapRun(){
    if(!window.SN||typeof SN.run!=="function") return setTimeout(wrapRun, 40);
    if(SN.__pizza4211Run) return;
    SN.__pizza4211Run=true;
    var orig=SN.run.bind(SN);
    foodHunt._origRun=orig;
    SN.run=function(t){
      t=String(t||"").trim();
      if(isFoodOrBrand(t)){
        var place=lastPlace();
        if(place){
          foodHunt(t, place.name, place);
          return;
        }
      }
      return orig(t);
    };
  }

  function scrubPlaces(j, place){
    if(!j||!place||placeIsRhodes(place)) return j;
    function drop(arr){
      if(!Array.isArray(arr)) return arr;
      return arr.filter(function(x){
        if(!x) return false;
        if(isFinite(+x.lat)&&isFinite(+x.lng)&&isRhodesPin(x)) return false;
        return true;
      });
    }
    var changed=false;
    var out=j;
    if(Array.isArray(j.places)){
      var kp=drop(j.places);
      if(kp.length!==j.places.length){ out=Object.assign({}, out, {places:kp}); changed=true; }
    }
    if(Array.isArray(j.vendors)){
      var kv=drop(j.vendors);
      if(kv.length!==j.vendors.length){ out=Object.assign({}, out, {vendors:kv}); changed=true; }
    }
    if(Array.isArray(j.results)){
      var kr=drop(j.results);
      if(kr.length!==j.results.length){ out=Object.assign({}, out, {results:kr}); changed=true; }
    }
    return changed?out:j;
  }

  var ofetch=window.fetch;
  window.fetch=function(input, init){
    var url=typeof input==="string"?input:(input&&input.url)||"";
    var p=ofetch.apply(this, arguments);
    if(!/\/api\/(ai|find)\b/.test(String(url))) return p;
    return p.then(function(res){
      var clone=res.clone();
      return clone.json().then(function(j){
        try{
          var place=lastPlace();
          var scrubbed=scrubPlaces(j, place);
          if(scrubbed!==j){
            return new Response(JSON.stringify(scrubbed),{status:res.status,headers:{"Content-Type":"application/json"}});
          }
        }catch(e){}
        return res;
      }).catch(function(){ return res; });
    });
  };

  wrapRun();
  wrapTalk();
})();
