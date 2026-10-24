import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const url=process.argv[2]||'https://waytoagi-fly-games.vercel.app';
await mkdir('work',{recursive:true});
const response=await fetch(url);assert.equal(response.status,200);
const html=await response.text();
const assets=[...html.matchAll(/(?:src|href)="(\/assets\/[^"\s]+)"/g)].map(m=>m[1]);
assert.ok(assets.length>=2);
const checked=[];
for(const path of assets){
  const remote=await fetch(new URL(path,url));assert.equal(remote.status,200);
  const bytes=Buffer.from(await remote.arrayBuffer()),local=await readFile(`dist${path}`);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),createHash('sha256').update(local).digest('hex'));
  checked.push({path,bytes:bytes.length});
}
const browser=await chromium.launch({channel:'chrome',headless:true});
const errors=[];const failures=[];
try{
  const desktop=await browser.newContext({viewport:{width:1440,height:900}});
  const page=await desktop.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>failures.push(r.url()));
  await page.goto(url,{waitUntil:'networkidle'});
  await page.locator('.equipment-card img').evaluate(img=>img.decode());
  assert.equal(await page.evaluate(()=>typeof window.__FLY_DEBUG__),'undefined');
  assert.ok(await page.getByRole('button',{name:'开始起飞'}).isVisible());
  await page.screenshot({path:'work/production-title.png'});
  await page.getByRole('button',{name:'开始起飞'}).click();
  await page.keyboard.down('ArrowDown');await page.keyboard.down('Space');await page.waitForTimeout(850);await page.keyboard.up('Space');await page.keyboard.up('ArrowDown');
  await page.getByRole('button',{name:'暂停游戏'}).click();
  const height=Number(await page.locator('#height').textContent()),clean=parseFloat(await page.locator('#clean-value').textContent()),water=parseFloat(await page.locator('#water-value').textContent());
  assert.ok(height>0);assert.ok(clean>0);assert.ok(water<100);
  await page.getByRole('button',{name:'继续起飞'}).click();await page.getByRole('button',{name:'回到补水点',exact:true}).click();
  assert.equal(await page.locator('#water-value').textContent(),'100%');
  await page.getByRole('button',{name:'暂停游戏'}).click();await page.getByRole('button',{name:'从头再飞一次'}).click();assert.equal(await page.locator('#clean-value').textContent(),'0.0%');
  const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  const phone=await mobile.newPage();phone.on('pageerror',e=>errors.push(e.message));phone.on('requestfailed',r=>failures.push(r.url()));
  await phone.goto(url,{waitUntil:'networkidle'});assert.equal(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await phone.getByRole('button',{name:'开始起飞'}).tap();assert.ok(await phone.locator('#joystick').isVisible());
  const b=await phone.locator('#joystick').boundingBox(),cdp=await mobile.newCDPSession(phone);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width/2-30,y:b.y+b.height/2+39}]});await phone.waitForTimeout(1300);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await phone.getByRole('button',{name:'暂停游戏'}).tap();const mobileHeight=Number(await phone.locator('#height').textContent());assert.ok(mobileHeight>5);
  await phone.getByRole('button',{name:'继续起飞'}).tap();await phone.locator('#rescue-touch').tap();await phone.waitForTimeout(500);await phone.screenshot({path:'work/production-mobile.png'});
  const tablet=await browser.newContext({viewport:{width:768,height:1024}}),tab=await tablet.newPage();tab.on('pageerror',e=>errors.push(e.message));tab.on('requestfailed',r=>failures.push(r.url()));await tab.goto(url,{waitUntil:'networkidle'});assert.equal(await tab.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await tab.getByRole('button',{name:'开始起飞'}).click();assert.ok(await tab.getByRole('button',{name:'暂停游戏'}).isVisible());
  assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
  const report={verifiedAt:new Date().toISOString(),url,http:response.status,anonymous:true,assetsMatchLocalBuild:true,assets:checked,productAssetDecoded:true,desktop:{height,clean,water,pause:true,rescue:true,restart:true},mobile:{width:390,height:844,flightHeight:mobileHeight,touch:true,noOverflow:true},tablet:{width:768,height:1024,start:true,noOverflow:true},productionDebugInterface:false,pageErrors:errors,failedRequests:failures};
  await writeFile('work/production-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
