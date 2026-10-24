import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame, rescue, scoreStars, FIXED_DT, MAX_WATER, PHYSICS, getResidentCount } from '../src/core.ts';
import type { GameState, Input } from '../src/core.ts';
import { platforms, obstacles, WORLD_HEIGHT } from '../src/level.ts';

const idle: Input = { dx: 0, dy: 1, spraying: false };
function run(state: GameState, input: Input, seconds: number) {
  const events = [];
  for (let i = 0; i < Math.ceil(seconds / FIXED_DT); i++) events.push(...stepGame(state, input, FIXED_DT));
  return events;
}

test('a fresh game is grounded, full, dirty, and independent from other runs', () => {
  const a = createGame();
  const b = createGame();
  assert.equal(a.player.water, MAX_WATER);
  assert.equal(a.player.grounded, true);
  assert.equal(a.cleanPct, 0);
  assert.ok(a.dirt.length > 500 && a.dirt.length < 3000);
  a.dirt[0].amount = 0;
  assert.equal(b.dirt[0].amount, 1);
  assert.equal(getResidentCount(a), 0);
});

test('downward spray lifts the character; leftward spray moves them right', () => {
  const s = createGame();
  const initialY = s.player.y;
  run(s, { dx: 0, dy: 1, spraying: true }, 0.4);
  assert.ok(s.player.y < initialY - 35);
  assert.ok(s.player.vy < 0);
  assert.ok(s.player.water < 100 && s.player.water > 89);
  const initialX = s.player.x;
  run(s, { dx: -1, dy: 0, spraying: true }, 0.2);
  assert.ok(s.player.x > initialX + 10);
});

test('empty or near-empty tank never grants free thrust and never goes negative', () => {
  const a = createGame();
  a.player.y -= 300;
  a.player.water = 0;
  const b = structuredClone(a);
  run(a, { dx: 0, dy: 1, spraying: true }, 0.25);
  run(b, idle, 0.25);
  assert.equal(a.player.water, 0);
  assert.equal(a.spraying, false);
  assert.equal(a.player.y, b.player.y);
  assert.equal(a.cleanPct, 0);
  a.player.water = 0.0001;
  stepGame(a, { dx: 0, dy: 1, spraying: true }, FIXED_DT);
  assert.ok(a.player.water >= 0);
});

test('a stopped character refills on a yellow platform at a bounded rate', () => {
  const s = createGame();
  s.player.water = 10;
  run(s, idle, 0.5);
  assert.ok(s.player.water > 36 && s.player.water < 39);
  assert.equal(s.refilling, true);
  run(s, idle, 2);
  assert.equal(s.player.water, 100);
});

test('service platforms can be crossed upward and catch downward movement', () => {
  const s = createGame();
  const platform = platforms[1];
  s.player.x = platform.x + platform.w / 2;
  s.player.y = platform.y + 75;
  run(s, { dx: 0, dy: 1, spraying: true }, 0.85);
  assert.ok(s.player.y + s.player.h / 2 < platform.y);
  const events = run(s, idle, 1.4);
  assert.equal(s.player.y + s.player.h / 2, platform.y);
  assert.equal(s.checkpoint.platformId, platform.id);
  assert.ok(events.some(e => e.type === 'checkpoint'));
});

test('air conditioners block sides, undersides, and downward landing without overlap', () => {
  const box = obstacles[0];
  const side = createGame();
  side.player.x = box.x - 30;
  side.player.y = box.y + box.h / 2;
  side.player.vx = 330;
  stepGame(side, idle, 0.1);
  assert.ok(side.player.x + side.player.w / 2 <= box.x + 0.01);
  const below = createGame();
  below.player.x = box.x + box.w / 2;
  below.player.y = box.y + box.h + 24;
  below.player.vy = -300;
  stepGame(below, { dx: 0, dy: 1, spraying: true }, 0.05);
  assert.ok(below.player.y - below.player.h / 2 >= box.y + box.h - 0.01);
  const above = createGame();
  above.player.x = box.x + box.w / 2;
  above.player.y = box.y - 24;
  above.player.vy = 300;
  stepGame(above, idle, 0.05);
  assert.equal(above.player.y + above.player.h / 2, box.y);
});

