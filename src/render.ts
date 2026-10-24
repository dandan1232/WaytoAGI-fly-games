import type { GameState, Resident } from './core.ts';
import { getHeightMeters, getResidentCount, scoreStars } from './core.ts';
import { BUILDING, platforms, obstacles, WORLD_HEIGHT } from './level.ts';

type ViewMode = 'title' | 'playing' | 'paused' | 'victory';
type Particle = { x:number; y:number; vx:number; vy:number; life:number; max:number; r:number };
const INK = '#203c4b';
const YELLOW = '#ffda00';
const hash = (n: number) => { const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
function rounded(c:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number,fill:string,stroke?:string,line=2){c.beginPath();c.roundRect(x,y,w,h,r);c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=line;c.stroke();}}
function ellipse(c:CanvasRenderingContext2D,x:number,y:number,rx:number,ry:number,fill:string,stroke?:string){c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=2;c.stroke();}}
function path(c:CanvasRenderingContext2D,points:number[][],fill:string|CanvasGradient,stroke?:string,line=2){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=line;c.stroke();}}
function line(c:CanvasRenderingContext2D,x:number,y:number,xx:number,yy:number,color=INK,width=2){c.beginPath();c.moveTo(x,y);c.lineTo(xx,yy);c.strokeStyle=color;c.lineWidth=width;c.stroke();}
function text(c:CanvasRenderingContext2D,value:string,x:number,y:number,size=12,color=INK,weight=600,align:CanvasTextAlign='left'){c.fillStyle=color;c.font=`${weight} ${size}px "Microsoft YaHei", "Segoe UI", sans-serif`;c.textAlign=align;c.fillText(value,x,y);}
function star(c:CanvasRenderingContext2D,x:number,y:number,size:number,color:string){c.save();c.translate(x,y);path(c,[[0,-size],[size*.3,-size*.3],[size,0],[size*.3,size*.3],[0,size],[-size*.3,size*.3],[-size,0],[-size*.3,-size*.3]],color);c.restore();}

