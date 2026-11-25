import type { Block, MatchResult, PenColor, ProgramDoc, RunResult, Segment, SizeExpr } from './types';

export const COLOR_HEX: Record<Exclude<PenColor, 'rainbow'>, string> = {
  cyan: '#47f0ff',
  pink: '#ff7edb',
  lime: '#69f08d',
  gold: '#ffd45d',
  violet: '#a98bff',
  coral: '#ff7b6b',
};

const MAX_SEGMENTS = 2500;
const MAX_DEPTH = 14;
const MIN_RECURSIVE_SIZE = 10;

export function countBlocks(doc: ProgramDoc): number {
  const countList = (list: Block[]): number =>
    list.reduce((n, b) => n + 1 + (b.body ? countList(b.body) : 0), 0);
  return countList(doc.main) + countList(doc.myBlock);
}

function evalSize(expr: SizeExpr | undefined, fixed: number, sizeParam: number | null): number {
  if (!expr || expr === 'fixed' || sizeParam === null) return fixed;
  if (expr === 'size') return sizeParam;
  if (expr === 'size-10') return sizeParam - 10;
  if (expr === 'size-15') return sizeParam - 15;
  if (expr === 'size*0.7') return sizeParam * 0.7;
  if (expr === 'size*0.75') return sizeParam * 0.75;
  return fixed;
}

export interface RunOptions {
  startX?: number;
  startY?: number;
  startAngle?: number;
  angleOffset?: number;
  hueOffset?: number;
}

export function executeProgram(doc: ProgramDoc, opts: RunOptions = {}): RunResult {
  let x = opts.startX ?? 0;
  let y = opts.startY ?? 0;
  let angle = (opts.startAngle ?? 0) + (opts.angleOffset ?? 0);
  let penDown = true;
  let colorMode: PenColor = 'cyan';
  let rainbowStep = opts.hueOffset ?? 0;
  let steps = 0;
  let stoppedEarly = false;
  const segments: Segment[] = [];

  const currentColor = (): string => {
    if (colorMode === 'rainbow') {
      const hue = (rainbowStep * 14) % 360;
      rainbowStep++;
      return `hsl(${hue}, 95%, 68%)`;
    }
    return COLOR_HEX[colorMode];
  };

  const walk = (dist: number) => {
    const rad = ((angle - 90) * Math.PI) / 180;
    const nx = x + Math.cos(rad) * dist;
    const ny = y + Math.sin(rad) * dist;
    if (penDown && Math.abs(dist) > 0.01) {
      segments.push({ x1: x, y1: y, x2: nx, y2: ny, color: currentColor() });
    }
    x = nx;
    y = ny;
  };

  const runList = (list: Block[], sizeParam: number | null, depth: number) => {
    for (const block of list) {
      if (segments.length >= MAX_SEGMENTS || steps >= 6000) {
        stoppedEarly = true;
        return;
      }
      steps++;
      switch (block.kind) {
        case 'MOVE':
          walk(evalSize(block.sizeExpr, block.value ?? 60, sizeParam));
          break;
        case 'BACK':
          walk(-evalSize(block.sizeExpr, block.value ?? 60, sizeParam));
          break;
        case 'TURN_R':
          angle += block.value ?? 90;
          break;
        case 'TURN_L':
          angle -= block.value ?? 90;
          break;
        case 'PEN_UP':
          penDown = false;
          break;
        case 'PEN_DOWN':
          penDown = true;
          break;
        case 'COLOR':
          colorMode = block.color ?? 'cyan';
          break;
        case 'REPEAT': {
          const times = Math.max(0, Math.min(72, Math.round(block.value ?? 4)));
          for (let i = 0; i < times; i++) {
            runList(block.body ?? [], sizeParam, depth);
            if (stoppedEarly) return;
          }
          break;
        }
        case 'CALL': {
          const nextSize = evalSize(block.sizeExpr, block.value ?? 80, sizeParam);
          if (depth >= MAX_DEPTH || (sizeParam !== null && nextSize < MIN_RECURSIVE_SIZE)) break;
          runList(doc.myBlock, nextSize, depth + 1);
          break;
        }
      }
    }
  };

  runList(doc.main, null, 0);
  const finalColor = colorMode as PenColor;
  return {
    segments,
    endPose: {
      x,
      y,
      angle,
      penDown,
      color: finalColor === 'rainbow' ? '#ff7edb' : COLOR_HEX[finalColor],
    },
    steps,
    stoppedEarly,
  };
}

function samplePoints(segments: Segment[], spacing = 6): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (const s of segments) {
    const len = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
    const n = Math.max(1, Math.ceil(len / spacing));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      pts.push([s.x1 + (s.x2 - s.x1) * t, s.y1 + (s.y2 - s.y1) * t]);
    }
  }
  return pts;
}

function fractionClose(a: Array<[number, number]>, b: Array<[number, number]>, tolSq: number): number {
  if (!a.length) return 0;
  let hit = 0;
  for (const [ax, ay] of a) {
    for (const [bx, by] of b) {
      const dx = ax - bx;
      const dy = ay - by;
      if (dx * dx + dy * dy <= tolSq) {
        hit++;
        break;
      }
    }
  }
  return hit / a.length;
}

/**
 * Order- and direction-independent shape matcher.
 * Compares sampled points along drawn vs target segments.
 */
export function matchDrawing(drawn: Segment[], target: Segment[]): MatchResult {
  if (!target.length) return { passed: true, coverage: 1, accuracy: 1, score: 100 };
  if (!drawn.length) return { passed: false, coverage: 0, accuracy: 0, score: 0 };
  const dPts = samplePoints(drawn);
  const tPts = samplePoints(target);
  const tolSq = 8.5 * 8.5;
  const coverage = fractionClose(tPts, dPts, tolSq);
  const accuracy = fractionClose(dPts, tPts, tolSq);
  const score = Math.round(((coverage + accuracy) / 2) * 100);
  const passed = coverage >= 0.94 && accuracy >= 0.92;
  return { passed, coverage, accuracy, score };
}