test('a real spray removes local dirt only; AC boxes stop the beam', () => {
  const s = createGame();
  s.player.x = 260;
  s.player.y = 2500;
  const far = s.dirt.find(c => c.y < 400)!;
  run(s, { dx: 1, dy: 0, spraying: true }, 0.15);
  assert.ok(s.cleanPct > 0 && s.cleanPct < 2);
  assert.equal(far.amount, 1);
  assert.ok(s.dirt.some(c => c.amount < 1));
  const blocked = createGame();
  const box = obstacles[0];
  blocked.player.x = box.x - 60;
  blocked.player.y = box.y + 20;
  stepGame(blocked, { dx: 1, dy: 0, spraying: true }, FIXED_DT);
  assert.ok(Math.abs(blocked.beamEnd.x - box.x) < 0.01);
  assert.ok(blocked.dirt.filter(c => c.x > box.x + box.w && c.y >= box.y && c.y < box.y + box.h).every(c => c.amount === 1));
});

test('resident unlock is earned by actual spray coverage and emits one discovery', () => {
  const s = createGame();
  const resident = s.residents[0];
  const events = [];
  // Repositioning sets up a unit-test nozzle scan; every dirt change still comes from real spray.
  for (let y = resident.y; y <= resident.y + resident.h; y += 20) {
    for (let n = 0; n < 65; n++) {
      s.player.x = resident.x - 45;
      s.player.y = y;
      s.player.vx = 0;
      s.player.vy = 0;
      s.player.water = 100;
      events.push(...stepGame(s, { dx: 1, dy: 0, spraying: true }, FIXED_DT));
    }
  }
  assert.ok(resident.cleanPct >= 60);
  assert.equal(resident.unlocked, true);
  assert.equal(events.filter(e => e.type === 'resident' && e.id === resident.id).length, 1);
  assert.ok(s.residents.slice(1).every(r => !r.unlocked));
});

test('mud is removed by the beam, once, without changing distant mud', () => {
  const s = createGame();
  const mud = s.mud[0];
  const events = [];
  for (let n = 0; n < 80; n++) {
    s.player.x = mud.x - 65;
    s.player.y = mud.y;
    s.player.vx = s.player.vy = 0;
    events.push(...stepGame(s, { dx: 1, dy: 0, spraying: true }, FIXED_DT));
  }
  assert.equal(mud.hp, 0);
  assert.equal(events.filter(e => e.type === 'mud').length, 1);
  assert.equal(s.mud[1].hp, 1);
});

test('manual and falling rescues preserve progress and the highest checkpoint', () => {
  const s = createGame();
  const topStop = platforms[3];
  s.player.x = topStop.x + topStop.w / 2;
  s.player.y = topStop.y - s.player.h / 2 - 2;
  run(s, idle, 0.15);
  const cp = { ...s.checkpoint };
  s.dirt[0].amount = 0.2;
  const bottom = platforms[0];
  s.player.x = bottom.x + bottom.w / 2;
  s.player.y = bottom.y - s.player.h / 2;
  run(s, idle, 0.1);
  assert.deepEqual(s.checkpoint, cp);
  rescue(s);
  assert.equal(s.rescues, 1);
  assert.equal(s.player.water, 100);
  assert.equal(s.player.y, cp.y);
  assert.equal(s.dirt[0].amount, 0.2);
  s.player.y = WORLD_HEIGHT + 200;
  const events = stepGame(s, idle, FIXED_DT);
  assert.equal(s.rescues, 2);
  assert.ok(events.some(e => e.type === 'rescue'));
});

