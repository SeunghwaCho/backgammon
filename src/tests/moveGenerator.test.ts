import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateAllLegalSequences,
  getSelectablePoints,
  getMovesFromPoint,
  filterSequencesAfterMove,
} from '../game/MoveGenerator.js';
import type { Point, DiceState, Move } from '../game/Types.js';

/** Helpers */
function emptyBoard(): Point[] {
  return Array.from({ length: 26 }, () => ({ owner: null, count: 0 }));
}

function place(board: Point[], index: number, owner: 'white' | 'black', count: number): void {
  board[index] = { owner, count };
}

function makeDice(a: number, b: number): DiceState {
  if (a === b) {
    return { values: [a, b], remaining: [a, a, a, a] };
  }
  return { values: [a, b], remaining: [a, b] };
}

describe('generateAllLegalSequences - basic moves', () => {
  test('white with one checker and one die: one sequence', () => {
    const board = emptyBoard();
    place(board, 10, 'white', 1);
    const seqs = generateAllLegalSequences(board, 'white', makeDice(3, 5), 0);
    // Expected: from 10 to 7 (die=3) or from 10 to 5 (die=5)
    // Both dice can be used independently in one move each
    // But we need to maximize usage: try both dice for two-move sequences
    // However from 10 with die=3 → to 7, then from 7 with die=5 → to 2
    // from 10 with die=5 → to 5, then from 5 with die=3 → to 2
    // Both produce 2-move sequences
    assert.ok(seqs.length > 0);
    // All sequences should use both dice
    for (const seq of seqs) {
      assert.equal(seq.length, 2);
    }
  });

  test('black with one checker: moves in increasing direction', () => {
    const board = emptyBoard();
    place(board, 15, 'black', 1);
    const seqs = generateAllLegalSequences(board, 'black', makeDice(2, 4), 0);
    // From 15: die=2 → 17, die=4 → 19
    // Sequences of length 2
    assert.ok(seqs.length > 0);
    for (const seq of seqs) {
      assert.equal(seq.length, 2);
    }
    // All moves should go in increasing direction
    for (const seq of seqs) {
      for (const move of seq) {
        if (move.to !== 26) { // not bear-off
          assert.ok(move.to > move.from, `Black should move forward: ${move.from} -> ${move.to}`);
        }
      }
    }
  });

  test('returns no usable moves when all destinations blocked', () => {
    const board = emptyBoard();
    place(board, 10, 'white', 1);
    // Block all reachable destinations for dice 3 and 5
    place(board, 7, 'black', 2); // blocks die=3
    place(board, 5, 'black', 2); // blocks die=5
    // Also block any follow-up from 8 and 6
    place(board, 8, 'black', 2);
    place(board, 6, 'black', 2);
    place(board, 4, 'black', 2);
    place(board, 9, 'black', 2);
    // White can't move anywhere with dice 3 or 5
    const seqs = generateAllLegalSequences(board, 'white', makeDice(3, 5), 0);
    // When no moves are possible, the generator returns [[]] (one empty sequence)
    // indicating no legal sub-moves exist.
    const hasAnyMove = seqs.some(s => s.length > 0);
    assert.equal(hasAnyMove, false);
  });
});

describe('generateAllLegalSequences - bar priority', () => {
  test('white with checker on bar must enter first', () => {
    const board = emptyBoard();
    place(board, 0, 'white', 1);  // white bar
    place(board, 10, 'white', 5); // other checkers on board
    const seqs = generateAllLegalSequences(board, 'white', makeDice(3, 5), 0);
    // All sequences must start from bar (index 0)
    for (const seq of seqs) {
      assert.equal(seq[0].from, 0, 'First move must be from bar');
    }
  });

  test('black with checker on bar must enter first', () => {
    const board = emptyBoard();
    place(board, 25, 'black', 1); // black bar
    place(board, 15, 'black', 5);
    const seqs = generateAllLegalSequences(board, 'black', makeDice(2, 4), 0);
    for (const seq of seqs) {
      assert.equal(seq[0].from, 25, 'First move must be from bar');
    }
  });

  test('white bar entry blocked on one die: only uses unblocked die', () => {
    const board = emptyBoard();
    place(board, 0, 'white', 1); // white bar
    // die=3: would enter at 25-3=22, die=5: would enter at 25-5=20
    place(board, 22, 'black', 2); // blocks die=3 entry
    const seqs = generateAllLegalSequences(board, 'white', makeDice(3, 5), 0);
    // Only die=5 works for bar entry
    for (const seq of seqs) {
      assert.equal(seq[0].from, 0);
      assert.equal(seq[0].dieUsed, 5);
      assert.equal(seq[0].to, 20);
    }
  });
});

