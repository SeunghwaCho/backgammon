import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createInitialBoard, cloneBoard, barIndex, createInitialGameState } from '../game/GameState.js';
import {
  isSingleMoveValid,
  canBearOff,
  applySingleMove,
  isBlocked,
  isBlot,
  getHomeBoardRange,
  getPipCount,
  checkWinner,
  getWinType,
  winTypeMultiplier,
} from '../game/Rules.js';
import type { Point } from '../game/Types.js';

/** Helpers */
function emptyBoard(): Point[] {
  return Array.from({ length: 26 }, () => ({ owner: null, count: 0 }));
}

function placeCheckers(board: Point[], index: number, owner: 'white' | 'black', count: number): void {
  board[index] = { owner, count };
}

describe('getHomeBoardRange', () => {
  test('white home board is 1-6', () => {
    assert.deepEqual(getHomeBoardRange('white'), [1, 6]);
  });
  test('black home board is 19-24', () => {
    assert.deepEqual(getHomeBoardRange('black'), [19, 24]);
  });
});

describe('isBlocked', () => {
  test('returns false when point is empty', () => {
    const board = emptyBoard();
    assert.equal(isBlocked(board, 10, 'white'), false);
  });

  test('returns false when point has 1 opponent checker (blot)', () => {
    const board = emptyBoard();
    placeCheckers(board, 10, 'black', 1);
    assert.equal(isBlocked(board, 10, 'white'), false);
  });

  test('returns true when point has 2+ opponent checkers', () => {
    const board = emptyBoard();
    placeCheckers(board, 10, 'black', 2);
    assert.equal(isBlocked(board, 10, 'white'), true);
  });

  test('returns false when point has own checkers', () => {
    const board = emptyBoard();
    placeCheckers(board, 10, 'white', 3);
    assert.equal(isBlocked(board, 10, 'white'), false);
  });

  test('returns false for bar indices', () => {
    const board = emptyBoard();
    assert.equal(isBlocked(board, 0, 'white'), false);
    assert.equal(isBlocked(board, 25, 'black'), false);
  });
});

describe('isBlot', () => {
  test('returns true when point has exactly 1 opponent checker', () => {
    const board = emptyBoard();
    placeCheckers(board, 5, 'black', 1);
    assert.equal(isBlot(board, 5, 'white'), true);
  });

  test('returns false when point has 2 opponent checkers', () => {
    const board = emptyBoard();
    placeCheckers(board, 5, 'black', 2);
    assert.equal(isBlot(board, 5, 'white'), false);
  });

  test('returns false when point has own checkers', () => {
    const board = emptyBoard();
    placeCheckers(board, 5, 'white', 1);
    assert.equal(isBlot(board, 5, 'white'), false);
  });
});

describe('canBearOff', () => {
  test('white cannot bear off when checkers outside home board', () => {
    const board = emptyBoard();
    placeCheckers(board, 8, 'white', 1); // point 8 is outside home (1-6)
    placeCheckers(board, 3, 'white', 14);
    assert.equal(canBearOff(board, 'white', 0), false);
  });

  test('white can bear off when all checkers in home board (1-6)', () => {
    const board = emptyBoard();
    placeCheckers(board, 1, 'white', 5);
    placeCheckers(board, 3, 'white', 5);
    placeCheckers(board, 6, 'white', 5);
    assert.equal(canBearOff(board, 'white', 0), true);
  });

  test('white cannot bear off with checker on bar', () => {
    const board = emptyBoard();
    placeCheckers(board, 0, 'white', 1); // white bar
    placeCheckers(board, 3, 'white', 14);
    assert.equal(canBearOff(board, 'white', 0), false);
  });

  test('black cannot bear off when checkers outside home board', () => {
    const board = emptyBoard();
    placeCheckers(board, 12, 'black', 1); // point 12 outside black home (19-24)
    placeCheckers(board, 21, 'black', 14);
    assert.equal(canBearOff(board, 'black', 0), false);
  });

  test('black can bear off when all checkers in home board (19-24)', () => {
    const board = emptyBoard();
    placeCheckers(board, 19, 'black', 5);
    placeCheckers(board, 22, 'black', 5);
    placeCheckers(board, 24, 'black', 5);
    assert.equal(canBearOff(board, 'black', 0), true);
  });

  test('black cannot bear off with checker on bar', () => {
    const board = emptyBoard();
    placeCheckers(board, 25, 'black', 1); // black bar
    placeCheckers(board, 22, 'black', 14);
    assert.equal(canBearOff(board, 'black', 0), false);
  });
});

