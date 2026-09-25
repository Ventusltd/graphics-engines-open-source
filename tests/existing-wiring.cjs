// Browser acceptance against the existing published Ventus drawings.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const out=path.resolve(__dirname,'../.local/existing-wiring');fs.mkdirSync(out,{recursive:true});
const base=process.env.EXISTING_WIRING_BASE||'https://globalgrid2050.com/ventus/wiring/';
(async()=>{let browser;const results=[];try{
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{}),args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 for(const name of ['inverter-48','inverter-station']){
  const page=await browser.newPage({viewport:{width:1600,height:1100}}),result={name,url:new URL(name+'.html',base).href,errors:[],checks:[]};results.push(result);
  page.on('pageerror',error=>result.errors.push(error.message));page.setDefaultTimeout(30000);
  try{
   const response=await page.goto(result.url,{waitUntil:'networkidle'});assert.equal(response.status(),200);
   if(!await page.locator('#flow').isVisible())await page.locator(name==='inverter-48'?'#menu':'#controls').click();
   if(name==='inverter-48'){
    await page.waitForFunction(()=>window.__inverter48?.ready===true);
    const snapshot=()=>page.evaluate(()=>({ready:__inverter48.ready,playing:__inverter48.playing,frames:__inverter48.flowFrames,stats:__inverter48.flowStats,homes:__inverter48.animatedHomeCount,visibility:document.visibilityState}));
    result.initial=await snapshot();if(!result.initial.playing)await page.locator('#flow').click();
    await page.waitForFunction(()=>__inverter48.flowFrames>2&&__inverter48.flowStats.homePaths>0);
    const before=await snapshot(),started=Date.now();result.frameProbe={before};
    try{await page.waitForFunction(previous=>__inverter48.flowFrames>previous,before.frames,{timeout:10000,polling:100});}finally{result.frameProbe.elapsedMs=Date.now()-started;result.frameProbe.after=await snapshot();}
    const after=await snapshot();
    assert.equal(after.playing,true);assert.ok(after.frames>before.frames);assert.equal(after.homes,48);result.running=after;
    await page.screenshot({path:path.join(out,name+'-running.png')});
    await page.locator('#flow').click();await page.waitForTimeout(150);const stopped=await snapshot();await page.waitForTimeout(350);const still=await snapshot();assert.equal(still.playing,false);assert.equal(still.frames,stopped.frames);result.paused=still;
    await page.locator('#flow').click();await page.waitForFunction(previous=>__inverter48.flowFrames>previous,still.frames,{timeout:10000,polling:100});result.checks.push('ready; 48 animated home cables; frames advance, pause and resume');
   }else{
    await page.waitForFunction(()=>window.__inverterStation?.model&&document.querySelector('#drawing .power'));
    result.model=await page.evaluate(()=>({inverters:__inverterStation.model.inverters.length,cables:__inverterStation.model.cables.length,sections:__inverterStation.model.sections.length}));
    assert.deepEqual(result.model,{inverters:28,cables:84,sections:2});
    const animation=()=>page.locator('#drawing .power').first().evaluate(e=>{const s=getComputedStyle(e);return {name:s.animationName,state:s.animationPlayState,display:s.display,offset:s.strokeDashoffset,duration:s.animationDuration};});
    if(await page.locator('#drawing').evaluate(e=>e.classList.contains('paused')))await page.locator('#flow').click();
    await page.waitForTimeout(100);const before=await animation();await page.waitForTimeout(350);const after=await animation();
    assert.notEqual(after.name,'none');assert.notEqual(after.display,'none');assert.equal(after.state,'running');assert.notEqual(after.offset,before.offset);result.running={before,after};
    await page.screenshot({path:path.join(out,name+'-running.png')});
    await page.locator('#flow').click();await page.waitForTimeout(100);const stopped=await animation();await page.waitForTimeout(350);const still=await animation();assert.equal(still.display,'none');result.paused={stopped,still};
    await page.locator('#flow').click();await page.waitForTimeout(100);const resumed=await animation();assert.notEqual(resumed.display,'none');await page.waitForTimeout(350);assert.notEqual((await animation()).offset,resumed.offset);result.checks.push('28 inverters / 84 phase cables; computed dash offset advances, pause hides flow, resume moves flow');
   }
   assert.deepEqual(result.errors,[]);result.status='passed';
  }catch(error){result.status='failed';result.failure=error.stack;process.exitCode=1;}
  finally{await page.screenshot({path:path.join(out,name+'.png'),fullPage:true}).catch(()=>{});await page.close();}
 }
 }catch(error){results.push({status:'failed',failure:error.stack});process.exitCode=1;}finally{if(browser)await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));}})();
