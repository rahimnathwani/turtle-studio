import './styles.css';
import { LEVELS, SANDBOX_PRESETS } from './data/levels';
import { COLOR_HEX, countBlocks, executeProgram, matchDrawing } from './turtle/engine';
import type { Block, BlockKind, Level, MatchResult, PenColor, ProgramDoc, Segment, SizeExpr } from './turtle/types';
import { loadSave, writeSave } from './storage';
import { setMuted, sfx } from './ui/sfx';

const app = document.querySelector<HTMLDivElement>('#app')!;
const STAGE_SIZE = 480;
const ANGLE_PRESETS = [30, 45, 60, 72, 85, 90, 120, 144];
const PEN_COLORS: PenColor[] = ['cyan', 'pink', 'lime', 'gold', 'violet', 'coral', 'rainbow'];

const BLOCK_META: Record<BlockKind, { label: string; family: string; defaultVal?: number }> = {
  MOVE: { label: 'MOVE', family: 'move', defaultVal: 100 },
  BACK: { label: 'BACK', family: 'move', defaultVal: 60 },
  TURN_R: { label: 'TURN ↻', family: 'turn', defaultVal: 90 },
  TURN_L: { label: 'TURN ↺', family: 'turn', defaultVal: 90 },
  PEN_UP: { label: 'PEN UP', family: 'pen' },
  PEN_DOWN: { label: 'PEN DOWN', family: 'pen' },
  COLOR: { label: 'COLOR', family: 'pen' },
  REPEAT: { label: 'REPEAT', family: 'loop', defaultVal: 4 },
  CALL: { label: 'DO MY BLOCK', family: 'fn', defaultVal: 80 },
};

let save = loadSave();
setMuted(save.muted);

let level: Level = LEVELS.find(l => l.number === save.level) ?? LEVELS[0];
let doc: ProgramDoc = cloneDoc(save.programs[level.number] ?? { main: [], myBlock: [], spin: false });
let activeTab: 'main' | 'myBlock' = 'main';
let activeContainerId: string | null = null; // REPEAT block id to insert into, or null = root
let selectedBlockId: string | null = null;
let hintOpen = false;
let drawerOpen = false;
let helpOpen = false;
let successModal: { score: number; blocks: number; star: boolean } | null = null;
let toast: { text: string; kind: 'info' | 'error' } | null = null;
let toastTimer: number | undefined;
let undoStack: ProgramDoc[] = [];
let redoStack: ProgramDoc[] = [];
let idSeq = 1;

// Animation state
let drawLimit: number | null = null; // null = draw all segments immediately
let animFrame = 0;
let spinAngle = 0;
let spinHue = 0;

function nextId(): string {
  return `b${Date.now().toString(36)}${idSeq++}`;
}

function cloneBlocks(list: Block[]): Block[] {
  return list.map(b => ({ ...b, body: b.body ? cloneBlocks(b.body) : undefined }));
}

function cloneDoc(d: ProgramDoc): ProgramDoc {
  return { main: cloneBlocks(d.main), myBlock: cloneBlocks(d.myBlock), spin: Boolean(d.spin) };
}

function esc(v: unknown): string {
  return String(v).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));
}

function showToast(text: string, kind: 'info' | 'error' = 'info'): void {
  toast = { text, kind };
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast = null;
    app.querySelector('.toast')?.remove();
  }, 3500);
}

function persist(): void {
  save.level = level.number;
  save.programs[level.number] = cloneDoc(doc);
  writeSave(save);
}

function pushUndo(): void {
  undoStack.push(cloneDoc(doc));
  if (undoStack.length > 50) undoStack.shift();
  redoStack = [];
}

function activeList(): Block[] {
  return activeTab === 'myBlock' ? doc.myBlock : doc.main;
}

function findBlock(list: Block[], id: string): { list: Block[]; index: number; block: Block } | null {
  for (let i = 0; i < list.length; i++) {
    if (list[i].id === id) return { list, index: i, block: list[i] };
    if (list[i].body) {
      const found = findBlock(list[i].body!, id);
      if (found) return found;
    }
  }
  return null;
}

function targetSegments(): Segment[] {
  if (!level.targetProgram) return [];
  return executeProgram(
    { main: level.targetProgram.main, myBlock: level.targetProgram.myBlock ?? [], spin: false },
    { startX: level.startX, startY: level.startY, startAngle: level.startAngle },
  ).segments;
}