describe('isSingleMoveValid - normal moves', () => {
  test('white moves from 10 to 7 with die=3', () => {
    const board = emptyBoard();
    placeCheckers(board, 10, 'white', 2);
    assert.equal(isSingleMoveValid(board, 'white', 0, 10, 7, 3), true);
  });

  test('white cannot move to blocked point', () => {
    const board = emptyBoard();
    placeCheckers(board, 10, 'white', 2);
    placeCheckers(board, 7, 'black', 2); // blocked
    assert.equal(isSingleMoveValid(board, 'white', 0, 10, 7, 3), false);
  });

  test('white can hit blot', () => {
    const board = emptyBoard();
    placeCheckers(board, 10, 'white', 2);
    placeCheckers(board, 7, 'black', 1); // blot
    assert.equal(isSingleMoveValid(board, 'white', 0, 10, 7, 3), true);
  });

  test('white cannot move with wrong die value', () => {
    const board = emptyBoard();
    placeCheckers(board, 10, 'white', 2);
    assert.equal(isSingleMoveValid(board, 'white', 0, 10, 7, 4), false);
  });

  test('black moves from 15 to 18 with die=3', () => {
    const board = emptyBoard();
    placeCheckers(board, 15, 'black', 2);
    assert.equal(isSingleMoveValid(board, 'black', 0, 15, 18, 3), true);
  });

  test('black cannot move to blocked point', () => {
    const board = emptyBoard();
    placeCheckers(board, 15, 'black', 2);
    placeCheckers(board, 18, 'white', 2); // blocked
    assert.equal(isSingleMoveValid(board, 'black', 0, 15, 18, 3), false);
  });

  test('cannot move from empty point', () => {
    const board = emptyBoard();
    assert.equal(isSingleMoveValid(board, 'white', 0, 10, 7, 3), false);
  });
});

describe('isSingleMoveValid - bar re-entry', () => {
  test('white bar re-entry to point 22 with die=3 (25-3=22)', () => {
    const board = emptyBoard();
    placeCheckers(board, 0, 'white', 1); // white on bar
    assert.equal(isSingleMoveValid(board, 'white', 0, 0, 22, 3), true);
  });

  test('white bar re-entry to point 19 with die=6 (25-6=19)', () => {
    const board = emptyBoard();
    placeCheckers(board, 0, 'white', 1);
    assert.equal(isSingleMoveValid(board, 'white', 0, 0, 19, 6), true);
  });

  test('white bar re-entry blocked by black', () => {
    const board = emptyBoard();
    placeCheckers(board, 0, 'white', 1);
    placeCheckers(board, 22, 'black', 2); // blocks die=3
    assert.equal(isSingleMoveValid(board, 'white', 0, 0, 22, 3), false);
  });

  test('white must re-enter from bar before moving other pieces', () => {
    const board = emptyBoard();
    placeCheckers(board, 0, 'white', 1); // white on bar
    placeCheckers(board, 10, 'white', 2); // white also on board
    // Moving from point 10 is invalid while there's a checker on bar
    assert.equal(isSingleMoveValid(board, 'white', 0, 10, 7, 3), false);
  });

  test('black bar re-entry to point 4 with die=4', () => {
    const board = emptyBoard();
    placeCheckers(board, 25, 'black', 1); // black on bar
    assert.equal(isSingleMoveValid(board, 'black', 0, 25, 4, 4), true);
  });

  test('black bar re-entry blocked', () => {
    const board = emptyBoard();
    placeCheckers(board, 25, 'black', 1);
    placeCheckers(board, 4, 'white', 2); // blocks die=4
    assert.equal(isSingleMoveValid(board, 'black', 0, 25, 4, 4), false);
  });
});

