import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialBoard,
  createInitialGameState,
  barIndex,
  bearOffTarget,
  verifyCheckerCounts,
  countTotalCheckers,
  cloneBoard,
  cloneGameState,
} from '../game/GameState.js';

describe('createInitialBoard', () => {
  test('board has 26 slots (0=white bar, 1-24=points, 25=black bar)', () => {
    const board = createInitialBoard();
    assert.equal(board.length, 26);
  });

  test('white checker positions: 24(2), 13(5), 8(3), 6(5)', () => {
    const board = createInitialBoard();
    assert.equal(board[24].owner, 'white');
    assert.equal(board[24].count, 2);
    assert.equal(board[13].owner, 'white');
    assert.equal(board[13].count, 5);
    assert.equal(board[8].owner, 'white');
    assert.equal(board[8].count, 3);
    assert.equal(board[6].owner, 'white');
    assert.equal(board[6].count, 5);
  });

  test('black checker positions: 1(2), 12(5), 17(3), 19(5)', () => {
    const board = createInitialBoard();
    assert.equal(board[1].owner, 'black');
    assert.equal(board[1].count, 2);
    assert.equal(board[12].owner, 'black');
    assert.equal(board[12].count, 5);
    assert.equal(board[17].owner, 'black');
    assert.equal(board[17].count, 3);
    assert.equal(board[19].owner, 'black');
    assert.equal(board[19].count, 5);
  });

  test('bars are empty at start', () => {
    const board = createInitialBoard();
    assert.equal(board[0].count, 0);  // white bar
    assert.equal(board[25].count, 0); // black bar
  });

  test('total white checkers = 15', () => {
    const board = createInitialBoard();
    let total = 0;
    for (let i = 0; i <= 25; i++) {
      if (board[i].owner === 'white') total += board[i].count;
    }
    assert.equal(total, 15);
  });

  test('total black checkers = 15', () => {
    const board = createInitialBoard();
    let total = 0;
    for (let i = 0; i <= 25; i++) {
      if (board[i].owner === 'black') total += board[i].count;
    }
    assert.equal(total, 15);
  });

  test('all other points are empty', () => {
    const board = createInitialBoard();
    const occupiedByWhite = new Set([24, 13, 8, 6]);
    const occupiedByBlack = new Set([1, 12, 17, 19]);
    for (let i = 1; i <= 24; i++) {
      if (!occupiedByWhite.has(i) && !occupiedByBlack.has(i)) {
        assert.equal(board[i].count, 0, `Point ${i} should be empty`);
        assert.equal(board[i].owner, null, `Point ${i} owner should be null`);
      }
    }
  });
});

describe('createInitialGameState', () => {
  test('starts in waitingForRoll phase', () => {
    const state = createInitialGameState();
    assert.equal(state.phase, 'waitingForRoll');
  });

  test('no dice at start', () => {
    const state = createInitialGameState();
    assert.equal(state.dice, null);
  });

  test('no winner at start', () => {
    const state = createInitialGameState();
    assert.equal(state.winner, null);
  });

  test('borne off counts start at 0', () => {
    const state = createInitialGameState();
    assert.equal(state.whiteBorneOff, 0);
    assert.equal(state.blackBorneOff, 0);
  });

  test('verifyCheckerCounts passes for initial state', () => {
    const state = createInitialGameState();
    assert.equal(verifyCheckerCounts(state), true);
  });
});

describe('barIndex / bearOffTarget', () => {
  test('white bar = index 0', () => {
    assert.equal(barIndex('white'), 0);
  });

  test('black bar = index 25', () => {
    assert.equal(barIndex('black'), 25);
  });

  test('white bear-off target = -1', () => {
    assert.equal(bearOffTarget('white'), -1);
  });

  test('black bear-off target = 26', () => {
    assert.equal(bearOffTarget('black'), 26);
  });
});

describe('countTotalCheckers', () => {
  test('15 white checkers in initial state', () => {
    const state = createInitialGameState();
    assert.equal(countTotalCheckers(state, 'white'), 15);
  });

  test('15 black checkers in initial state', () => {
    const state = createInitialGameState();
    assert.equal(countTotalCheckers(state, 'black'), 15);
  });

  test('counts borne-off checkers', () => {
    const state = createInitialGameState();
    state.whiteBorneOff = 3;
    // Remove 3 from board to keep total = 15
    state.board[6].count = 2;
    assert.equal(countTotalCheckers(state, 'white'), 15);
  });
});

describe('cloneBoard', () => {
  test('clone is not the same reference', () => {
    const board = createInitialBoard();
    const clone = cloneBoard(board);
    assert.notEqual(clone, board);
  });

  test('modifying clone does not affect original', () => {
    const board = createInitialBoard();
    const clone = cloneBoard(board);
    clone[6].count = 99;
    assert.equal(board[6].count, 5);
  });
});

describe('cloneGameState', () => {
  test('clone is not same reference as original', () => {
    const state = createInitialGameState();
    const clone = cloneGameState(state);
    assert.notEqual(clone, state);
  });

  test('modifying clone board does not affect original', () => {
    const state = createInitialGameState();
    const clone = cloneGameState(state);
    clone.board[6].count = 99;
    assert.equal(state.board[6].count, 5);
  });

  test('clones dice correctly', () => {
    const state = createInitialGameState();
    state.dice = { values: [3, 5], remaining: [3, 5] };
    const clone = cloneGameState(state);
    assert.deepEqual(clone.dice, { values: [3, 5], remaining: [3, 5] });
    clone.dice!.remaining.pop();
    assert.equal(state.dice.remaining.length, 2);
  });
});
