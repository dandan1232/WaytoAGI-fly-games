import { test, expect, type Page } from '@playwright/test';
import { platforms, obstacles } from '../src/level.ts';

async function observe(page:Page){return page.evaluate(()=>(window as any).__FLY_DEBUG__.snapshot());}

/** Fly around the first AC, spend the tank and land on top, using normal input only. */
async function emptyLanding(page:Page,touch:boolean){
  if(!touch){
    // First refill, then descend onto the lower AC and spend the remaining tank there.
    // The route follows observed motion rather than relying on exact mouse timing.
    let held=false,duty=0;
    try{
      for(const destination of [platforms[1],obstacles[0]]){
        const tx=destination.x+destination.w/2,deadline=Date.now()+18000;let above=false,landed=false;
        while(Date.now()<deadline){
          const s=await observe(page),p=s.player,ty=destination.y-p.h/2;
          if(s.status==='lost'){landed=true;break;}
          if(p.grounded&&Math.abs(p.y-ty)<1){landed=true;break;}
          if(p.y<ty-65)above=true;
          const targetY=above?ty+6:ty-90,vx=Math.max(-220,Math.min(220,(tx-p.x)*2.7)),vy=Math.max(-285,Math.min(120,(targetY-p.y)*2.7));
          const ax=(vx-p.vx)*7+p.vx*2.6,ay=(vy-p.vy)*7-650+p.vy*.45,n=Math.hypot(ax,ay);duty+=Math.min(1,n/1420);
          let spray=duty>=1;if(spray)duty-=1;if(above&&Math.abs(tx-p.x)<75&&p.y>ty-65)spray=false;
          const at=await page.evaluate(({dx,dy})=>{const d=(window as any).__FLY_DEBUG__,p=d.snapshot().player,r=document.querySelector('canvas')!.getBoundingClientRect(),s=d.toScreen(p.x+dx*130,p.y+dy*130);return{x:s.x+r.x,y:s.y+r.y};},{dx:-ax/(n||1),dy:-ay/(n||1)});
          await page.mouse.move(at.x,at.y);if(spray!==held){if(spray)await page.mouse.down();else await page.mouse.up();held=spray;}
          await page.waitForTimeout(20);
        }
        if(held){await page.mouse.up();held=false;}
        expect(landed,JSON.stringify(await observe(page))).toBe(true);
        if(destination===platforms[1])await page.waitForTimeout(2100);
      }
      if((await observe(page)).status!=='lost'){
        await page.locator('#world').focus();await page.keyboard.down('ArrowUp');await page.keyboard.down('Space');
        await expect(page.locator('#failure-dialog')).toBeVisible();await page.keyboard.up('Space');await page.keyboard.up('ArrowUp');
      }
    }finally{await page.mouse.up();await page.keyboard.up('Space');await page.keyboard.up('ArrowUp');}
    expect((await observe(page)).status).toBe('lost');return;
  }
  const cdp=touch?await page.context().newCDPSession(page):null;
  const box=touch?(await page.locator('#joystick').boundingBox())!:null;
  let held=false;
  const began=(await observe(page)).elapsed;
  try{
    const deadline=Date.now()+7000;
    while(Date.now()<deadline){
      const state=await observe(page);if(state.status==='lost')break;
      const first=state.elapsed-began<1.23,dx=first?-.2:1,dy=first?1:.5,n=Math.hypot(dx,dy);
      if(touch){
        await cdp!.send('Input.dispatchTouchEvent',{type:held?'touchMove':'touchStart',touchPoints:[{x:box!.x+box!.width/2+dx/n*47,y:box!.y+box!.height/2+dy/n*47}]});
      }else{
        const at=await page.evaluate(({dx,dy,n})=>{const debug=(window as any).__FLY_DEBUG__,p=debug.snapshot().player,r=document.querySelector('canvas')!.getBoundingClientRect(),s=debug.toScreen(p.x+dx/n*240,p.y+dy/n*240);return{x:s.x+r.x,y:s.y+r.y};},{dx,dy,n});
        await page.mouse.move(at.x,at.y);if(!held)await page.mouse.down();
      }
      held=true;await page.waitForTimeout(12);
    }
  }finally{
    if(cdp){await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();}
    else await page.mouse.up();
  }
  expect((await observe(page)).status,JSON.stringify(await observe(page))).toBe('lost');
}

for(const touch of [false,true]){
  test(`${touch?'touch':'mouse'}: an empty landing on AC ends the run and retry starts clean`,async({browser,baseURL})=>{
    const context=await browser.newContext({viewport:touch?{width:390,height:844}:{width:1440,height:900},isMobile:touch,hasTouch:touch});
    const page=await context.newPage(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(baseURL!);await page.getByRole('button',{name:'开始起飞'}).click();await page.getByRole('button',{name:'收起提示'}).click();
    await emptyLanding(page,touch);await expect(page.locator('#failure-dialog')).toBeVisible();
    await expect(page.getByRole('heading',{name:'水箱空了。'})).toBeVisible();
    const stopped=await observe(page);expect(stopped.mode).toBe('failed');expect(stopped.player.water).toBe(0);
    await page.waitForTimeout(350);const frozen=await observe(page);expect(frozen.player).toEqual(stopped.player);expect(frozen.elapsed).toEqual(stopped.elapsed);
    expect(await page.evaluate(()=>localStorage.getItem('karcher-flight-best-v1'))).toBeNull();
    await page.keyboard.press('Escape');await expect(page.locator('#failure-dialog')).toBeVisible();
    await page.screenshot({path:`work/failure-${touch?'mobile':'desktop'}.png`});
    if(touch)await page.getByRole('button',{name:'重新起飞',exact:true}).tap();else await page.keyboard.press('r');
    await expect(page.locator('#failure-dialog')).toBeHidden();const fresh=await observe(page);
    expect(fresh.mode).toBe('playing');expect(fresh.status).toBe('playing');expect(fresh.player.water).toBe(100);expect(fresh.cleanPct).toBe(0);expect(fresh.rescues).toBe(0);
    await page.waitForTimeout(200);const noGhostInput=await observe(page);expect(noGhostInput.player.grounded).toBe(true);expect(noGhostInput.player.water).toBe(100);
    expect(errors).toEqual([]);await context.close();
  });
}