describe('isSingleMoveValid - bearing off (white)', () => {
  test('white exact bear-off from point 3 with die=3', () => {
    const board = emptyBoard();
    placeCheckers(board, 3, 'white', 3);
    placeCheckers(board, 1, 'white', 12);
    assert.equal(isSingleMoveValid(board, 'white', 0, 3, -1, 3), true);
  });

  test('white overshoot bear-off from point 3 with die=5 (no checkers on 4-6)', () => {
    const board = emptyBoard();
    placeCheckers(board, 3, 'white', 3);
    placeCheckers(board, 1, 'white', 12);
    // No checkers on 4, 5, 6 - overshoot allowed
    assert.equal(isSingleMoveValid(board, 'white', 0, 3, -1, 5), true);
  });

  test('white overshoot NOT allowed when higher home points occupied', () => {
    const board = emptyBoard();
    placeCheckers(board, 3, 'white', 3);
    placeCheckers(board, 5, 'white', 2); // point 5 is higher than 3
    placeCheckers(board, 1, 'white', 10);
    // die=5 but point 5 has checkers, so can't overshoot from point 3
    assert.equal(isSingleMoveValid(board, 'white', 0, 3, -1, 5), false);
  });

  test('white cannot bear off when not all checkers in home board', () => {
    const board = emptyBoard();
    placeCheckers(board, 3, 'white', 3);
    placeCheckers(board, 10, 'white', 12); // outside home board
    assert.equal(isSingleMoveValid(board, 'white', 0, 3, -1, 3), false);
  });

  test('white cannot bear off with die < point value', () => {
    const board = emptyBoard();
    placeCheckers(board, 5, 'white', 5);
    placeCheckers(board, 3, 'white', 10);
    // die=3 is less than point 5, not valid
    assert.equal(isSingleMoveValid(board, 'white', 0, 5, -1, 3), false);
  });
});

describe('isSingleMoveValid - bearing off (black)', () => {
  test('black exact bear-off from point 22 with die=3 (25-22=3)', () => {
    const board = emptyBoard();
    placeCheckers(board, 22, 'black', 3);
    placeCheckers(board, 24, 'black', 12);
    assert.equal(isSingleMoveValid(board, 'black', 0, 22, 26, 3), true);
  });

  test('black exact bear-off from point 19 with die=6 (25-19=6)', () => {
    const board = emptyBoard();
    placeCheckers(board, 19, 'black', 3);
    placeCheckers(board, 24, 'black', 12);
    assert.equal(isSingleMoveValid(board, 'black', 0, 19, 26, 6), true);
  });

  test('black exact bear-off from point 24 with die=1 (25-24=1)', () => {
    const board = emptyBoard();
    placeCheckers(board, 24, 'black', 15);
    assert.equal(isSingleMoveValid(board, 'black', 0, 24, 26, 1), true);
  });

  test('black overshoot: from point 22 with die=5 (need 3), no lower-index checkers', () => {
    const board = emptyBoard();
    placeCheckers(board, 22, 'black', 5);
    placeCheckers(board, 24, 'black', 10);
    // die=5 > distanceNeeded=3; lower points (19, 20, 21) have no checkers → allowed
    assert.equal(isSingleMoveValid(board, 'black', 0, 22, 26, 5), true);
  });

  test('black overshoot NOT allowed when lower home points occupied', () => {
    const board = emptyBoard();
    placeCheckers(board, 22, 'black', 5);
    placeCheckers(board, 20, 'black', 5); // point 20 < 22, further from bearing off
    placeCheckers(board, 24, 'black', 5);
    // die=5 > distanceNeeded=3, but point 20 has checkers → not allowed
    assert.equal(isSingleMoveValid(board, 'black', 0, 22, 26, 5), false);
  });

  test('black cannot bear off when not all in home board', () => {
    const board = emptyBoard();
    placeCheckers(board, 22, 'black', 3);
    placeCheckers(board, 12, 'black', 12); // outside home
    assert.equal(isSingleMoveValid(board, 'black', 0, 22, 26, 3), false);
  });

  test('black die < distanceNeeded is invalid', () => {
    const board = emptyBoard();
    placeCheckers(board, 19, 'black', 5); // distanceNeeded = 25-19 = 6
    placeCheckers(board, 24, 'black', 10);
    // die=4 < 6 → invalid
    assert.equal(isSingleMoveValid(board, 'black', 0, 19, 26, 4), false);
  });
});

