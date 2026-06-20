import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path'; import https from 'https';
const ROOT=process.cwd();
const TYPES={'.html':'text/html','.json':'application/json','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.css':'text/css','.js':'text/javascript','.mp4':'video/mp4'};
// Prefetch hero assets from source repos before rendering.
// Each pack may include a _photo_src.json: [{dest, src_owner, src_repo, src_sha}]
// Uses GITHUB_TOKEN from the Actions environment to call the git blobs API.
{const GH=process.env.GITHUB_TOKEN||'';
if(GH){const pd2=path.join(ROOT,'promo-packs');
const pds=fs.existsSync(pd2)?fs.readdirSync(pd2,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>path.join(pd2,e.name)):[];
for(const pd of pds){const sf=path.join(pd,'_photo_src.json');if(!fs.existsSync(sf))continue;
let srcs;try{srcs=JSON.parse(fs.readFileSync(sf,'utf8'));}catch(e){continue;}
for(const {dest,src_owner,src_repo,src_sha} of (srcs||[])){const dp=path.join(pd,dest);if(fs.existsSync(dp))continue;
try{const buf=await new Promise((res,rej)=>{
  const o={hostname:'api.github.com',path:`/repos/${src_owner}/${src_repo}/git/blobs/${src_sha}`,
    headers:{'User-Agent':'render-posters','Accept':'application/vnd.github+json','Authorization':`Bearer ${GH}`}};
  https.get(o,r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>{
    try{const j=JSON.parse(d);res(j.content?Buffer.from(j.content.replace(/\n/g,''),'base64'):null);}catch(e){rej(e);}
  });}).on('error',rej);
});
if(buf){fs.writeFileSync(dp,buf);console.log('asset fetched',dest);}}
catch(e){console.log('asset fetch fail',dest,String(e).slice(0,80));}}}}
}
const server=http.createServer((req,res)=>{let f=path.join(ROOT,decodeURIComponent(req.url.split('?')[0]));try{if(fs.existsSync(f)&&fs.statSync(f).isFile()){res.setHeader('Content-Type',TYPES[path.extname(f).toLowerCase()]||'application/octet-stream');fs.createReadStream(f).pipe(res);return;}}catch(e){}res.statusCode=404;res.end('nf');});
await new Promise(r=>server.listen(0,r)); const port=server.address().port;
function walk(d){let o=[];for(const e of fs.readdirSync(d,{withFileTypes:true})){const fp=path.join(d,e.name);if(e.isDirectory())o=o.concat(walk(fp));else if(/^poster-.*\.html$/.test(e.name))o.push(fp);}return o;}
const packOf=ph=>path.dirname(path.dirname(ph)); // promo-packs/<job>
const dir=path.join(ROOT,'promo-packs');
const posters=fs.existsSync(dir)?walk(dir):[];
const browser=await chromium.launch(); let n=0;
for(const ph of posters){
  const png=ph.replace(/\.html$/,'.png');
  // Render if the PNG is missing OR the pack carries a .rerender flag (a redo). On a redo
  // we OVERWRITE in place — the old PNG stays live on Pages until the commit swaps it
  // atomically, so the pack is never blank mid-redo. The flag is cleared by the workflow.
  const force=fs.existsSync(path.join(packOf(ph),'.rerender'));
  if(fs.existsSync(png) && !force) continue;
  const rel=path.relative(ROOT,ph).split(path.sep).join('/');
  const pg=await browser.newPage({viewport:{width:1080,height:1920},deviceScaleFactor:1});
  try{
    await pg.goto(`http://localhost:${port}/${rel}`,{waitUntil:'networkidle',timeout:30000});
    await pg.waitForFunction('window.__ready===true',{timeout:8000}).catch(()=>{});
    await pg.waitForTimeout(2500);
    const el=await pg.$('#poster');
    await (el||pg).screenshot({path:png});
    if(!fs.existsSync(png)||fs.statSync(png).size<5000){ try{fs.rmSync(png,{force:true});}catch(e){} throw new Error('PNG too small/empty — render failed'); }
    console.log('rendered',rel); n++;
  }catch(e){ console.log('FAIL',rel,String(e).slice(0,120)); }
  await pg.close();
}
await browser.close(); server.close(); console.log('done; rendered',n);
