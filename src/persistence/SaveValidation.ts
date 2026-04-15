// SaveValidation: validates save data before loading
// Rejects corrupt, partial, or version-mismatched saves

import { SaveData, SerializedGameState, Player, GamePhase } from '../game/Types.js';

export const SCHEMA_VERSION = 1;
export const APP_VERSION = '1.0.0';

// Validation result
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function err(errors: string[], msg: string): void {
  errors.push(msg);
}

// Top-level save data validation
export function validateSaveData(data: unknown): ValidationResult {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    err(errors, 'Save data is not an object');
    return { valid: false, errors };
  }

  const d = data as Record<string, unknown>;

  // Schema version check
  if (typeof d.schemaVersion !== 'number') {
    err(errors, 'Missing or invalid schemaVersion');
  } else if (d.schemaVersion !== SCHEMA_VERSION) {
    err(errors, `Schema version mismatch: expected ${SCHEMA_VERSION}, got ${d.schemaVersion}`);
  }

  // Timestamp
  if (typeof d.timestamp !== 'number' || d.timestamp <= 0) {
    err(errors, 'Missing or invalid timestamp');
  }

  // App version (warning only, not blocking)
  if (typeof d.appVersion !== 'string') {
    err(errors, 'Missing appVersion (warning)');
    // Don't fail for this
  }

  // Game state
  if (!d.gameState || typeof d.gameState !== 'object') {
    err(errors, 'Missing gameState');
    return { valid: errors.length === 0, errors };
  }

  const gs = d.gameState as Record<string, unknown>;
  validateGameState(gs, errors);

  return { valid: errors.length === 0, errors };
}

function validateGameState(gs: Record<string, unknown>, errors: string[]): void {
  // Board
  if (!Array.isArray(gs.board)) {
    err(errors, 'gameState.board is not an array');
    return;
  }

  if (gs.board.length !== 26) {
    err(errors, `gameState.board must have 26 entries, got ${gs.board.length}`);
    return;
  }

  let whiteTotalOnBoard = 0;
  let blackTotalOnBoard = 0;

  for (let i = 0; i < 26; i++) {
    const pt = gs.board[i] as Record<string, unknown>;
    if (!pt || typeof pt !== 'object') {
      err(errors, `board[${i}] is not an object`);
      continue;
    }
    if (pt.owner !== null && pt.owner !== 'white' && pt.owner !== 'black') {
      err(errors, `board[${i}].owner is invalid: ${pt.owner}`);
    }
    if (typeof pt.count !== 'number' || pt.count < 0 || pt.count > 15) {
      err(errors, `board[${i}].count is invalid: ${pt.count}`);
    }
    if (pt.owner === 'white') whiteTotalOnBoard += (pt.count as number) || 0;
    if (pt.owner === 'black') blackTotalOnBoard += (pt.count as number) || 0;
  }

  // Borne off counts
  if (typeof gs.whiteBorneOff !== 'number' || gs.whiteBorneOff < 0 || gs.whiteBorneOff > 15) {
    err(errors, `whiteBorneOff invalid: ${gs.whiteBorneOff}`);
  }
  if (typeof gs.blackBorneOff !== 'number' || gs.blackBorneOff < 0 || gs.blackBorneOff > 15) {
    err(errors, `blackBorneOff invalid: ${gs.blackBorneOff}`);
  }

  const whiteBorneOff = (gs.whiteBorneOff as number) || 0;
  const blackBorneOff = (gs.blackBorneOff as number) || 0;

  // Verify total checker counts = 15 per player
  const whiteTotal = whiteTotalOnBoard + whiteBorneOff;
  const blackTotal = blackTotalOnBoard + blackBorneOff;

  if (whiteTotal !== 15) {
    err(errors, `White checker total is ${whiteTotal}, expected 15`);
  }
  if (blackTotal !== 15) {
    err(errors, `Black checker total is ${blackTotal}, expected 15`);
  }

  // Current player
  const validPlayers: Player[] = ['white', 'black'];
  if (!validPlayers.includes(gs.currentPlayer as Player)) {
    err(errors, `currentPlayer invalid: ${gs.currentPlayer}`);
  }

  // Phase
  const validPhases: GamePhase[] = [
    'waitingForRoll', 'playerActing', 'aiThinking', 'gameOver',
  ];
  if (!validPhases.includes(gs.phase as GamePhase)) {
    err(errors, `phase invalid: ${gs.phase}`);
  }

  // Dice state (optional)
  if (gs.dice !== null && gs.dice !== undefined) {
    validateDiceState(gs.dice as Record<string, unknown>, errors);
  }

  // Winner (optional)
  if (
    gs.winner !== null &&
    gs.winner !== undefined &&
    !validPlayers.includes(gs.winner as Player)
  ) {
    err(errors, `winner invalid: ${gs.winner}`);
  }
}

function validateDiceState(dice: Record<string, unknown>, errors: string[]): void {
  if (!Array.isArray(dice.values) || dice.values.length !== 2) {
    err(errors, 'dice.values must be array of length 2');
    return;
  }
  for (const v of dice.values) {
    if (typeof v !== 'number' || v < 1 || v > 6) {
      err(errors, `dice.values contains invalid value: ${v}`);
    }
  }

  if (!Array.isArray(dice.remaining)) {
    err(errors, 'dice.remaining must be an array');
    return;
  }
  for (const v of dice.remaining) {
    if (typeof v !== 'number' || v < 1 || v > 6) {
      err(errors, `dice.remaining contains invalid value: ${v}`);
    }
  }

  // Remaining count must be <= 4 (max for doubles) and >= 0
  if (dice.remaining.length > 4 || dice.remaining.length < 0) {
    err(errors, `dice.remaining length invalid: ${dice.remaining.length}`);
  }
}

// Convert validated save data to a SerializedGameState
export function deserializeGameState(saveData: SaveData): SerializedGameState {
  return saveData.gameState;
}