function currentRun(angleOffset = 0, hueOffset = 0) {
  return executeProgram(doc, {
    startX: level.startX,
    startY: level.startY,
    startAngle: level.startAngle,
    angleOffset,
    hueOffset,
  });
}

function currentMatch(): MatchResult | null {
  if (level.sandbox || !level.targetProgram) return null;
  const drawn = currentRun().segments;
  const target = targetSegments();
  return matchDrawing(drawn, target);
}

function selectLevel(n: number): void {
  const next = LEVELS.find(l => l.number === n);
  if (!next) return;
  level = next;
  doc = cloneDoc(save.programs[n] ?? { main: [], myBlock: [], spin: false });
  activeTab = 'main';
  activeContainerId = null;
  selectedBlockId = null;
  hintOpen = false;
  drawerOpen = false;
  successModal = null;
  toast = null;
  drawLimit = null;
  undoStack = [];
  redoStack = [];
  persist();
  render();
  syncLoop();
}

function addBlock(kind: BlockKind): void {
  pushUndo();
  const meta = BLOCK_META[kind];
  const block: Block = {
    id: nextId(),
    kind,
    value: meta.defaultVal,
    sizeExpr: activeTab === 'myBlock' && (kind === 'MOVE' || kind === 'BACK') ? 'size' : 'fixed',
    color: kind === 'COLOR' ? 'rainbow' : undefined,
    body: kind === 'REPEAT' ? [] : undefined,
  };
  const root = activeList();
  if (activeContainerId) {
    const parent = findBlock(root, activeContainerId);
    if (parent && parent.block.kind === 'REPEAT') {
      parent.block.body = parent.block.body ?? [];
      parent.block.body.push(block);
    } else {
      activeContainerId = null;
      root.push(block);
    }
  } else {
    root.push(block);
  }
  if (kind === 'REPEAT') activeContainerId = block.id;
  selectedBlockId = block.id;
  drawLimit = null;
  sfx.add();
  persist();
  render();
}

function removeBlock(id: string): void {
  pushUndo();
  const found = findBlock(activeList(), id);
  if (!found) return;
  found.list.splice(found.index, 1);
  if (selectedBlockId === id) selectedBlockId = null;
  if (activeContainerId === id) activeContainerId = null;
  drawLimit = null;
  sfx.remove();
  persist();
  render();
}

function moveBlock(id: string, delta: number): void {
  const found = findBlock(activeList(), id);
  if (!found) return;
  const to = found.index + delta;
  if (to < 0 || to >= found.list.length) return;
  pushUndo();
  const [item] = found.list.splice(found.index, 1);
  found.list.splice(to, 0, item);
  sfx.tweak();
  persist();
  render();
}

function adjustValue(id: string, delta: number, exact?: number): void {
  const found = findBlock(activeList(), id);
  if (!found) return;
  pushUndo();
  const b = found.block;
  const min = b.kind === 'REPEAT' ? 1 : 0;
  const max = b.kind === 'REPEAT' ? 72 : 360;
  b.sizeExpr = 'fixed';
  b.value = Math.max(min, Math.min(max, exact ?? (b.value ?? 0) + delta));
  drawLimit = null;
  sfx.tweak();
  persist();
  render();
}

function setExpr(id: string, expr: SizeExpr): void {
  const found = findBlock(activeList(), id);
  if (!found) return;
  pushUndo();
  found.block.sizeExpr = expr;
  drawLimit = null;
  sfx.tweak();
  persist();
  render();
}

function setColor(id: string, c: PenColor): void {
  const found = findBlock(activeList(), id);
  if (!found) return;
  pushUndo();
  found.block.color = c;
  drawLimit = null;
  sfx.tweak();
  persist();
  render();
}

function undo(): void {
  const prev = undoStack.pop();
  if (!prev) return;
  redoStack.push(cloneDoc(doc));
  doc = prev;
  selectedBlockId = null;
  activeContainerId = null;
  drawLimit = null;
  persist();
  render();
}

function redo(): void {
  const next = redoStack.pop();
  if (!next) return;
  undoStack.push(cloneDoc(doc));
  doc = next;
  selectedBlockId = null;
  activeContainerId = null;
  drawLimit = null;
  persist();
  render();
}

