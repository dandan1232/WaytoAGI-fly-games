import { BUILDING, WORLD_HEIGHT, WORLD_WIDTH, platforms, obstacles, residentDefs, mudDefs, secretWindow } from './level.ts';
import type { Rect, ResidentDef, Platform } from './level.ts';

export const FIXED_DT = 1 / 120;
export const MAX_WATER = 100;
export const BEAM_LENGTH = 250;
export const PHYSICS = {
  gravity: 650,
  thrust: 1420,
  horizontalDrag: 2.6,
  verticalDrag: 0.45,
  maxHorizontalSpeed: 340,
  maxUpSpeed: 430,
  maxDownSpeed: 480,
  // A tank can clear one 420px ascent with steering margin, but not skip two stops.
  waterPerSecond: 54,
  refillPerSecond: 55,
  cleanPerSecond: 2.7,
  beamHalfWidth: 29,
} as const;

export interface Input { dx: number; dy: number; spraying: boolean }
export interface Player {
  x: number; y: number; vx: number; vy: number;
  w: number; h: number; water: number; grounded: boolean;
}
export interface DirtCell extends Rect { amount: number }
export interface Resident extends ResidentDef { unlocked: boolean; cleanPct: number }
export interface Mud { x: number; y: number; r: number; hp: number }
export interface GameEvent {
  type: 'resident' | 'rescue' | 'checkpoint' | 'win' | 'mud' | 'achievement' | 'fail';
  id?: string;
  message?: string;
}
export interface GameState {
  player: Player;
  dirt: DirtCell[];
  residents: Resident[];
  secret: { unlocked: boolean; cleanPct: number };
  mud: Mud[];
  elapsed: number;
  cleanPct: number;
  highest: number;
  checkpoint: { x: number; y: number; platformId: string };
  rescues: number;
  status: 'playing' | 'won' | 'lost';
  spraying: boolean;
  aim: { x: number; y: number };
  beamEnd: { x: number; y: number };
  refilling: boolean;
}

const START = platforms[0];
const PLAYER_W = 30;
const PLAYER_H = 44;
const START_X = START.x + START.w / 2;
const START_Y = START.y - PLAYER_H / 2;
const CELL = 26;
const EPS = 0.001;

export function createGame(): GameState {
  const dirt: DirtCell[] = [];
  for (let y = BUILDING.y + 40; y < BUILDING.y + BUILDING.h - 24; y += CELL) {
    for (let x = BUILDING.x + 12; x < BUILDING.x + BUILDING.w - 12; x += CELL) {
      const w = Math.min(CELL, BUILDING.x + BUILDING.w - 12 - x);
      const h = Math.min(CELL, BUILDING.y + BUILDING.h - 24 - y);
      dirt.push({ x, y, w, h, amount: 1 });
    }
  }
  return {
    player: { x: START_X, y: START_Y, vx: 0, vy: 0, w: PLAYER_W, h: PLAYER_H, water: MAX_WATER, grounded: true },
    dirt,
    residents: residentDefs.map((r) => ({ ...r, unlocked: false, cleanPct: 0 })),
    secret: { unlocked: false, cleanPct: 0 },
    mud: mudDefs.map((m) => ({ ...m })),
    elapsed: 0, cleanPct: 0, highest: 0,
    checkpoint: { x: START_X, y: START_Y, platformId: START.id },
    rescues: 0, status: 'playing', spraying: false,
    aim: { x: 0, y: 1 }, beamEnd: { x: START_X, y: START_Y + BEAM_LENGTH }, refilling: false,
  };
}

function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)); }
function overlaps(p: Player, rect: Rect) {
  return p.x + p.w / 2 > rect.x + EPS && p.x - p.w / 2 < rect.x + rect.w - EPS &&
    p.y + p.h / 2 > rect.y + EPS && p.y - p.h / 2 < rect.y + rect.h - EPS;
}

/** Distance along a ray until it enters a rectangle, or Infinity if it misses. */
function rayRect(x: number, y: number, dx: number, dy: number, rect: Rect): number {
  let near = 0;
  let far = BEAM_LENGTH;
  for (const [pos, dir, lo, hi] of [[x, dx, rect.x, rect.x + rect.w], [y, dy, rect.y, rect.y + rect.h]]) {
    if (Math.abs(dir) < EPS) { if (pos < lo || pos > hi) return Infinity; }
    else {
      const a = (lo - pos) / dir;
      const b = (hi - pos) / dir;
      near = Math.max(near, Math.min(a, b));
      far = Math.min(far, Math.max(a, b));
      if (near > far) return Infinity;
    }
  }
  return near;
}

/** Squared distance to a finite segment, without allocations. */
function distanceToBeam(px: number, py: number, x: number, y: number, dx: number, dy: number, length: number): number {
  const t = clamp((px - x) * dx + (py - y) * dy, 0, length);
  const a = px - (x + dx * t);
  const b = py - (y + dy * t);
  return a * a + b * b;
}

