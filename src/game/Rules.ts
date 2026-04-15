import { Player, Point, GameState, Move } from './Types.js';
import { barIndex, cloneBoard } from './GameState.js';

// White's home board: points 1-6
// Black's home board: points 19-24
export function getHomeBoardRange(player: Player): [number, number] {
  return player === 'white' ? [1, 6] : [19, 24];
}

// Check if a player can bear off (all checkers in home board or already borne off)
export function canBearOff(board: Point[], player: Player, borneOff: number): boolean {
  const barIdx = barIndex(player);
  const barPt = board[barIdx];
  if (barPt.owner === player && barPt.count > 0) return false;

  const [homeMin, homeMax] = getHomeBoardRange(player);

  for (let i = 1; i <= 24; i++) {
    const pt = board[i];
    if (pt.owner !== player || pt.count === 0) continue;
    // Check if this point is outside home board
    if (i < homeMin || i > homeMax) return false;
  }
  return true;
}

// Check if a specific point is blocked (has 2+ opponent checkers)
export function isBlocked(board: Point[], pointIndex: number, player: Player): boolean {
  if (pointIndex < 1 || pointIndex > 24) return false;
  const pt = board[pointIndex];
  const opponent: Player = player === 'white' ? 'black' : 'white';
  return pt.owner === opponent && pt.count >= 2;
}

// Check if a point is a blot (single opponent checker = can be hit)
export function isBlot(board: Point[], pointIndex: number, player: Player): boolean {
  if (pointIndex < 1 || pointIndex > 24) return false;
  const pt = board[pointIndex];
  const opponent: Player = player === 'white' ? 'black' : 'white';
  return pt.owner === opponent && pt.count === 1;
}

// Validate a single sub-move given current board state and remaining dice
// Returns whether the move is valid (does not enforce full-turn dice maximization)
export function isSingleMoveValid(
  board: Point[],
  player: Player,
  borneOff: number,
  from: number,
  to: number,
  dieValue: number
): boolean {
  const barIdx = barIndex(player);

  // Must enter from bar first if there are checkers on bar
  const barPt = board[barIdx];
  if (barPt.owner === player && barPt.count > 0) {
    // from must be the bar
    if (from !== barIdx) return false;
  }

  // Validate source point has player's checker
  const srcPt = board[from];
  if (!srcPt || srcPt.owner !== player || srcPt.count === 0) return false;

  // Calculate expected destination
  if (to === -1 || to === 26) {
    // Bear off move
    if (!canBearOff(board, player, borneOff)) return false;

    const [homeMin, homeMax] = getHomeBoardRange(player);

    if (player === 'white') {
      // White bears off from low points (point 1-6) using die value
      // Die must exactly match point number OR die > point and no checkers on higher home points
      if (from < homeMin || from > homeMax) return false;
      if (dieValue === from) return true; // exact bear off

      if (dieValue > from) {
        // Can bear off with higher die only if no checkers on higher points
        for (let p = from + 1; p <= homeMax; p++) {
          if (board[p].owner === player && board[p].count > 0) return false;
        }
        return true;
      }
      // die < from: not valid bear off
      return false;
    } else {
      // Black bears off from high points (19-24) using die value
      if (from < homeMin || from > homeMax) return false;
      // Black at point N: distance to bear off = (25 - N), die must match (25-N)
      const distanceNeeded = 25 - from;
      if (dieValue === distanceNeeded) return true;

      if (dieValue > distanceNeeded) {
        // Can only bear off with higher die if no checkers on lower points (further from bearing off)
        // "lower points" for black means smaller indices (19..from-1)
        for (let p = homeMin; p < from; p++) {
          if (board[p].owner === player && board[p].count > 0) return false;
        }
        return true;
      }
      return false;
    }
  }

  // Regular move (including bar re-entry)
  if (to < 1 || to > 24) return false;

  // Verify die matches distance
  // Special case: bar re-entry
  // White bar (from=0): enters at point (25 - dieValue), so die must = 25 - to
  // Black bar (from=25): enters at point dieValue, so die must = to
  let expectedDie: number;
  if (from === 0) {
    // White bar re-entry
    expectedDie = 25 - to;
  } else if (from === 25) {
    // Black bar re-entry
    expectedDie = to;
  } else {
    // Normal move
    expectedDie = player === 'white' ? from - to : to - from;
  }
  if (expectedDie !== dieValue) return false;

  // Destination cannot be blocked by opponent
  if (isBlocked(board, to, player)) return false;

  return true;
}

// Apply a single sub-move to a board (returns new board, does not mutate)
export function applySingleMove(
  board: Point[],
  player: Player,
  from: number,
  to: number
): { newBoard: Point[]; isHit: boolean } {
  const newBoard = cloneBoard(board);
  const opponent: Player = player === 'white' ? 'black' : 'white';
  let isHit = false;

  // Remove checker from source
  if (newBoard[from].owner === player && newBoard[from].count > 0) {
    newBoard[from].count--;
    if (newBoard[from].count === 0) {
      newBoard[from].owner = null;
    }
  }

  if (to === -1 || to === 26) {
    // Bear off: checker leaves the board (handled externally by tracking borneOff count)
    return { newBoard, isHit: false };
  }

  // Check for hit
  if (newBoard[to].owner === opponent && newBoard[to].count === 1) {
    isHit = true;
    // Send hit checker to opponent's bar
    const oppBarIdx = barIndex(opponent);
    newBoard[to].count = 0;
    newBoard[to].owner = null;
    if (newBoard[oppBarIdx].owner === opponent) {
      newBoard[oppBarIdx].count++;
    } else {
      newBoard[oppBarIdx].owner = opponent;
      newBoard[oppBarIdx].count = 1;
    }
  }

  // Place checker at destination
  if (newBoard[to].owner === player) {
    newBoard[to].count++;
  } else {
    newBoard[to].owner = player;
    newBoard[to].count = 1;
  }

  return { newBoard, isHit };
}

// Check if the game is over
export function checkWinner(state: GameState): Player | null {
  if (state.whiteBorneOff >= 15) return 'white';
  if (state.blackBorneOff >= 15) return 'black';
  return null;
}

// Get all points that have a player's checkers (excluding bar)
export function getPlayerPoints(board: Point[], player: Player): number[] {
  const points: number[] = [];
  for (let i = 1; i <= 24; i++) {
    if (board[i].owner === player && board[i].count > 0) {
      points.push(i);
    }
  }
  return points;
}

// Calculate pip count for a player (used for AI evaluation)
export function getPipCount(board: Point[], player: Player, borneOff: number): number {
  let pip = 0;
  if (player === 'white') {
    for (let i = 1; i <= 24; i++) {
      if (board[i].owner === 'white') pip += board[i].count * i;
    }
    // Bar pieces have to travel full board
    if (board[0].owner === 'white') pip += board[0].count * 25;
  } else {
    for (let i = 1; i <= 24; i++) {
      if (board[i].owner === 'black') pip += board[i].count * (25 - i);
    }
    if (board[25].owner === 'black') pip += board[25].count * 25;
  }
  return pip;
}
