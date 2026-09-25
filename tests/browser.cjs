// Real Chromium interaction test. npm install --no-save playwright; npx playwright install chromium
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),zlib=require('node:zlib');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../web'),out=path.resolve(__dirname,'../.local/browser');
fs.mkdirSync(out,{recursive:true});
// Decode Chromium PNG screenshots to prove that the unobstructed canvas has rendered lines.
function colours(png){
 let p=8,w,h,bpp,parts=[];
 while(p<png.length){const n=png.readUInt32BE(p),type=png.toString('ascii',p+4,p+8),data=png.subarray(p+8,p+8+n);p+=n+12;
  if(type==='IHDR'){w=data.readUInt32BE(0);h=data.readUInt32BE(4);assert.equal(data[8],8);bpp=data[9]===6?4:data[9]===2?3:0;assert.ok(bpp);}
  if(type==='IDAT')parts.push(data);
 }
 const raw=zlib.inflateSync(Buffer.concat(parts)),stride=w*bpp,values=new Set();let previous=Buffer.alloc(stride),offset=0;
 for(let y=0;y<h;y++){const filter=raw[offset++],row=Buffer.alloc(stride);for(let x=0;x<stride;x++){
  const a=x>=bpp?row[x-bpp]:0,b=previous[x],c=x>=bpp?previous[x-bpp]:0,q=a+b-c;
  const pa=Math.abs(q-a),pb=Math.abs(q-b),pc=Math.abs(q-c),prediction=filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):pa<=pb&&pa<=pc?a:pb<=pc?b:c;
  row[x]=(raw[offset++]+prediction)&255;
 }for(let x=0;x<stride;x+=bpp)values.add(`${row[x]},${row[x+1]},${row[x+2]}`);previous=row;}
 return values.size;
}
const server=http.createServer((req,res)=>{try{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(root+path.sep))throw Error('Path outside web');const data=fs.readFileSync(file);res.setHeader('Content-Type',({'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.end(data);}catch{res.statusCode=404;res.end('Not found');}});
(async()=>{let browser;const report={checks:[],errors:[]};try{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1280,height:900},acceptDownloads:true});
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>window.electricalExplorer?.state.vertexCount>0);
 assert.equal(await page.locator('#error').textContent(),'');
 const state=()=>page.evaluate(()=>window.electricalExplorer.state);
 const clip={x:350,y:0,width:930,height:790};
 const initial=await page.screenshot({path:path.join(out,'initial.png'),clip});
 report.canvasColours=colours(initial);assert.ok(report.canvasColours>10,'Canvas must contain rendered geometry');report.checks.push('nonempty WebGL canvas');
 await page.locator('[name=height]').fill('2.5');await page.getByRole('button',{name:'Apply geometry',exact:true}).click();assert.equal((await state()).settings.height,2.5);report.checks.push('numeric geometry applied');
 for(const mode of ['walk','fly']){await page.locator('#mode').selectOption(mode);await page.locator('#scene').focus();const before=await page.screenshot({clip});await page.keyboard.down('w');await page.waitForTimeout(400);await page.keyboard.up('w');const after=await page.screenshot({clip});assert.equal((await state()).mode,mode);assert.ok(!before.equals(after),`${mode} W changes rendered view`);report.checks.push(`${mode} movement`);}
 await page.locator('#start').click();await page.keyboard.down('w');await page.waitForTimeout(400);await page.keyboard.up('w');const forward=(await state()).distance;assert.ok(forward>0);await page.keyboard.down('s');await page.waitForTimeout(180);await page.keyboard.up('s');assert.ok((await state()).distance<forward);report.checks.push('cable W/S distance');
 await page.locator('#blueprint').click();assert.equal((await state()).mode,'top');await page.locator('#hide').click();assert.equal(await page.locator('aside').isVisible(),false);await page.locator('#show').click();assert.equal(await page.locator('aside').isVisible(),true);report.checks.push('blueprint and controls');
 await page.locator('summary').filter({hasText:'Cable route files'}).click();
 const routes=[{id:'browser-test',label:'Browser metric test',points:[[0,0,0],[3,4,0],[3,4,12]]}],envelope={schema:'electrical-routes/1',units:'metres',axes:'ENU',routes};
 await page.locator('#route-file').setInputFiles({name:'routes.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(envelope))});await page.waitForFunction(()=>window.electricalExplorer.state.routes[0].id==='browser-test');assert.equal((await state()).routes[0].length,17);
 const downloadPromise=page.waitForEvent('download');await page.locator('#export-routes').click();const download=await downloadPromise;await download.saveAs(path.join(out,'exported-routes.json'));assert.deepEqual(JSON.parse(fs.readFileSync(path.join(out,'exported-routes.json'),'utf8')).routes,routes);report.checks.push('real file import/export and 17 m length');
 await page.locator('#blueprint').click();await page.screenshot({path:path.join(out,'final.png')});
 assert.deepEqual(report.errors,[]);report.status='passed';
 }catch(error){report.status='failed';report.failure=error.stack;process.exitCode=1;}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}})();
