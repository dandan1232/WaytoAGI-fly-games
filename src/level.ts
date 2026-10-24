/** All geometry uses world pixels: x right, y down. These are fantasy game units. */
export const WORLD_WIDTH = 900;
export const WORLD_HEIGHT = 3000;
export const BUILDING = { x: 190, y: 160, w: 520, h: 2700 } as const;

export interface Rect { x: number; y: number; w: number; h: number }
export interface Platform extends Rect { id: string; kind: 'refill' | 'roof' | 'ledge' }
export interface Obstacle extends Rect { id: string }
export interface ResidentDef extends Rect {
  id: string;
  name: string;
  line: string;
  appearance: 'cat' | 'chef' | 'gamer' | 'grandma';
}

/** Bottom-to-top order is also the safe, fully traversable suggested route. */
export const platforms: Platform[] = [
  { id: 'start', x: 140, y: 2810, w: 340, h: 24, kind: 'refill' },
  { id: 'stop-1', x: 430, y: 2390, w: 310, h: 22, kind: 'refill' },
  { id: 'stop-2', x: 160, y: 1970, w: 310, h: 22, kind: 'refill' },
  { id: 'stop-3', x: 430, y: 1550, w: 310, h: 22, kind: 'refill' },
  { id: 'stop-4', x: 160, y: 1130, w: 310, h: 22, kind: 'refill' },
  { id: 'stop-5', x: 430, y: 710, w: 310, h: 22, kind: 'refill' },
  { id: 'stop-6', x: 160, y: 290, w: 310, h: 22, kind: 'refill' },
  { id: 'roof', x: 175, y: 160, w: 550, h: 30, kind: 'roof' },
];

/** Each AC blocks the previous refill's direct launch column, encouraging a diagonal route. */
export const obstacles: Obstacle[] = [
  { id: 'ac-1', x: 270, y: 2570, w: 92, h: 54 },
  { id: 'ac-2', x: 540, y: 2145, w: 92, h: 54 },
  { id: 'ac-3', x: 270, y: 1730, w: 92, h: 54 },
  { id: 'ac-4', x: 540, y: 1310, w: 92, h: 54 },
  { id: 'ac-5', x: 270, y: 890, w: 92, h: 54 },
  { id: 'ac-6', x: 540, y: 470, w: 92, h: 54 },
];

export const residentDefs: ResidentDef[] = [
  { id: 'cat', name: '猫总监', line: '这位人类，你挡住我的日光浴了。', x: 530, y: 2460, w: 112, h: 112, appearance: 'cat' },
  { id: 'chef', name: '煎蛋大师', line: '我以为是下雨，原来是送上门的洗窗。', x: 255, y: 2040, w: 112, h: 112, appearance: 'chef' },
  { id: 'gamer', name: '不下班玩家', line: '等等，你这喷气背包在哪个版本更新的？', x: 530, y: 1200, w: 112, h: 112, appearance: 'gamer' },
  { id: 'grandma', name: '阳台花神', line: '小伙子，飞得不错！花不用浇，谢谢。', x: 255, y: 780, w: 112, h: 112, appearance: 'grandma' },
];

/** Replaces the lowest left-hand window, reachable from the starting refill. */
export const secretWindow = {
  id: 'off-duty-duck', x: 235, y: 2640, w: 98, h: 115,
  threshold: 70, achievement: '原来你在摸鱼',
} as const;

export const mudDefs = [
  { x: 588, y: 2630, r: 27, hp: 1 },
  { x: 298, y: 2205, r: 30, hp: 1 },
  { x: 600, y: 1785, r: 26, hp: 1 },
  { x: 280, y: 1370, r: 30, hp: 1 },
  { x: 608, y: 950, r: 27, hp: 1 },
  { x: 295, y: 520, r: 25, hp: 1 },
];

export const districts = [
  { name: '早八街区', subtitle: '先飞起来，再管姿势', minHeight: 0 },
  { name: '云上生活', subtitle: '每扇窗后，都有点故事', minHeight: 900 },
  { name: '高光天台', subtitle: '最后一段，向上就对了', minHeight: 1800 },
] as const;
