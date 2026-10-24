import { test, expect, type Page } from '@playwright/test';
import { platforms, secretWindow } from '../src/level.ts';

async function snapshot(page:Page){return page.evaluate(()=>(window as any).__FLY_DEBUG__.snapshot());}

async function washSecret(page:Page,touch=false){
  const target={x:secretWindow.x+30,y:secretWindow.y+30};
  const cdp=touch?await page.context().newCDPSession(page):null;
  const box=touch?(await page.locator('#joystick').boundingBox())!:null;
  let held=false;const deadline=Date.now()+5000;
  try{
    while(Date.now()<deadline){
      const s=await snapshot(page);if(s.secret.unlocked)break;
      if(touch){
        const dx=target.x-s.player.x,dy=target.y-s.player.y,n=Math.hypot(dx,dy);
        await cdp!.send('Input.dispatchTouchEvent',{type:held?'touchMove':'touchStart',touchPoints:[{x:box!.x+box!.width/2+dx/n*46,y:box!.y+box!.height/2+dy/n*46}]});
      }else{
        const at=await page.evaluate(target=>{const p=(window as any).__FLY_DEBUG__.toScreen(target.x,target.y),r=document.querySelector('canvas')!.getBoundingClientRect();return{x:p.x+r.x,y:p.y+r.y};},target);
        await page.mouse.move(at.x,at.y);if(!held)await page.mouse.down();
      }
      held=true;await page.waitForTimeout(30);
    }
  }finally{if(cdp){await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();}else await page.mouse.up();}
  expect((await snapshot(page)).secret.unlocked).toBe(true);
}

test('secret glass unlocks through mouse spray and the collection survives reload/replay',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'开始起飞'}).click();
  await page.getByRole('button',{name:'收起提示'}).click();await washSecret(page);
  await expect(page.locator('#achievement-banner')).toBeVisible();await expect(page.locator('#achievement-heading')).toHaveText('隐藏成就解锁');
  await expect(page.locator('#achievement-chip')).toHaveClass(/earned/);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('karcher-flight-achievements-v1')||'null'))).toEqual({duckWindow:true});
  await page.getByRole('button',{name:'回到补水点',exact:true}).click();await page.waitForTimeout(500);
  expect((await snapshot(page)).secret.unlocked).toBe(true);await page.screenshot({path:'work/secret-desktop.png'});
  await page.reload();await page.getByRole('button',{name:'开始起飞'}).click();
  await expect(page.locator('#achievement-chip')).toHaveClass(/earned/);expect((await snapshot(page)).secret.unlocked).toBe(false);
  await page.getByRole('button',{name:'收起提示'}).click();await washSecret(page);
  await expect(page.locator('#achievement-heading')).toHaveText('彩蛋再次发现');
  await page.getByRole('button',{name:'暂停游戏'}).click();await page.getByRole('button',{name:'从头再飞一次'}).click();
  expect((await snapshot(page)).secret.unlocked).toBe(false);await expect(page.locator('#achievement-banner')).toBeHidden();await expect(page.locator('#achievement-chip')).toHaveClass(/earned/);
});

test('secret glass can be washed with the mobile touch joystick',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage();await page.goto('/');await page.getByRole('button',{name:'开始起飞'}).tap();
  await page.getByRole('button',{name:'收起提示'}).tap();await washSecret(page,true);
  await expect(page.locator('#achievement-banner')).toBeVisible();await expect(page.locator('#achievement-chip')).toHaveClass(/earned/);
  await page.locator('#rescue-touch').tap();await page.waitForTimeout(500);await page.screenshot({path:'work/secret-mobile.png'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await context.close();
});
test('desktop: keyboard flight, real cleaning, pause, help, rescue and restart',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await expect(page.getByRole('button',{name:'开始起飞'})).toBeVisible();
  await page.screenshot({path:'work/title-desktop.png'});
  await page.getByRole('button',{name:'开始起飞'}).click();
  await page.keyboard.down('ArrowDown');await page.keyboard.down('Space');await page.waitForTimeout(900);await page.keyboard.up('Space');await page.keyboard.up('ArrowDown');
  await page.keyboard.press('p');const flown=await snapshot(page);
  expect(flown.highest).toBeGreaterThan(130);expect(flown.cleanPct).toBeGreaterThan(0);expect(flown.player.water).toBeLessThan(95);
  await page.waitForTimeout(400);const frozen=await snapshot(page);expect(frozen.elapsed).toEqual(flown.elapsed);expect(frozen.player.y).toEqual(flown.player.y);
  await page.getByRole('button',{name:'继续起飞'}).click();await page.getByRole('button',{name:'玩法说明'}).click();expect((await snapshot(page)).mode).toBe('paused');
  await page.getByRole('button',{name:'知道了，天台见'}).click();expect((await snapshot(page)).mode).toBe('playing');
  await page.getByRole('button',{name:'回到补水点',exact:true}).click();const rescued=await snapshot(page);expect(rescued.rescues).toBe(1);expect(rescued.player.water).toBe(100);
  await page.getByRole('button',{name:'开启音效'}).click();await expect(page.getByRole('button',{name:'关闭音效'})).toBeVisible();
  await page.getByRole('button',{name:'暂停游戏'}).click();await page.getByRole('button',{name:'从头再飞一次'}).click();const restarted=await snapshot(page);expect(restarted.rescues).toBe(0);expect(restarted.cleanPct).toBe(0);
  await page.screenshot({path:'work/playing-desktop.png'});expect(errors).toEqual([]);
});

