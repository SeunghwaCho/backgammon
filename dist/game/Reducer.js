// Reducer: pure functions that apply actions to game state
// Each function returns a new GameState without mutating the input
import { cloneGameState, createInitialGameState } from './GameState.js';
import { checkWinner, applySingleMove } from './Rules.js';
import { generateAllLegalSequences, getMovesFromPoint, getSelectablePoints, filterSequencesAfterMove, } from './MoveGenerator.js';
// Roll dice and update state
export function rollDice(state, d1, d2) {
    const next = cloneGameState(state);
    const isDoubles = d1 === d2;
    const remaining = isDoubles ? [d1, d1, d1, d1] : [d1, d2];
    next.dice = {
        values: [d1, d2],
        remaining: remaining,
    };
    // Generate all legal sequences for this roll
    const borneOff = next.currentPlayer === 'white' ? next.whiteBorneOff : next.blackBorneOff;
    next.legalSequences = generateAllLegalSequences(next.board, next.currentPlayer, next.dice, borneOff);
    // Check if any legal sequence actually has at least one move
    const hasLegalMoves = next.legalSequences.some(seq => seq.length > 0);
    if (!hasLegalMoves) {
        // No legal moves - must pass turn
        next.phase = 'waitingForRoll';
        next.errorMessage = 'No legal moves. Turn passed.';
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
export function selectPoint(state, pointIndex) {
    if (state.phase !== 'playerActing')
        return state;
    if (!state.dice)
        return state;
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
export function applyPlayerMove(state, move) {
    if (state.phase !== 'playerActing')
        return state;
    if (!state.dice)
        return state;
    // Validate move is in validMoves
    const isValid = state.validMoves.some(m => m.from === move.from && m.to === move.to && m.dieUsed === move.dieUsed);
    if (!isValid) {
        const next = cloneGameState(state);
        next.errorMessage = 'Invalid move.';
        return next;
    }
    return applyMoveInternal(state, move);
}
// Apply a move (used by both player and AI)
export function applyMoveInternal(state, move) {
    const next = cloneGameState(state);
    const player = next.currentPlayer;
    // Apply to board
    const { newBoard, isHit } = applySingleMove(next.board, player, move.from, move.to);
    next.board = newBoard;
    // Handle bear off
    if (move.to === -1 || move.to === 26) {
        if (player === 'white')
            next.whiteBorneOff++;
        else
            next.blackBorneOff++;
    }
    // Remove used die from remaining
    const dieIdx = next.dice.remaining.indexOf(move.dieUsed);
    if (dieIdx !== -1)
        next.dice.remaining.splice(dieIdx, 1);
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
        next.phase = 'gameOver';
        return next;
    }
    // Check if turn is complete (no more dice or no more legal moves)
    if (next.dice.remaining.length === 0) {
        return endTurn(next);
    }
    // Check if remaining sequences have any moves
    const hasMoreMoves = next.legalSequences.length > 0 && next.legalSequences.some(s => s.length > 0);
    if (!hasMoreMoves) {
        // Remaining dice can't be used
        return endTurn(next);
    }
    // Continue same player's turn
    // Phase stays playerActing (for human) - AI handled externally
    return next;
}
// End the current player's turn and switch to next player
export function endTurn(state) {
    const next = cloneGameState(state);
    next.currentPlayer = next.currentPlayer === 'white' ? 'black' : 'white';
    next.dice = null;
    next.selectedPoint = null;
    next.validMoves = [];
    next.legalSequences = [];
    next.phase = 'waitingForRoll';
    return next;
}
// Roll both dice to determine who goes first
// Returns updated state; tie stays in rollingForFirst, winner also stays so
// the caller can display the result briefly before transitioning.
export function rollForFirst(state, wRoll, bRoll) {
    const next = cloneGameState(state);
    next.initialRoll = { white: wRoll, black: bRoll };
    if (wRoll !== bRoll) {
        // Set the winner as currentPlayer; main.ts will transition phase after a delay
        next.currentPlayer = wRoll > bRoll ? 'white' : 'black';
    }
    // Phase stays rollingForFirst in both tie and winner cases; caller drives transition
    return next;
}
// Start a new game (begins in rollingForFirst so players roll to decide who goes first)
export function startNewGame() {
    return createInitialGameState();
}
// Restore game from saved state (with validation)
export function restoreFromSave(saved) {
    // Re-generate legal sequences if needed
    if (saved.phase === 'playerActing' ||
        saved.phase === 'aiThinking') {
        if (saved.dice) {
            const borneOff = saved.currentPlayer === 'white' ? saved.whiteBorneOff : saved.blackBorneOff;
            const sequences = generateAllLegalSequences(saved.board, saved.currentPlayer, saved.dice, borneOff);
            saved.legalSequences = sequences;
        }
    }
    saved.selectedPoint = null;
    saved.validMoves = [];
    saved.initialRoll = null;
    // If AI was mid-thinking, reset to waitingForRoll for that player
    if (saved.phase === 'aiThinking') {
        saved.phase = 'waitingForRoll';
    }
    // If restored mid-initial-roll, restart the initial roll phase cleanly
    if (saved.phase === 'rollingForFirst') {
        saved.currentPlayer = 'white'; // will be re-determined by fresh roll
    }
    return saved;
}
//# sourceMappingURL=Reducer.js.map