export class Renderer {
  private c: CanvasRenderingContext2D;
  private width = 1; private height = 1; private dpr = 1;
  private cameraY = 2550; private cameraX = 450; private scale = 1; private centerX = 450;
  private particles:Particle[] = [];
  private time = 0; private wonAt = 0; private previousMode:ViewMode = 'title';
  private reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  constructor(private canvas:HTMLCanvasElement){
    const context=canvas.getContext('2d');if(!context)throw new Error('浏览器不支持 Canvas 2D');this.c=context;
    new ResizeObserver(()=>this.resize()).observe(canvas);this.resize();
  }
  resize(){const b=this.canvas.getBoundingClientRect();this.width=b.width;this.height=b.height;this.dpr=Math.min(devicePixelRatio||1,2);this.canvas.width=Math.round(b.width*this.dpr);this.canvas.height=Math.round(b.height*this.dpr);}
  screenToWorld(x:number,y:number){const b=this.canvas.getBoundingClientRect();return{x:(x-b.left-this.centerX)/this.scale+this.cameraX,y:(y-b.top-this.height/2)/this.scale+this.cameraY};}
  worldToScreen(x:number,y:number){return{x:(x-this.cameraX)*this.scale+this.centerX,y:(y-this.cameraY)*this.scale+this.height/2};}
  reset(){this.wonAt=0;this.previousMode='title';this.particles=[];this.cameraY=2550;}
  draw(state:GameState,mode:ViewMode,dt:number){
    this.time+=dt;
    if(mode==='victory'&&this.previousMode!=='victory')this.wonAt=this.time;
    this.previousMode=mode;
    const mobile=this.width<600;
    let zoom=mobile?Math.max(.48,this.width/780):Math.min(1.06,(this.width-190)/940);
    let cameraY=state.player.y-this.height*.08/zoom, centerX=this.width/2+(mobile?20:30);
    if(mode==='title'){zoom=mobile?.65:Math.min(1.08,this.height/650);centerX=this.width*(mobile?.98:.72);cameraY=state.player.y-this.height*.24/zoom;}
    let reveal=0;
    if(mode==='victory'){
      const t=Math.min(1,(this.time-this.wonAt)/(this.reduced?.2:3.2)),ease=1-(1-t)**3;
      zoom=zoom+(Math.min((this.height-(mobile?220:75))/3000,(this.width-100)/900)-zoom)*ease;
      cameraY=state.player.y+(1490-state.player.y)*ease;
      centerX=this.width/2+(mobile?0:-this.width*.12)*ease;
      reveal=Math.min(1,Math.max(0,(this.time-this.wonAt-3.6)/2.2));
    }
    const follow=mode==='title'||mode==='victory'?1:1-Math.exp(-dt*8);
    this.scale+=(zoom-this.scale)*follow;this.cameraY+=(cameraY-this.cameraY)*follow;this.centerX=centerX;
    const c=this.c;c.setTransform(this.dpr,0,0,this.dpr,0,0);c.clearRect(0,0,this.width,this.height);
    this.sky(c,state,mode);
    c.save();c.translate(this.centerX,this.height/2);c.scale(this.scale,this.scale);c.translate(-this.cameraX,-this.cameraY);
    const top=this.cameraY-this.height/2/this.scale-160,bottom=this.cameraY+this.height/2/this.scale+160;
    this.building(c,state,top,bottom,reveal);
    this.effects(c,state,mode,dt);
    this.player(c,state,mode);
    if(mode==='playing'&&state.elapsed<9){
      c.save();c.setLineDash([4,5]);line(c,state.player.x,state.player.y+40,state.player.x,state.player.y+125,'#3d899f',2);c.setLineDash([]);path(c,[[state.player.x-8,state.player.y+113],[state.player.x+8,state.player.y+113],[state.player.x,state.player.y+127]],'#3d899f');text(c,'朝这里喷水',state.player.x+16,state.player.y+90,12,'#386b7c');c.restore();
    }
    c.restore();
    if(mode==='title'){
      const fade=c.createLinearGradient(0,0,this.width*(mobile?.72:.52),0);fade.addColorStop(0,'#d9eef3');fade.addColorStop(.6,'#d9eef3f0');fade.addColorStop(1,'#d9eef300');c.fillStyle=fade;c.fillRect(0,0,this.width,this.height);
    }
  }
  private sky(c:CanvasRenderingContext2D,state:GameState,mode:ViewMode){
    const gradient=c.createLinearGradient(0,0,0,this.height);gradient.addColorStop(0,'#d9eef3');gradient.addColorStop(1,'#eef3e9');c.fillStyle=gradient;c.fillRect(0,0,this.width,this.height);
    ellipse(c,this.width*.86,110,46,46,'#fff1a9');
    for(let i=0;i<8;i++){
      const parallax=(state.highest*.12)%450;const x=hash(i+7)*this.width,y=((hash(i+81)*this.height+parallax+this.time*(this.reduced?0:1.5))%(this.height+160))-80;
      const s=32+hash(i+15)*38;c.save();c.globalAlpha=.75;ellipse(c,x,y,s*1.5,s*.38,'#fffdf3');ellipse(c,x-s*.4,y-s*.25,s*.65,s*.57,'#fffdf3');ellipse(c,x+s*.4,y-s*.34,s*.76,s*.66,'#fffdf3');c.restore();
    }
    const ground=this.worldToScreen(0,2860).y;
    if(ground<this.height+220){
      for(let layer=0;layer<2;layer++)for(let i=0;i<14;i++){
        const w=52+hash(i+13)*50,h=70+hash(i+5)*150,x=(i*105+layer*32)%Math.max(this.width+100,300)-40,y=ground-h*(layer?1:.7);
        rounded(c,x,y,w,h+300,3,layer?'#b9d3ce':'#cadaD4');
        if(layer)for(let r=0;r<5;r++)for(let col=0;col<3;col++)rounded(c,x+12+col*21,y+15+r*25,8,11,1,'#d9e8de');
      }
      c.fillStyle='#aec9b8';c.fillRect(0,ground+10,this.width,this.height-ground);c.fillStyle='#839f90';c.fillRect(0,ground+32,this.width,6);
    }
    if(mode!=='victory'){
      c.save();c.globalAlpha=.14;for(let i=0;i<70;i++){const x=hash(i+66)*this.width,y=hash(i+33)*this.height;c.fillStyle=INK;c.fillRect(x,y,1,1);}c.restore();
    }
  }
  private building(c:CanvasRenderingContext2D,state:GameState,top:number,bottom:number,reveal:number){
    const b=BUILDING;
    // Side face, cap and the cream main facade.
    path(c,[[b.x+b.w,b.y+12],[b.x+b.w+43,b.y+35],[b.x+b.w+43,b.y+b.h],[b.x+b.w,b.y+b.h]],'#a6b9a3',INK,3);
    rounded(c,b.x,b.y,b.w,b.h,3,'#f4e8c9',INK,3);
    c.save();c.beginPath();c.rect(b.x+3,b.y+3,b.w-6,b.h-6);c.clip();
    for(let row=0;row<23;row++){
      const y=b.y+row*125;
      if(y+125<top||y>bottom)continue;
      c.fillStyle=row%2?'#eee2c3':'#f6ebd2';c.fillRect(b.x+3,y,b.w-6,125);
      line(c,b.x,y+124,b.x+b.w,y+124,'#d4cbb5',2);
      for(let j=0;j<6;j++){const x=b.x+25+j*85+(row%2?35:0);line(c,x,y+87,x+45,y+87,'#dccfb5',1);line(c,x+22,y+87,x+22,y+98,'#dccfb5',1);}
    }
    this.mural(c);
    for(let y=330;y<2700;y+=210){
      if(y+140<top||y>bottom)continue;
      for(let col=0;col<3;col++)this.window(c,235+col*155,y,98,115,Math.floor(y/210)+col);
    }
    // Special residents get their own recognizable frame.
    state.residents.forEach(r=>{if(r.y+r.h<top||r.y>bottom)return;this.window(c,r.x,r.y,r.w,r.h,1);this.resident(c,r,reveal);});
    // Actual dirt cells: reveal is a purely visual end-card transition and never updates state.
    state.dirt.forEach((cell,i)=>{
      if(cell.amount<.01||cell.y+cell.h<top||cell.y>bottom)return;
      const amount=cell.amount*(1-reveal);if(amount<.01)return;
      c.globalAlpha=amount*.78;c.fillStyle='#7c8d79';c.fillRect(cell.x,cell.y,cell.w+.35,cell.h+.35);
      if(hash(i)> .67){c.globalAlpha=amount*.22;ellipse(c,cell.x+cell.w*.5,cell.y+cell.h*.5,cell.w*.37,cell.h*.18,'#415c4a');}
      if(hash(i+218)>.83){c.globalAlpha=amount*.25;line(c,cell.x+8,cell.y+5,cell.x+7,cell.y+cell.h,'#c3b280',3);}
    });c.globalAlpha=1;
    // Exposed residents appear in front of the cleaned window interior.
    state.residents.filter(r=>r.unlocked).forEach(r=>{if(r.y+r.h>=top&&r.y<=bottom)this.resident(c,r,1);});
    c.restore();
    // Yellow drainpipe and little brackets establish the upward route.
    line(c,b.x-17,b.y+40,b.x-17,b.y+b.h-20,'#3c5956',14);line(c,b.x-17,b.y+40,b.x-17,b.y+b.h-20,'#d7bd61',9);
    for(let y=300;y<2850;y+=180){if(y<top||y>bottom)continue;line(c,b.x-28,y,b.x-7,y,'#435f5a',4);}
    for(const box of obstacles){if(box.y+box.h<top||box.y>bottom)continue;rounded(c,box.x+4,box.y+7,box.w,box.h,5,'#203c4b22');rounded(c,box.x,box.y,box.w,box.h,5,'#d6e5dc',INK,3);ellipse(c,box.x+29,box.y+27,18,18,'#a9c4b7',INK);for(let i=0;i<4;i++){const a=this.time*(this.reduced?0:.8)+i*Math.PI/2;line(c,box.x+29,box.y+27,box.x+29+Math.cos(a)*13,box.y+27+Math.sin(a)*13,'#5c7c71',4);}for(let j=0;j<4;j++)line(c,box.x+58,box.y+15+j*8,box.x+80,box.y+15+j*8,'#749489',2);}
    state.mud.forEach((m,i)=>{if(m.hp<=0||m.y+m.r<top||m.y-m.r>bottom)return;const r=m.r*(.6+.4*m.hp);c.save();c.translate(m.x,m.y);for(let j=0;j<8;j++){const a=j*Math.PI/4;ellipse(c,Math.cos(a)*r*.6,Math.sin(a)*r*.6,r*.42,r*.43,'#7e694d');}ellipse(c,0,0,r*.8,r*.8,'#8d785b',INK);ellipse(c,-8,-3,4,6,'#fffdf3');ellipse(c,8,-3,4,6,'#fffdf3');ellipse(c,-7,-2,2,3,INK);ellipse(c,7,-2,2,3,INK);line(c,-5,10,6,10,INK,2);if(i%2===0)path(c,[[-12,-r],[-5,-r-9],[2,-r],[11,-r-5],[14,-r+3]],'#ae8d60');c.restore();});
    for(const p of platforms){
      if(p.y+p.h+40<top||p.y-90>bottom)continue;
      if(p.kind==='roof'){
        rounded(c,p.x,p.y,p.w,p.h,4,'#6c9b8d',INK,3);rounded(c,p.x-9,p.y-8,p.w+18,13,3,'#dbe9cf',INK,3);
        line(c,p.x+40,p.y-10,p.x+40,p.y-106,INK,4);path(c,[[p.x+41,p.y-107],[p.x+126,p.y-88],[p.x+41,p.y-63]],YELLOW,INK,2);text(c,'FINISH',p.x+51,p.y-83,12);
        this.plant(c,p.x+p.w-58,p.y-10,.95);this.plant(c,p.x+p.w-110,p.y-10,.65);
        rounded(c,p.x+205,p.y-60,145,45,5,'#fffdf3',INK,2);text(c,'天台见！',p.x+277,p.y-30,22,INK,850,'center');
      }else{
        path(c,[[p.x+10,p.y+p.h],[p.x+35,p.y+p.h+35],[p.x+35,p.y+p.h]],'#789181',INK,2);path(c,[[p.x+p.w-10,p.y+p.h],[p.x+p.w-35,p.y+p.h+35],[p.x+p.w-35,p.y+p.h]],'#789181',INK,2);
        rounded(c,p.x,p.y,p.w,p.h,3,YELLOW,INK,3);c.save();c.beginPath();c.rect(p.x+2,p.y+p.h-7,p.w-4,5);c.clip();for(let x=p.x;x<p.x+p.w;x+=25)path(c,[[x,p.y+p.h],[x+8,p.y+p.h-8],[x+17,p.y+p.h-8],[x+9,p.y+p.h]],'#b39c20');c.restore();
        const tankX=p.x+18;rounded(c,tankX,p.y-59,32,57,7,'#a7d6d6',INK,2);rounded(c,tankX+8,p.y-65,16,9,2,INK);line(c,tankX+10,p.y-45,tankX+10,p.y-15,'#d7f2eb',4);line(c,tankX+32,p.y-18,tankX+43,p.y-18,INK,3);
        const active=state.checkpoint.platformId===p.id;rounded(c,p.x+p.w-100,p.y-31,91,24,4,active?'#fffdf3':'#f7edb1',INK,1.5);text(c,active?'✓ 安全补水点':'补水站 ↑',p.x+p.w-55,p.y-14,10,INK,750,'center');
        if(state.refilling&&active){star(c,tankX+17,p.y-80,8,YELLOW);text(c,'+ WATER',p.x+p.w/2,p.y-54,11,'#306b65',800,'center');}
      }
    }
    // The street is only drawn close to the bottom of the building.
    if(bottom>2780){rounded(c,270,2830,170,80,8,'#7aa597',INK,3);rounded(c,286,2843,66,67,3,'#527e7a',INK,2);rounded(c,360,2843,66,67,3,'#527e7a',INK,2);line(c,345,2867,345,2882,'#eae1bb',3);line(c,367,2867,367,2882,'#eae1bb',3);text(c,'城市焕新中心',355,2820,13,INK,700,'center');this.plant(c,100,2890,1.5);this.plant(c,790,2890,1.3);rounded(c,560,2845,90,60,4,'#e9a580',INK,2);text(c,'招募飞行员',605,2869,11,INK,800,'center');text(c,'无需跳跃键',605,2889,10,INK,500,'center');}
  }
  private mural(c:CanvasRenderingContext2D){
    // A single mural spans the building. Windows remain windows; the paint lives around them.
    c.save();c.globalAlpha=.75;
    c.strokeStyle='#e99b77';c.lineWidth=110;c.beginPath();c.moveTo(380,2770);c.bezierCurveTo(900,2290,140,2030,470,1590);c.bezierCurveTo(770,1190,170,950,480,350);c.stroke();
    c.strokeStyle='#e9c04d';c.lineWidth=37;c.beginPath();c.moveTo(325,2770);c.bezierCurveTo(840,2300,80,2020,410,1590);c.bezierCurveTo(710,1190,110,950,420,350);c.stroke();c.globalAlpha=1;
    for(let i=0;i<14;i++)star(c,230+hash(i+75)*420,300+i*175,12+hash(i+25)*12,i%2?'#71a6a0':'#df9e6a');
    c.save();c.translate(460,625);c.rotate(.22);path(c,[[-50,95],[-78,151],[-20,130],[0,170],[24,129],[82,151],[48,92]],'#e08a65',INK,3);path(c,[[0,-145],[-62,-37],[-57,99],[57,99],[62,-37]],YELLOW,INK,4);ellipse(c,0,-26,33,36,'#96c8cd',INK);ellipse(c,-8,-35,12,13,'#d7f0ec');path(c,[[-57,52],[-100,104],[-102,155],[-52,112]],'#d46e52',INK,3);path(c,[[57,52],[100,104],[102,155],[52,112]],'#d46e52',INK,3);c.restore();
    c.save();c.translate(448,1550);c.rotate(-.1);text(c,'向上',0,0,114,'#39716c',950,'center');text(c,'有光',0,119,114,'#39716c',950,'center');c.restore();c.restore();
  }
  private window(c:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,variant:number){
    rounded(c,x+3,y+6,w,h,3,'#203c4b22');rounded(c,x,y,w,h,3,'#537e82',INK,3);c.fillStyle=variant%3===0?'#f5d49d':'#a8d0cc';c.fillRect(x+7,y+7,w-14,h-14);
    path(c,[[x+8,y+9],[x+w*.4,y+9],[x+8,y+h*.55]],'#e6f0d9');path(c,[[x+w*.6,y+9],[x+w-8,y+9],[x+8,y+h-9],[x+8,y+h*.7]],'#c9e1d1');line(c,x+w/2,y+4,x+w/2,y+h-5,'#416c71',4);line(c,x+4,y+h*.52,x+w-4,y+h*.52,'#416c71',4);rounded(c,x-5,y+h-1,w+10,9,2,'#cfdbbf',INK,2);
    if(variant%4===0){this.plant(c,x+23,y+h-1,.42);}
  }
  private plant(c:CanvasRenderingContext2D,x:number,y:number,s:number){
    c.save();c.translate(x,y);c.scale(s,s);path(c,[[-18,-30],[18,-30],[13,0],[-13,0]],'#d58c67',INK,2);line(c,0,-29,0,-78,'#417660',3);for(let i=0;i<5;i++){const side=i%2?-1:1;c.save();c.translate(0,-38-i*9);c.rotate(side*.7);ellipse(c,side*9,-7,13,6,i%2?'#598d65':'#7caa70');c.restore();}rounded(c,-21,-34,42,9,2,'#e6a781',INK,2);c.restore();
  }
  private resident(c:CanvasRenderingContext2D,r:Resident,reveal:number){
    if(!r.unlocked&&reveal<.5)return;
    c.save();c.translate(r.x+r.w/2,r.y+r.h-7);c.beginPath();c.rect(-r.w/2+5,-r.h+11,r.w-10,r.h-8);c.clip();
    if(r.appearance==='cat'){
      ellipse(c,0,-18,30,25,'#e7ab6b',INK);path(c,[[-25,-43],[-28,-76],[-6,-56],[13,-56],[29,-76],[27,-40]],'#e7ab6b',INK,2);ellipse(c,0,-45,27,23,'#edb87d',INK);line(c,-15,-47,-6,-45,INK,2);line(c,6,-45,15,-47,INK,2);path(c,[[-4,-37],[4,-37],[0,-33]],'#b15d53');line(c,-28,-34,-10,-34,INK,1);line(c,10,-34,28,-34,INK,1);line(c,-25,-28,-9,-30,INK,1);line(c,9,-30,25,-28,INK,1);
    }else{
      const colors={chef:'#f5f1d8',gamer:'#dc916f',grandma:'#92b5a1'};rounded(c,-27,-37,54,51,17,colors[r.appearance],INK,2);ellipse(c,0,-56,22,25,'#efbc92',INK);ellipse(c,-8,-58,2,3,INK);ellipse(c,8,-58,2,3,INK);line(c,-5,-45,5,-45,'#a15f50',2);
      if(r.appearance==='chef'){rounded(c,-24,-88,48,23,8,'#fffdf3',INK,2);ellipse(c,-17,-89,13,13,'#fffdf3',INK);ellipse(c,0,-94,15,15,'#fffdf3',INK);ellipse(c,17,-89,13,13,'#fffdf3',INK);line(c,29,-28,39,-51,INK,3);ellipse(c,40,-55,13,5,'#374b4c',INK);ellipse(c,40,-56,6,3,YELLOW);}
      if(r.appearance==='gamer'){c.strokeStyle=INK;c.lineWidth=6;c.beginPath();c.arc(0,-58,25,Math.PI,0);c.stroke();rounded(c,-29,-62,9,20,4,'#567c7c',INK,2);rounded(c,20,-62,9,20,4,'#567c7c',INK,2);rounded(c,-23,-11,46,17,5,INK);ellipse(c,-13,-3,3,3,YELLOW);ellipse(c,13,-3,3,3,'#e99472');}
      if(r.appearance==='grandma'){ellipse(c,0,-78,24,11,'#d7ddd4',INK);ellipse(c,22,-81,12,12,'#d7ddd4',INK);ellipse(c,-9,-58,8,7,'#ffffff44',INK);ellipse(c,9,-58,8,7,'#ffffff44',INK);line(c,-1,-58,1,-58,INK,2);}
    }
    c.restore();if(r.unlocked){rounded(c,r.x+7,r.y-25,r.w-14,20,9,YELLOW,INK,1);text(c,r.name,r.x+r.w/2,r.y-11,9,INK,750,'center');}
  }
  private player(c:CanvasRenderingContext2D,s:GameState,mode:ViewMode){
    const p=s.player;const tilt=this.reduced?0:Math.max(-.28,Math.min(.28,p.vx/700));
    // A thin safety cord makes rescue part of the visual world.
    if(mode!=='victory'){c.save();c.globalAlpha=.35;c.strokeStyle='#547a7b';c.lineWidth=1.5;c.beginPath();c.moveTo(s.checkpoint.x,s.checkpoint.y-15);c.quadraticCurveTo((s.checkpoint.x+p.x)/2-40,Math.min(s.checkpoint.y,p.y)-90,p.x,p.y-6);c.stroke();c.restore();}
    if(p.grounded)ellipse(c,p.x,p.y+p.h/2+2,25,5,'#203c4b30');
    c.save();c.translate(p.x,p.y+4);c.rotate(tilt);c.scale(1.15,1.15);
    const kick=s.spraying?Math.sin(this.time*19)*5:0;
    // Boots / overalls / pressure tank / helmet.
    line(c,-7,7,-10-kick,18,INK,9);line(c,7,7,12+kick,18,INK,9);rounded(c,-18-kick,15,13,8,3,'#37515b',INK,2);rounded(c,7+kick,15,14,8,3,'#37515b',INK,2);
    rounded(c,-19,-19,16,28,6,YELLOW,INK,2);rounded(c,-17,-13,6,17,2,'#fff28a');rounded(c,-10,-14,25,28,7,'#50797b',INK,2);line(c,-2,-13,-2,7,YELLOW,4);rounded(c,-1,-5,14,9,2,YELLOW,INK,1);
    ellipse(c,5,-22,15,15,'#f0bd91',INK);rounded(c,2,-28,16,11,4,'#d9f1e8',INK,1.6);line(c,9,-26,7,-20,'#fff',2);
    c.beginPath();c.ellipse(4,-29,18,14,0,Math.PI,0);c.lineTo(22,-25);c.lineTo(-14,-25);c.closePath();c.fillStyle=YELLOW;c.fill();c.strokeStyle=INK;c.lineWidth=2;c.stroke();rounded(c,-17,-27,42,6,3,YELLOW,INK,2);line(c,3,-41,3,-30,'#c4a600',3);
    c.restore();
    const a=Math.atan2(s.aim.y,s.aim.x);c.save();c.translate(p.x,p.y);c.rotate(a);line(c,0,1,15,1,'#edbc8f',8);rounded(c,10,-7,24,14,3,YELLOW,INK,2);rounded(c,30,-4,18,8,2,'#3d5157',INK,2);rounded(c,13,5,7,12,2,INK);c.restore();
    if(mode==='title'){c.save();c.translate(p.x+55,p.y-80);c.rotate(-.07);rounded(c,-10,-25,137,40,8,'#fffdf3',INK,2);path(c,[[10,14],[3,27],[24,14]],'#fffdf3',INK,2);text(c,'我先飞一个？',58,0,14,INK,800,'center');c.restore();}
  }
  private effects(c:CanvasRenderingContext2D,s:GameState,mode:ViewMode,dt:number){
    if(s.spraying&&mode==='playing'){
      const p=s.player,dx=s.aim.x,dy=s.aim.y,ox=p.x+dx*45,oy=p.y+dy*45,ex=s.beamEnd.x,ey=s.beamEnd.y;
      const perpendicular={x:-dy,y:dx};
      const gradient=c.createLinearGradient(ox,oy,ex,ey);gradient.addColorStop(0,'#d8faffd9');gradient.addColorStop(1,'#80cdd640');path(c,[[ox+perpendicular.x*3,oy+perpendicular.y*3],[ex+perpendicular.x*25,ey+perpendicular.y*25],[ex-perpendicular.x*25,ey-perpendicular.y*25],[ox-perpendicular.x*3,oy-perpendicular.y*3]],gradient);
      for(let j=0;j<5;j++){const offset=(j-2)*6;line(c,ox+perpendicular.x*j,oy+perpendicular.y*j,ex+perpendicular.x*offset,ey+perpendicular.y*offset,j%2?'#eaffffba':'#76c7dbb0',1.5);}
      if(!this.reduced)for(let i=0;i<3;i++)this.particles.push({x:ex+(Math.random()-.5)*35,y:ey+(Math.random()-.5)*35,vx:(Math.random()-.5)*190,vy:-Math.random()*120,life:.35+Math.random()*.25,max:.6,r:2+Math.random()*3});
    }
    if(mode==='playing'){this.particles=this.particles.filter(p=>p.life>0);for(const p of this.particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=260*dt;c.globalAlpha=Math.max(0,p.life/p.max);ellipse(c,p.x,p.y,p.r,p.r*1.4,'#c7f0ef');}c.globalAlpha=1;}
    if(mode==='victory'&&!this.reduced){for(let i=0;i<20;i++){const x=180+hash(i+4)*570,y=60+((hash(i)*2900+this.time*40)%2850);star(c,x,y,4+hash(i+5)*8,i%2?YELLOW:'#f3aa81');}}
  }
  async poster(s:GameState):Promise<Blob|null>{
    const canvas=document.createElement('canvas');canvas.width=900;canvas.height=1200;const c=canvas.getContext('2d')!;
    c.fillStyle='#d9eef3';c.fillRect(0,0,900,1200);text(c,'KÄRCHER  /  清洁飞行队',60,65,21,INK,900);line(c,60,84,205,84,YELLOW,8);
    text(c,'这次，我真的上天了。',450,148,42,INK,900,'center');text(c,'CLEAN A LITTLE. FLY A LITTLE HIGHER.',450,187,12,'#607d86',600,'center');
    c.save();c.translate(244,220);c.scale(.42,.24);this.building(c,s,0,WORLD_HEIGHT,1);this.player(c,s,'victory');c.restore();
    rounded(c,76,949,748,157,12,'#fffdf3',INK,3);const values=[`${getHeightMeters(s)}m`,`${s.cleanPct.toFixed(1)}%`,`${getResidentCount(s)}/4`,`${Math.floor(s.elapsed/60)}:${String(Math.floor(s.elapsed%60)).padStart(2,'0')}`];const labels=['到达高度','实际洁净度','发现住户','飞行用时'];values.forEach((v,i)=>{text(c,v,165+i*190,1005,31,INK,750,'center');text(c,labels[i],165+i*190,1036,12,'#607d86',500,'center');});text(c,`飞行评级 ${'★'.repeat(scoreStars(s))}${'☆'.repeat(3-scoreStars(s))} · 安全救援 ${s.rescues} 次`,450,1080,13,INK,600,'center');
    text(c,'清洁一平方米，向上多一米。',450,1149,16,INK,700,'center');text(c,'品牌创意游戏 · 幻想设定，非真实产品能力',450,1180,10,'#607d86',400,'center');
    return new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  }
}
