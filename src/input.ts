import type { GameState, Input } from './core.ts';

export class Controls {
  private keys = new Set<string>();
  private pointer = { x: 0, y: 0, down: false, seen: false };
  private stick = { x: 0, y: 1, down: false };
  private resetStick:()=>void=()=>{};
  private captures=new Map<HTMLElement,number>();
  active = false;
  aim = { x: 0, y: 1 };
  constructor(canvas: HTMLCanvasElement, joystick: HTMLElement, private toWorld: (x: number, y: number) => {x:number,y:number}) {
    const knob = joystick.querySelector<HTMLElement>('.joystick-knob')!;
    canvas.addEventListener('pointerdown', e => {
      if (!this.active || e.button !== 0) return;
      e.preventDefault(); canvas.setPointerCapture(e.pointerId);this.captures.set(canvas,e.pointerId);
      this.pointer = { x: e.clientX, y: e.clientY, down: true, seen: true };
    });
    canvas.addEventListener('pointermove', e => { this.pointer.x = e.clientX; this.pointer.y = e.clientY; this.pointer.seen = true; });
    const stopPointer = () => { this.pointer.down = false;this.captures.delete(canvas); };
    canvas.addEventListener('pointerup', stopPointer); canvas.addEventListener('pointercancel', stopPointer); canvas.addEventListener('lostpointercapture', stopPointer);
    const moveStick = (e: PointerEvent) => {
      const b = joystick.getBoundingClientRect(), dx = e.clientX - b.left - b.width / 2, dy = e.clientY - b.top - b.height / 2;
      const length = Math.hypot(dx, dy), radius = b.width * .31;
      this.stick = { x: length > 6 ? dx / length : 0, y: length > 6 ? dy / length : 1, down: length > 8 };
      const scale = Math.min(radius, length) / (length || 1);
      knob.style.transform = `translate(${dx * scale}px,${dy * scale}px)`;
      joystick.classList.toggle('engaged', this.stick.down);
    };
    joystick.addEventListener('pointerdown', e => { if (!this.active) return; e.preventDefault(); joystick.setPointerCapture(e.pointerId);this.captures.set(joystick,e.pointerId);moveStick(e); });
    joystick.addEventListener('pointermove', e => { if (joystick.hasPointerCapture(e.pointerId) && this.active) { e.preventDefault(); moveStick(e); } });
    const stopStick = () => { this.stick.down = false; knob.style.transform = ''; joystick.classList.remove('engaged');this.captures.delete(joystick); };
    this.resetStick=stopStick;
    joystick.addEventListener('pointerup', stopStick); joystick.addEventListener('pointercancel', stopStick); joystick.addEventListener('lostpointercapture', stopStick);
    window.addEventListener('keydown', e => {
      if (!this.active || /^(INPUT|TEXTAREA|BUTTON|A)$/.test((e.target as HTMLElement)?.tagName || '')) return;
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) { e.preventDefault(); this.keys.add(e.key); }
    });
    window.addEventListener('keyup', e => this.keys.delete(e.key));
  }
  sample(state: GameState): Input {
    if (!this.active) return { dx: this.aim.x, dy: this.aim.y, spraying: false };
    const dx = Number(this.keys.has('ArrowRight')) - Number(this.keys.has('ArrowLeft'));
    const dy = Number(this.keys.has('ArrowDown')) - Number(this.keys.has('ArrowUp'));
    if (dx || dy) { const d = Math.hypot(dx, dy); this.aim = { x: dx / d, y: dy / d }; }
    else if (this.stick.down) this.aim = { x: this.stick.x, y: this.stick.y };
    else if (this.pointer.seen && !this.keys.has(' ')) {
      const point = this.toWorld(this.pointer.x, this.pointer.y);
      const px = point.x - state.player.x, py = point.y - state.player.y, d = Math.hypot(px, py);
      if (d > 12) this.aim = { x: px / d, y: py / d };
    }
    return { dx: this.aim.x, dy: this.aim.y, spraying: this.pointer.down || this.stick.down || this.keys.has(' ') };
  }
  clear() { this.keys.clear();this.pointer.down=false;this.stick.down=false;for(const [element,id] of this.captures){if(element.hasPointerCapture(id))element.releasePointerCapture(id);}this.captures.clear();this.resetStick(); }
}