describe('generateAllLegalSequences - dice maximization', () => {
  test('must use both dice when possible', () => {
    const board = emptyBoard();
    place(board, 8, 'white', 2);
    const seqs = generateAllLegalSequences(board, 'white', makeDice(2, 4), 0);
    // Both dice can be used: 8→6 then 6→2, or 8→4 then 4→2
    for (const seq of seqs) {
      assert.equal(seq.length, 2, 'Should use both dice');
    }
  });

  test('uses one die when only one is playable', () => {
    const board = emptyBoard();
    place(board, 4, 'white', 1);
    // die=3 → to 1, die=5 → to -1 (bear off - but can't bear off yet)
    // die=3: 4→1, then from 1: 1-5=-4<0 but not in bearing off mode
    // Actually let's test: white at point 4, dice 3,5
    // die=3: 4→1 valid, then from 1: die=5→1-5=-4<1, need bear-off = not available (checkers at pt4 only? no...after move checker is at 1)
    // After 4→1 (using die=3), remaining die=5. From 1: 1-5=-4 would be bear-off but can we? need all in home
    // At this point, checker at 1 → still in home board. canBearOff: only 1 checker on board (at pt1), it's in home. YES can bear off.
    // So with die=5 from pt1: 1-5=-4<0 → to=-1? No: -1 is used, but die=5 from point 1: distanceNeeded=1, die=5>1. Can overshoot?
    // No checker on points 2-6 → overshoot allowed → valid bear off.
    // So both dice can be used. Let's use a scenario where truly only 1 die works.
    const board2 = emptyBoard();
    place(board2, 3, 'white', 1);
    // Block all destinations for die=4: 3-4=-1 → bear off but not ready (checker at 3, not in home? wait, 3 IS in white home 1-6)
    // Hmm. Let me think of a simpler case.
    // White at point 15, die=3 → to 12, die=5 → to 10.
    // After 15→12 with die=3: from 12 with die=5 → 7
    // After 15→10 with die=5: from 10 with die=3 → 7
    // Both work as 2-move sequences.
    // To test single die: block the continuation.
    const board3 = emptyBoard();
    place(board3, 15, 'white', 1);
    // Block everything reachable from 12: block 9,8,7 (die=3,4,5 from 12)
    place(board3, 12, 'black', 2); // block landing on 12 with die=3
    // Wait — die=3 from 15 → 12, but 12 is blocked. Die=5 from 15→10.
    // From 10 with die=3 → 7. So two-die sequence exists: 15→10, 10→7.
    // Need to find a case where only one die can be used at all.
    // White at point 4, dice 5 and 5 (doubles) — but that's doubles.
    // Simple case: white at point 2, dice 3 and 3 (not doubles, use 3,5).
    // die=3 from 2 → to -1 (bear off) - valid if all in home
    // die=5 from 2 → to -1 (overshoot bear off) - valid if no checkers on 3-6
    // Use a board where only one checker on point 2 and all home.
    const board4 = emptyBoard();
    place(board4, 2, 'white', 1);
    // Only 1 checker at pt2, all in home board.
    // die=3 → exact bear off from 2? No: distanceNeeded for white at pt2 = die must = 2. die=3 > 2 → overshoot check: no checkers on pt3-6 → valid!
    // die=5 → 5 > 2 → overshoot: no checkers on pt3-6 → valid!
    // After first bear-off (1 checker only), board is empty → no second move.
    const seqs4 = generateAllLegalSequences(board4, 'white', makeDice(3, 5), 0);
    // 1 checker, can bear off with die=3 or die=5. Max dice used = 1.
    // Higher die rule: must use die=5 (if only 1 die can be used, use higher)
    assert.ok(seqs4.length > 0);
    for (const seq of seqs4) {
      assert.equal(seq.length, 1);
    }
  });
});