function clearProgram(): void {
  if (!doc.main.length && !doc.myBlock.length) return;
  pushUndo();
  doc = { main: [], myBlock: [], spin: doc.spin };
  selectedBlockId = null;
  activeContainerId = null;
  drawLimit = null;
  sfx.remove();
  persist();
  render();
}

function checkDrawing(): void {
  const match = currentMatch();
  if (!match) return;
  if (match.passed) {
    const blocks = countBlocks(doc);
    const star = level.parBlocks !== undefined && blocks <= level.parBlocks;
    if (!save.completed.includes(level.number)) save.completed.push(level.number);
    const prev = save.bestBlocks[level.number];
    save.bestBlocks[level.number] = Math.min(prev ?? Infinity, blocks);
    persist();
    successModal = { score: match.score, blocks, star };
    sfx.win();
    launchConfetti();
    render();
  } else {
    sfx.fail();
    showToast(`Almost! You're at ${match.score}% match — trace the dotted blueprint closely.`, 'error');
    render();
  }
}

function watchDraw(): void {
  const total = currentRun().segments.length;
  if (!total) {
    showToast('Add some blocks first!');
    render();
    return;
  }
  drawLimit = 0;
  syncLoop();
}

function launchConfetti(): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const host = document.createElement('div');
  host.className = 'confetti';
  const colors = ['#47f0ff', '#ff7edb', '#69f08d', '#ffd45d', '#a98bff'];
  for (let i = 0; i < 110; i++) {
    const p = document.createElement('i');
    p.style.left = `${Math.random() * 100}%`;
    p.style.background = colors[i % colors.length];
    p.style.animationDuration = `${2 + Math.random() * 1.4}s`;
    p.style.animationDelay = `${Math.random() * 0.5}s`;
    p.style.setProperty('--drift', `${(Math.random() * 2 - 1) * 140}px`);
    p.style.setProperty('--spin', `${540 + Math.random() * 720}deg`);
    host.appendChild(p);
  }
  document.body.appendChild(host);
  window.setTimeout(() => host.remove(), 4200);
}

