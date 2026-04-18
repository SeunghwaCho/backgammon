import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  rollDice,
  selectPoint,
  applyPlayerMove,
  applyMoveInternal,
  endTurn,
  canOfferDouble,
  offerDouble,
  acceptDouble,
  declineDouble,
  startNextGame,
  rollForFirst,
  startNewGame,
  restoreFromSave,
} from '../game/Reducer.js';
import {
  createInitialGameState,
  createInitialCube,
  cloneGameState,
} from '../game/GameState.js';
import type { GameState, Move } from '../game/Types.js';

// ─── helpers ────────────────────────────────────────────────────────────────

function emptyBoard() {
  return Array.from({ length: 26 }, () => ({
    owner: null as null | 'white' | 'black',
    count: 0,
  }));
}

function mv(from: number, to: number, dieUsed: number): Move {
  return { from, to, dieUsed, isHit: false };
}

function waitingState(player: 'white' | 'black' = 'white'): GameState {
  const s = createInitialGameState();
  s.phase = 'waitingForRoll';
  s.currentPlayer = player;
  return s;
}

function rolledState(d1: number, d2: number, player: 'white' | 'black' = 'white'): GameState {
  return rollDice(waitingState(player), d1, d2);
}

// ─── rollDice ───────────────────────────────────────────────────────────────

describe('rollDice - basic', () => {
  test('stores dice values', () => {
    const s = rolledState(3, 5);
    assert.deepEqual(s.dice!.values, [3, 5]);
  });

  test('non-doubles: remaining = [d1, d2]', () => {
    const s = rolledState(2, 4);
    assert.deepEqual(s.dice!.remaining, [2, 4]);
  });

  test('doubles: remaining = [d, d, d, d]', () => {
    const s = rolledState(3, 3);
    assert.deepEqual(s.dice!.remaining, [3, 3, 3, 3]);
  });

  test('white player → phase becomes playerActing', () => {
    const s = rolledState(1, 2);
    assert.equal(s.phase, 'playerActing');
  });

  test('black player → phase becomes aiThinking', () => {
    const s = rolledState(1, 2, 'black');
    assert.equal(s.phase, 'aiThinking');
  });

  test('generates legal sequences', () => {
    const s = rolledState(1, 2);
    assert.ok(s.legalSequences.length > 0);
  });

  test('clears selection', () => {
    const base = waitingState();
    base.selectedPoint = 6;
    const s = rollDice(base, 1, 2);
    assert.equal(s.selectedPoint, null);
    assert.deepEqual(s.validMoves, []);
  });

  test('does not mutate original state', () => {
    const base = waitingState();
    rollDice(base, 1, 2);
    assert.equal(base.dice, null);
    assert.equal(base.phase, 'waitingForRoll');
  });
});

describe('rollDice - no legal moves', () => {
  test('passes turn when white checker on bar cannot enter', () => {
    // White on bar; dice [3,5] → entry at pts 22 and 20; block both
    const s = waitingState('white');
    s.board = emptyBoard();
    s.board[0]  = { owner: 'white', count: 1 };  // white on bar
    s.board[22] = { owner: 'black', count: 2 };  // blocks die 3
    s.board[20] = { owner: 'black', count: 2 };  // blocks die 5

    const result = rollDice(s, 3, 5);
    assert.equal(result.currentPlayer, 'black');
    assert.equal(result.phase, 'waitingForRoll');
  });
});

// ─── selectPoint ────────────────────────────────────────────────────────────

describe('selectPoint', () => {
  test('ignored when not in playerActing phase', () => {
    const s = waitingState();
    const result = selectPoint(s, 6);
    assert.equal(result, s);
  });

  test('returns error for point with no legal moves', () => {
    const s = rolledState(1, 2);
    const result = selectPoint(s, 25); // black bar — no white moves
    assert.ok(result.errorMessage !== null);
    assert.equal(result.selectedPoint, null);
  });

  test('sets selectedPoint and validMoves for a valid point', () => {
    const s = rolledState(1, 2);
    const result = selectPoint(s, 6);
    assert.equal(result.selectedPoint, 6);
    assert.ok(result.validMoves.length > 0);
    assert.equal(result.errorMessage, null);
  });

  test('all validMoves have from = selectedPoint', () => {
    const s = rolledState(1, 2);
    const result = selectPoint(s, 6);
    assert.ok(result.validMoves.every(m => m.from === 6));
  });

  test('does not mutate original state', () => {
    const s = rolledState(1, 2);
    const orig = s.selectedPoint;
    selectPoint(s, 6);
    assert.equal(s.selectedPoint, orig);
  });
});

