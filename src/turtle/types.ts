export type BlockKind =
  | 'MOVE'
  | 'BACK'
  | 'TURN_R'
  | 'TURN_L'
  | 'PEN_UP'
  | 'PEN_DOWN'
  | 'COLOR'
  | 'REPEAT'
  | 'CALL';

export type SizeExpr = 'fixed' | 'size' | 'size-10' | 'size-15' | 'size*0.7' | 'size*0.75';

export type PenColor =
  | 'cyan'
  | 'pink'
  | 'lime'
  | 'gold'
  | 'violet'
  | 'coral'
  | 'rainbow';

export interface Block {
  id: string;
  kind: BlockKind;
  value?: number;
  sizeExpr?: SizeExpr;
  color?: PenColor;
  body?: Block[];
}

export interface ProgramDoc {
  main: Block[];
  myBlock: Block[];
  spin: boolean;
}

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
}

export interface TurtlePose {
  x: number;
  y: number;
  angle: number; // degrees, 0 = up, 90 = right
  penDown: boolean;
  color: string;
}

export interface RunResult {
  segments: Segment[];
  endPose: TurtlePose;
  steps: number;
  stoppedEarly: boolean;
}

export interface MatchResult {
  passed: boolean;
  coverage: number; // 0..1
  accuracy: number; // 0..1
  score: number; // 0..100
}

export interface Level {
  number: number;
  name: string;
  section: 'Basics' | 'Polygons & Stars' | 'Symmetry' | 'My Block & Fractals' | 'Sandbox';
  instructions: string;
  hint?: string;
  startX?: number;
  startY?: number;
  startAngle?: number;
  available: BlockKind[];
  allowMyBlock?: boolean;
  allowSpin?: boolean;
  parBlocks?: number;
  targetProgram?: { main: Block[]; myBlock?: Block[] };
  sandbox?: boolean;
}