function clean(state: GameState, dt: number, events: GameEvent[]) {
  const p = state.player;
  const { x: dx, y: dy } = state.aim;
  // The beam starts near the hands, but never teleports through a solid AC box.
  const ox = p.x + dx * 16;
  const oy = p.y + dy * 16;
  let length = BEAM_LENGTH;
  for (const box of obstacles) length = Math.min(length, rayRect(ox, oy, dx, dy, box));
  state.beamEnd.x = ox + dx * length;
  state.beamEnd.y = oy + dy * length;
  let removed = 0;
  const reach = PHYSICS.beamHalfWidth;
  const reachSquared = reach * reach;
  for (const cell of state.dirt) {
    if (cell.amount <= 0) continue;
    const cx = cell.x + cell.w / 2;
    const cy = cell.y + cell.h / 2;
    // The projection bound keeps a broad spray from leaking past an occluder.
    const along = (cx - ox) * dx + (cy - oy) * dy;
    if (along < -reach / 2 || along > length + EPS) continue;
    const d2 = distanceToBeam(cx, cy, ox, oy, dx, dy, length);
    if (d2 > reachSquared) continue;
    const strength = 1 - 0.45 * Math.sqrt(d2) / reach;
    const amount = Math.min(cell.amount, PHYSICS.cleanPerSecond * strength * dt);
    cell.amount -= amount;
    removed += amount;
  }
  if (removed > 0) {
    // Sum measured remaining dirt, rather than accumulating rounding error in score.
    const remaining = state.dirt.reduce((sum, cell) => sum + cell.amount, 0);
    state.cleanPct = clamp((1 - remaining / state.dirt.length) * 100, 0, 100);
    for (const resident of state.residents) {
      if (resident.unlocked) continue;
      let total = 0;
      let grime = 0;
      for (const cell of state.dirt) {
        const cx = cell.x + cell.w / 2;
        const cy = cell.y + cell.h / 2;
        if (cx >= resident.x && cx <= resident.x + resident.w && cy >= resident.y && cy <= resident.y + resident.h) {
          total++;
          grime += cell.amount;
        }
      }
      resident.cleanPct = total ? clamp((1 - grime / total) * 100, 0, 100) : 0;
      if (resident.cleanPct >= 60) {
        resident.unlocked = true;
        events.push({ type: 'resident', id: resident.id, message: `${resident.name}：${resident.line}` });
      }
    }
    if (!state.secret.unlocked) {
      let total = 0, grime = 0;
      for (const cell of state.dirt) {
        const cx = cell.x + cell.w / 2, cy = cell.y + cell.h / 2;
        if (cx >= secretWindow.x && cx <= secretWindow.x + secretWindow.w && cy >= secretWindow.y && cy <= secretWindow.y + secretWindow.h) {
          total++; grime += cell.amount;
        }
      }
      state.secret.cleanPct = total ? clamp((1 - grime / total) * 100, 0, 100) : 0;
      if (state.secret.cleanPct >= secretWindow.threshold) {
        state.secret.unlocked = true;
        events.push({ type: 'achievement', id: secretWindow.id });
      }
    }
  }
  for (let i = 0; i < state.mud.length; i++) {
    const mud = state.mud[i];
    if (mud.hp <= 0) continue;
    const along = (mud.x - ox) * dx + (mud.y - oy) * dy;
    if (along < 0 || along > length) continue;
    if (distanceToBeam(mud.x, mud.y, ox, oy, dx, dy, length) <= (mud.r + reach) ** 2) {
      mud.hp = Math.max(0, mud.hp - 2.2 * dt);
      if (mud.hp === 0) events.push({ type: 'mud', id: `mud-${i}`, message: '泥团退散！' });
    }
  }
}

function landedOn(state: GameState, platform: Platform, dt: number, events: GameEvent[]) {
  const p = state.player;
  if (platform.kind === 'roof') {
    state.status = 'won';
    state.spraying = false;
    p.vx = 0;
    events.push({ type: 'win', message: '到顶了！整座楼都在为你发光。' });
    return;
  }
  if (platform.kind !== 'refill' || state.spraying) return;
  if (p.water < MAX_WATER) {
    state.refilling = true;
    p.water = Math.min(MAX_WATER, p.water + PHYSICS.refillPerSecond * dt);
  }
  const checkpointY = platform.y - p.h / 2;
  if (checkpointY < state.checkpoint.y - EPS) {
    state.checkpoint = { x: platform.x + platform.w / 2, y: checkpointY, platformId: platform.id };
    events.push({ type: 'checkpoint', id: platform.id, message: '补水站抵达 · 安全绳已向上固定' });
  }
}

/** Rescue preserves all cleaning, discoveries and time; the highest checkpoint never moves down. */
export function rescue(state: GameState): GameEvent {
  if (state.status === 'won') return { type: 'rescue', message: '已经登顶，无需救援。' };
  if (state.status === 'lost') return { type: 'rescue', message: '本次飞行已结束，请重新起飞。' };
  const p = state.player;
  p.x = state.checkpoint.x;
  p.y = state.checkpoint.y;
  p.vx = 0;
  p.vy = 0;
  p.water = MAX_WATER;
  p.grounded = true;
  state.spraying = false;
  state.refilling = false;
  state.rescues++;
  return { type: 'rescue', message: '安全绳接住你了，补满水再飞！' };
}