// ─── applyPlayerMove ────────────────────────────────────────────────────────

describe('applyPlayerMove', () => {
  test('returns error for move not in validMoves', () => {
    const s = rolledState(1, 2);
    const result = applyPlayerMove(s, mv(24, 1, 1)); // impossible distance
    assert.ok(result.errorMessage !== null);
  });

  test('ignored when not playerActing', () => {
    const s = waitingState();
    const result = applyPlayerMove(s, mv(6, 5, 1));
    assert.equal(result, s);
  });

  test('applies a valid move chosen from validMoves', () => {
    let s = rolledState(1, 2);
    s = selectPoint(s, 6);
    const move = s.validMoves[0];
    const result = applyPlayerMove(s, move);
    assert.ok(
      result.board[move.from].count < s.board[move.from].count ||
      result.board[move.from].owner !== s.board[move.from].owner
    );
  });
});

// ─── applyMoveInternal ──────────────────────────────────────────────────────

describe('applyMoveInternal - regular move', () => {
  function moveState(): GameState {
    const s = waitingState();
    s.board = emptyBoard();
    s.board[10] = { owner: 'white', count: 2 };
    s.dice = { values: [3, 3], remaining: [3, 3, 3, 3] };
    s.phase = 'playerActing';
    s.legalSequences = [[mv(10, 7, 3)]];
    return s;
  }

  test('moves checker from source to destination', () => {
    const result = applyMoveInternal(moveState(), mv(10, 7, 3));
    assert.equal(result.board[10].count, 1);
    assert.equal(result.board[7].owner, 'white');
    assert.equal(result.board[7].count, 1);
  });

  test('removes used die from remaining', () => {
    const s = waitingState();
    s.board = emptyBoard();
    s.board[10] = { owner: 'white', count: 2 };
    s.dice = { values: [2, 4], remaining: [2, 4] };
    s.phase = 'playerActing';
    // Two-move sequence so the turn doesn't end after the first move
    s.legalSequences = [[mv(10, 8, 2), mv(8, 4, 4)]];
    const result = applyMoveInternal(s, mv(10, 8, 2));
    assert.deepEqual(result.dice!.remaining, [4]);
  });

  test('clears selection after move', () => {
    const s = moveState();
    s.selectedPoint = 10;
    const result = applyMoveInternal(s, mv(10, 7, 3));
    assert.equal(result.selectedPoint, null);
    assert.deepEqual(result.validMoves, []);
  });

  test('does not mutate original state', () => {
    const s = waitingState();
    s.board = emptyBoard();
    s.board[10] = { owner: 'white', count: 1 };
    s.dice = { values: [2, 4], remaining: [2, 4] };
    s.phase = 'playerActing';
    s.legalSequences = [[mv(10, 8, 2)]];
    applyMoveInternal(s, mv(10, 8, 2));
    assert.equal(s.board[10].count, 1);
    assert.deepEqual(s.dice!.remaining, [2, 4]);
  });
});

describe('applyMoveInternal - hit', () => {
  test('sends opponent blot to bar', () => {
    const s = waitingState();
    s.board = emptyBoard();
    s.board[10] = { owner: 'white', count: 1 };
    s.board[8]  = { owner: 'black', count: 1 }; // blot at destination
    s.dice = { values: [2, 4], remaining: [2, 4] };
    s.phase = 'playerActing';
    s.legalSequences = [[mv(10, 8, 2)]];

    const result = applyMoveInternal(s, mv(10, 8, 2));
    assert.equal(result.board[25].owner, 'black'); // black bar
    assert.equal(result.board[25].count, 1);
    assert.equal(result.board[8].owner, 'white');
    assert.equal(result.board[8].count, 1);
  });
});

