import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateSaveData, SCHEMA_VERSION } from '../persistence/SaveValidation.js';
import type { SaveData } from '../game/Types.js';

/** Build a minimal valid SaveData object */
function validSaveData(): SaveData {
  return {
    schemaVersion: SCHEMA_VERSION,
    appVersion: '1.0.0',
    timestamp: Date.now(),
    gameState: {
      board: buildValidBoard(),
      whiteBorneOff: 0,
      blackBorneOff: 0,
      currentPlayer: 'white',
      dice: null,
      phase: 'waitingForRoll',
      winner: null,
    },
  };
}

/** Build a standard initial board serialization (15+15 checkers) */
function buildValidBoard(): Array<{ owner: 'white' | 'black' | null; count: number }> {
  const board = Array.from({ length: 26 }, () => ({ owner: null as 'white' | 'black' | null, count: 0 }));
  // Standard initial position
  board[24] = { owner: 'white', count: 2 };
  board[13] = { owner: 'white', count: 5 };
  board[8]  = { owner: 'white', count: 3 };
  board[6]  = { owner: 'white', count: 5 };
  board[1]  = { owner: 'black', count: 2 };
  board[12] = { owner: 'black', count: 5 };
  board[17] = { owner: 'black', count: 3 };
  board[19] = { owner: 'black', count: 5 };
  return board;
}

describe('validateSaveData - valid data', () => {
  test('accepts valid initial game state', () => {
    const result = validateSaveData(validSaveData());
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
  });

  test('accepts state with some pieces borne off', () => {
    const data = validSaveData();
    // Move some white checkers to borne-off
    data.gameState.board[6].count = 3; // reduce from 5 to 3
    data.gameState.whiteBorneOff = 2;  // 2 borne off
    const result = validateSaveData(data);
    assert.equal(result.valid, true);
  });

  test('accepts state with dice', () => {
    const data = validSaveData();
    data.gameState.dice = { values: [3, 5], remaining: [3, 5] };
    data.gameState.phase = 'playerActing';
    const result = validateSaveData(data);
    assert.equal(result.valid, true);
  });

  test('accepts state with doubles dice', () => {
    const data = validSaveData();
    data.gameState.dice = { values: [4, 4], remaining: [4, 4, 4, 4] };
    data.gameState.phase = 'playerActing';
    const result = validateSaveData(data);
    assert.equal(result.valid, true);
  });

  test('accepts state in aiThinking phase', () => {
    const data = validSaveData();
    data.gameState.phase = 'aiThinking';
    data.gameState.currentPlayer = 'black';
    const result = validateSaveData(data);
    assert.equal(result.valid, true);
  });

  test('accepts game over state with winner', () => {
    const data = validSaveData();
    data.gameState.phase = 'gameOver';
    data.gameState.winner = 'white';
    // Move all white off the board
    data.gameState.board = Array.from({ length: 26 }, () => ({ owner: null as null, count: 0 }));
    // Black still has pieces
    data.gameState.board[1]  = { owner: 'black', count: 2 };
    data.gameState.board[12] = { owner: 'black', count: 5 };
    data.gameState.board[17] = { owner: 'black', count: 3 };
    data.gameState.board[19] = { owner: 'black', count: 5 };
    data.gameState.whiteBorneOff = 15;
    const result = validateSaveData(data);
    assert.equal(result.valid, true);
  });
});

describe('validateSaveData - schema version', () => {
  test('rejects wrong schema version', () => {
    const data = validSaveData();
    (data as any).schemaVersion = 999;
    const result = validateSaveData(data);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('Schema version mismatch')));
  });

  test('rejects missing schema version', () => {
    const data = validSaveData();
    delete (data as any).schemaVersion;
    const result = validateSaveData(data);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('schemaVersion')));
  });
});

describe('validateSaveData - timestamp', () => {
  test('rejects missing timestamp', () => {
    const data = validSaveData();
    delete (data as any).timestamp;
    const result = validateSaveData(data);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('timestamp')));
  });

  test('rejects timestamp of 0', () => {
    const data = validSaveData();
    (data as any).timestamp = 0;
    const result = validateSaveData(data);
    assert.equal(result.valid, false);
  });
});

