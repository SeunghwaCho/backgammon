// MoveGenerator: generates all legal complete turn sequences for the current state.
// This is the critical component - it enforces:
//   1. Bar entry priority
//   2. Maximum dice usage (must use both dice if possible)
//   3. Higher-die rule (when only one die can be used, must use higher die)
//   4. Doubles: 4 sub-moves with the same value
//   5. Bear-off edge cases

import { Player, Point, Move, MoveSequence, DiceState } from './Types.js';
import { barIndex, cloneBoard } from './GameState.js';
import {
  isSingleMoveValid,
  applySingleMove,
  canBearOff,
  getHomeBoardRange,
} from './Rules.js';

interface SimState {
  board: Point[];
  borneOff: number;  // for the active player
  remainingDice: number[];
}

// Generate all possible source points for the current player given the sim state
function getSourcePoints(
  simState: SimState,
  player: Player
): number[] {
  const barIdx = barIndex(player);
  const barPt = simState.board[barIdx];

  // If on bar, must re-enter first
  if (barPt.owner === player && barPt.count > 0) {
    return [barIdx];
  }

  const sources: number[] = [];
  for (let i = 1; i <= 24; i++) {
    if (simState.board[i].owner === player && simState.board[i].count > 0) {
      sources.push(i);
    }
  }
  return sources;
}

// Get possible "to" values for a given from + die + player
// Handles: normal moves, bar re-entry, and bear-off
function getPossibleDestinations(
  simState: SimState,
  player: Player,
  from: number,
  dieValue: number
): number[] {
  const board = simState.board;
  const destinations: number[] = [];

  // Bar re-entry:
  // White bar (from=0): enters at point (25 - dieValue) if in range 19-24
  // Black bar (from=25): enters at point dieValue if in range 1-6
  if (from === 0 && player === 'white') {
    const to = 25 - dieValue; // e.g., die=1 → pt24, die=6 → pt19
    if (to >= 1 && to <= 24) {
      if (isSingleMoveValid(board, player, simState.borneOff, from, to, dieValue)) {
        destinations.push(to);
      }
    }
    return destinations;
  }

  if (from === 25 && player === 'black') {
    const to = dieValue; // e.g., die=1 → pt1, die=6 → pt6
    if (to >= 1 && to <= 24) {
      if (isSingleMoveValid(board, player, simState.borneOff, from, to, dieValue)) {
        destinations.push(to);
      }
    }
    return destinations;
  }

  // Normal board move
  if (player === 'white') {
    const to = from - dieValue;
    if (to >= 1) {
      if (isSingleMoveValid(board, player, simState.borneOff, from, to, dieValue)) {
        destinations.push(to);
      }
    } else {
      // Possible bear off (to <= 0)
      if (isSingleMoveValid(board, player, simState.borneOff, from, -1, dieValue)) {
        destinations.push(-1);
      }
    }
  } else {
    const to = from + dieValue;
    if (to <= 24) {
      if (isSingleMoveValid(board, player, simState.borneOff, from, to, dieValue)) {
        destinations.push(to);
      }
    } else {
      // Possible bear off (to > 24)
      if (isSingleMoveValid(board, player, simState.borneOff, from, 26, dieValue)) {
        destinations.push(26);
      }
    }
  }

  return destinations;
}

// Apply a sub-move to a SimState (returns new SimState)
function applySimMove(
  simState: SimState,
  player: Player,
  from: number,
  to: number,
  dieValue: number
): SimState {
  const { newBoard, isHit } = applySingleMove(simState.board, player, from, to);
  let borneOff = simState.borneOff;
  if (to === -1 || to === 26) {
    borneOff++;
  }
  const remainingDice = [...simState.remainingDice];
  const idx = remainingDice.indexOf(dieValue);
  if (idx !== -1) remainingDice.splice(idx, 1);

  return { board: newBoard, borneOff, remainingDice };
}