// Canvas drawing
function paintCanvas(): void {
  const canvas = app.querySelector<HTMLCanvasElement>('.studio-canvas');
  if (!canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(200, Math.round(rect.width * dpr));
  const h = Math.max(200, Math.round(rect.height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const c = canvas.getContext('2d')!;
  c.save();
  c.clearRect(0, 0, w, h);
  const scale = w / STAGE_SIZE;
  c.translate(w / 2, h / 2);
  c.scale(scale, scale);

  // Subtle background grid
  c.strokeStyle = 'rgba(92, 122, 184, 0.14)';
  c.lineWidth = 1;
  for (let g = -200; g <= 200; g += 40) {
    c.beginPath();
    c.moveTo(g, -240);
    c.lineTo(g, 240);
    c.moveTo(-240, g);
    c.lineTo(240, g);
    c.stroke();
  }

  // Target ghost blueprint
  if (!level.sandbox && level.targetProgram) {
    const tSegs = targetSegments();
    c.save();
    c.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    c.lineWidth = 4;
    c.setLineDash([7, 7]);
    c.lineCap = 'round';
    for (const s of tSegs) {
      c.beginPath();
      c.moveTo(s.x1, s.y1);
      c.lineTo(s.x2, s.y2);
      c.stroke();
    }
    c.restore();
  }

  // Player drawing
  const run = currentRun(doc.spin ? spinAngle : 0, doc.spin ? spinHue : 0);
  const count = drawLimit === null ? run.segments.length : Math.min(run.segments.length, Math.floor(drawLimit));

  c.lineCap = 'round';
  c.lineJoin = 'round';
  for (let i = 0; i < count; i++) {
    const s = run.segments[i];
    c.strokeStyle = s.color;
    c.shadowColor = s.color;
    c.shadowBlur = 10;
    c.lineWidth = 3.5;
    c.beginPath();
    c.moveTo(s.x1, s.y1);
    c.lineTo(s.x2, s.y2);
    c.stroke();
  }
  c.shadowBlur = 0;

  // Turtle sprite at current head
  let tx = level.startX ?? 0;
  let ty = level.startY ?? 0;
  let ta = (level.startAngle ?? 0) + (doc.spin ? spinAngle : 0);
  if (count > 0 && count < run.segments.length) {
    const last = run.segments[count - 1];
    tx = last.x2;
    ty = last.y2;
    ta = (Math.atan2(last.y2 - last.y1, last.x2 - last.x1) * 180) / Math.PI + 90;
  } else if (count >= run.segments.length) {
    tx = run.endPose.x;
    ty = run.endPose.y;
    ta = run.endPose.angle;
  }

  c.save();
  c.translate(tx, ty);
  c.rotate((ta * Math.PI) / 180);
  // Turtle glow shell
  c.fillStyle = '#5ce68a';
  c.shadowColor = '#5ce68a';
  c.shadowBlur = 12;
  c.beginPath();
  c.arc(0, 0, 9, 0, Math.PI * 2);
  c.fill();
  // Head pointer
  c.fillStyle = '#ffffff';
  c.beginPath();
  c.moveTo(0, -14);
  c.lineTo(5, -6);
  c.lineTo(-5, -6);
  c.closePath();
  c.fill();
  c.restore();

  c.restore();
}

function syncLoop(): void {
  if (animFrame) cancelAnimationFrame(animFrame);
  animFrame = 0;
  const needsLoop = doc.spin || drawLimit !== null;
  if (!needsLoop) {
    paintCanvas();
    return;
  }
  const stepFrame = () => {
    let keepGoing = false;
    if (doc.spin) {
      spinAngle = (spinAngle + 0.8) % 360;
      spinHue = (spinHue + 0.25) % 360;
      keepGoing = true;
    }
    if (drawLimit !== null) {
      const total = currentRun().segments.length;
      const speed = Math.max(0.4, total / 90);
      drawLimit += speed;
      if (drawLimit >= total) {
        drawLimit = null;
      } else {
        keepGoing = true;
      }
    }
    paintCanvas();
    if (keepGoing) animFrame = requestAnimationFrame(stepFrame);
    else animFrame = 0;
  };
  animFrame = requestAnimationFrame(stepFrame);
}

// Rendering UI
function renderHeader(): string {
  const playable = LEVELS.filter(l => !l.sandbox);
  const solved = playable.filter(l => save.completed.includes(l.number)).length;
  const pct = Math.round((solved / playable.length) * 100);
  return `<header>
    <button class="brand" data-action="open-drawer"><span class="brand-dot"></span>TURTLE STUDIO</button>
    <button class="hdr-prog" data-action="open-drawer"><span class="hp-bar"><i style="width:${pct}%"></i></span><span>${solved}/${playable.length}</span></button>
    <button class="level-pill" data-action="open-drawer">${level.sandbox ? 'Sandbox' : `Level ${level.number}`} ⌄</button>
    <button class="icon-btn${save.muted ? ' muted' : ''}" data-action="toggle-mute" aria-label="Toggle sound">${save.muted ? '🔇' : '🔊'}</button>
    <button class="icon-btn" data-action="open-help" aria-label="Help">?</button>
  </header>`;
}

function renderBlock(b: Block, inMyBlock: boolean): string {
  const meta = BLOCK_META[b.kind];
  const sel = selectedBlockId === b.id;
  const hasStepper = b.kind === 'MOVE' || b.kind === 'BACK' || b.kind === 'TURN_R' || b.kind === 'TURN_L' || b.kind === 'REPEAT' || b.kind === 'CALL';
  const usesExpr = inMyBlock && (b.kind === 'MOVE' || b.kind === 'BACK' || b.kind === 'CALL');
  const isExprMode = usesExpr && b.sizeExpr && b.sizeExpr !== 'fixed';
  const unit = b.kind === 'TURN_R' || b.kind === 'TURN_L' ? '°' : b.kind === 'REPEAT' ? '×' : '';
  const stepAmt = b.kind === 'REPEAT' ? 1 : b.kind === 'TURN_R' || b.kind === 'TURN_L' ? 15 : 10;

  let control = '';
  if (b.kind === 'COLOR') {
    control = `<span class="step-val">${esc(b.color ?? 'cyan')}</span>`;
  } else if (hasStepper) {
    const exprPicker = usesExpr
      ? `<select class="expr-select" data-action="set-expr" data-id="${b.id}" aria-label="Size formula">
          <option value="fixed"${!b.sizeExpr || b.sizeExpr === 'fixed' ? ' selected' : ''}>number</option>
          <option value="size"${b.sizeExpr === 'size' ? ' selected' : ''}>size</option>
          <option value="size-10"${b.sizeExpr === 'size-10' ? ' selected' : ''}>size − 10</option>
          <option value="size-15"${b.sizeExpr === 'size-15' ? ' selected' : ''}>size − 15</option>
          <option value="size*0.7"${b.sizeExpr === 'size*0.7' ? ' selected' : ''}>size × 0.7</option>
          <option value="size*0.75"${b.sizeExpr === 'size*0.75' ? ' selected' : ''}>size × 0.75</option>
        </select>`
      : '';
    const stepper = !isExprMode
      ? `<span class="stepper">
          <button class="step-btn" data-action="step-val" data-id="${b.id}" data-delta="${-stepAmt}" aria-label="Decrease">−</button>
          <span class="step-val">${b.value ?? 0}${unit}</span>
          <button class="step-btn" data-action="step-val" data-id="${b.id}" data-delta="${stepAmt}" aria-label="Increase">+</button>
        </span>`
      : '';
    control = `${exprPicker}${stepper}`;
  }

  let quick = '';
  if (sel && (b.kind === 'TURN_R' || b.kind === 'TURN_L')) {
    quick = `<div class="quick-row">${ANGLE_PRESETS.map(
      a => `<button class="q-chip${b.value === a ? ' on' : ''}" data-action="set-val" data-id="${b.id}" data-val="${a}">${a}°</button>`,
    ).join('')}</div>`;
  } else if (sel && b.kind === 'COLOR') {
    quick = `<div class="quick-row">${PEN_COLORS.map(c => {
      const style = c === 'rainbow' ? '' : `style="background:${COLOR_HEX[c]}"`;
      return `<button class="swatch${c === 'rainbow' ? ' rainbow' : ''}${b.color === c ? ' on' : ''}" ${style} data-action="set-color" data-id="${b.id}" data-color="${c}" aria-label="${c}"></button>`;
    }).join('')}</div>`;
  }

  let loopBody = '';
  if (b.kind === 'REPEAT') {
    const inside = (b.body ?? []).map(child => renderBlock(child, inMyBlock)).join('');
    const isTarget = activeContainerId === b.id;
    loopBody = `<div class="loop-body">
      ${inside}
      <button class="loop-target${isTarget ? ' active' : ''}" data-action="set-container" data-id="${b.id}">${isTarget ? '✓ New blocks go inside this REPEAT' : '+ Tap here to add blocks inside'}</button>
    </div>`;
  }

  return `<div class="blk f-${meta.family}${sel ? ' selected' : ''}" data-action="select-block" data-id="${b.id}">
    <div class="blk-head">
      <span class="blk-name">${meta.label}</span>
      ${control}
      <span class="blk-tools">
        <button class="mini-btn" data-action="move-up" data-id="${b.id}" aria-label="Move up">↑</button>
        <button class="mini-btn" data-action="move-down" data-id="${b.id}" aria-label="Move down">↓</button>
        <button class="mini-btn del" data-action="del-block" data-id="${b.id}" aria-label="Delete">×</button>
      </span>
    </div>
    ${quick}
    ${loopBody}
  </div>`;
}

function renderPanel(): string {
  const list = activeList();
  const inMyBlock = activeTab === 'myBlock';
  const blocksCount = countBlocks(doc);

  const presets = level.sandbox
    ? `<div class="preset-row">${SANDBOX_PRESETS.map(
        (p, i) => `<button class="preset-btn" data-action="load-preset" data-preset="${i}">✨ ${esc(p.name)}</button>`,
      ).join('')}</div>`
    : '';

  const tabs = level.allowMyBlock
    ? `<div class="tabs">
        <button class="tab-btn${activeTab === 'main' ? ' active' : ''}" data-action="tab" data-tab="main">MAIN (${doc.main.length})</button>
        <button class="tab-btn fn-tab${activeTab === 'myBlock' ? ' active' : ''}" data-action="tab" data-tab="myBlock">MY BLOCK (size) (${doc.myBlock.length})</button>
      </div>`
    : '';

  const palette = `<div class="palette">${level.available
    .map(k => `<button class="pal-btn f-${BLOCK_META[k].family}" data-action="add-block" data-kind="${k}">+ ${BLOCK_META[k].label}</button>`)
    .join('')}</div>`;

  const bodyHtml = list.length
    ? list.map(b => renderBlock(b, inMyBlock)).join('') +
      (activeContainerId
        ? `<button class="loop-target" data-action="set-container" data-id="">+ Add new blocks at the end (outside REPEAT)</button>`
        : '')
    : `<div class="empty-slot">Tap a colorful block above to start drawing!</div>`;

  return `<aside class="panel">
    <div>
      <p class="eyebrow">${esc(level.section)} · ${level.sandbox ? 'Free Play' : `Level ${level.number}`}</p>
      <h1>${esc(level.name)}</h1>
    </div>
    <div class="card">
      <p>${esc(level.instructions)}</p>
      <div class="meta-row">
        <span>${blocksCount} block${blocksCount === 1 ? '' : 's'}</span>
        ${level.parBlocks !== undefined ? `<span class="star-goal">★ Goal: ≤ ${level.parBlocks} blocks</span>` : ''}
      </div>
      ${level.hint ? `<button class="hint-toggle" data-action="toggle-hint">${hintOpen ? 'Hide hint' : 'Need a hint?'}</button>${hintOpen ? `<div class="hint-box">${esc(level.hint)}</div>` : ''}` : ''}
      ${presets}
    </div>
    ${tabs}
    ${palette}
    <div class="prog-box">${bodyHtml}</div>
  </aside>`;
}

function renderDrawer(): string {
  const cards = LEVELS.map(l => {
    const done = save.completed.includes(l.number);
    const best = save.bestBlocks[l.number];
    const star = done && l.parBlocks !== undefined && best !== undefined && best <= l.parBlocks;
    return `<button class="lvl-card${l.number === level.number ? ' selected' : ''}${done ? ' done' : ''}" data-action="select-level" data-level="${l.number}">
      <span class="lvl-num">${done ? '✓' : l.sandbox ? '✦' : l.number}</span>
      <span><b>${esc(l.name)}</b><small>${esc(l.section)}</small></span>
      ${star ? '<span class="lvl-star">★</span>' : ''}
    </button>`;
  }).join('');
  return `<div class="backdrop drawer-backdrop" data-backdrop="close-drawer">
    <div class="drawer" role="dialog" aria-modal="true">
      <div class="drawer-head"><h2>Turtle Studio Levels</h2><button class="icon-btn" data-action="close-drawer" aria-label="Close">×</button></div>
      <div class="level-grid">${cards}</div>
    </div>
  </div>`;
}

function renderSuccess(): string {
  if (!successModal) return '';
  const hasNext = LEVELS.some(l => l.number === level.number + 1);
  return `<div class="backdrop" data-backdrop="close-success">
    <section class="modal" role="dialog" aria-modal="true">
      <div style="font-size:44px">✨</div>
      <p class="eyebrow">LEVEL ${level.number} COMPLETE</p>
      <h2>${esc(level.name)} — nailed it!</h2>
      <div class="modal-stats">
        <div><b>${successModal.score}%</b><span>shape match</span></div>
        <div class="${successModal.star ? 'star' : ''}"><b>${successModal.blocks}</b><span>blocks${level.parBlocks !== undefined ? ` · ★ ≤ ${level.parBlocks}` : ''}</span></div>
      </div>
      ${hasNext ? `<button class="bar-btn primary wide-btn" data-action="next-level">Next Level →</button>` : ''}
      <button class="text-link" data-action="close-success">Keep drawing</button>
    </section>
  </div>`;
}

function renderHelp(): string {
  return `<div class="backdrop" data-backdrop="close-help">
    <section class="modal" role="dialog" aria-modal="true" style="text-align:left">
      <p class="eyebrow">HOW TO PLAY</p>
      <h2>Code glowing art &amp; fractals</h2>
      <p style="color:#dbe6fc;line-height:1.5;font-size:14px">
        <b>1. Tap blocks</b> to build your drawing program. Tap any block in your list to adjust its steps, angles, or rainbow color.<br><br>
        <b>2. REPEAT loops:</b> Tap inside a REPEAT block so new blocks go inside it.<br><br>
        <b>3. MY BLOCK (size):</b> Teach your own reusable command — and call it inside itself with <b>size − 10</b> or <b>size × 0.7</b> to draw spirals and fractal trees!<br><br>
        <b>4. Animate:</b> Turn on <b>Spin</b> in the Animation Studio to watch your art spin in real time.
      </p>
      <button class="bar-btn primary wide-btn" data-action="close-help">Let's draw!</button>
    </section>
  </div>`;
}

function render(): void {
  const match = currentMatch();
  app.innerHTML = `${renderHeader()}
  <main class="stage">
    <section class="canvas-wrap">
      <canvas class="studio-canvas"></canvas>
      ${match ? `<div class="match-pill${match.passed ? ' good' : ''}">${match.score}% match</div>` : ''}
      ${toast ? `<div class="toast ${toast.kind}">${esc(toast.text)}</div>` : ''}
      <div class="canvas-bar">
        ${!level.sandbox ? `<button class="bar-btn primary" data-action="check">✓ Check Drawing</button>` : ''}
        <button class="bar-btn watch" data-action="watch">▶ Watch Draw</button>
        ${level.allowSpin ? `<button class="bar-btn spin${doc.spin ? ' on' : ''}" data-action="toggle-spin">🌀 ${doc.spin ? 'Spinning' : 'Spin'}</button>` : ''}
        <button class="bar-btn" data-action="undo"${undoStack.length ? '' : ' disabled'}>Undo</button>
        <button class="bar-btn" data-action="redo"${redoStack.length ? '' : ' disabled'}>Redo</button>
        <button class="bar-btn" data-action="clear"${doc.main.length || doc.myBlock.length ? '' : ' disabled'}>Clear</button>
      </div>
    </section>
    ${renderPanel()}
  </main>
  ${drawerOpen ? renderDrawer() : ''}
  ${successModal ? renderSuccess() : ''}
  ${helpOpen ? renderHelp() : ''}`;
  paintCanvas();
}

app.addEventListener('click', event => {
  const clicked = event.target as HTMLElement;
  if (clicked.tagName === 'SELECT') return;
  const target = clicked.closest<HTMLElement>('[data-action]') ?? (clicked.dataset.backdrop ? clicked : null);
  if (!target) return;
  const action = target.dataset.action ?? target.dataset.backdrop;
  const id = target.dataset.id ?? '';

  if (action === 'open-drawer') { drawerOpen = true; render(); }
  else if (action === 'close-drawer') { drawerOpen = false; render(); }
  else if (action === 'open-help') { helpOpen = true; render(); }
  else if (action === 'close-help') { helpOpen = false; render(); }
  else if (action === 'close-success') { successModal = null; render(); }
  else if (action === 'select-level') { selectLevel(Number(target.dataset.level)); }
  else if (action === 'next-level') { selectLevel(level.number + 1); }
  else if (action === 'toggle-mute') { save.muted = !save.muted; setMuted(save.muted); writeSave(save); render(); }
  else if (action === 'toggle-hint') { hintOpen = !hintOpen; render(); }
  else if (action === 'tab') { activeTab = target.dataset.tab as 'main' | 'myBlock'; activeContainerId = null; selectedBlockId = null; render(); }
  else if (action === 'add-block') { addBlock(target.dataset.kind as BlockKind); }
  else if (action === 'select-block') { selectedBlockId = id; render(); }
  else if (action === 'set-container') { activeContainerId = id || null; render(); }
  else if (action === 'step-val') { adjustValue(id, Number(target.dataset.delta)); }
  else if (action === 'set-val') { adjustValue(id, 0, Number(target.dataset.val)); }
  else if (action === 'set-color') { setColor(id, target.dataset.color as PenColor); }
  else if (action === 'move-up') { moveBlock(id, -1); }
  else if (action === 'move-down') { moveBlock(id, 1); }
  else if (action === 'del-block') { removeBlock(id); }
  else if (action === 'undo') { undo(); }
  else if (action === 'redo') { redo(); }
  else if (action === 'clear') { clearProgram(); }
  else if (action === 'check') { checkDrawing(); }
  else if (action === 'watch') { watchDraw(); }
  else if (action === 'toggle-spin') { doc.spin = !doc.spin; persist(); render(); syncLoop(); }
  else if (action === 'load-preset') {
    const preset = SANDBOX_PRESETS[Number(target.dataset.preset)];
    if (preset) {
      pushUndo();
      doc = cloneDoc(preset.doc);
      activeTab = 'main';
      activeContainerId = null;
      selectedBlockId = null;
      drawLimit = null;
      sfx.add();
      persist();
      render();
      syncLoop();
    }
  }
});

app.addEventListener('change', event => {
  const t = event.target as HTMLSelectElement;
  if (t.dataset.action === 'set-expr' && t.dataset.id) {
    setExpr(t.dataset.id, t.value as SizeExpr);
  }
});

window.addEventListener('resize', () => paintCanvas());

render();
syncLoop();