describe('applyMoveInternal - bear off', () => {
  test('increments whiteBorneOff', () => {
    const s = waitingState();
    s.board = emptyBoard();
    s.board[3] = { owner: 'white', count: 1 };
    s.whiteBorneOff = 5;
    s.dice = { values: [3, 5], remaining: [3] };
    s.phase = 'playerActing';
    s.legalSequences = [[mv(3, -1, 3)]];
    const result = applyMoveInternal(s, mv(3, -1, 3));
    assert.equal(result.whiteBorneOff, 6);
  });

  test('increments blackBorneOff', () => {
    const s = waitingState('black');
    s.board = emptyBoard();
    s.board[22] = { owner: 'black', count: 1 };
    s.blackBorneOff = 7;
    s.dice = { values: [3, 5], remaining: [3] };
    s.phase = 'aiThinking';
    s.legalSequences = [[mv(22, 26, 3)]];
    const result = applyMoveInternal(s, mv(22, 26, 3));
    assert.equal(result.blackBorneOff, 8);
  });
});

describe('applyMoveInternal - end of turn', () => {
  test('switches player when all dice used', () => {
    const s = waitingState();
    s.board = emptyBoard();
    s.board[10] = { owner: 'white', count: 1 };
    s.dice = { values: [2, 4], remaining: [2] };
    s.phase = 'playerActing';
    s.legalSequences = [[mv(10, 8, 2)]];
    const result = applyMoveInternal(s, mv(10, 8, 2));
    assert.equal(result.currentPlayer, 'black');
    assert.equal(result.phase, 'waitingForRoll');
  });
});

describe('applyMoveInternal - win detection', () => {
  function nearWinState(): GameState {
    const s = waitingState();
    s.board = emptyBoard();
    s.board[3] = { owner: 'white', count: 1 };
    s.board[15] = { owner: 'black', count: 15 }; // black not borne off, not on bar, not in white home
    s.whiteBorneOff = 14;
    s.blackBorneOff = 0;
    s.dice = { values: [3, 5], remaining: [3] };
    s.phase = 'playerActing';
    s.legalSequences = [[mv(3, -1, 3)]];
    return s;
  }

  test('sets winner when white bears off last checker', () => {
    const result = applyMoveInternal(nearWinState(), mv(3, -1, 3));
    assert.equal(result.winner, 'white');
    assert.equal(result.phase, 'gameOver');
  });

  test('single win type when loser has borne off checkers', () => {
    const s = nearWinState();
    s.blackBorneOff = 1;
    s.board[15].count = 14;
    const result = applyMoveInternal(s, mv(3, -1, 3));
    assert.equal(result.winType, 'single');
  });

  test('gammon win type when loser has not borne off', () => {
    const result = applyMoveInternal(nearWinState(), mv(3, -1, 3));
    assert.equal(result.winType, 'gammon');
  });

  test('backgammon win type when loser has checker in winner home board', () => {
    const s = nearWinState();
    s.board[4] = { owner: 'black', count: 1 }; // white home = pts 1-6
    s.board[15].count = 14;
    const result = applyMoveInternal(s, mv(3, -1, 3));
    assert.equal(result.winType, 'backgammon');
  });

  test('backgammon win type when loser has checker on bar', () => {
    const s = nearWinState();
    s.board[25] = { owner: 'black', count: 1 }; // black bar
    s.board[15].count = 14;
    const result = applyMoveInternal(s, mv(3, -1, 3));
    assert.equal(result.winType, 'backgammon');
  });

  test('adds 1 × cube to match score on single win', () => {
    const s = nearWinState();
    s.blackBorneOff = 1;
    s.board[15].count = 14;
    s.cube = { value: 2, owner: 'black' };
    const result = applyMoveInternal(s, mv(3, -1, 3));
    assert.equal(result.match.whiteScore, 2); // 1 × 2
  });

  test('adds 2 × cube to match score on gammon win', () => {
    const s = nearWinState();
    s.cube = { value: 2, owner: 'black' };
    const result = applyMoveInternal(s, mv(3, -1, 3));
    assert.equal(result.match.whiteScore, 4); // 2 × 2
  });

  test('sets matchOver when reaching targetScore', () => {
    const s = nearWinState();
    s.blackBorneOff = 1;
    s.board[15].count = 14;
    s.match.whiteScore = 4;
    s.match.targetScore = 5;
    const result = applyMoveInternal(s, mv(3, -1, 3));
    assert.equal(result.match.matchOver, true);
    assert.equal(result.match.matchWinner, 'white');
  });

  test('does not set matchOver when below targetScore', () => {
    const s = nearWinState();
    s.blackBorneOff = 1;
    s.board[15].count = 14;
    s.match.whiteScore = 2;
    s.match.targetScore = 5;
    const result = applyMoveInternal(s, mv(3, -1, 3));
    assert.equal(result.match.matchOver, false);
  });
});