// Recursive DFS to generate all possible move sequences from a given state
// Returns array of complete sequences (each is array of Move)
function generateSequences(
  simState: SimState,
  player: Player,
  currentSequence: Move[]
): MoveSequence[] {
  if (simState.remainingDice.length === 0) {
    return [currentSequence];
  }

  const sources = getSourcePoints(simState, player);
  const usedDice = new Set<string>(); // track (from,to,die) combos to avoid duplicates
  const results: MoveSequence[] = [];
  let hasAnyMove = false;

  // Try each unique die value
  const triedDice = new Set<number>();

  for (const dieValue of simState.remainingDice) {
    if (triedDice.has(dieValue)) continue;
    triedDice.add(dieValue);

    for (const from of sources) {
      const destinations = getPossibleDestinations(simState, player, from, dieValue);

      for (const to of destinations) {
        const key = `${from}-${to}-${dieValue}`;
        if (usedDice.has(key)) continue;
        usedDice.add(key);

        hasAnyMove = true;
        const { newBoard, isHit } = applySingleMove(simState.board, player, from, to);
        let newBorneOff = simState.borneOff;
        if (to === -1 || to === 26) newBorneOff++;

        const newRemaining = [...simState.remainingDice];
        const dieIdx = newRemaining.indexOf(dieValue);
        newRemaining.splice(dieIdx, 1);

        const move: Move = { from, to, dieUsed: dieValue, isHit };
        const newSimState: SimState = {
          board: newBoard,
          borneOff: newBorneOff,
          remainingDice: newRemaining,
        };

        const subSequences = generateSequences(newSimState, player, [
          ...currentSequence,
          move,
        ]);
        results.push(...subSequences);
      }
    }
  }

  if (!hasAnyMove) {
    // No moves available with remaining dice - this is a complete sequence
    return [currentSequence];
  }

  return results;
}

// Main entry point: generate all legal complete turn sequences
// Enforces: max dice usage and higher-die-first rule
export function generateAllLegalSequences(
  board: Point[],
  player: Player,
  dice: DiceState,
  borneOff: number
): MoveSequence[] {
  const initialState: SimState = {
    board: cloneBoard(board),
    borneOff,
    remainingDice: [...dice.remaining],
  };

  const allSequences = generateSequences(initialState, player, []);

  if (allSequences.length === 0) return [];

  // Apply dice maximization rules:
  // 1. Prefer sequences that use the most dice
  // 2. If tied on count, prefer sequences using the higher die value

  const maxDiceUsed = Math.max(...allSequences.map(seq => seq.length));
  const maxDiceSequences = allSequences.filter(seq => seq.length === maxDiceUsed);

  // If doubles, all same value - no higher-die rule needed
  const isDoubles = dice.values[0] === dice.values[1];

  // Only apply higher-die rule when exactly 1 die can be used (not doubles)
  if (!isDoubles && maxDiceUsed === 1 && dice.remaining.length === 2) {
    // Find the max die value used across these sequences
    const maxDieInSequences = Math.max(
      ...maxDiceSequences.map(seq => (seq.length > 0 ? seq[0].dieUsed : 0))
    );
    // Only keep sequences using the highest die
    const higherDieSeqs = maxDiceSequences.filter(
      seq => seq.length > 0 && seq[0].dieUsed === maxDieInSequences
    );
    if (higherDieSeqs.length > 0) return deduplicate(higherDieSeqs);
  }

  return deduplicate(maxDiceSequences);
}

// Deduplicate sequences by their (from, to) pairs
function sequenceKey(seq: MoveSequence): string {
  return seq.map(m => `${m.from}>${m.to}`).join(',');
}

function deduplicate(sequences: MoveSequence[]): MoveSequence[] {
  const seen = new Set<string>();
  return sequences.filter(seq => {
    const key = sequenceKey(seq);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Get all unique first moves from a set of legal sequences
// Used to determine which source points are selectable
export function getSelectablePoints(sequences: MoveSequence[]): Set<number> {
  const points = new Set<number>();
  for (const seq of sequences) {
    if (seq.length > 0) points.add(seq[0].from);
  }
  return points;
}

// Get all valid first moves from a specific source point
export function getMovesFromPoint(
  sequences: MoveSequence[],
  from: number
): Move[] {
  const moveMap = new Map<string, Move>();
  for (const seq of sequences) {
    if (seq.length > 0 && seq[0].from === from) {
      const m = seq[0];
      const key = `${m.from}-${m.to}-${m.dieUsed}`;
      if (!moveMap.has(key)) {
        moveMap.set(key, m);
      }
    }
  }
  return Array.from(moveMap.values());
}

// After a sub-move is made, filter remaining sequences to those consistent with
// the move just made, then strip the first element from each sequence
export function filterSequencesAfterMove(
  sequences: MoveSequence[],
  move: Move
): MoveSequence[] {
  const filtered: MoveSequence[] = [];
  for (const seq of sequences) {
    if (seq.length > 0) {
      const first = seq[0];
      if (first.from === move.from && first.to === move.to && first.dieUsed === move.dieUsed) {
        filtered.push(seq.slice(1));
      }
    }
  }
  return deduplicate(filtered);
}