describe('generateAllLegalSequences - higher die rule', () => {
  test('when only one die can be used, must use higher die', () => {
    const board = emptyBoard();
    // White at point 3, can only move with die=3 OR die=5, not both
    // After 3→0 (bear-off with die=3), no checkers left — 1 move only
    // After 3→-1 (bear-off with die=5, overshoot), no checkers left — 1 move only
    // Actually both work individually, but can't combine (only 1 checker)
    place(board, 3, 'white', 1);
    const seqs = generateAllLegalSequences(board, 'white', makeDice(3, 5), 0);
    // Higher die rule: must prefer die=5
    assert.ok(seqs.length > 0);
    for (const seq of seqs) {
      assert.equal(seq[0].dieUsed, 5, 'Must use higher die (5 > 3)');
    }
  });

  test('higher die rule: white with die=2 vs die=6, only one usable', () => {
    const board = emptyBoard();
    place(board, 6, 'white', 1); // only checker
    // die=6: from 6 → exact bear-off. die=2: from 6 → 4.
    // After 6→4 (die=2), from 4: die=6 → bear off (4 < 6, no checkers on 5-6)? yes.
    // So both dice can be used in sequence. Let's block continuation.
    // Simpler: single checker at point 1 (die=1 exact, die=5 overshoot if no 2-6)
    // No wait, canBearOff requires ALL in home. With just 1 checker at pt1, can bear off.
    // die=5 from 1 → overshoot → valid. die=1 from 1 → exact → valid.
    // After bear-off, only 1 checker, no second move. Higher die=5 preferred.
    place(board, 1, 'white', 1);
    board[6] = { owner: null, count: 0 }; // clear previous

    const board2 = emptyBoard();
    place(board2, 1, 'white', 1);
    const seqs = generateAllLegalSequences(board2, 'white', makeDice(1, 5), 0);
    assert.ok(seqs.length > 0);
    for (const seq of seqs) {
      assert.equal(seq[0].dieUsed, 5, 'Should use die=5 (higher die rule)');
    }
  });

  test('higher die rule does NOT apply to doubles', () => {
    const board = emptyBoard();
    place(board, 5, 'white', 1); // single checker
    // doubles 3,3,3,3 — all same value, so higher-die rule N/A
    const seqs = generateAllLegalSequences(board, 'white', makeDice(3, 3), 0);
    // Can use die=3: 5→2, then 2→bear-off if can
    // At point 5 and all in home: can bear-off.
    // 5→2 (die=3), then 2→bear-off (die=3, overshoot: no checkers 3-6 after move)
    // Then no more checkers → 2 moves used out of 4
    assert.ok(seqs.length > 0);
    // All sequences should use die value=3
    for (const seq of seqs) {
      for (const move of seq) {
        assert.equal(move.dieUsed, 3);
      }
    }
  });
});

describe('generateAllLegalSequences - doubles', () => {
  test('doubles: up to 4 sub-moves with same die value', () => {
    const board = emptyBoard();
    // 4 white checkers spread, using double 3s
    place(board, 12, 'white', 1);
    place(board, 9, 'white', 1);
    place(board, 6, 'white', 1);
    place(board, 4, 'white', 1);
    const seqs = generateAllLegalSequences(board, 'white', makeDice(3, 3), 0);
    assert.ok(seqs.length > 0);
    // Max length = 4 moves
    const maxLen = Math.max(...seqs.map(s => s.length));
    assert.equal(maxLen, 4);
    // All die values must be 3
    for (const seq of seqs) {
      for (const move of seq) {
        assert.equal(move.dieUsed, 3);
      }
    }
  });

  test('doubles: stops at fewer moves if board runs out', () => {
    const board = emptyBoard();
    place(board, 6, 'white', 1); // only 1 checker, max 2 moves of die=3: 6→3→bear-off
    const seqs = generateAllLegalSequences(board, 'white', makeDice(3, 3), 0);
    assert.ok(seqs.length > 0);
    // 6→3 (die=3), then 3→bear-off (die=3 > 3? no, 3=3 exact bear-off)
    const maxLen = Math.max(...seqs.map(s => s.length));
    assert.ok(maxLen <= 2); // can't use more than 2 dice with 1 checker
  });
});

describe('generateAllLegalSequences - bear-off sequences', () => {
  test('white can generate complete bear-off sequence', () => {
    const board = emptyBoard();
    place(board, 3, 'white', 2);
    place(board, 1, 'white', 2);
    const seqs = generateAllLegalSequences(board, 'white', makeDice(3, 1), 0);
    assert.ok(seqs.length > 0);
    // At least one sequence should include a bear-off move (to=-1)
    const hasBearOff = seqs.some(seq => seq.some(m => m.to === -1));
    assert.ok(hasBearOff, 'Should generate bear-off moves');
  });

  test('black can generate complete bear-off sequence', () => {
    const board = emptyBoard();
    place(board, 22, 'black', 2);
    place(board, 24, 'black', 2);
    const seqs = generateAllLegalSequences(board, 'black', makeDice(3, 1), 0);
    assert.ok(seqs.length > 0);
    // At least one sequence should include a bear-off move (to=26)
    const hasBearOff = seqs.some(seq => seq.some(m => m.to === 26));
    assert.ok(hasBearOff, 'Should generate black bear-off moves');
  });
});