// ─── endTurn ────────────────────────────────────────────────────────────────

describe('endTurn', () => {
  test('switches from white to black', () => {
    assert.equal(endTurn(waitingState('white')).currentPlayer, 'black');
  });

  test('switches from black to white', () => {
    assert.equal(endTurn(waitingState('black')).currentPlayer, 'white');
  });

  test('sets phase to waitingForRoll', () => {
    assert.equal(endTurn(rolledState(1, 2)).phase, 'waitingForRoll');
  });

  test('clears dice', () => {
    assert.equal(endTurn(rolledState(1, 2)).dice, null);
  });

  test('clears selection and legal sequences', () => {
    const s = rolledState(1, 2);
    s.selectedPoint = 6;
    const result = endTurn(s);
    assert.equal(result.selectedPoint, null);
    assert.deepEqual(result.validMoves, []);
    assert.deepEqual(result.legalSequences, []);
  });

  test('does not mutate original state', () => {
    const s = rolledState(1, 2);
    endTurn(s);
    assert.equal(s.currentPlayer, 'white');
    assert.ok(s.dice !== null);
  });
});

// ─── canOfferDouble ─────────────────────────────────────────────────────────

describe('canOfferDouble', () => {
  test('returns true in waitingForRoll with default cube', () => {
    assert.equal(canOfferDouble(waitingState()), true);
  });

  test('returns false when not waitingForRoll', () => {
    const s = waitingState();
    s.phase = 'playerActing';
    assert.equal(canOfferDouble(s), false);
  });

  test('returns false during Crawford game', () => {
    const s = waitingState();
    s.match.isCrawford = true;
    assert.equal(canOfferDouble(s), false);
  });

  test('returns false when cube value >= 64', () => {
    const s = waitingState();
    s.cube.value = 64;
    assert.equal(canOfferDouble(s), false);
  });

  test('returns false when opponent owns the cube', () => {
    const s = waitingState('white');
    s.cube = { value: 2, owner: 'black' };
    assert.equal(canOfferDouble(s), false);
  });

  test('returns true when current player owns the cube', () => {
    const s = waitingState('white');
    s.cube = { value: 2, owner: 'white' };
    assert.equal(canOfferDouble(s), true);
  });

  test('returns true when cube is centered (owner = null)', () => {
    const s = waitingState('black');
    s.cube = { value: 1, owner: null };
    assert.equal(canOfferDouble(s), true);
  });

  test('returns false at cube value 32 (< 64 still ok)', () => {
    const s = waitingState();
    s.cube.value = 32;
    assert.equal(canOfferDouble(s), true);
  });
});

// ─── offerDouble ─────────────────────────────────────────────────────────────

describe('offerDouble', () => {
  test('white offers: cube value doubles', () => {
    assert.equal(offerDouble(waitingState('white')).cube.value, 2);
  });

  test('white offers: black (AI) now owns the cube', () => {
    assert.equal(offerDouble(waitingState('white')).cube.owner, 'black');
  });

  test('white offers: phase stays waitingForRoll (AI auto-accepts)', () => {
    assert.equal(offerDouble(waitingState('white')).phase, 'waitingForRoll');
  });

  test('black offers: phase becomes playerDecidingDouble', () => {
    assert.equal(offerDouble(waitingState('black')).phase, 'playerDecidingDouble');
  });

  test('black offers: cube value not yet changed (wait for accept)', () => {
    assert.equal(offerDouble(waitingState('black')).cube.value, 1);
  });

  test('returns unchanged state when canOfferDouble is false', () => {
    const s = waitingState('white');
    s.match.isCrawford = true;
    assert.equal(offerDouble(s), s);
  });

  test('does not mutate original state', () => {
    const s = waitingState('white');
    offerDouble(s);
    assert.equal(s.cube.value, 1);
    assert.equal(s.cube.owner, null);
  });
});

// ─── acceptDouble ────────────────────────────────────────────────────────────

