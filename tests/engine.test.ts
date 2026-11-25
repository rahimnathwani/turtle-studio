import { describe, expect, it } from 'vitest';
import { LEVELS } from '../src/data/levels';
import { countBlocks, executeProgram, matchDrawing } from '../src/turtle/engine';

describe('Turtle Studio engine & all puzzle targets', () => {
  it('every puzzle targetProgram runs cleanly and matches itself 100%', () => {
    for (const lvl of LEVELS) {
      if (lvl.sandbox || !lvl.targetProgram) continue;
      const doc = {
        main: lvl.targetProgram.main,
        myBlock: lvl.targetProgram.myBlock ?? [],
        spin: false,
      };
      const res = executeProgram(doc, {
        startX: lvl.startX,
        startY: lvl.startY,
        startAngle: lvl.startAngle,
      });
      expect(res.segments.length, `Level ${lvl.number} (${lvl.name}) segments`).toBeGreaterThan(0);
      expect(res.stoppedEarly, `Level ${lvl.number} stoppedEarly`).toBe(false);
      const match = matchDrawing(res.segments, res.segments);
      expect(match.passed).toBe(true);
      expect(match.score).toBe(100);
      if (lvl.parBlocks !== undefined) {
        expect(countBlocks(doc), `Level ${lvl.number} parBlocks`).toBeLessThanOrEqual(lvl.parBlocks);
      }
    }
  });

  it('matches a square drawn counter-clockwise against a clockwise target', () => {
    const sq = LEVELS.find(l => l.number === 3)!;
    const target = executeProgram(
      { main: sq.targetProgram!.main, myBlock: [], spin: false },
      { startX: sq.startX, startY: sq.startY },
    );
    const reverse = executeProgram(
      {
        main: [
          {
            id: 'r',
            kind: 'REPEAT',
            value: 4,
            body: [
              { id: 't', kind: 'TURN_R', value: 90 },
              { id: 'm', kind: 'MOVE', value: 120 },
            ],
          },
        ],
        myBlock: [],
        spin: false,
      },
      { startX: sq.startX, startY: sq.startY },
    );
    // Turning right first draws a square shifted; verify different shape fails
    expect(matchDrawing(reverse.segments, target.segments).passed).toBe(false);
  });
});