test('won runs lock physics and score without changing measured cleanliness', () => {
  const s = createGame();
  const roof = platforms.find(p => p.kind === 'roof')!;
  s.player.x = roof.x + roof.w / 2;
  s.player.y = roof.y - s.player.h / 2 - 2;
  const events = run(s, idle, 0.2);
  assert.equal(s.status, 'won');
  assert.ok(events.some(e => e.type === 'win'));
  assert.equal(scoreStars(s), 1);
  const snapshot = structuredClone(s);
  run(s, { dx: 0, dy: 1, spraying: true }, 1);
  assert.deepEqual(s, snapshot);
  s.cleanPct = 35;
  s.residents.slice(0, 3).forEach(r => r.unlocked = true);
  assert.equal(scoreStars(s), 3);
});

test('fixed substeps behave consistently at 30, 60, and 120 render fps', () => {
  const states = [30, 60, 120].map(fps => {
    const s = createGame();
    for (let i = 0; i < fps; i++) stepGame(s, { dx: -0.3, dy: 1, spraying: true }, 1 / fps);
    return s;
  });
  for (const s of states.slice(1)) {
    assert.ok(Math.abs(s.player.x - states[0].player.x) < 0.000001);
    assert.ok(Math.abs(s.player.y - states[0].player.y) < 0.000001);
    assert.ok(Math.abs(s.player.water - states[0].player.water) < 0.000001);
  }
  const s = createGame();
  stepGame(s, idle, 10);
  assert.ok(s.elapsed <= 0.100001);
  const before = s.elapsed;
  stepGame(s, idle, Number.NaN);
  stepGame(s, idle, -1);
  assert.equal(s.elapsed, before);
});

test('all refill stops and the roof are reachable using only normal inputs', () => {
  const state = createGame();
  const visited = [state.checkpoint.platformId];
  let duty = 0;
  for (const destination of platforms.slice(1)) {
    const tx = destination.x + destination.w / 2;
    const ty = destination.y - state.player.h / 2;
    let above = false;
    let landed = false;
    for (let frame = 0; frame < 60 * 18; frame++) {
      const p = state.player;
      if (p.y < ty - 65) above = true;
      const targetY = above ? ty + 6 : ty - 90;
      const desiredVx = Math.max(-220, Math.min(220, (tx - p.x) * 2.7));
      const desiredVy = Math.max(-285, Math.min(120, (targetY - p.y) * 2.7));
      const ax = (desiredVx - p.vx) * 7 + p.vx * PHYSICS.horizontalDrag;
      const ay = (desiredVy - p.vy) * 7 - PHYSICS.gravity + p.vy * PHYSICS.verticalDrag;
      const power = Math.hypot(ax, ay);
      duty += Math.min(1, power / PHYSICS.thrust);
      let spraying = duty >= 1;
      if (spraying) duty -= 1;
      if (above && Math.abs(tx - p.x) < 75 && p.y > ty - 65) spraying = false;
      const len = power || 1;
      stepGame(state, { dx: -ax / len, dy: -ay / len, spraying }, 1 / 60);
      if ((state.player.grounded && Math.abs(state.player.y - ty) < 1) || state.status === 'won') {
        run(state, idle, 2.1);
        visited.push(destination.id);
        landed = true;
        break;
      }
    }
    assert.ok(landed, `Could not reach ${destination.id}: ${JSON.stringify({ player: state.player, checkpoint: state.checkpoint, rescues: state.rescues })}`);
    assert.equal(state.rescues, 0, `No rescue shortcut is allowed on route to ${destination.id}`);
  }
  assert.deepEqual(visited, platforms.map(p => p.id));
  assert.equal(state.status, 'won');
  assert.ok(state.highest > 2600);
  console.log(`Route proof: ${visited.join(' → ')}; ${state.elapsed.toFixed(1)} s, ${state.rescues} rescues, ${state.cleanPct.toFixed(1)}% cleaned.`);
});