describe('acceptDouble', () => {
  function decidingState(): GameState {
    return offerDouble(waitingState('black')); // black offers → playerDecidingDouble
  }

  test('cube value doubles', () => {
    assert.equal(acceptDouble(decidingState()).cube.value, 2);
  });

  test('white (player) now owns the cube', () => {
    assert.equal(acceptDouble(decidingState()).cube.owner, 'white');
  });

  test('phase returns to waitingForRoll', () => {
    assert.equal(acceptDouble(decidingState()).phase, 'waitingForRoll');
  });

  test('ignored when not playerDecidingDouble', () => {
    const s = waitingState('white');
    assert.equal(acceptDouble(s), s);
  });
});

// ─── declineDouble ───────────────────────────────────────────────────────────

describe('declineDouble', () => {
  function decidingState(): GameState {
    return offerDouble(waitingState('black'));
  }

  test('black wins when player declines', () => {
    assert.equal(declineDouble(decidingState()).winner, 'black');
  });

  test('phase becomes gameOver', () => {
    assert.equal(declineDouble(decidingState()).phase, 'gameOver');
  });

  test('win type is single', () => {
    assert.equal(declineDouble(decidingState()).winType, 'single');
  });

  test('awards current cube value to black', () => {
    const s = decidingState();
    s.cube.value = 4;
    assert.equal(declineDouble(s).match.blackScore, 4);
  });

  test('sets matchOver when reaching targetScore', () => {
    const s = decidingState();
    s.match.blackScore = 4;
    s.match.targetScore = 5;
    const result = declineDouble(s);
    assert.equal(result.match.matchOver, true);
    assert.equal(result.match.matchWinner, 'black');
  });

  test('ignored when not playerDecidingDouble', () => {
    const s = waitingState('white');
    assert.equal(declineDouble(s), s);
  });
});

// ─── rollForFirst ────────────────────────────────────────────────────────────

describe('rollForFirst', () => {
  function rollingState(): GameState {
    return createInitialGameState(); // phase = rollingForFirst
  }

  test('stores initial roll values', () => {
    assert.deepEqual(rollForFirst(rollingState(), 4, 2).initialRoll, { white: 4, black: 2 });
  });

  test('white wins when white roll > black roll', () => {
    assert.equal(rollForFirst(rollingState(), 5, 3).currentPlayer, 'white');
  });

  test('black wins when black roll > white roll', () => {
    assert.equal(rollForFirst(rollingState(), 2, 6).currentPlayer, 'black');
  });

  test('phase stays rollingForFirst on tie', () => {
    assert.equal(rollForFirst(rollingState(), 4, 4).phase, 'rollingForFirst');
  });

  test('phase stays rollingForFirst after winner determined (caller drives transition)', () => {
    assert.equal(rollForFirst(rollingState(), 5, 3).phase, 'rollingForFirst');
  });

  test('does not mutate original state', () => {
    const s = rollingState();
    rollForFirst(s, 3, 5);
    assert.equal(s.initialRoll, null);
  });
});

// ─── startNextGame ───────────────────────────────────────────────────────────

describe('startNextGame - match preservation', () => {
  function matchState(whiteScore: number, blackScore: number, targetScore = 5): GameState {
    const s = createInitialGameState();
    s.phase = 'gameOver';
    s.match = { targetScore, whiteScore, blackScore,
                isCrawford: false, postCrawford: false, matchOver: false, matchWinner: null };
    return s;
  }

  test('preserves white score', () => {
    assert.equal(startNextGame(matchState(3, 1)).match.whiteScore, 3);
  });

  test('preserves black score', () => {
    assert.equal(startNextGame(matchState(3, 1)).match.blackScore, 1);
  });

  test('new game starts in rollingForFirst phase', () => {
    assert.equal(startNextGame(matchState(2, 2)).phase, 'rollingForFirst');
  });

  test('cube resets to value 1, unowned', () => {
    const s = matchState(2, 2);
    s.cube = { value: 4, owner: 'black' };
    const result = startNextGame(s);
    assert.equal(result.cube.value, 1);
    assert.equal(result.cube.owner, null);
  });
});

