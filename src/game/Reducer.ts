// Reducer: pure functions that apply actions to game state
// Each function returns a new GameState without mutating the input

import { GameState, Player, Move, MoveSequence, DiceState } from './Types.js';
import { cloneGameState, barIndex, createInitialGameState, createInitialCube } from './GameState.js';
import { checkWinner, applySingleMove, getWinType, winTypeMultiplier } from './Rules.js';
import {
  generateAllLegalSequences,
  getMovesFromPoint,
  getSelectablePoints,
  filterSequencesAfterMove,
} from './MoveGenerator.js';

// Roll dice and update state
export function rollDice(state: GameState, d1: number, d2: number): GameState {
  const next = cloneGameState(state);

  const isDoubles = d1 === d2;
  const remaining = isDoubles ? [d1, d1, d1, d1] : [d1, d2];

  next.dice = {
    values: [d1, d2],
    remaining: remaining,
  };

  // Generate all legal sequences for this roll
  const borneOff =
    next.currentPlayer === 'white' ? next.whiteBorneOff : next.blackBorneOff;

  next.legalSequences = generateAllLegalSequences(
    next.board,
    next.currentPlayer,
    next.dice,
    borneOff
  );

  // Check if any legal sequence actually has at least one move
  const hasLegalMoves = next.legalSequences.some(seq => seq.length > 0);
  if (!hasLegalMoves) {
    // No legal moves - must pass turn
    next.phase = 'waitingForRoll';
    next.errorMessage = '합법적인 수가 없습니다. 턴을 넘깁니다.';
    // Switch to next player
    return endTurn(next);
  }

  next.phase = next.currentPlayer === 'white' ? 'playerActing' : 'aiThinking';
  next.selectedPoint = null;
  next.validMoves = [];
  next.errorMessage = null;

  return next;
}

// Select a point (source checker) for the human player
export function selectPoint(state: GameState, pointIndex: number): GameState {
  if (state.phase !== 'playerActing') return state;
  if (!state.dice) return state;

  const next = cloneGameState(state);

  // Check if this point has valid moves in legal sequences
  const selectable = getSelectablePoints(next.legalSequences);

  if (!selectable.has(pointIndex)) {
    next.errorMessage = 'No legal moves from that point.';
    next.selectedPoint = null;
    next.validMoves = [];
    return next;
  }

  next.selectedPoint = pointIndex;
  next.validMoves = getMovesFromPoint(next.legalSequences, pointIndex);
  next.errorMessage = null;

  return next;
}

// Apply a move chosen by the human player
export function applyPlayerMove(state: GameState, move: Move): GameState {
  if (state.phase !== 'playerActing') return state;
  if (!state.dice) return state;

  // Validate move is in validMoves
  const isValid = state.validMoves.some(
    m => m.from === move.from && m.to === move.to && m.dieUsed === move.dieUsed
  );
  if (!isValid) {
    const next = cloneGameState(state);
    next.errorMessage = 'Invalid move.';
    return next;
  }

  return applyMoveInternal(state, move);
}

// Apply a move (used by both player and AI)
export function applyMoveInternal(state: GameState, move: Move): GameState {
  const next = cloneGameState(state);
  const player = next.currentPlayer;

  // Apply to board
  const { newBoard, isHit } = applySingleMove(next.board, player, move.from, move.to);
  next.board = newBoard;

  // Handle bear off
  if (move.to === -1 || move.to === 26) {
    if (player === 'white') next.whiteBorneOff++;
    else next.blackBorneOff++;
  }

  // Remove used die from remaining
  const dieIdx = next.dice!.remaining.indexOf(move.dieUsed);
  if (dieIdx !== -1) next.dice!.remaining.splice(dieIdx, 1);

  // Filter legal sequences
  next.legalSequences = filterSequencesAfterMove(next.legalSequences, move);

  // Clear selection
  next.selectedPoint = null;
  next.validMoves = [];
  next.errorMessage = null;

  // Check for win
  const winner = checkWinner(next);
  if (winner) {
    next.winner = winner;
    next.winType = getWinType(next, winner);
    next.phase = 'gameOver';
    // Update match score
    const pts = next.cube.value * winTypeMultiplier(next.winType);
    const newMatch = { ...next.match };
    if (winner === 'white') newMatch.whiteScore += pts;
    else newMatch.blackScore += pts;
    // Check if match is over
    if (newMatch.whiteScore >= newMatch.targetScore || newMatch.blackScore >= newMatch.targetScore) {
      newMatch.matchOver = true;
      newMatch.matchWinner = winner;
    }
    next.match = newMatch;
    return next;
  }

  // Check if turn is complete (no more dice or no more legal moves)
  if (next.dice!.remaining.length === 0) {
    return endTurn(next);
  }

  // Check if remaining sequences have any moves
  const hasMoreMoves =
    next.legalSequences.length > 0 && next.legalSequences.some(s => s.length > 0);

  if (!hasMoreMoves) {
    // Remaining dice can't be used
    return endTurn(next);
  }

  // Continue same player's turn
  // Phase stays playerActing (for human) - AI handled externally
  return next;
}

// End the current player's turn and switch to next player
export function endTurn(state: GameState): GameState {
  const next = cloneGameState(state);
  next.currentPlayer = next.currentPlayer === 'white' ? 'black' : 'white';
  next.dice = null;
  next.selectedPoint = null;
  next.validMoves = [];
  next.legalSequences = [];
  next.phase = 'waitingForRoll';
  return next;
}

