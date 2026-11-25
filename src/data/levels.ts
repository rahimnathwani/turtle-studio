import type { Block, Level, PenColor, ProgramDoc, SizeExpr } from '../turtle/types';

let bid = 1;
const b = (
  kind: Block['kind'],
  opts: Partial<Omit<Block, 'id' | 'kind'>> = {},
): Block => ({ id: `t${bid++}`, kind, ...opts });

const move = (value: number, sizeExpr: SizeExpr = 'fixed') => b('MOVE', { value, sizeExpr });
const back = (value: number, sizeExpr: SizeExpr = 'fixed') => b('BACK', { value, sizeExpr });
const turnR = (value: number) => b('TURN_R', { value });
const turnL = (value: number) => b('TURN_L', { value });
const penUp = () => b('PEN_UP');
const penDown = () => b('PEN_DOWN');
const color = (c: PenColor) => b('COLOR', { color: c });
const rep = (value: number, body: Block[]) => b('REPEAT', { value, body });
const call = (value: number, sizeExpr: SizeExpr = 'fixed') => b('CALL', { value, sizeExpr });

export const LEVELS: Level[] = [
  {
    number: 1,
    name: 'First Line',
    section: 'Basics',
    instructions: 'Move the turtle forward 100 steps to trace the glowing line!',
    hint: 'Tap MOVE in the toolbox and set it to 100.',
    startY: 50,
    available: ['MOVE'],
    parBlocks: 1,
    targetProgram: { main: [move(100)] },
  },
  {
    number: 2,
    name: 'L-Corner',
    section: 'Basics',
    instructions: 'Draw a crisp right-angle corner: go up 100 steps, turn right 90°, then go 100 steps.',
    hint: 'Use MOVE 100, TURN ↻ 90°, and MOVE 100.',
    startX: -50,
    startY: 50,
    available: ['MOVE', 'TURN_R', 'TURN_L'],
    parBlocks: 3,
    targetProgram: { main: [move(100), turnR(90), move(100)] },
  },
  {
    number: 3,
    name: 'Neon Square',
    section: 'Basics',
    instructions: 'Draw a full square (side 120) using a REPEAT loop!',
    hint: 'Put MOVE 120 and TURN ↻ 90° inside a REPEAT 4 block.',
    startX: -60,
    startY: 60,
    available: ['MOVE', 'TURN_R', 'TURN_L', 'REPEAT'],
    parBlocks: 3,
    targetProgram: { main: [rep(4, [move(120), turnR(90)])] },
  },
  {
    number: 4,
    name: 'Triangle Trick',
    section: 'Polygons & Stars',
    instructions: 'Draw an equilateral triangle (side 130). Watch out: how far does the turtle turn at each corner?',
    hint: 'A full circle is 360°, and 360° ÷ 3 corners = 120°!',
    startX: -65,
    startY: 55,
    startAngle: 90,
    available: ['MOVE', 'TURN_R', 'TURN_L', 'REPEAT', 'COLOR'],
    parBlocks: 3,
    targetProgram: { main: [rep(3, [move(130), turnL(120)])] },
  },
  {
    number: 5,
    name: 'Honeycomb Hexagon',
    section: 'Polygons & Stars',
    instructions: 'Draw a 6-sided hexagon with side length 80.',
    hint: '360° ÷ 6 sides = 60° per corner!',
    startX: -40,
    startY: 70,
    startAngle: 90,
    available: ['MOVE', 'TURN_R', 'TURN_L', 'REPEAT', 'COLOR'],
    parBlocks: 3,
    targetProgram: { main: [rep(6, [move(80), turnL(60)])] },
  },
  {
    number: 6,
    name: 'Shooting Star',
    section: 'Polygons & Stars',
    instructions: 'Draw a 5-pointed star with side length 150!',
    hint: 'Repeat 5 times: MOVE 150, then TURN ↻ 144°!',
    startX: -75,
    startY: -25,
    startAngle: 90,
    available: ['MOVE', 'TURN_R', 'TURN_L', 'REPEAT', 'COLOR'],
    parBlocks: 3,
    targetProgram: { main: [rep(5, [move(150), turnR(144)])] },
  },
  {
    number: 7,
    name: 'Dashed Runway',
    section: 'Polygons & Stars',
    instructions: 'Draw 4 dashes in a row: each dash is 30 steps long with a 20-step blank gap between them.',
    hint: 'Inside REPEAT 4: PEN DOWN, MOVE 30, PEN UP, MOVE 20.',
    startX: -90,
    startY: 0,
    startAngle: 90,
    available: ['MOVE', 'TURN_R', 'TURN_L', 'PEN_UP', 'PEN_DOWN', 'REPEAT', 'COLOR'],
    parBlocks: 5,
    targetProgram: { main: [rep(4, [penDown(), move(30), penUp(), move(20)])] },
  },
  {
    number: 8,
    name: 'Staircase',
    section: 'Polygons & Stars',
    instructions: 'Climb 4 steps up and to the right! Each riser and tread is 35 steps.',
    hint: 'Repeat 4 times: MOVE 35, TURN ↻ 90°, MOVE 35, TURN ↺ 90°.',
    startX: -70,
    startY: 70,
    available: ['MOVE', 'TURN_R', 'TURN_L', 'PEN_UP', 'PEN_DOWN', 'REPEAT', 'COLOR'],
    parBlocks: 5,
    targetProgram: { main: [rep(4, [move(35), turnR(90), move(35), turnL(90)])] },
  },
  {
    number: 9,
    name: 'Pinwheel',
    section: 'Symmetry',
    instructions: 'Draw 6 squares fanning out from the center — a nested loop!',
    hint: 'Put your square (REPEAT 4: MOVE 70, TURN ↻ 90°) inside an outer REPEAT 6 that turns 60° after each square!',
    available: ['MOVE', 'TURN_R', 'TURN_L', 'PEN_UP', 'PEN_DOWN', 'REPEAT', 'COLOR'],
    parBlocks: 5,
    targetProgram: { main: [rep(6, [rep(4, [move(70), turnR(90)]), turnR(60)])] },
  },
  {
    number: 10,
    name: 'Crystal Flower',
    section: 'Symmetry',
    instructions: 'Draw 12 rotated hexagons (side 45) to bloom a sparkling flower!',
    hint: 'Outer REPEAT 12 (turning 30° each time), inner REPEAT 6 (MOVE 45, TURN ↻ 60°).',
    available: ['MOVE', 'TURN_R', 'TURN_L', 'PEN_UP', 'PEN_DOWN', 'REPEAT', 'COLOR'],
    parBlocks: 5,
    targetProgram: { main: [rep(12, [rep(6, [move(45), turnR(60)]), turnR(30)])] },
  },
  {
    number: 11,
    name: 'My First Custom Block',
    section: 'My Block & Fractals',
    instructions: 'Teach MY BLOCK(size) to draw a square of any size, then call it 3 times in MAIN with sizes 40, 80, and 120!',
    hint: 'Switch to the MY BLOCK tab: REPEAT 4 → MOVE [size], TURN ↻ 90°. Then in MAIN: DO MY BLOCK 40, 80, and 120!',
    startX: -60,
    startY: 60,
    available: ['MOVE', 'TURN_R', 'TURN_L', 'REPEAT', 'CALL', 'COLOR'],
    allowMyBlock: true,
    parBlocks: 6,
    targetProgram: {
      myBlock: [rep(4, [move(60, 'size'), turnR(90)])],
      main: [call(40), call(80), call(120)],
    },
  },
  {
    number: 12,
    name: 'Square Spiral',
    section: 'My Block & Fractals',
    instructions: 'Use recursion! Make MY BLOCK(size) draw one side of length [size], turn right 90°, then call MY BLOCK(size − 10)! Start with 140.',
    hint: 'In MY BLOCK: MOVE [size], TURN ↻ 90°, DO MY BLOCK [size - 10]. In MAIN: DO MY BLOCK 140. It stops automatically when size < 10!',
    startX: -70,
    startY: 70,
    available: ['MOVE', 'BACK', 'TURN_R', 'TURN_L', 'REPEAT', 'CALL', 'COLOR'],
    allowMyBlock: true,
    parBlocks: 4,
    targetProgram: {
      myBlock: [move(60, 'size'), turnR(90), call(60, 'size-10')],
      main: [call(140)],
    },
  },
  {
    number: 13,
    name: 'Hypno Vortex',
    section: 'My Block & Fractals',
    instructions: 'Same recursive trick, twisted! In MY BLOCK(size), move [size], turn right 85°, then call MY BLOCK(size − 10). Start with 150!',
    hint: 'Just like Square Spiral, except TURN ↻ 85° instead of 90° — watch the spiral twist!',
    startX: -60,
    startY: 70,
    available: ['MOVE', 'BACK', 'TURN_R', 'TURN_L', 'REPEAT', 'CALL', 'COLOR'],
    allowMyBlock: true,
    allowSpin: true,
    parBlocks: 4,
    targetProgram: {
      myBlock: [move(60, 'size'), turnR(85), call(60, 'size-10')],
      main: [call(150)],
    },
  },
  {
    number: 14,
    name: 'Fractal Tree',
    section: 'My Block & Fractals',
    instructions: 'Grow a glowing tree! Each branch moves [size], splits left 30° and right 30° into two smaller branches (size × 0.7), then backs up!',
    hint: 'In MY BLOCK: MOVE [size], TURN ↺ 30°, DO MY BLOCK [size*0.7], TURN ↻ 60°, DO MY BLOCK [size*0.7], TURN ↺ 30°, BACK [size]. In MAIN: DO MY BLOCK 80!',
    startX: 0,
    startY: 140,
    available: ['MOVE', 'BACK', 'TURN_R', 'TURN_L', 'REPEAT', 'CALL', 'COLOR'],
    allowMyBlock: true,
    parBlocks: 8,
    targetProgram: {
      myBlock: [
        move(60, 'size'),
        turnL(30),
        call(60, 'size*0.7'),
        turnR(60),
        call(60, 'size*0.7'),
        turnL(30),
        back(60, 'size'),
      ],
      main: [call(80)],
    },
  },
  {
    number: 15,
    name: 'Animation Studio',
    section: 'Sandbox',
    instructions: 'Free play! Mix rainbows, nested loops, recursion, and SPIN WITH TIME to create looping Scratch-style animations — or remix a starter preset below!',
    available: ['MOVE', 'BACK', 'TURN_R', 'TURN_L', 'PEN_UP', 'PEN_DOWN', 'COLOR', 'REPEAT', 'CALL'],
    allowMyBlock: true,
    allowSpin: true,
    sandbox: true,
  },
];

export interface SandboxPreset {
  name: string;
  doc: ProgramDoc;
}

export const SANDBOX_PRESETS: SandboxPreset[] = [
  {
    name: 'Rainbow Spirograph',
    doc: {
      main: [color('rainbow'), rep(18, [rep(4, [move(75), turnR(90)]), turnR(20)])],
      myBlock: [],
      spin: true,
    },
  },
  {
    name: 'Spinning Starburst',
    doc: {
      main: [color('rainbow'), rep(12, [rep(5, [move(110), turnR(144)]), turnR(30)])],
      myBlock: [],
      spin: true,
    },
  },
  {
    name: 'Neon Fractal Tree',
    doc: {
      main: [color('rainbow'), penUp(), back(120), penDown(), call(85)],
      myBlock: [
        move(60, 'size'),
        turnL(28),
        call(60, 'size*0.7'),
        turnR(56),
        call(60, 'size*0.7'),
        turnL(28),
        back(60, 'size'),
      ],
      spin: false,
    },
  },
  {
    name: 'Hypno Spiral',
    doc: {
      main: [color('rainbow'), call(150)],
      myBlock: [move(60, 'size'), turnR(86), call(60, 'size-10')],
      spin: true,
    },
  },
];