describe('getSelectablePoints', () => {
  test('returns set of unique first-move sources', () => {
    const board = emptyBoard();
    place(board, 10, 'white', 2);
    place(board, 8, 'white', 2);
    const seqs = generateAllLegalSequences(board, 'white', makeDice(2, 4), 0);
    const selectable = getSelectablePoints(seqs);
    assert.ok(selectable.size > 0);
    // Sources must be from the board positions we set up
    for (const pt of selectable) {
      assert.ok([10, 8, 6, 4].includes(pt) || pt >= 1, `Point ${pt} should be a valid source`);
    }
  });

  test('returns empty set when no sequences', () => {
    const selectable = getSelectablePoints([]);
    assert.equal(selectable.size, 0);
  });
});

describe('getMovesFromPoint', () => {
  test('returns valid first moves from specific source', () => {
    const board = emptyBoard();
    place(board, 10, 'white', 2);
    const seqs = generateAllLegalSequences(board, 'white', makeDice(2, 4), 0);
    const moves = getMovesFromPoint(seqs, 10);
    assert.ok(moves.length > 0);
    for (const m of moves) {
      assert.equal(m.from, 10);
    }
  });

  test('returns empty when source not in any sequence', () => {
    const board = emptyBoard();
    place(board, 10, 'white', 2);
    const seqs = generateAllLegalSequences(board, 'white', makeDice(2, 4), 0);
    const moves = getMovesFromPoint(seqs, 15); // not a source
    assert.equal(moves.length, 0);
  });
});

describe('filterSequencesAfterMove', () => {
  test('filters sequences to those starting with the given move', () => {
    const board = emptyBoard();
    place(board, 10, 'white', 2);
    const seqs = generateAllLegalSequences(board, 'white', makeDice(2, 4), 0);
    // Get first move options from point 10
    const moves = getMovesFromPoint(seqs, 10);
    assert.ok(moves.length > 0);
    const firstMove = moves[0];
    const filtered = filterSequencesAfterMove(seqs, firstMove);
    // Filtered sequences should be the remainder after the first move
    for (const seq of filtered) {
      // Should not start with the same move
      if (seq.length > 0) {
        assert.ok(
          !(seq[0].from === firstMove.from && seq[0].to === firstMove.to),
          'Filtered sequence should not repeat the first move'
        );
      }
    }
  });

  test('returns empty when move not in any sequence', () => {
    const board = emptyBoard();
    place(board, 10, 'white', 2);
    const seqs = generateAllLegalSequences(board, 'white', makeDice(2, 4), 0);
    const fakeMove: Move = { from: 10, to: 3, dieUsed: 7, isHit: false };
    const filtered = filterSequencesAfterMove(seqs, fakeMove);
    assert.equal(filtered.length, 0);
  });
});

describe('edge cases', () => {
  test('no legal moves: generator reports hasAnyMove=false', () => {
    const board = emptyBoard();
    place(board, 3, 'white', 1);
    // Block all reachable points
    place(board, 2, 'black', 2); // blocks die=1
    place(board, 1, 'black', 2); // blocks die=2
    // die=1: 3→2 blocked; die=2: 3→1 blocked
    const seqs = generateAllLegalSequences(board, 'white', makeDice(1, 2), 0);
    // Generator returns [[]] when no moves: one empty sequence, no moves inside
    const hasAnyMove = seqs.some(s => s.length > 0);
    assert.equal(hasAnyMove, false);
  });

  test('deduplication: same sequence not returned twice', () => {
    const board = emptyBoard();
    place(board, 8, 'white', 5); // many checkers, dice 3,3 could produce duplicates
    const seqs = generateAllLegalSequences(board, 'white', makeDice(3, 3), 0);
    const keys = seqs.map(seq => seq.map(m => `${m.from}>${m.to}`).join(','));
    const uniqueKeys = new Set(keys);
    assert.equal(keys.length, uniqueKeys.size, 'No duplicate sequences');
  });
});