test('mobile: visible joystick, touch flight and no horizontal overflow',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const page=await context.newPage();const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
  await page.screenshot({path:'work/title-mobile.png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'开始起飞'}).tap();await expect(page.locator('#joystick')).toBeVisible();
  const box=(await page.locator('#joystick').boundingBox())!;
  const session=await context.newCDPSession(page);
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2-30,y:box.y+box.height/2+39}]});
  await page.waitForTimeout(1300);
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.getByRole('button',{name:'暂停游戏'}).tap();expect((await snapshot(page)).highest).toBeGreaterThan(180);
  await page.getByRole('button',{name:'继续起飞'}).tap();await page.locator('#rescue-touch').tap();
  await page.screenshot({path:'work/playing-mobile.png'});expect(errors).toEqual([]);await context.close();
});

test('normal mouse input can visit every stop, win, reveal, download poster and replay',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.getByRole('button',{name:'开始起飞'}).click();
  await page.getByRole('button',{name:'收起提示'}).click();await page.locator('#world').focus();
  let duty=0,holding=false;
  const visited=['start'];
  for(const destination of platforms.slice(1)){
    const tx=destination.x+destination.w/2;let above=false,landed=false;const deadline=Date.now()+26000;
    while(Date.now()<deadline){
      const s=await snapshot(page),p=s.player,ty=destination.y-p.h/2;
      if(s.status==='won'){landed=true;break;}
      if(p.grounded&&Math.abs(p.y-ty)<1){landed=true;break;}
      if(p.y<ty-65)above=true;
      const targetY=above?ty+6:ty-90;
      const desiredVx=Math.max(-220,Math.min(220,(tx-p.x)*2.7));
      const desiredVy=Math.max(-285,Math.min(120,(targetY-p.y)*2.7));
      const ax=(desiredVx-p.vx)*7+p.vx*2.6,ay=(desiredVy-p.vy)*7-650+p.vy*.45;
      const power=Math.hypot(ax,ay);duty+=Math.min(1,power/1420);let spray=duty>=1;if(spray)duty-=1;
      if(above&&Math.abs(tx-p.x)<75&&p.y>ty-65)spray=false;
      const dx=-ax/(power||1),dy=-ay/(power||1);
      const pos=await page.evaluate(({dx,dy})=>{const debug=(window as any).__FLY_DEBUG__,p=debug.snapshot().player,r=document.querySelector('canvas')!.getBoundingClientRect();const s=debug.toScreen(p.x+dx*130,p.y+dy*130);return{x:s.x+r.x,y:s.y+r.y};},{dx,dy});
      await page.mouse.move(pos.x,pos.y);
      if(spray!==holding){if(spray)await page.mouse.down();else await page.mouse.up();holding=spray;}
      await page.waitForTimeout(22);
    }
    if(holding){await page.mouse.up();holding=false;}
    expect(landed,`mouse route failed at ${destination.id}; ${JSON.stringify(await snapshot(page))}`).toBe(true);
    visited.push(destination.id);await page.waitForTimeout(2100);
  }
  const final=await snapshot(page);expect(final.status).toBe('won');expect(final.rescues).toBe(0);expect(final.cleanPct).toBeGreaterThan(5);expect(visited).toEqual(platforms.map(p=>p.id));
  await expect(page.getByRole('button',{name:'查看飞行成绩'})).toBeVisible();await page.waitForTimeout(2200);await page.screenshot({path:'work/victory-desktop.png'});
  await page.getByRole('button',{name:'查看飞行成绩'}).click();expect((await snapshot(page)).cleanPct).toEqual(final.cleanPct);
  await expect(page.getByRole('heading',{name:'登顶成功。'})).toBeVisible();await page.screenshot({path:'work/results-desktop.png'});
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'带走我的飞行海报'}).click();const download=await downloadPromise;await download.saveAs('work/flight-poster.png');expect(download.suggestedFilename()).toContain('.png');
  await page.getByRole('button',{name:'再飞一次，挑战更高分'}).click();const reset=await snapshot(page);expect(reset.mode).toBe('playing');expect(reset.cleanPct).toBe(0);expect(reset.player.water).toBe(100);expect(reset.rescues).toBe(0);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('karcher-flight-best-v1')||'null'))).toBeTruthy();expect(errors).toEqual([]);
  console.log(`Browser route: ${visited.join(' → ')}; ${final.elapsed.toFixed(1)} s, ${final.cleanPct.toFixed(1)}% cleaned, ${final.rescues} rescues.`);
});