describe('startNextGame - Crawford rule', () => {
  function makeState(opts: { w: number; b: number; target?: number;
                             isCrawford?: boolean; postCrawford?: boolean }): GameState {
    const s = createInitialGameState();
    s.phase = 'gameOver';
    s.match = {
      targetScore: opts.target ?? 5,
      whiteScore: opts.w,
      blackScore: opts.b,
      isCrawford: opts.isCrawford ?? false,
      postCrawford: opts.postCrawford ?? false,
      matchOver: false,
      matchWinner: null,
    };
    return s;
  }

  test('sets isCrawford when white reaches targetScore - 1', () => {
    assert.equal(startNextGame(makeState({ w: 4, b: 0 })).match.isCrawford, true);
  });

  test('sets isCrawford when black reaches targetScore - 1', () => {
    assert.equal(startNextGame(makeState({ w: 0, b: 4 })).match.isCrawford, true);
  });

  test('clears isCrawford and sets postCrawford after Crawford game', () => {
    const result = startNextGame(makeState({ w: 4, b: 2, isCrawford: true }));
    assert.equal(result.match.isCrawford, false);
    assert.equal(result.match.postCrawford, true);
  });

  test('does not set Crawford again in postCrawford games', () => {
    const result = startNextGame(makeState({ w: 4, b: 3, postCrawford: true }));
    assert.equal(result.match.isCrawford, false);
  });

  test('does not set Crawford when neither player is at match point', () => {
    assert.equal(startNextGame(makeState({ w: 2, b: 2 })).match.isCrawford, false);
  });
});

// ─── startNewGame ────────────────────────────────────────────────────────────

describe('startNewGame', () => {
  test('returns initial game state', () => {
    const result = startNewGame();
    assert.equal(result.phase, 'rollingForFirst');
    assert.equal(result.winner, null);
    assert.equal(result.dice, null);
  });

  test('resets match scores', () => {
    const result = startNewGame();
    assert.equal(result.match.whiteScore, 0);
    assert.equal(result.match.blackScore, 0);
  });
});

// ─── restoreFromSave ─────────────────────────────────────────────────────────

describe('restoreFromSave', () => {
  test('clears selectedPoint and validMoves', () => {
    const s = createInitialGameState();
    s.selectedPoint = 6;
    s.validMoves = [mv(6, 5, 1)];
    const result = restoreFromSave(s);
    assert.equal(result.selectedPoint, null);
    assert.deepEqual(result.validMoves, []);
  });

  test('clears initialRoll', () => {
    const s = createInitialGameState();
    s.initialRoll = { white: 3, black: 1 };
    assert.equal(restoreFromSave(s).initialRoll, null);
  });

  test('resets aiThinking phase to waitingForRoll', () => {
    const s = createInitialGameState();
    s.phase = 'aiThinking';
    s.dice = { values: [2, 4], remaining: [2, 4] };
    assert.equal(restoreFromSave(s).phase, 'waitingForRoll');
  });

  test('resets playerDecidingDouble to waitingForRoll and resets cube', () => {
    const s = createInitialGameState();
    s.phase = 'playerDecidingDouble';
    s.cube = { value: 4, owner: 'black' };
    const result = restoreFromSave(s);
    assert.equal(result.phase, 'waitingForRoll');
    assert.equal(result.cube.value, 1);
  });

  test('resets rollingForFirst player to white', () => {
    const s = createInitialGameState();
    s.phase = 'rollingForFirst';
    s.currentPlayer = 'black';
    assert.equal(restoreFromSave(s).currentPlayer, 'white');
  });

  test('fills missing cube with default', () => {
    const s = createInitialGameState();
    (s as unknown as Record<string, unknown>).cube = undefined;
    const result = restoreFromSave(s);
    assert.deepEqual(result.cube, { value: 1, owner: null });
  });

  test('fills missing match with default', () => {
    const s = createInitialGameState();
    (s as unknown as Record<string, unknown>).match = undefined;
    const result = restoreFromSave(s);
    assert.equal(result.match.targetScore, 5);
    assert.equal(result.match.whiteScore, 0);
  });

  test('regenerates legal sequences for playerActing phase', () => {
    const s = createInitialGameState();
    s.phase = 'playerActing';
    s.currentPlayer = 'white';
    s.dice = { values: [1, 2], remaining: [1, 2] };
    s.legalSequences = [];
    const result = restoreFromSave(s);
    assert.ok(result.legalSequences.length > 0);
  });
});