describe('applySingleMove', () => {
  test('normal move: moves checker from source to destination', () => {
    const board = emptyBoard();
    placeCheckers(board, 10, 'white', 2);
    const { newBoard, isHit } = applySingleMove(board, 'white', 10, 7);
    assert.equal(newBoard[10].count, 1);
    assert.equal(newBoard[7].owner, 'white');
    assert.equal(newBoard[7].count, 1);
    assert.equal(isHit, false);
  });

  test('hit: sends opponent blot to bar', () => {
    const board = emptyBoard();
    placeCheckers(board, 10, 'white', 2);
    placeCheckers(board, 7, 'black', 1); // blot
    const { newBoard, isHit } = applySingleMove(board, 'white', 10, 7);
    assert.equal(isHit, true);
    assert.equal(newBoard[7].owner, 'white');
    assert.equal(newBoard[7].count, 1);
    // Black checker sent to black bar (index 25)
    assert.equal(newBoard[25].owner, 'black');
    assert.equal(newBoard[25].count, 1);
  });

  test('hit: accumulates on bar when multiple checkers already there', () => {
    const board = emptyBoard();
    placeCheckers(board, 10, 'white', 2);
    placeCheckers(board, 7, 'black', 1);
    placeCheckers(board, 25, 'black', 2); // already 2 on bar
    const { newBoard, isHit } = applySingleMove(board, 'white', 10, 7);
    assert.equal(isHit, true);
    assert.equal(newBoard[25].count, 3);
  });

  test('bear-off: removes checker from source, does not add anywhere', () => {
    const board = emptyBoard();
    placeCheckers(board, 3, 'white', 2);
    const { newBoard, isHit } = applySingleMove(board, 'white', 3, -1);
    assert.equal(newBoard[3].count, 1);
    assert.equal(isHit, false);
    // Checker is gone from board entirely (borneOff tracked externally)
  });

  test('does not mutate original board', () => {
    const board = emptyBoard();
    placeCheckers(board, 10, 'white', 2);
    const original10Count = board[10].count;
    applySingleMove(board, 'white', 10, 7);
    assert.equal(board[10].count, original10Count); // original unchanged
  });

  test('stacking: second checker on same destination', () => {
    const board = emptyBoard();
    placeCheckers(board, 10, 'white', 2);
    placeCheckers(board, 7, 'white', 1);
    const { newBoard } = applySingleMove(board, 'white', 10, 7);
    assert.equal(newBoard[7].owner, 'white');
    assert.equal(newBoard[7].count, 2);
  });

  test('bar entry: moves checker from bar to point', () => {
    const board = emptyBoard();
    placeCheckers(board, 0, 'white', 1); // white on bar
    const { newBoard, isHit } = applySingleMove(board, 'white', 0, 22);
    assert.equal(newBoard[0].count, 0);
    assert.equal(newBoard[22].owner, 'white');
    assert.equal(newBoard[22].count, 1);
    assert.equal(isHit, false);
  });
});

describe('getPipCount', () => {
  test('white pip count on initial board = 167', () => {
    // Standard starting position:
    // 2 × pt24 = 48, 5 × pt13 = 65, 3 × pt8 = 24, 5 × pt6 = 30  → total 167
    const board = createInitialBoard();
    assert.equal(getPipCount(board, 'white', 0), 167);
  });

  test('black pip count on initial board = 167 (symmetric)', () => {
    // 2 × (25-1)=48, 5 × (25-12)=65, 3 × (25-17)=24, 5 × (25-19)=30 → 167
    const board = createInitialBoard();
    assert.equal(getPipCount(board, 'black', 0), 167);
  });

  test('white pip decreases after moving closer to home', () => {
    const board = emptyBoard();
    placeCheckers(board, 10, 'white', 1);
    const before = getPipCount(board, 'white', 0);
    const { newBoard } = applySingleMove(board, 'white', 10, 7);
    const after = getPipCount(newBoard, 'white', 0);
    assert.equal(before - after, 3); // moved 3 pips closer
  });

  test('black pip decreases after moving closer to home', () => {
    const board = emptyBoard();
    placeCheckers(board, 15, 'black', 1);
    const before = getPipCount(board, 'black', 0);
    const { newBoard } = applySingleMove(board, 'black', 15, 18);
    const after = getPipCount(newBoard, 'black', 0);
    assert.equal(before - after, 3);
  });

  test('white checker on bar has pip count of 25', () => {
    const board = emptyBoard();
    placeCheckers(board, 0, 'white', 1); // bar
    assert.equal(getPipCount(board, 'white', 0), 25);
  });

  test('black checker on bar has pip count of 25', () => {
    const board = emptyBoard();
    placeCheckers(board, 25, 'black', 1); // bar
    assert.equal(getPipCount(board, 'black', 0), 25);
  });

  test('pip count = 0 when no checkers on board', () => {
    const board = emptyBoard();
    assert.equal(getPipCount(board, 'white', 0), 0);
    assert.equal(getPipCount(board, 'black', 0), 0);
  });

  test('pip count unaffected by borne-off count parameter', () => {
    // getPipCount only counts checkers ON the board; borneOff param not used
    const board = emptyBoard();
    placeCheckers(board, 5, 'white', 2);
    assert.equal(getPipCount(board, 'white', 0), getPipCount(board, 'white', 5));
  });
});

// ─── checkWinner ─────────────────────────────────────────────────────────────