describe('validateSaveData - board structure', () => {
  test('rejects board with wrong number of slots', () => {
    const data = validSaveData();
    (data.gameState as any).board = data.gameState.board.slice(0, 20);
    const result = validateSaveData(data);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('26 entries')));
  });

  test('rejects board with null instead of array', () => {
    const data = validSaveData();
    (data.gameState as any).board = null;
    const result = validateSaveData(data);
    assert.equal(result.valid, false);
  });

  test('rejects board point with invalid owner', () => {
    const data = validSaveData();
    (data.gameState.board[5] as any).owner = 'red';
    const result = validateSaveData(data);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('owner')));
  });

  test('rejects board point with negative count', () => {
    const data = validSaveData();
    (data.gameState.board[6] as any).count = -1;
    const result = validateSaveData(data);
    assert.equal(result.valid, false);
  });
});

describe('validateSaveData - checker count', () => {
  test('rejects white checker count != 15', () => {
    const data = validSaveData();
    data.gameState.board[6].count = 3; // was 5, now 3 — total white = 13
    const result = validateSaveData(data);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('White checker total')));
  });

  test('rejects black checker count != 15', () => {
    const data = validSaveData();
    data.gameState.board[19].count = 3; // was 5, now 3 — total black = 13
    const result = validateSaveData(data);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('Black checker total')));
  });

  test('accepts 15 with some borne off', () => {
    const data = validSaveData();
    data.gameState.board[6].count = 3; // 2 removed from board
    data.gameState.whiteBorneOff = 2;
    const result = validateSaveData(data);
    assert.equal(result.valid, true);
  });
});

describe('validateSaveData - current player and phase', () => {
  test('rejects invalid currentPlayer', () => {
    const data = validSaveData();
    (data.gameState as any).currentPlayer = 'green';
    const result = validateSaveData(data);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('currentPlayer')));
  });

  test('rejects invalid phase', () => {
    const data = validSaveData();
    (data.gameState as any).phase = 'spinning';
    const result = validateSaveData(data);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('phase')));
  });

  test('accepts black as currentPlayer', () => {
    const data = validSaveData();
    data.gameState.currentPlayer = 'black';
    const result = validateSaveData(data);
    assert.equal(result.valid, true);
  });
});

describe('validateSaveData - dice state', () => {
  test('rejects dice values outside 1-6', () => {
    const data = validSaveData();
    data.gameState.dice = { values: [0, 7], remaining: [0, 7] };
    data.gameState.phase = 'playerActing';
    const result = validateSaveData(data);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('invalid value')));
  });

  test('rejects dice.values with wrong length', () => {
    const data = validSaveData();
    (data.gameState as any).dice = { values: [3], remaining: [3] };
    const result = validateSaveData(data);
    assert.equal(result.valid, false);
  });

  test('rejects dice.remaining with invalid values', () => {
    const data = validSaveData();
    data.gameState.dice = { values: [3, 5], remaining: [3, 8] }; // 8 is invalid
    const result = validateSaveData(data);
    assert.equal(result.valid, false);
  });

  test('accepts null dice (waiting for roll)', () => {
    const data = validSaveData();
    data.gameState.dice = null;
    const result = validateSaveData(data);
    assert.equal(result.valid, true);
  });
});

describe('validateSaveData - corrupt inputs', () => {
  test('rejects null input', () => {
    const result = validateSaveData(null);
    assert.equal(result.valid, false);
  });

  test('rejects non-object input', () => {
    const result = validateSaveData('not an object');
    assert.equal(result.valid, false);
  });

  test('rejects missing gameState', () => {
    const data = validSaveData();
    delete (data as any).gameState;
    const result = validateSaveData(data);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('gameState')));
  });

  test('rejects invalid winner', () => {
    const data = validSaveData();
    (data.gameState as any).winner = 'draw';
    const result = validateSaveData(data);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('winner')));
  });
});