// Check if a player can legally offer to double
export function canOfferDouble(state: GameState): boolean {
  if (state.phase !== 'waitingForRoll') return false;
  if (state.match.isCrawford) return false;
  if (state.cube.value >= 64) return false;
  if (state.cube.owner !== null && state.cube.owner !== state.currentPlayer) return false;
  return true;
}

// Player offers to double; AI accepts/declines automatically in main.ts
// Human offers: AI auto-accepts (simplified)
// AI offers: phase becomes playerDecidingDouble
export function offerDouble(state: GameState): GameState {
  if (!canOfferDouble(state)) return state;
  const next = cloneGameState(state);
  if (state.currentPlayer === 'white') {
    // Human offering to AI — AI always accepts; AI (black) now owns the cube
    next.cube = { value: state.cube.value * 2, owner: 'black' };
    next.errorMessage = null;
  } else {
    // AI offering to human — wait for player decision
    next.phase = 'playerDecidingDouble';
    next.errorMessage = null;
  }
  return next;
}

// Player accepts the AI's double offer
export function acceptDouble(state: GameState): GameState {
  if (state.phase !== 'playerDecidingDouble') return state;
  const next = cloneGameState(state);
  next.cube = { value: state.cube.value * 2, owner: 'white' };
  next.phase = 'waitingForRoll'; // AI still needs to roll (its turn)
  next.errorMessage = null;
  return next;
}

// Player declines the AI's double offer — current player (AI) wins at old cube value
export function declineDouble(state: GameState): GameState {
  if (state.phase !== 'playerDecidingDouble') return state;
  const next = cloneGameState(state);
  // Decliner (white/human) concedes; AI wins 1× current (not-yet-doubled) cube value
  next.winner = 'black';
  next.winType = 'single';
  next.phase = 'gameOver';
  const pts = next.cube.value;
  const newMatch = { ...next.match };
  newMatch.blackScore += pts;
  if (newMatch.blackScore >= newMatch.targetScore) {
    newMatch.matchOver = true;
    newMatch.matchWinner = 'black';
  }
  next.match = newMatch;
  next.errorMessage = null;
  return next;
}

// Start the next game in the same match (preserves match state)
export function startNextGame(state: GameState): GameState {
  const oldMatch = { ...state.match };
  // Determine Crawford status for the new game
  const whiteMPM1 = oldMatch.whiteScore === oldMatch.targetScore - 1;
  const blackMPM1 = oldMatch.blackScore === oldMatch.targetScore - 1;
  const eitherAtMatchPoint = whiteMPM1 || blackMPM1;
  if (eitherAtMatchPoint && !oldMatch.postCrawford && !oldMatch.isCrawford) {
    oldMatch.isCrawford = true;
  } else {
    if (oldMatch.isCrawford) oldMatch.postCrawford = true;
    oldMatch.isCrawford = false;
  }
  return createInitialGameState(oldMatch);
}

// Roll both dice to determine who goes first
// Returns updated state; tie stays in rollingForFirst, winner also stays so
// the caller can display the result briefly before transitioning.
export function rollForFirst(state: GameState, wRoll: number, bRoll: number): GameState {
  const next = cloneGameState(state);
  next.initialRoll = { white: wRoll, black: bRoll };
  if (wRoll !== bRoll) {
    // Set the winner as currentPlayer; main.ts will transition phase after a delay
    next.currentPlayer = wRoll > bRoll ? 'white' : 'black';
  }
  // Phase stays rollingForFirst in both tie and winner cases; caller drives transition
  return next;
}

// Start a brand-new match (resets match scores)
export function startNewGame(): GameState {
  return createInitialGameState();
}

// Restore game from saved state (with validation)
export function restoreFromSave(saved: GameState): GameState {
  // Re-generate legal sequences if needed
  if (
    saved.phase === 'playerActing' ||
    saved.phase === 'aiThinking'
  ) {
    if (saved.dice) {
      const borneOff =
        saved.currentPlayer === 'white' ? saved.whiteBorneOff : saved.blackBorneOff;
      const sequences = generateAllLegalSequences(
        saved.board,
        saved.currentPlayer,
        saved.dice,
        borneOff
      );
      saved.legalSequences = sequences;
    }
  }
  saved.selectedPoint = null;
  saved.validMoves = [];
  saved.initialRoll = null;
  // If AI was mid-thinking or deciding a double offer, reset to waitingForRoll
  if (saved.phase === 'aiThinking' || saved.phase === 'playerDecidingDouble') {
    saved.phase = 'waitingForRoll';
    saved.cube = createInitialCube(); // abandon any in-progress double offer
  }
  // If restored mid-initial-roll, restart the initial roll phase cleanly
  if (saved.phase === 'rollingForFirst') {
    saved.currentPlayer = 'white'; // will be re-determined by fresh roll
  }
  // Ensure cube and match fields are present (handles older save formats)
  if (!saved.cube) saved.cube = createInitialCube();
  if (!saved.match) {
    saved.match = {
      targetScore: 5, whiteScore: 0, blackScore: 0,
      isCrawford: false, postCrawford: false,
      matchOver: false, matchWinner: null,
    };
  }
  return saved;
}
