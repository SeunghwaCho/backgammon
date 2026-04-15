// AI opponent using heuristic scoring to select the best move sequence
// Always plays legal moves; uses the same MoveGenerator as the human player

import { GameState, Player, MoveSequence, Move, Point } from '../game/Types.js';
import { cloneGameState } from '../game/GameState.js';
import { applyMoveInternal } from '../game/Reducer.js';
import { getPipCount, getHomeBoardRange, canBearOff } from '../game/Rules.js';

// Score a board position from the perspective of the given player
function evaluatePosition(
  board: Point[],
  player: Player,
  whiteBorneOff: number,
  blackBorneOff: number
): number {
  const opponent: Player = player === 'white' ? 'black' : 'white';
  let score = 0;

  const playerBorneOff = player === 'white' ? whiteBorneOff : blackBorneOff;
  const opponentBorneOff = player === 'white' ? blackBorneOff : whiteBorneOff;

  // Strong weight on bearing off progress
  score += playerBorneOff * 10;
  score -= opponentBorneOff * 10;

  // Pip count difference (lower pip count is better for us)
  const myPip = getPipCount(board, player, playerBorneOff);
  const oppPip = getPipCount(board, opponent, opponentBorneOff);
  score += (oppPip - myPip) * 0.3;

  // Count blots (single checkers = vulnerable)
  let myBlots = 0;
  let oppBlots = 0;
  for (let i = 1; i <= 24; i++) {
    const pt = board[i];
    if (pt.owner === player && pt.count === 1) myBlots++;
    if (pt.owner === opponent && pt.count === 1) oppBlots++;
  }
  score -= myBlots * 2;
  score += oppBlots * 1.5;

  // Count points (stacked positions = safer)
  let myPoints = 0;
  let oppPoints = 0;
  for (let i = 1; i <= 24; i++) {
    const pt = board[i];
    if (pt.owner === player && pt.count >= 2) myPoints++;
    if (pt.owner === opponent && pt.count >= 2) oppPoints++;
  }
  score += myPoints * 1.5;

  // Home board progress
  const [homeMin, homeMax] = getHomeBoardRange(player);
  for (let i = homeMin; i <= homeMax; i++) {
    const pt = board[i];
    if (pt.owner === player) score += pt.count * 0.5;
  }

  // Penalize bar checkers heavily
  const myBarIdx = player === 'white' ? 0 : 25;
  const oppBarIdx = player === 'white' ? 25 : 0;
  const myBarPt = board[myBarIdx];
  const oppBarPt = board[oppBarIdx];
  if (myBarPt.owner === player) score -= myBarPt.count * 8;
  if (oppBarPt.owner === opponent) score += oppBarPt.count * 5; // opponent on bar is good for us

  // Reward making the opponent's home board points (prime building)
  // For black (AI): reward blocking points in low numbers
  // For white: reward blocking high numbers
  if (player === 'black') {
    for (let i = 1; i <= 6; i++) {
      if (board[i].owner === 'black' && board[i].count >= 2) score += 2;
    }
  } else {
    for (let i = 19; i <= 24; i++) {
      if (board[i].owner === 'white' && board[i].count >= 2) score += 2;
    }
  }

  return score;
}

// Apply a full move sequence and return resulting state
function applySequence(state: GameState, sequence: MoveSequence): GameState {
  let current = cloneGameState(state);
  for (const move of sequence) {
    current = applyMoveInternal(current, move);
    // Stop if game over
    if (current.phase === 'gameOver') break;
  }
  return current;
}

// Pick the best move sequence for the AI player
export function chooseBestSequence(state: GameState): MoveSequence | null {
  const sequences = state.legalSequences;
  if (!sequences || sequences.length === 0) return null;

  // Filter out empty sequences
  const validSeqs = sequences.filter(s => s.length > 0);
  if (validSeqs.length === 0) return null;

  const player = state.currentPlayer;
  let bestScore = -Infinity;
  let bestSeq: MoveSequence = validSeqs[0];

  for (const seq of validSeqs) {
    const resultState = applySequence(state, seq);
    const score = evaluatePosition(
      resultState.board,
      player,
      resultState.whiteBorneOff,
      resultState.blackBorneOff
    );

    // Add small random noise to avoid always choosing same sequence in ties
    const finalScore = score + Math.random() * 0.01;

    if (finalScore > bestScore) {
      bestScore = finalScore;
      bestSeq = seq;
    }
  }

  return bestSeq;
}

// Execute AI turn asynchronously with delays for better UX
export async function executeAITurn(
  state: GameState,
  onMove: (newState: GameState, move: Move) => void,
  onComplete: (finalState: GameState) => void,
  rollDiceFn: (state: GameState) => GameState
): Promise<void> {
  // First roll dice
  await delay(400);
  let current = rollDiceFn(state);
  onComplete(current); // update display after roll

  // If no moves (already switched to next player's roll phase)
  if (current.phase !== 'aiThinking') {
    onComplete(current);
    return;
  }

  // Choose best sequence
  const bestSeq = chooseBestSequence(current);
  if (!bestSeq || bestSeq.length === 0) {
    onComplete(current);
    return;
  }

  // Apply each move with a delay
  for (const move of bestSeq) {
    await delay(500);
    if (current.phase === 'gameOver') break;
    current = applyMoveInternal(current, move);
    onMove(current, move);
  }

  // Small delay before ending
  await delay(300);
  onComplete(current);
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
