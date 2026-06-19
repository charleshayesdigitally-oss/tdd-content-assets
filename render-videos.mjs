import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
import { execFileSync } from 'child_process';
const ROOT=process.cwd();
const TYPES={'.html':'text/html','.json':'application/json','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.css':'text/css','.js':'text/javascript','.mp4':'video/mp4'};
const server=http.createServer((req,res)=>{let f=path.join(ROOT,decodeURIComponent(req.url.split('?')[0]));try{if(fs.existsSync(f)&&fs.statSync(f).isFile()){res.setHeader('Content-Type',TYPES[path.extname(f).toLowerCase()]||'application/octet-stream');fs.createReadStream(f).pipe(res);return;}}catch(e){}res.statusCode=404;res.end('nf');});
await new Promise(r=>server.listen(0,r)); const port=server.address().port;
const DUR=6000, FPS=30, N=Math.round(DUR/1000*FPS); // 6s @ 30fps
// only story-format pieces become TikTok videos (vertical 1080x1920)
function walk(d){let o=[];for(const e of fs.readdirSync(d,{withFileTypes:true})){const fp=path.join(d,e.name);if(e.isDirectory())o=o.concat(walk(fp));else if(/^poster-.*\.html$/.test(e.name)&&path.basename(path.dirname(fp)).endsWith('-story'))o.push(fp);}return o;}
const packOf=ph=>path.dirname(path.dirname(ph)); // promo-packs/<job>
const dir=path.join(ROOT,'promo-packs');
const posters=fs.existsSync(dir)?walk(dir):[];
const browser=await chromium.launch(); let n=0;
for(const ph of posters){
  const mp4=ph.replace(/\.html$/,'.mp4');
  // Render if MP4 missing OR the pack has a .rerender flag (a redo). Overwrites in place so
  // the old video stays live until the commit swaps it — never blank mid-redo. Flag cleared by workflow.
  const force=fs.existsSync(path.join(packOf(ph),'.rerender'));
  if(fs.existsSync(mp4) && !force) continue;
  const rel=path.relative(ROOT,ph).split(path.sep).join('/');
  const fdir=path.join(path.dirname(ph),'_frames'); fs.mkdirSync(fdir,{recursive:true});
  const pg=await browser.newPage({viewport:{width:1080,height:1920},deviceScaleFactor:1});
  try{
    await pg.goto(`http://localhost:${port}/${rel}`,{waitUntil:'networkidle',timeout:30000});
    await pg.waitForFunction('window.__ready===true',{timeout:8000}).catch(()=>{});
    await pg.waitForTimeout(300);
    await pg.evaluate(()=>{const p=document.getElementById('poster'); if(p) p.classList.add('anim');});
    await pg.waitForTimeout(80); // let class-triggered animations register
    await pg.evaluate(()=>document.getAnimations().forEach(a=>a.pause()));
    const el=await pg.$('#poster');
    for(let i=0;i<N;i++){
      const t=i/FPS*1000;
      await pg.evaluate((t)=>document.getAnimations().forEach(a=>{try{a.currentTime=t;}catch(e){}}), t);
      await (el||pg).screenshot({path:path.join(fdir,`f${String(i).padStart(4,'0')}.png`)});
    }
    execFileSync('ffmpeg',['-y','-framerate',String(FPS),'-i',path.join(fdir,'f%04d.png'),'-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart','-an',mp4],{stdio:'ignore'});
    if(!fs.existsSync(mp4)||fs.statSync(mp4).size<20000){ try{fs.rmSync(mp4,{force:true});}catch(e){} throw new Error('MP4 too small/empty — encode failed'); }
    console.log('video',rel); n++;
  }catch(e){ console.log('FAIL',rel,String(e).slice(0,140)); }
  await pg.close();
  fs.rmSync(fdir,{recursive:true,force:true});
}
await browser.close(); server.close(); console.log('done; videos',n);
