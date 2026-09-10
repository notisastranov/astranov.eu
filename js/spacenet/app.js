/* SpaceNet 4251-one-entity OS (gz parts joined; function talk( goNamed huntNamed NOW/PAY/RELOAD) */
window.__SN_4251=!0;
(async function(){
var b64=window.__SN4251_GZ||"";
if(!b64){console.error("4251 gz missing");return;}
var b=Uint8Array.from(atob(b64),function(c){return c.charCodeAt(0)});
var code=await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
if(code.indexOf("function talk(")<0)throw new Error("4251 inflate fail");
(0,eval)(code);
})();