/** Mutates one state using bounded substeps. Pausing is implemented by not calling this function. */
export function stepGame(state: GameState, input: Input, delta: number): GameEvent[] {
  const events: GameEvent[] = [];
  if (state.status !== 'playing' || !Number.isFinite(delta) || delta <= 0) return events;
  const duration = Math.min(delta, 0.1);
  const steps = Math.ceil(duration / FIXED_DT);
  const dt = duration / steps;
  for (let n = 0; n < steps && state.status === 'playing'; n++) {
    const p = state.player;
    state.elapsed += dt;
    state.refilling = false;
    const length = Math.hypot(input.dx, input.dy);
    if (Number.isFinite(length) && length > EPS) {
      state.aim.x = input.dx / length;
      state.aim.y = input.dy / length;
    }
    state.spraying = Boolean(input.spraying && p.water > EPS && Number.isFinite(length) && length > EPS);
    // A nearly empty tank supplies only its remaining fraction of a substep.
    const poweredDt = state.spraying ? Math.min(dt, p.water / PHYSICS.waterPerSecond) : 0;
    if (poweredDt > 0) {
      p.vx -= state.aim.x * PHYSICS.thrust * poweredDt;
      p.vy -= state.aim.y * PHYSICS.thrust * poweredDt;
      p.water = Math.max(0, p.water - PHYSICS.waterPerSecond * poweredDt);
      clean(state, poweredDt, events);
    }
    p.vy += PHYSICS.gravity * dt;
    p.vx *= Math.exp(-PHYSICS.horizontalDrag * dt);
    p.vy *= Math.exp(-PHYSICS.verticalDrag * dt);
    if (p.grounded && !state.spraying) p.vx *= Math.exp(-12 * dt);
    p.vx = clamp(p.vx, -PHYSICS.maxHorizontalSpeed, PHYSICS.maxHorizontalSpeed);
    p.vy = clamp(p.vy, -PHYSICS.maxUpSpeed, PHYSICS.maxDownSpeed);
    p.x += p.vx * dt;
    for (const box of obstacles) {
      if (!overlaps(p, box)) continue;
      if (p.vx > 0) p.x = box.x - p.w / 2;
      else if (p.vx < 0) p.x = box.x + box.w + p.w / 2;
      p.vx = 0;
    }
    // World edges are soft arena bounds, rather than instant deaths.
    if (p.x < p.w / 2 + 15) { p.x = p.w / 2 + 15; p.vx = Math.max(0, p.vx); }
    if (p.x > WORLD_WIDTH - p.w / 2 - 15) { p.x = WORLD_WIDTH - p.w / 2 - 15; p.vx = Math.min(0, p.vx); }

    const oldFeet = p.y + p.h / 2;
    p.y += p.vy * dt;
    p.grounded = false;
    for (const box of obstacles) {
      if (!overlaps(p, box)) continue;
      if (p.vy > 0) {
        p.y = box.y - p.h / 2; p.grounded = true;
        if (p.water <= EPS) {
          p.water = 0; p.vx = 0; p.vy = 0;
          state.spraying = false; state.refilling = false; state.status = 'lost';
          state.highest = Math.max(state.highest, START_Y - p.y);
          events.push({ type: 'fail', id: box.id, message: '水箱空了，落在空调外机上，飞行结束。' });
          break;
        }
      }
      else if (p.vy < 0) p.y = box.y + box.h + p.h / 2;
      p.vy = 0;
    }
    if (state.status !== 'playing') break;
    for (const platform of platforms) {
      const feet = p.y + p.h / 2;
      const crossesTop = oldFeet <= platform.y + 0.5 && feet >= platform.y && p.vy >= 0;
      const horizontal = p.x + p.w / 2 > platform.x + 4 && p.x - p.w / 2 < platform.x + platform.w - 4;
      if (!crossesTop || !horizontal) continue;
      p.y = platform.y - p.h / 2;
      p.vy = 0;
      p.grounded = true;
      landedOn(state, platform, dt, events);
      break;
    }
    // Soft upper limit keeps the final landing reachable after an enthusiastic launch.
    if (p.y < 24) { p.y = 24; p.vy = Math.max(0, p.vy); }
    state.highest = Math.max(state.highest, START_Y - p.y);
    if (p.y - p.h / 2 > WORLD_HEIGHT + 80) events.push(rescue(state));
  }
  return events;
}

export function scoreStars(state: GameState): number {
  if (state.status !== 'won') return 0;
  return 1 + (state.cleanPct >= 35 ? 1 : 0) + (getResidentCount(state) >= 3 ? 1 : 0);
}

export function getResidentCount(state: GameState): number { return state.residents.filter((r) => r.unlocked).length; }
/** A presentation-only fantasy altitude scale; never a product specification. */
export function getHeightMeters(state: GameState): number { return Math.max(0, Math.round(state.highest / 20)); }
