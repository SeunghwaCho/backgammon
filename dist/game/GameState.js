// Standard backgammon initial position
// WHITE pieces at: 24(2), 13(5), 8(3), 6(5)
// BLACK pieces at: 1(2), 12(5), 17(3), 19(5)
// WHITE moves 24->1, BLACK moves 1->24
export function createInitialBoard() {
    const board = [];
    // Index 0: white bar
    board.push({ owner: null, count: 0 });
    // Points 1-24
    for (let i = 1; i <= 24; i++) {
        board.push({ owner: null, count: 0 });
    }
    // Index 25: black bar
    board.push({ owner: null, count: 0 });
    // Place white checkers
    board[24] = { owner: 'white', count: 2 };
    board[13] = { owner: 'white', count: 5 };
    board[8] = { owner: 'white', count: 3 };
    board[6] = { owner: 'white', count: 5 };
    // Place black checkers
    board[1] = { owner: 'black', count: 2 };
    board[12] = { owner: 'black', count: 5 };
    board[17] = { owner: 'black', count: 3 };
    board[19] = { owner: 'black', count: 5 };
    return board;
}
export function createInitialGameState() {
    return {
        board: createInitialBoard(),
        whiteBorneOff: 0,
        blackBorneOff: 0,
        currentPlayer: 'white',
        dice: null,
        phase: 'rollingForFirst',
        selectedPoint: null,
        validMoves: [],
        legalSequences: [],
        winner: null,
        lastSaveTime: null,
        errorMessage: null,
        initialRoll: null,
    };
}
// Deep clone a game state to prevent mutation bugs
export function cloneGameState(state) {
    return {
        board: state.board.map(p => ({ owner: p.owner, count: p.count })),
        whiteBorneOff: state.whiteBorneOff,
        blackBorneOff: state.blackBorneOff,
        currentPlayer: state.currentPlayer,
        dice: state.dice
            ? {
                values: [state.dice.values[0], state.dice.values[1]],
                remaining: [...state.dice.remaining],
            }
            : null,
        phase: state.phase,
        selectedPoint: state.selectedPoint,
        validMoves: state.validMoves.map(m => ({ ...m })),
        legalSequences: state.legalSequences.map(seq => seq.map(m => ({ ...m }))),
        winner: state.winner,
        lastSaveTime: state.lastSaveTime,
        errorMessage: state.errorMessage,
        initialRoll: state.initialRoll ? { ...state.initialRoll } : null,
    };
}
// Clone just the board (used for move simulation)
export function cloneBoard(board) {
    return board.map(p => ({ owner: p.owner, count: p.count }));
}
// Get the bar index for a player
export function barIndex(player) {
    return player === 'white' ? 0 : 25;
}
// Get the bear-off sentinel value for a player
// White bears off to point 0 (i.e., to < 1), we use -1 as the "to" value
// Black bears off beyond 24 (i.e., > 24), we use 26 as the "to" value
export function bearOffTarget(player) {
    return player === 'white' ? -1 : 26;
}
// Get how many checkers a player has on the bar
export function getBarCount(state, player) {
    const idx = barIndex(player);
    const pt = state.board[idx];
    if (pt.owner === player)
        return pt.count;
    return 0;
}
// Count total checkers for a player (board + bar + borne off)
export function countTotalCheckers(state, player) {
    let total = 0;
    for (let i = 0; i <= 25; i++) {
        const pt = state.board[i];
        if (pt.owner === player)
            total += pt.count;
    }
    if (player === 'white')
        total += state.whiteBorneOff;
    else
        total += state.blackBorneOff;
    return total;
}
// Verify checker counts are correct (15 per player)
export function verifyCheckerCounts(state) {
    return (countTotalCheckers(state, 'white') === 15 &&
        countTotalCheckers(state, 'black') === 15);
}
//# sourceMappingURL=GameState.js.map