describe('checkWinner', () => {
  test('returns null when nobody has borne off 15', () => {
    const state = createInitialGameState();
    assert.equal(checkWinner(state), null);
  });

  test('returns white when white has borne off 15', () => {
    const state = createInitialGameState();
    state.whiteBorneOff = 15;
    assert.equal(checkWinner(state), 'white');
  });

  test('returns black when black has borne off 15', () => {
    const state = createInitialGameState();
    state.blackBorneOff = 15;
    assert.equal(checkWinner(state), 'black');
  });

  test('returns null when both are at 14', () => {
    const state = createInitialGameState();
    state.whiteBorneOff = 14;
    state.blackBorneOff = 14;
    assert.equal(checkWinner(state), null);
  });
});

// ─── getWinType ───────────────────────────────────────────────────────────────

describe('getWinType', () => {
  /** Build a minimal game state to test win type classification. */
  function winState(opts: {
    loserBorneOff?: number;
    loserOnBar?: boolean;
    loserInWinnerHome?: boolean;
    winner?: 'white' | 'black';
  } = {}): ReturnType<typeof createInitialGameState> {
    const winner = opts.winner ?? 'white';
    const loser: 'white' | 'black' = winner === 'white' ? 'black' : 'white';
    const state = createInitialGameState();
    state.board = emptyBoard();

    if (loser === 'black') {
      state.blackBorneOff = opts.loserBorneOff ?? 0;
      if (opts.loserOnBar) {
        state.board[25] = { owner: 'black', count: 1 };
      }
      if (opts.loserInWinnerHome) {
        // winner = white, home = 1-6
        state.board[3] = { owner: 'black', count: 1 };
      }
      // Remaining black checkers in neutral zone
      const placed = (opts.loserOnBar ? 1 : 0) + (opts.loserInWinnerHome ? 1 : 0);
      const neutral = 15 - (opts.loserBorneOff ?? 0) - placed;
      if (neutral > 0) state.board[15] = { owner: 'black', count: neutral };
    } else {
      state.whiteBorneOff = opts.loserBorneOff ?? 0;
      if (opts.loserOnBar) {
        state.board[0] = { owner: 'white', count: 1 };
      }
      if (opts.loserInWinnerHome) {
        // winner = black, home = 19-24
        state.board[21] = { owner: 'white', count: 1 };
      }
      const placed = (opts.loserOnBar ? 1 : 0) + (opts.loserInWinnerHome ? 1 : 0);
      const neutral = 15 - (opts.loserBorneOff ?? 0) - placed;
      if (neutral > 0) state.board[10] = { owner: 'white', count: neutral };
    }
    return state;
  }

  test('single: loser has borne off at least one checker', () => {
    const state = winState({ loserBorneOff: 3 });
    assert.equal(getWinType(state, 'white'), 'single');
  });

  test('gammon: loser has 0 borne off, not on bar, not in winner home', () => {
    const state = winState({ loserBorneOff: 0 });
    assert.equal(getWinType(state, 'white'), 'gammon');
  });

  test('backgammon: loser has checker on black bar (white wins)', () => {
    const state = winState({ loserBorneOff: 0, loserOnBar: true });
    assert.equal(getWinType(state, 'white'), 'backgammon');
  });

  test('backgammon: loser has checker in winner home board (white wins)', () => {
    const state = winState({ loserBorneOff: 0, loserInWinnerHome: true });
    assert.equal(getWinType(state, 'white'), 'backgammon');
  });

  test('gammon when black wins and white has 0 borne off, not in black home', () => {
    const state = winState({ winner: 'black', loserBorneOff: 0 });
    assert.equal(getWinType(state, 'black'), 'gammon');
  });

  test('backgammon when black wins and white is on bar', () => {
    const state = winState({ winner: 'black', loserBorneOff: 0, loserOnBar: true });
    assert.equal(getWinType(state, 'black'), 'backgammon');
  });

  test('backgammon when black wins and white is in black home (19-24)', () => {
    const state = winState({ winner: 'black', loserBorneOff: 0, loserInWinnerHome: true });
    assert.equal(getWinType(state, 'black'), 'backgammon');
  });
});

// ─── winTypeMultiplier ────────────────────────────────────────────────────────

describe('winTypeMultiplier', () => {
  test('single = 1', () => {
    assert.equal(winTypeMultiplier('single'), 1);
  });

  test('gammon = 2', () => {
    assert.equal(winTypeMultiplier('gammon'), 2);
  });

  test('backgammon = 3', () => {
    assert.equal(winTypeMultiplier('backgammon'), 3);
  });
});
