import './style.css';
import { createGame, stepGame, rescue, getHeightMeters, getResidentCount, scoreStars, FIXED_DT } from './core.ts';
import type { GameEvent } from './core.ts';
import { districts, secretWindow } from './level.ts';
import { Renderer } from './render.ts';
import { Controls } from './input.ts';
import { GameAudio } from './audio.ts';
import { loadBest, saveBest, loadSecretAchievement, saveSecretAchievement } from './storage.ts';

const $ = <T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const canvas=$<HTMLCanvasElement>('world');
let state=createGame();
let mode:'title'|'playing'|'paused'|'victory'='title';
const renderer=new Renderer(canvas);
const controls=new Controls(canvas,$('joystick'),(x,y)=>renderer.screenToWorld(x,y));
const audio=new GameAudio();
let accumulator=0, last=performance.now(), lastHud=0, toastTimer=0, showResultTimer=0;
let hintDismissed=false, milestone=0;
let resumeAfterHelp=false;
let secretCollected=loadSecretAchievement(), achievementTimer=0;
const help=$<HTMLDialogElement>('help-dialog'),pauseDialog=$<HTMLDialogElement>('pause-dialog'),results=$<HTMLDialogElement>('result-dialog');
const fmt=(seconds:number)=>`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
const setHidden=(id:string,hidden:boolean)=>$(id).classList.toggle('hidden',hidden);
const best=loadBest();
if(best)$('title-best').textContent=`个人最佳：${'★'.repeat(best.stars)} · 洗亮 ${best.clean.toFixed(1)}% · ${fmt(best.elapsed)}`;

function announce(message:string){$('announce').textContent=message;}
function toast(message:string,duration=3500){clearTimeout(toastTimer);$('toast').textContent=message;setHidden('toast',false);announce(message);toastTimer=window.setTimeout(()=>setHidden('toast',true),duration);}
function updateAchievement(){
  $('achievement-chip').classList.toggle('earned',secretCollected);
  $('achievement-chip').textContent=secretCollected?`★ ${secretWindow.achievement}`:'◇ 隐藏成就 · ?';
  $('achievement-chip').title=secretCollected?'收藏成就：洗亮「请勿打扰」窗户，发现泡澡的小黄鸭':'有扇窗上写着「请勿打扰」……';
}
function discoverSecret(){
  const first=!secretCollected, saved=saveSecretAchievement();secretCollected=true;
  clearTimeout(achievementTimer);setHidden('toast',true);
  $('achievement-heading').textContent=first?'隐藏成就解锁':'彩蛋再次发现';
  $('achievement-save').textContent=saved?'已收藏 · 下次回来也记得':'本次已解锁 · 浏览器未允许保存';
  setHidden('achievement-banner',false);updateAchievement();audio.chime('achievement');
  announce(`隐藏成就：${secretWindow.achievement}。小黄鸭正在偷偷泡澡。`);
  achievementTimer=window.setTimeout(()=>setHidden('achievement-banner',true),6500);
}
function start(){
  clearTimeout(showResultTimer);clearTimeout(toastTimer);clearTimeout(achievementTimer);setHidden('achievement-banner',true);
  [help,pauseDialog,results].forEach(d=>{if(d.open)d.close();});
  state=createGame();mode='playing';controls.clear();controls.active=true;renderer.reset();accumulator=0;last=performance.now();milestone=0;hintDismissed=false;
  ['title-screen','reveal-caption','toast'].forEach(id=>setHidden(id,true));
  ['hud','pause-button','height-ruler','desktop-controls','touch-controls','in-game-hint'].forEach(id=>setHidden(id,false));
  $('hint-title').textContent='先朝脚下喷水试试';$('hint-body').textContent=matchMedia('(pointer:coarse)').matches?'摇杆向下拖动，角色就会向上飞；松手停下':'按住鼠标喷水，松手停下 · 黄色平台可以补水';
  document.body.classList.add('is-playing');canvas.focus({preventScroll:true});updateHud();updateAchievement();announce('飞行开始。向下喷水，角色向上飞。');
}
function pause(showDialog=true){
  if(mode!=='playing')return;
  $('pause-heading').textContent='歇会儿，再飞。';
  mode='paused';controls.active=false;controls.clear();state.spraying=false;audio.spray(false);accumulator=0;
  if(showDialog&&!pauseDialog.open)pauseDialog.showModal();
}
function resume(){
  if(pauseDialog.open)pauseDialog.close();
  if(mode!=='paused')return;
  mode='playing';controls.clear();controls.active=true;last=performance.now();accumulator=0;canvas.focus({preventScroll:true});
}
function finish(){
  if(mode==='victory')return;
  mode='victory';controls.active=false;controls.clear();audio.spray(false);audio.chime('win');
  ['hud','height-ruler','pause-button','in-game-hint','touch-controls','desktop-controls','toast','achievement-banner'].forEach(id=>setHidden(id,true));
  const stars=scoreStars(state),residents=getResidentCount(state);
  const saved=saveBest({stars,clean:state.cleanPct,residents,elapsed:state.elapsed,rescues:state.rescues,height:getHeightMeters(state)});
  $('result-stars').innerHTML=Array.from({length:3},(_,i)=>`<svg ${i>=stars?'class="empty"':''} aria-hidden="true"><use href="#star"/></svg>`).join('');
  $('result-stars').setAttribute('aria-label',`获得 ${stars} 星，共 3 星`);
  $('result-height').textContent=`${getHeightMeters(state)} m`;$('result-clean').textContent=`${state.cleanPct.toFixed(1)}%`;
  $('result-residents').textContent=`${residents} / 4`;$('result-time').textContent=fmt(state.elapsed);
  $('result-save').textContent=`安全救援 ${state.rescues} 次 · ${saved.saved?'个人最佳已保存在当前浏览器':'浏览器未允许保存，仍可下载海报留念'}`;
  $('result-achievement').textContent=state.secret.unlocked?`★ 本局发现：${secretWindow.achievement}`:secretCollected?`★ 已收藏：${secretWindow.achievement}`:'◇ 隐藏成就仍在某扇脏窗后等你';
  showResultTimer=window.setTimeout(()=>setHidden('reveal-caption',false),matchMedia('(prefers-reduced-motion: reduce)').matches?400:4000);
  announce(`登顶成功，获得 ${stars} 星。实际洁净度 ${state.cleanPct.toFixed(1)}%。`);
}
function handle(events:GameEvent[]){
  for(const event of events){
    if(event.type==='achievement'){discoverSecret();continue;}
    if(event.type==='win'){finish();continue;}
    if(event.message)toast(event.message,event.type==='resident'?5500:2500);
    if(event.type!=='mud')audio.chime(event.type);
    if(event.type==='rescue'){controls.clear();accumulator=0;}
  }
}
function manualRescue(){if(mode!=='playing')return;controls.clear();handle([rescue(state)]);audio.spray(false);updateHud();canvas.focus({preventScroll:true});}
function updateHud(){
  // Altitude is current position; the saved high-water mark remains in the result.
  const altitude=Math.max(0,Math.round((2788-state.player.y)/20));
  $('height').textContent=String(altitude);$('height-fill').style.width=`${Math.min(100,altitude/133*100)}%`;$('ruler-player').style.bottom=`${Math.min(100,altitude/133*100)}%`;
  const water=Math.max(0,Math.ceil(state.player.water));$('water-value').textContent=`${water}%`;$('water-fill').style.width=`${water}%`;
  $('water-note').textContent=state.refilling?'补水中… 站稳稍等片刻':water<20?'水量偏低，找黄色平台落脚':'落在黄色平台，自动补水';
  document.querySelector('.water-card')?.classList.toggle('low',water<20);document.querySelector('.water-card')?.classList.toggle('refilling',state.refilling);
  $('clean-value').textContent=`${state.cleanPct.toFixed(1)}%`;
  const district=[...districts].reverse().find(d=>state.highest>=d.minHeight)!;$('stage-name').textContent=district.name;
  const residentIcons=['猫','厨','游','花'];$('residents').querySelectorAll('b').forEach((el,i)=>{const found=state.residents[i].unlocked;el.textContent=found?residentIcons[i]:'?';el.classList.toggle('found',found);el.title=found?`${state.residents[i].name}：${state.residents[i].line}`:'尚未发现，试着洗亮特殊窗户';});
  if(!hintDismissed&&state.highest>120&&milestone===0){milestone=1;$('hint-title').textContent='飞起来了！斜着喷，试试横移';$('hint-body').textContent='水向左下喷，角色向右上飞 · 靠近黄色平台时松手落脚';}
  if(!hintDismissed&&state.checkpoint.platformId!=='start'&&milestone===1){milestone=2;$('hint-title').textContent='补给到位，继续向上';$('hint-body').textContent='飞行时顺手洗亮窗户，看看里面住着谁';}
  if(state.elapsed>35&&!hintDismissed){hintDismissed=true;setHidden('in-game-hint',true);}
}

$('start-button').addEventListener('click',start);
$('pause-button').addEventListener('click',()=>pause());$('resume-button').addEventListener('click',resume);
$('restart-button').addEventListener('click',start);$('replay-button').addEventListener('click',start);
$('rescue-button').addEventListener('click',manualRescue);$('rescue-touch').addEventListener('click',manualRescue);
$('dismiss-hint').addEventListener('click',()=>{hintDismissed=true;setHidden('in-game-hint',true);});
$('help-button').addEventListener('click',()=>{resumeAfterHelp=mode==='playing';if(resumeAfterHelp)pause(false);help.showModal();});
help.addEventListener('close',()=>{if(resumeAfterHelp){resumeAfterHelp=false;resume();}});
help.querySelectorAll('.close-dialog,.close-help').forEach(el=>el.addEventListener('click',()=>help.close()));
results.querySelector('.close-dialog')!.addEventListener('click',()=>results.close());
pauseDialog.addEventListener('cancel',e=>{e.preventDefault();resume();});
$('show-results').addEventListener('click',()=>results.showModal());
async function toggleAudio(){const enabled=await audio.toggle();$('audio-button').setAttribute('aria-pressed',String(enabled));$('audio-button').setAttribute('aria-label',enabled?'关闭音效':'开启音效');$('audio-button').innerHTML=`<svg><use href="#${enabled?'sound':'mute'}"/></svg>`;}
$('audio-button').addEventListener('click',toggleAudio);
$('poster-button').addEventListener('click',async()=>{
  const button=$<HTMLButtonElement>('poster-button');button.disabled=true;const old=button.innerHTML;button.textContent='正在生成飞行海报…';
  try{const blob=await renderer.poster(state);if(!blob)throw new Error('生成失败');const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='我靠洗地飞起来了-飞行纪念.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);button.textContent='海报已生成，再存一张';}
  catch{button.textContent='暂时没生成成功，点击重试';}
  finally{button.disabled=false;setTimeout(()=>{button.innerHTML=old;},3500);}
});
window.addEventListener('keydown',e=>{
  if(e.repeat||/INPUT|TEXTAREA/.test((e.target as HTMLElement)?.tagName||''))return;
  if(e.key.toLowerCase()==='m'){void toggleAudio();return;}
  if(e.key==='Escape'||e.key.toLowerCase()==='p'){
    if(help.open||results.open)return;
    e.preventDefault();if(mode==='playing')pause();else if(mode==='paused')resume();
  }
  if(e.key.toLowerCase()==='r'&&mode==='playing'){pause();$('pause-heading').textContent='要从头再飞一次吗？';}
});
window.addEventListener('blur',()=>{if(mode==='playing')pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='playing')pause();});
function frame(now:number){
  const dt=Math.min(Math.max((now-last)/1000,0),.1);last=now;
  if(mode==='playing'){
    accumulator+=dt;
    const input=controls.sample(state);
    while(accumulator>=FIXED_DT&&mode==='playing'){accumulator-=FIXED_DT;handle(stepGame(state,input,FIXED_DT));}
    audio.spray(state.spraying);
    if(now-lastHud>100){updateHud();lastHud=now;}
  }else{audio.spray(false);accumulator=0;}
  renderer.draw(state,mode,dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Read-only development observations support real-input browser validation.
// Vite removes this entire branch from production builds; no state mutation hook exists.
if(import.meta.env.DEV){
  Object.defineProperty(window,'__FLY_DEBUG__',{value:Object.freeze({
    snapshot:()=>({mode,player:{...state.player},elapsed:state.elapsed,cleanPct:state.cleanPct,checkpoint:{...state.checkpoint},rescues:state.rescues,status:state.status,highest:state.highest,secret:{...state.secret},residents:state.residents.map(r=>({id:r.id,unlocked:r.unlocked})),screen:renderer.worldToScreen(state.player.x,state.player.y)}),
    toScreen:(x:number,y:number)=>renderer.worldToScreen(x,y),
  }),configurable:false,writable:false});
}
