import { test, expect } from '@playwright/test';

const sizes=[
  {width:1440,height:900,touch:false},
  {width:1024,height:768,touch:false},
  {width:768,height:1024,touch:false},
  {width:390,height:844,touch:true},
  {width:320,height:640,touch:true},
  {width:844,height:390,touch:true},
];
type Box={x:number;y:number;width:number;height:number};
function overlaps(a:Box,b:Box){return a.x<b.x+b.width&&b.x<a.x+a.width&&a.y<b.y+b.height&&b.y<a.y+a.height;}

for(const size of sizes){
  test(`interface ${size.width}×${size.height}: visible start, clear controls and usable menus`,async({browser,baseURL})=>{
    const context=await browser.newContext({viewport:size,isMobile:size.touch,hasTouch:size.touch,reducedMotion:'reduce'});
    const page=await context.newPage(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(baseURL!);await page.locator('.equipment-card img').evaluate(img=>(img as HTMLImageElement).decode());
    // Let the initial CSS state settle before taking a visual record.
    await page.waitForTimeout(200);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const start=(await page.locator('#start-button').boundingBox())!,equipment=(await page.locator('.equipment-card').boundingBox())!;
    expect(start.y+start.height).toBeLessThanOrEqual(size.height);expect(start.y).toBeGreaterThanOrEqual(0);
    expect(overlaps(start,equipment),'The product must not cover the start control').toBe(false);
    const targets=await page.locator('.top-actions button:visible,#start-button').evaluateAll(buttons=>buttons.map(button=>{const r=button.getBoundingClientRect();return{w:r.width,h:r.height};}));
    expect(targets.every(b=>b.w>=44&&b.h>=44)).toBe(true);
    await page.screenshot({path:`work/ui-r3-title-${size.width}.png`});
    await page.locator('#start-button').click();await page.waitForTimeout(500);
    if(size.touch){
      const joystick=(await page.locator('#joystick').boundingBox())!,rescue=(await page.locator('#rescue-touch').boundingBox())!,hint=(await page.locator('#in-game-hint').boundingBox())!;
      expect(joystick.y+joystick.height).toBeLessThanOrEqual(size.height);expect(rescue.y+rescue.height).toBeLessThanOrEqual(size.height);
      expect(overlaps(hint,joystick),'The hint must not cover the joystick').toBe(false);
      expect(overlaps(hint,rescue),'The hint must not cover rescue').toBe(false);
    }
    await page.screenshot({path:`work/ui-r3-play-${size.width}.png`});
    await page.getByRole('button',{name:'玩法说明'}).click();await expect(page.locator('#help-dialog')).toBeVisible();
    await page.getByRole('button',{name:'关闭说明'}).click();await page.getByRole('button',{name:'暂停游戏'}).click();
    await expect(page.locator('#pause-dialog')).toBeVisible();await page.screenshot({path:`work/ui-r3-pause-${size.width}.png`});
    await page.getByRole('button',{name:'继续起飞'}).click();await expect(page.locator('#pause-dialog')).toBeHidden();
    expect(errors).toEqual([]);await context.close();
  });
}
