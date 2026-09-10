/* SpaceNet 4252-one-entity OS (gz inflate; function talk( goNamed huntNamed NOW/PAY/RELOAD) */
window.__SN_4252=!0;
(async function(){
var b64=window.__SN4252_GZ||"";
if(!b64){console.error("4252 gz missing");return;}
var b=Uint8Array.from(atob(b64),function(c){return c.charCodeAt(0)});
var code=await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
if(code.indexOf("function talk(")<0)throw new Error("4252 inflate fail");
(0,eval)(code);
})();
