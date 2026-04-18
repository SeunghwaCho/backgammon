"use strict";
(() => {
  // src/game/GameState.ts
  var DEFAULT_MATCH_LENGTH = 5;
  function createInitialBoard() {
    const board = [];
    board.push({ owner: null, count: 0 });
    for (let i = 1; i <= 24; i++) {
      board.push({ owner: null, count: 0 });
    }
    board.push({ owner: null, count: 0 });
    board[24] = { owner: "white", count: 2 };
    board[13] = { owner: "white", count: 5 };
    board[8] = { owner: "white", count: 3 };
    board[6] = { owner: "white", count: 5 };
    board[1] = { owner: "black", count: 2 };
    board[12] = { owner: "black", count: 5 };
    board[17] = { owner: "black", count: 3 };
    board[19] = { owner: "black", count: 5 };
    return board;
  }
  function createInitialCube() {
    return { value: 1, owner: null };
  }
  function createInitialMatch(targetScore = DEFAULT_MATCH_LENGTH) {
    return {
      targetScore,
      whiteScore: 0,
      blackScore: 0,
      isCrawford: false,
      postCrawford: false,
      matchOver: false,
      matchWinner: null
    };
  }
  function createInitialGameState(match) {
    return {
      board: createInitialBoard(),
      whiteBorneOff: 0,
      blackBorneOff: 0,
      currentPlayer: "white",
      dice: null,
      phase: "rollingForFirst",
      selectedPoint: null,
      validMoves: [],
      legalSequences: [],
      winner: null,
      winType: null,
      lastSaveTime: null,
      errorMessage: null,
      initialRoll: null,
      cube: createInitialCube(),
      match: match ?? createInitialMatch()
    };
  }
  function cloneGameState(state) {
    return {
      board: state.board.map((p) => ({ owner: p.owner, count: p.count })),
      whiteBorneOff: state.whiteBorneOff,
      blackBorneOff: state.blackBorneOff,
      currentPlayer: state.currentPlayer,
      dice: state.dice ? {
        values: [state.dice.values[0], state.dice.values[1]],
        remaining: [...state.dice.remaining]
      } : null,
      phase: state.phase,
      selectedPoint: state.selectedPoint,
      validMoves: state.validMoves.map((m) => ({ ...m })),
      legalSequences: state.legalSequences.map((seq) => seq.map((m) => ({ ...m }))),
      winner: state.winner,
      winType: state.winType,
      lastSaveTime: state.lastSaveTime,
      errorMessage: state.errorMessage,
      initialRoll: state.initialRoll ? { ...state.initialRoll } : null,
      cube: { ...state.cube },
      match: { ...state.match }
    };
  }
  function cloneBoard(board) {
    return board.map((p) => ({ owner: p.owner, count: p.count }));
  }
  function barIndex(player) {
    return player === "white" ? 0 : 25;
  }

  // src/game/Rules.ts
  function getHomeBoardRange(player) {
    return player === "white" ? [1, 6] : [19, 24];
  }
  function canBearOff(board, player, borneOff) {
    const barIdx = barIndex(player);
    const barPt = board[barIdx];
    if (barPt.owner === player && barPt.count > 0) return false;
    const [homeMin, homeMax] = getHomeBoardRange(player);
    for (let i = 1; i <= 24; i++) {
      const pt = board[i];
      if (pt.owner !== player || pt.count === 0) continue;
      if (i < homeMin || i > homeMax) return false;
    }
    return true;
  }
  function isBlocked(board, pointIndex, player) {
    if (pointIndex < 1 || pointIndex > 24) return false;
    const pt = board[pointIndex];
    const opponent = player === "white" ? "black" : "white";
    return pt.owner === opponent && pt.count >= 2;
  }
  function isSingleMoveValid(board, player, borneOff, from, to, dieValue) {
    const barIdx = barIndex(player);
    const barPt = board[barIdx];
    if (barPt.owner === player && barPt.count > 0) {
      if (from !== barIdx) return false;
    }
    const srcPt = board[from];
    if (!srcPt || srcPt.owner !== player || srcPt.count === 0) return false;
    if (to === -1 || to === 26) {
      if (!canBearOff(board, player, borneOff)) return false;
      const [homeMin, homeMax] = getHomeBoardRange(player);
      if (player === "white") {
        if (from < homeMin || from > homeMax) return false;
        if (dieValue === from) return true;
        if (dieValue > from) {
          for (let p = from + 1; p <= homeMax; p++) {
            if (board[p].owner === player && board[p].count > 0) return false;
          }
          return true;
        }
        return false;
      } else {
        if (from < homeMin || from > homeMax) return false;
        const distanceNeeded = 25 - from;
        if (dieValue === distanceNeeded) return true;
        if (dieValue > distanceNeeded) {
          for (let p = homeMin; p < from; p++) {
            if (board[p].owner === player && board[p].count > 0) return false;
          }
          return true;
        }
        return false;
      }
    }
    if (to < 1 || to > 24) return false;
    let expectedDie;
    if (from === 0) {
      expectedDie = 25 - to;
    } else if (from === 25) {
      expectedDie = to;
    } else {
      expectedDie = player === "white" ? from - to : to - from;
    }
    if (expectedDie !== dieValue) return false;
    if (isBlocked(board, to, player)) return false;
    return true;
  }
  function applySingleMove(board, player, from, to) {
    const newBoard = cloneBoard(board);
    const opponent = player === "white" ? "black" : "white";
    let isHit = false;
    if (newBoard[from].owner === player && newBoard[from].count > 0) {
      newBoard[from].count--;
      if (newBoard[from].count === 0) {
        newBoard[from].owner = null;
      }
    }
    if (to === -1 || to === 26) {
      return { newBoard, isHit: false };
    }
    if (newBoard[to].owner === opponent && newBoard[to].count === 1) {
      isHit = true;
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
    if (newBoard[to].owner === player) {
      newBoard[to].count++;
    } else {
      newBoard[to].owner = player;
      newBoard[to].count = 1;
    }
    return { newBoard, isHit };
  }
  function checkWinner(state) {
    if (state.whiteBorneOff >= 15) return "white";
    if (state.blackBorneOff >= 15) return "black";
    return null;
  }
  function getWinType(state, winner) {
    const loser = winner === "white" ? "black" : "white";
    const loserBorneOff = loser === "white" ? state.whiteBorneOff : state.blackBorneOff;
    if (loserBorneOff > 0) return "single";
    const loserBarIdx = loser === "white" ? 0 : 25;
    const loserBarPt = state.board[loserBarIdx];
    if (loserBarPt.owner === loser && loserBarPt.count > 0) return "backgammon";
    const [winnerHomeMin, winnerHomeMax] = getHomeBoardRange(winner);
    for (let i = winnerHomeMin; i <= winnerHomeMax; i++) {
      if (state.board[i].owner === loser && state.board[i].count > 0) return "backgammon";
    }
    return "gammon";
  }
  function winTypeMultiplier(wt) {
    if (wt === "gammon") return 2;
    if (wt === "backgammon") return 3;
    return 1;
  }
  function getPipCount(board, player, borneOff) {
    let pip = 0;
    if (player === "white") {
      for (let i = 1; i <= 24; i++) {
        if (board[i].owner === "white") pip += board[i].count * i;
      }
      if (board[0].owner === "white") pip += board[0].count * 25;
    } else {
      for (let i = 1; i <= 24; i++) {
        if (board[i].owner === "black") pip += board[i].count * (25 - i);
      }
      if (board[25].owner === "black") pip += board[25].count * 25;
    }
    return pip;
  }

  // src/game/MoveGenerator.ts
  function getSourcePoints(simState, player) {
    const barIdx = barIndex(player);
    const barPt = simState.board[barIdx];
    if (barPt.owner === player && barPt.count > 0) {
      return [barIdx];
    }
    const sources = [];
    for (let i = 1; i <= 24; i++) {
      if (simState.board[i].owner === player && simState.board[i].count > 0) {
        sources.push(i);
      }
    }
    return sources;
  }
  function getPossibleDestinations(simState, player, from, dieValue) {
    const board = simState.board;
    const destinations = [];
    if (from === 0 && player === "white") {
      const to = 25 - dieValue;
      if (to >= 1 && to <= 24) {
        if (isSingleMoveValid(board, player, simState.borneOff, from, to, dieValue)) {
          destinations.push(to);
        }
      }
      return destinations;
    }
    if (from === 25 && player === "black") {
      const to = dieValue;
      if (to >= 1 && to <= 24) {
        if (isSingleMoveValid(board, player, simState.borneOff, from, to, dieValue)) {
          destinations.push(to);
        }
      }
      return destinations;
    }
    if (player === "white") {
      const to = from - dieValue;
      if (to >= 1) {
        if (isSingleMoveValid(board, player, simState.borneOff, from, to, dieValue)) {
          destinations.push(to);
        }
      } else {
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
        if (isSingleMoveValid(board, player, simState.borneOff, from, 26, dieValue)) {
          destinations.push(26);
        }
      }
    }
    return destinations;
  }
  function generateSequences(simState, player, currentSequence) {
    if (simState.remainingDice.length === 0) {
      return [currentSequence];
    }
    const sources = getSourcePoints(simState, player);
    const usedDice = /* @__PURE__ */ new Set();
    const results = [];
    let hasAnyMove = false;
    const triedDice = /* @__PURE__ */ new Set();
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
          const move = { from, to, dieUsed: dieValue, isHit };
          const newSimState = {
            board: newBoard,
            borneOff: newBorneOff,
            remainingDice: newRemaining
          };
          const subSequences = generateSequences(newSimState, player, [
            ...currentSequence,
            move
          ]);
          results.push(...subSequences);
        }
      }
    }
    if (!hasAnyMove) {
      return [currentSequence];
    }
    return results;
  }
  function generateAllLegalSequences(board, player, dice, borneOff) {
    const initialState = {
      board: cloneBoard(board),
      borneOff,
      remainingDice: [...dice.remaining]
    };
    const allSequences = generateSequences(initialState, player, []);
    if (allSequences.length === 0) return [];
    const maxDiceUsed = Math.max(...allSequences.map((seq) => seq.length));
    const maxDiceSequences = allSequences.filter((seq) => seq.length === maxDiceUsed);
    const isDoubles = dice.values[0] === dice.values[1];
    if (!isDoubles && maxDiceUsed === 1 && dice.remaining.length === 2) {
      const maxDieInSequences = Math.max(
        ...maxDiceSequences.map((seq) => seq.length > 0 ? seq[0].dieUsed : 0)
      );
      const higherDieSeqs = maxDiceSequences.filter(
        (seq) => seq.length > 0 && seq[0].dieUsed === maxDieInSequences
      );
      if (higherDieSeqs.length > 0) return deduplicate(higherDieSeqs);
    }
    return deduplicate(maxDiceSequences);
  }
  function sequenceKey(seq) {
    return seq.map((m) => `${m.from}>${m.to}`).join(",");
  }
  function deduplicate(sequences) {
    const seen = /* @__PURE__ */ new Set();
    return sequences.filter((seq) => {
      const key = sequenceKey(seq);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  function getSelectablePoints(sequences) {
    const points = /* @__PURE__ */ new Set();
    for (const seq of sequences) {
      if (seq.length > 0) points.add(seq[0].from);
    }
    return points;
  }
  function getMovesFromPoint(sequences, from) {
    const moveMap = /* @__PURE__ */ new Map();
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
  function filterSequencesAfterMove(sequences, move) {
    const filtered = [];
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

  // src/game/Reducer.ts
  function rollDice(state, d1, d2) {
    const next = cloneGameState(state);
    const isDoubles = d1 === d2;
    const remaining = isDoubles ? [d1, d1, d1, d1] : [d1, d2];
    next.dice = {
      values: [d1, d2],
      remaining
    };
    const borneOff = next.currentPlayer === "white" ? next.whiteBorneOff : next.blackBorneOff;
    next.legalSequences = generateAllLegalSequences(
      next.board,
      next.currentPlayer,
      next.dice,
      borneOff
    );
    const hasLegalMoves = next.legalSequences.some((seq) => seq.length > 0);
    if (!hasLegalMoves) {
      next.phase = "waitingForRoll";
      next.errorMessage = "No legal moves. Turn passed.";
      return endTurn(next);
    }
    next.phase = next.currentPlayer === "white" ? "playerActing" : "aiThinking";
    next.selectedPoint = null;
    next.validMoves = [];
    next.errorMessage = null;
    return next;
  }
  function selectPoint(state, pointIndex) {
    if (state.phase !== "playerActing") return state;
    if (!state.dice) return state;
    const next = cloneGameState(state);
    const selectable = getSelectablePoints(next.legalSequences);
    if (!selectable.has(pointIndex)) {
      next.errorMessage = "No legal moves from that point.";
      next.selectedPoint = null;
      next.validMoves = [];
      return next;
    }
    next.selectedPoint = pointIndex;
    next.validMoves = getMovesFromPoint(next.legalSequences, pointIndex);
    next.errorMessage = null;
    return next;
  }
  function applyPlayerMove(state, move) {
    if (state.phase !== "playerActing") return state;
    if (!state.dice) return state;
    const isValid = state.validMoves.some(
      (m) => m.from === move.from && m.to === move.to && m.dieUsed === move.dieUsed
    );
    if (!isValid) {
      const next = cloneGameState(state);
      next.errorMessage = "Invalid move.";
      return next;
    }
    return applyMoveInternal(state, move);
  }
  function applyMoveInternal(state, move) {
    const next = cloneGameState(state);
    const player = next.currentPlayer;
    const { newBoard, isHit } = applySingleMove(next.board, player, move.from, move.to);
    next.board = newBoard;
    if (move.to === -1 || move.to === 26) {
      if (player === "white") next.whiteBorneOff++;
      else next.blackBorneOff++;
    }
    const dieIdx = next.dice.remaining.indexOf(move.dieUsed);
    if (dieIdx !== -1) next.dice.remaining.splice(dieIdx, 1);
    next.legalSequences = filterSequencesAfterMove(next.legalSequences, move);
    next.selectedPoint = null;
    next.validMoves = [];
    next.errorMessage = null;
    const winner = checkWinner(next);
    if (winner) {
      next.winner = winner;
      next.winType = getWinType(next, winner);
      next.phase = "gameOver";
      const pts = next.cube.value * winTypeMultiplier(next.winType);
      const newMatch = { ...next.match };
      if (winner === "white") newMatch.whiteScore += pts;
      else newMatch.blackScore += pts;
      if (newMatch.whiteScore >= newMatch.targetScore || newMatch.blackScore >= newMatch.targetScore) {
        newMatch.matchOver = true;
        newMatch.matchWinner = winner;
      }
      next.match = newMatch;
      return next;
    }
    if (next.dice.remaining.length === 0) {
      return endTurn(next);
    }
    const hasMoreMoves = next.legalSequences.length > 0 && next.legalSequences.some((s) => s.length > 0);
    if (!hasMoreMoves) {
      return endTurn(next);
    }
    return next;
  }
  function endTurn(state) {
    const next = cloneGameState(state);
    next.currentPlayer = next.currentPlayer === "white" ? "black" : "white";
    next.dice = null;
    next.selectedPoint = null;
    next.validMoves = [];
    next.legalSequences = [];
    next.phase = "waitingForRoll";
    return next;
  }
  function canOfferDouble(state) {
    if (state.phase !== "waitingForRoll") return false;
    if (state.match.isCrawford) return false;
    if (state.cube.value >= 64) return false;
    if (state.cube.owner !== null && state.cube.owner !== state.currentPlayer) return false;
    return true;
  }
  function offerDouble(state) {
    if (!canOfferDouble(state)) return state;
    const next = cloneGameState(state);
    if (state.currentPlayer === "white") {
      next.cube = { value: state.cube.value * 2, owner: "black" };
      next.errorMessage = null;
    } else {
      next.phase = "playerDecidingDouble";
      next.errorMessage = null;
    }
    return next;
  }
  function acceptDouble(state) {
    if (state.phase !== "playerDecidingDouble") return state;
    const next = cloneGameState(state);
    next.cube = { value: state.cube.value * 2, owner: "white" };
    next.phase = "waitingForRoll";
    next.errorMessage = null;
    return next;
  }
  function declineDouble(state) {
    if (state.phase !== "playerDecidingDouble") return state;
    const next = cloneGameState(state);
    next.winner = "black";
    next.winType = "single";
    next.phase = "gameOver";
    const pts = next.cube.value;
    const newMatch = { ...next.match };
    newMatch.blackScore += pts;
    if (newMatch.blackScore >= newMatch.targetScore) {
      newMatch.matchOver = true;
      newMatch.matchWinner = "black";
    }
    next.match = newMatch;
    next.errorMessage = null;
    return next;
  }
  function startNextGame(state) {
    const oldMatch = { ...state.match };
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
  function rollForFirst(state, wRoll, bRoll) {
    const next = cloneGameState(state);
    next.initialRoll = { white: wRoll, black: bRoll };
    if (wRoll !== bRoll) {
      next.currentPlayer = wRoll > bRoll ? "white" : "black";
    }
    return next;
  }
  function startNewGame() {
    return createInitialGameState();
  }
  function restoreFromSave(saved) {
    if (saved.phase === "playerActing" || saved.phase === "aiThinking") {
      if (saved.dice) {
        const borneOff = saved.currentPlayer === "white" ? saved.whiteBorneOff : saved.blackBorneOff;
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
    if (saved.phase === "aiThinking" || saved.phase === "playerDecidingDouble") {
      saved.phase = "waitingForRoll";
      saved.cube = createInitialCube();
    }
    if (saved.phase === "rollingForFirst") {
      saved.currentPlayer = "white";
    }
    if (!saved.cube) saved.cube = createInitialCube();
    if (!saved.match) {
      saved.match = {
        targetScore: 5,
        whiteScore: 0,
        blackScore: 0,
        isCrawford: false,
        postCrawford: false,
        matchOver: false,
        matchWinner: null
      };
    }
    return saved;
  }

  // src/ai/BackgammonAI.ts
  function evaluatePosition(board, player, whiteBorneOff, blackBorneOff) {
    const opponent = player === "white" ? "black" : "white";
    let score = 0;
    const playerBorneOff = player === "white" ? whiteBorneOff : blackBorneOff;
    const opponentBorneOff = player === "white" ? blackBorneOff : whiteBorneOff;
    score += playerBorneOff * 10;
    score -= opponentBorneOff * 10;
    const myPip = getPipCount(board, player, playerBorneOff);
    const oppPip = getPipCount(board, opponent, opponentBorneOff);
    score += (oppPip - myPip) * 0.3;
    let myBlots = 0;
    let oppBlots = 0;
    for (let i = 1; i <= 24; i++) {
      const pt = board[i];
      if (pt.owner === player && pt.count === 1) myBlots++;
      if (pt.owner === opponent && pt.count === 1) oppBlots++;
    }
    score -= myBlots * 2;
    score += oppBlots * 1.5;
    let myPoints = 0;
    let oppPoints = 0;
    for (let i = 1; i <= 24; i++) {
      const pt = board[i];
      if (pt.owner === player && pt.count >= 2) myPoints++;
      if (pt.owner === opponent && pt.count >= 2) oppPoints++;
    }
    score += myPoints * 1.5;
    const [homeMin, homeMax] = getHomeBoardRange(player);
    for (let i = homeMin; i <= homeMax; i++) {
      const pt = board[i];
      if (pt.owner === player) score += pt.count * 0.5;
    }
    const myBarIdx = player === "white" ? 0 : 25;
    const oppBarIdx = player === "white" ? 25 : 0;
    const myBarPt = board[myBarIdx];
    const oppBarPt = board[oppBarIdx];
    if (myBarPt.owner === player) score -= myBarPt.count * 8;
    if (oppBarPt.owner === opponent) score += oppBarPt.count * 5;
    if (player === "black") {
      for (let i = 1; i <= 6; i++) {
        if (board[i].owner === "black" && board[i].count >= 2) score += 2;
      }
    } else {
      for (let i = 19; i <= 24; i++) {
        if (board[i].owner === "white" && board[i].count >= 2) score += 2;
      }
    }
    return score;
  }
  function applySequence(state, sequence) {
    let current = cloneGameState(state);
    for (const move of sequence) {
      current = applyMoveInternal(current, move);
      if (current.phase === "gameOver") break;
    }
    return current;
  }
  function chooseBestSequence(state) {
    const sequences = state.legalSequences;
    if (!sequences || sequences.length === 0) return null;
    const validSeqs = sequences.filter((s) => s.length > 0);
    if (validSeqs.length === 0) return null;
    const player = state.currentPlayer;
    let bestScore = -Infinity;
    let bestSeq = validSeqs[0];
    for (const seq of validSeqs) {
      const resultState = applySequence(state, seq);
      const score = evaluatePosition(
        resultState.board,
        player,
        resultState.whiteBorneOff,
        resultState.blackBorneOff
      );
      const finalScore = score + Math.random() * 0.01;
      if (finalScore > bestScore) {
        bestScore = finalScore;
        bestSeq = seq;
      }
    }
    return bestSeq;
  }

  // src/i18n/Locale.ts
  var KO = {
    youTurn: "\uB098 (\uD770\uC0C9)",
    aiTurn: "AI (\uAC80\uC815)",
    clickRoll: "\uC8FC\uC0AC\uC704\uB97C \uAD74\uB9AC\uC138\uC694 \u{1F3B2}",
    selectPiece: "\uB9D0\uC744 \uC120\uD0DD\uD558\uC138\uC694 \u265F\uFE0F",
    aiThinking: "AI \uC0DD\uAC01 \uC911... \u{1F914}",
    youWin: "\u{1F389} \uC2B9\uB9AC! \u{1F389}",
    aiWins: "\u{1F916} AI \uC2B9\uB9AC!",
    diceLabel: "\uC8FC\uC0AC\uC704",
    savedAt: "\uC800\uC7A5\uB428",
    btnRollEmoji: "\u{1F3B2}",
    btnRollText: "\uAD74\uB9AC\uAE30",
    btnNewGameEmoji: "\u{1F504}",
    btnNewGameText: "\uC0C8 \uAC8C\uC784",
    btnClearSaveEmoji: "\u{1F5D1}\uFE0F",
    btnClearSaveText: "\uC0AD\uC81C",
    btnLangEmoji: "\u{1F310}",
    btnLangText: "EN",
    btnRoll: "\u{1F3B2} \uAD74\uB9AC\uAE30",
    btnRollShort: "\u{1F3B2}",
    btnNewGame: "\u{1F504} \uC0C8 \uAC8C\uC784",
    btnNewGameShort: "\u{1F504}",
    btnClearSave: "\u{1F5D1}\uFE0F \uC800\uC7A5 \uC0AD\uC81C",
    btnClearSaveShort: "\u{1F5D1}\uFE0F",
    btnLang: "EN",
    btnSoundOnText: "\uC74C\uC18C\uAC70",
    btnSoundOffText: "\uC18C\uB9AC\uCF1C\uAE30",
    newGameHint: "\u{1F504} \uC0C8 \uAC8C\uC784 \uBC84\uD2BC\uC744 \uB20C\uB7EC \uB2E4\uC2DC \uC2DC\uC791\uD558\uC138\uC694",
    savedGameFound: "\u{1F4BE} \uC800\uC7A5\uB41C \uAC8C\uC784\uC774 \uC788\uC2B5\uB2C8\uB2E4",
    lastSaved: "\uB9C8\uC9C0\uB9C9 \uC800\uC7A5",
    btnContinue: "\u25B6\uFE0F \uC774\uC5B4\uD558\uAE30",
    btnContinueText: "\uC774\uC5B4\uD558\uAE30",
    btnNewGamePrompt: "\u{1F504} \uC0C8 \uAC8C\uC784",
    labelWhite: "\uD770\uC0C9",
    labelBlack: "\uAC80\uC815",
    bornOffWhite: "\uD770 bear-off",
    bornOffBlack: "\uAC80 bear-off",
    confirmNewGameTitle: "\uC0C8 \uAC8C\uC784 \uC2DC\uC791",
    confirmNewGameBody: "\uC9C4\uD589 \uC911\uC778 \uAC8C\uC784\uC774 \uC0AC\uB77C\uC9D1\uB2C8\uB2E4.\n\uC815\uB9D0 \uC0C8 \uAC8C\uC784\uC744 \uC2DC\uC791\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?",
    confirmYes: "\u2705 \uD655\uC778",
    confirmNo: "\u274C \uCDE8\uC18C",
    confirmClearSaveTitle: "\uC800\uC7A5 \uB370\uC774\uD130 \uC0AD\uC81C",
    confirmClearSaveBody: "\uC800\uC7A5\uB41C \uAC8C\uC784 \uB370\uC774\uD130\uAC00 \uC0AD\uC81C\uB429\uB2C8\uB2E4.\n\uC815\uB9D0 \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?",
    rollForFirstTitle: "\uC120\uACF5 \uACB0\uC815",
    rollForFirstPrompt: "\u{1F3B2} \uAD74\uB824\uC11C \uC120\uACF5\uC744 \uACB0\uC815\uD558\uC138\uC694",
    rollForFirstTie: "\uBB34\uC2B9\uBD80! \uB2E4\uC2DC \uAD74\uB9AC\uC138\uC694 \u{1F3B2}",
    rollForFirstWhiteFirst: "\u{1F389} \uD770\uC0C9 \uC120\uACF5!",
    rollForFirstBlackFirst: "\u{1F389} \uAC80\uC815 \uC120\uACF5!",
    btnDoubleEmoji: "\u2716\uFE0F",
    btnDoubleText: "\uB354\uBE14",
    aiOffersDouble: "AI\uAC00 \uB354\uBE14\uC744 \uC81C\uC548\uD569\uB2C8\uB2E4! (\uD604\uC7AC \xD7{v})",
    acceptDouble: "\u2705 \uC218\uB77D",
    declineDouble: "\u274C \uAC70\uBD80",
    youDoubled: "\uB354\uBE14! AI\uAC00 \uC218\uB77D\uD588\uC2B5\uB2C8\uB2E4 (\xD7{v})",
    aiAcceptedDouble: "AI\uAC00 \uB354\uBE14\uC744 \uC218\uB77D\uD588\uC2B5\uB2C8\uB2E4",
    cubeLabel: "\uD050\uBE0C",
    matchScore: "\uB9E4\uCE58",
    matchOf: "/{t}",
    matchWon: "\u{1F3C6} \uB9E4\uCE58 \uC2B9\uB9AC!",
    gammonWin: "\u{1F3AF} Gammon! ({v}\uC810)",
    backgammonWin: "\u{1F3AF} Backgammon! ({v}\uC810)",
    nextGameBtn: "\uB2E4\uC74C \uAC8C\uC784 \u25B6",
    pipLabel: "pip",
    errCannotMove: "\uADF8 \uACF3\uC73C\uB85C \uC774\uB3D9\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.",
    errInvalidMove: "\uC798\uBABB\uB41C \uC774\uB3D9\uC785\uB2C8\uB2E4.",
    msgSaveCleared: "\uC800\uC7A5 \uB370\uC774\uD130\uAC00 \uC0AD\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4.",
    errClearFailed: "\uC800\uC7A5 \uC0AD\uC81C\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.",
    errRestoreFailed: "\uBCF5\uC6D0 \uC2E4\uD328. \uC0C8 \uAC8C\uC784\uC744 \uC2DC\uC791\uD569\uB2C8\uB2E4."
  };
  var EN = {
    youTurn: "YOU (White)",
    aiTurn: "AI (Black)",
    clickRoll: "Roll the dice \u{1F3B2}",
    selectPiece: "Select a piece \u265F\uFE0F",
    aiThinking: "AI thinking... \u{1F914}",
    youWin: "\u{1F389} YOU WIN! \u{1F389}",
    aiWins: "\u{1F916} AI WINS!",
    diceLabel: "Dice",
    savedAt: "Saved",
    btnRollEmoji: "\u{1F3B2}",
    btnRollText: "Roll",
    btnNewGameEmoji: "\u{1F504}",
    btnNewGameText: "New",
    btnClearSaveEmoji: "\u{1F5D1}\uFE0F",
    btnClearSaveText: "Clear",
    btnLangEmoji: "\u{1F310}",
    btnLangText: "\uD55C\uAD6D\uC5B4",
    btnRoll: "\u{1F3B2} Roll",
    btnRollShort: "\u{1F3B2}",
    btnNewGame: "\u{1F504} New Game",
    btnNewGameShort: "\u{1F504}",
    btnClearSave: "\u{1F5D1}\uFE0F Clear Save",
    btnClearSaveShort: "\u{1F5D1}\uFE0F",
    btnLang: "\uD55C\uAD6D\uC5B4",
    btnSoundOnText: "Mute",
    btnSoundOffText: "Unmute",
    newGameHint: "Press \u{1F504} New Game to play again",
    savedGameFound: "\u{1F4BE} Saved Game Found",
    lastSaved: "Last saved",
    btnContinue: "\u25B6\uFE0F Continue",
    btnContinueText: "Continue",
    btnNewGamePrompt: "\u{1F504} New Game",
    labelWhite: "White",
    labelBlack: "Black",
    bornOffWhite: "White off",
    bornOffBlack: "Black off",
    confirmNewGameTitle: "New Game",
    confirmNewGameBody: "Your current game will be lost.\nAre you sure you want to start a new game?",
    confirmYes: "\u2705 Yes",
    confirmNo: "\u274C No",
    confirmClearSaveTitle: "Delete Save Data",
    confirmClearSaveBody: "Saved game data will be deleted.\nAre you sure?",
    rollForFirstTitle: "First Player",
    rollForFirstPrompt: "\u{1F3B2} Roll to determine who goes first",
    rollForFirstTie: "Tie! Roll again \u{1F3B2}",
    rollForFirstWhiteFirst: "\u{1F389} White goes first!",
    rollForFirstBlackFirst: "\u{1F389} Black goes first!",
    btnDoubleEmoji: "\u2716\uFE0F",
    btnDoubleText: "Double",
    aiOffersDouble: "AI offers Double! (now \xD7{v})",
    acceptDouble: "\u2705 Accept",
    declineDouble: "\u274C Decline",
    youDoubled: "Doubled! AI accepted (\xD7{v})",
    aiAcceptedDouble: "AI accepted the double",
    cubeLabel: "Cube",
    matchScore: "Match",
    matchOf: "/{t}",
    matchWon: "\u{1F3C6} Match Won!",
    gammonWin: "\u{1F3AF} Gammon! ({v} pts)",
    backgammonWin: "\u{1F3AF} Backgammon! ({v} pts)",
    nextGameBtn: "Next Game \u25B6",
    pipLabel: "pip",
    errCannotMove: "Cannot move there.",
    errInvalidMove: "Invalid move.",
    msgSaveCleared: "Save data cleared.",
    errClearFailed: "Failed to clear save.",
    errRestoreFailed: "Could not restore. Starting new game."
  };
  var LOCALES = { ko: KO, en: EN };
  var STORAGE_KEY = "bg_lang";
  function loadLang() {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === "ko" || v === "en") return v;
    } catch {
    }
    return "ko";
  }
  var _current = loadLang();
  var _onChange = null;
  function setLang(lang) {
    _current = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
    }
    _onChange?.();
  }
  function toggleLang() {
    setLang(_current === "ko" ? "en" : "ko");
  }
  function onLangChange(cb) {
    _onChange = cb;
  }
  function t() {
    return LOCALES[_current];
  }

  // src/render/AnimationSystem.ts
  var ANIM_MOVE_MS = 380;
  var ANIM_HIT_MS = 520;
  function easeOutCubic(t2) {
    return 1 - Math.pow(1 - t2, 3);
  }
  var AnimationSystem = class {
    constructor() {
      this.anims = [];
    }
    /** Enqueue a new animation. startTime defaults to performance.now(). */
    queue(anim) {
      this.anims.push(anim);
    }
    /** True if any animation is currently running or scheduled to start. */
    isActive() {
      const now = performance.now();
      return this.anims.some((a) => now - a.startTime < a.duration);
    }
    clear() {
      this.anims = [];
    }
    /**
     * Draw all active animations onto ctx.
     * Finished entries are pruned automatically.
     */
    render(ctx2) {
      const now = performance.now();
      const alive = [];
      for (const anim of this.anims) {
        const elapsed = now - anim.startTime;
        if (elapsed < 0) {
          alive.push(anim);
          continue;
        }
        const t2 = Math.min(1, elapsed / anim.duration);
        if (anim.kind === "move") {
          this.drawMoveAnim(ctx2, anim, t2);
        } else {
          this.drawHitBurst(ctx2, anim, t2);
        }
        if (t2 < 1) alive.push(anim);
      }
      this.anims = alive;
    }
    // ── Move animation ───────────────────────────────────────────────────────────
    drawMoveAnim(ctx2, a, t2) {
      const et = easeOutCubic(t2);
      const cx = a.fromX + (a.toX - a.fromX) * et;
      const cy = a.fromY + (a.toY - a.fromY) * et;
      const dist = Math.hypot(a.toX - a.fromX, a.toY - a.fromY);
      const arcH = Math.min(dist * 0.2, 44);
      const finalCY = cy - Math.sin(t2 * Math.PI) * arcH;
      const scale = 1 + Math.sin(t2 * Math.PI) * 0.2;
      const r = a.r * scale;
      const isWhite = a.player === "white";
      ctx2.save();
      ctx2.shadowColor = "rgba(0,0,0,0.55)";
      ctx2.shadowBlur = 10 + Math.sin(t2 * Math.PI) * 12;
      ctx2.beginPath();
      ctx2.arc(cx + 2, finalCY + 3, r * 0.9, 0, Math.PI * 2);
      ctx2.fillStyle = "rgba(0,0,0,0.28)";
      ctx2.fill();
      ctx2.beginPath();
      ctx2.arc(cx, finalCY, r, 0, Math.PI * 2);
      const grad = ctx2.createRadialGradient(
        cx - r * 0.3,
        finalCY - r * 0.35,
        r * 0.08,
        cx,
        finalCY,
        r
      );
      if (isWhite) {
        grad.addColorStop(0, "#ffffff");
        grad.addColorStop(0.65, "#f5f0e8");
        grad.addColorStop(1, "#a0a090");
      } else {
        grad.addColorStop(0, "#6a6a8a");
        grad.addColorStop(0.65, "#1a1a2e");
        grad.addColorStop(1, "#04040e");
      }
      ctx2.fillStyle = grad;
      ctx2.fill();
      ctx2.strokeStyle = isWhite ? "#c8c0b0" : "#4a4a6e";
      ctx2.lineWidth = Math.max(1, r * 0.13);
      ctx2.stroke();
      ctx2.beginPath();
      ctx2.arc(cx, finalCY, r * 0.63, 0, Math.PI * 2);
      ctx2.strokeStyle = isWhite ? "rgba(180,170,150,0.55)" : "rgba(110,110,155,0.55)";
      ctx2.lineWidth = Math.max(0.5, r * 0.07);
      ctx2.stroke();
      if (t2 > 0.05 && t2 < 0.55) {
        const trailAlpha = (0.55 - t2) / 0.55 * 0.35;
        for (let i = 1; i <= 3; i++) {
          const tt = easeOutCubic(Math.max(0, t2 - i * 0.06));
          const tcx = a.fromX + (a.toX - a.fromX) * tt;
          const tcy = a.fromY + (a.toY - a.fromY) * tt;
          const tArcH = Math.min(dist * 0.2, 44);
          const tFinalCY = tcy - Math.sin((t2 - i * 0.06) * Math.PI) * tArcH;
          const tr = r * (1 - i * 0.25);
          ctx2.beginPath();
          ctx2.arc(tcx, tFinalCY, Math.max(1, tr), 0, Math.PI * 2);
          ctx2.fillStyle = isWhite ? `rgba(245,240,232,${trailAlpha / i})` : `rgba(80,80,120,${trailAlpha / i})`;
          ctx2.fill();
        }
      }
      ctx2.restore();
    }
    // ── Hit burst ─────────────────────────────────────────────────────────────────
    drawHitBurst(ctx2, a, t2) {
      const et = easeOutCubic(t2);
      const alpha = 1 - t2;
      ctx2.save();
      if (t2 < 0.22) {
        const flashT = t2 / 0.22;
        ctx2.beginPath();
        ctx2.arc(a.x, a.y, a.r * 0.95 * (1 - flashT * 0.45), 0, Math.PI * 2);
        ctx2.fillStyle = `rgba(255, 255, 200, ${(1 - flashT) * 0.7})`;
        ctx2.fill();
      }
      ctx2.beginPath();
      ctx2.arc(a.x, a.y, a.r * (0.45 + et * 3), 0, Math.PI * 2);
      ctx2.strokeStyle = `rgba(255, 65, 10, ${alpha * 0.95})`;
      ctx2.lineWidth = Math.max(0.5, 4.5 * (1 - t2 * 0.85));
      ctx2.stroke();
      if (t2 < 0.6) {
        const t22 = t2 / 0.6;
        const et2 = easeOutCubic(t22);
        ctx2.beginPath();
        ctx2.arc(a.x, a.y, a.r * (0.3 + et2 * 1.7), 0, Math.PI * 2);
        ctx2.strokeStyle = `rgba(255, 210, 40, ${(1 - t22) * 0.9})`;
        ctx2.lineWidth = Math.max(0.5, 3 * (1 - t22));
        ctx2.stroke();
      }
      for (let i = 0; i < 8; i++) {
        const angle = i / 8 * Math.PI * 2 + Math.PI / 8;
        const dist = et * a.r * 3.2;
        const px = a.x + Math.cos(angle) * dist;
        const py = a.y + Math.sin(angle) * dist;
        const pr = Math.max(0.5, a.r * 0.23 * (1 - t2));
        ctx2.beginPath();
        ctx2.arc(px, py, pr, 0, Math.PI * 2);
        ctx2.fillStyle = i % 2 === 0 ? `rgba(255, 100, 10, ${alpha * 0.95})` : `rgba(255, 230, 40, ${alpha * 0.9})`;
        ctx2.fill();
      }
      if (t2 < 0.45) {
        const t3 = t2 / 0.45;
        const len = a.r * 0.9 * easeOutCubic(t3);
        ctx2.strokeStyle = `rgba(255, 180, 30, ${(1 - t3) * 0.7})`;
        ctx2.lineWidth = Math.max(0.5, 2 * (1 - t3));
        for (let i = 0; i < 4; i++) {
          const angle = i / 4 * Math.PI * 2 + Math.PI / 4;
          const sx = a.x + Math.cos(angle) * a.r * 0.3;
          const sy = a.y + Math.sin(angle) * a.r * 0.3;
          ctx2.beginPath();
          ctx2.moveTo(sx, sy);
          ctx2.lineTo(sx + Math.cos(angle) * len, sy + Math.sin(angle) * len);
          ctx2.stroke();
        }
      }
      ctx2.restore();
    }
  };

  // src/ui/HUD.ts
  var BUTTON_COLORS = {
    roll: { bg: "#3d8b3d", hover: "#4da84d", text: "#ffffff", border: "#2a5f2a" },
    newGame: { bg: "#8b3d3d", hover: "#a84d4d", text: "#ffffff", border: "#5f2a2a" },
    clearSave: { bg: "#4a4a5a", hover: "#5a5a6a", text: "#cccccc", border: "#333344" },
    default: { bg: "#3d5a8b", hover: "#4d6aa8", text: "#ffffff", border: "#2a3f5f" }
  };
  function renderButtons(ctx2, buttons, state, fontScale) {
    for (const btn of buttons) {
      if (!btn.visible(state)) continue;
      let colors = BUTTON_COLORS.default;
      if (btn.action.type === "rollDice") colors = BUTTON_COLORS.roll;
      else if (btn.action.type === "newGame") colors = BUTTON_COLORS.newGame;
      else if (btn.action.type === "clearSave") colors = BUTTON_COLORS.clearSave;
      ctx2.fillStyle = "rgba(0,0,0,0.3)";
      drawRoundRect(ctx2, btn.x + 2, btn.y + 2, btn.w, btn.h, 5);
      ctx2.fill();
      ctx2.fillStyle = colors.bg;
      drawRoundRect(ctx2, btn.x, btn.y, btn.w, btn.h, 5);
      ctx2.fill();
      ctx2.strokeStyle = colors.border;
      ctx2.lineWidth = 1.5;
      drawRoundRect(ctx2, btn.x, btn.y, btn.w, btn.h, 5);
      ctx2.stroke();
      ctx2.fillStyle = "rgba(255,255,255,0.15)";
      drawRoundRect(ctx2, btn.x + 1, btn.y + 1, btn.w - 2, btn.h / 2 - 1, 4);
      ctx2.fill();
      const cx = btn.x + btn.w / 2;
      ctx2.fillStyle = colors.text;
      ctx2.textAlign = "center";
      if (btn.emoji && btn.text) {
        const emojiSize = Math.max(16, Math.min(36, btn.h * 0.48));
        const textSize = Math.max(9, Math.min(18, btn.h * 0.27));
        const emojiY = btn.y + btn.h * 0.4;
        const textY = btn.y + btn.h * 0.8;
        ctx2.font = `${emojiSize}px sans-serif`;
        ctx2.textBaseline = "middle";
        ctx2.fillText(btn.emoji, cx, emojiY);
        ctx2.font = `bold ${textSize}px sans-serif`;
        ctx2.fillText(btn.text, cx, textY);
      } else {
        const fontSize = Math.max(11, Math.min(14, btn.h * 0.35));
        ctx2.font = `bold ${fontSize}px sans-serif`;
        ctx2.textBaseline = "middle";
        ctx2.fillText(btn.label, cx, btn.y + btn.h / 2);
      }
      ctx2.textBaseline = "alphabetic";
      ctx2.textAlign = "left";
    }
  }
  function drawRoundRect(ctx2, x, y, w, h, r) {
    ctx2.beginPath();
    ctx2.moveTo(x + r, y);
    ctx2.lineTo(x + w - r, y);
    ctx2.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx2.lineTo(x + w, y + h - r);
    ctx2.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx2.lineTo(x + r, y + h);
    ctx2.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx2.lineTo(x, y + r);
    ctx2.quadraticCurveTo(x, y, x + r, y);
    ctx2.closePath();
  }
  var TOAST_STYLES = {
    error: {
      bg: "rgba(30,10,10,0.92)",
      border: "#ff5555",
      highlight: "rgba(255,100,100,0.12)",
      text: "#ffcccc"
    },
    info: {
      bg: "rgba(10,20,40,0.88)",
      border: "#4488cc",
      highlight: "rgba(80,140,220,0.12)",
      text: "#aad4ff"
    }
  };
  function renderToast(ctx2, message, cx, cy, maxWidth, fontScale, variant = "error") {
    const style = TOAST_STYLES[variant];
    const fontSize = Math.max(12, 14 * fontScale);
    ctx2.font = `bold ${fontSize}px sans-serif`;
    const textW = ctx2.measureText(message).width;
    const padH = 14;
    const padV = 7;
    const boxW = Math.min(textW + padH * 2, maxWidth);
    const boxH = fontSize + padV * 2;
    const x = cx - boxW / 2;
    const y = cy - boxH / 2;
    ctx2.fillStyle = "rgba(0,0,0,0.4)";
    drawRoundRect(ctx2, x + 2, y + 2, boxW, boxH, 8);
    ctx2.fill();
    ctx2.fillStyle = style.bg;
    drawRoundRect(ctx2, x, y, boxW, boxH, 8);
    ctx2.fill();
    ctx2.strokeStyle = style.border;
    ctx2.lineWidth = 2;
    drawRoundRect(ctx2, x, y, boxW, boxH, 8);
    ctx2.stroke();
    ctx2.fillStyle = style.highlight;
    drawRoundRect(ctx2, x + 1, y + 1, boxW - 2, boxH / 2, 7);
    ctx2.fill();
    ctx2.save();
    ctx2.beginPath();
    ctx2.rect(x + 4, y, boxW - 8, boxH);
    ctx2.clip();
    ctx2.fillStyle = style.text;
    ctx2.textAlign = "center";
    ctx2.textBaseline = "middle";
    ctx2.fillText(message, cx, cy);
    ctx2.restore();
    ctx2.textBaseline = "alphabetic";
    ctx2.textAlign = "left";
  }
  function renderRestorePrompt(ctx2, canvasW, canvasH, saveTime, fontScale) {
    const boxW = Math.min(320 * fontScale, canvasW * 0.8);
    const boxH = Math.min(160 * fontScale, canvasH * 0.35);
    const x = (canvasW - boxW) / 2;
    const y = (canvasH - boxH) / 2;
    ctx2.fillStyle = "rgba(0,0,0,0.7)";
    ctx2.fillRect(0, 0, canvasW, canvasH);
    ctx2.fillStyle = "#1a2a3a";
    drawRoundRect(ctx2, x, y, boxW, boxH, 10);
    ctx2.fill();
    ctx2.strokeStyle = "#4a6a8a";
    ctx2.lineWidth = 2;
    drawRoundRect(ctx2, x, y, boxW, boxH, 10);
    ctx2.stroke();
    const loc = t();
    const titleFont = Math.max(14, 18 * fontScale);
    ctx2.font = `bold ${titleFont}px sans-serif`;
    ctx2.fillStyle = "#ffe066";
    ctx2.textAlign = "center";
    ctx2.fillText(loc.savedGameFound, canvasW / 2, y + 30 * fontScale);
    const d = new Date(saveTime);
    const timeStr = d.toLocaleString();
    const infoFont = Math.max(10, 12 * fontScale);
    ctx2.font = `${infoFont}px sans-serif`;
    ctx2.fillStyle = "#aacccc";
    ctx2.fillText(`${loc.lastSaved}: ${timeStr}`, canvasW / 2, y + 55 * fontScale);
    const btnW = boxW * 0.38;
    const btnH = Math.min(52, boxH * 0.28);
    const btnY = y + boxH - btnH - 12 * fontScale;
    const continueBtn = {
      x: canvasW / 2 - btnW - 8,
      y: btnY,
      w: btnW,
      h: btnH,
      action: { type: "continueGame" },
      label: loc.btnContinue,
      emoji: "\u25B6\uFE0F",
      text: loc.btnContinueText,
      visible: () => true
    };
    const newGameBtn = {
      x: canvasW / 2 + 8,
      y: btnY,
      w: btnW,
      h: btnH,
      action: { type: "newGame" },
      label: loc.btnNewGamePrompt,
      emoji: "\u{1F504}",
      text: loc.btnNewGameText,
      visible: () => true
    };
    const btnColors = [
      { bg: "#3d8b3d", border: "#2a5f2a", text: "#ffffff" },
      { bg: "#8b3d3d", border: "#5f2a2a", text: "#ffffff" }
    ];
    for (const [i, btn] of [continueBtn, newGameBtn].entries()) {
      const c = btnColors[i];
      ctx2.fillStyle = c.bg;
      drawRoundRect(ctx2, btn.x, btn.y, btn.w, btn.h, 5);
      ctx2.fill();
      ctx2.strokeStyle = c.border;
      ctx2.lineWidth = 1;
      drawRoundRect(ctx2, btn.x, btn.y, btn.w, btn.h, 5);
      ctx2.stroke();
      ctx2.font = `bold ${infoFont}px sans-serif`;
      ctx2.fillStyle = c.text;
      ctx2.textAlign = "center";
      ctx2.textBaseline = "middle";
      ctx2.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2);
      ctx2.textBaseline = "alphabetic";
    }
    ctx2.textAlign = "left";
    return { continueBtn, newGameBtn };
  }
  function renderConfirmDialog(ctx2, canvasW, canvasH, fontScale, title, body, yesAction, noAction, yesLabel, noLabel, accentColor = "#e07020") {
    ctx2.fillStyle = "rgba(0,0,0,0.72)";
    ctx2.fillRect(0, 0, canvasW, canvasH);
    const boxW = Math.min(320 * fontScale, canvasW * 0.85);
    const boxH = Math.min(170 * fontScale, canvasH * 0.38);
    const bx = (canvasW - boxW) / 2;
    const by = (canvasH - boxH) / 2;
    ctx2.fillStyle = "#1e2020";
    drawRoundRect(ctx2, bx, by, boxW, boxH, 12);
    ctx2.fill();
    ctx2.strokeStyle = accentColor;
    ctx2.lineWidth = 2;
    drawRoundRect(ctx2, bx, by, boxW, boxH, 12);
    ctx2.stroke();
    const titleSize = Math.max(15, 19 * fontScale);
    ctx2.font = `bold ${titleSize}px sans-serif`;
    ctx2.fillStyle = "#ffe066";
    ctx2.textAlign = "center";
    ctx2.textBaseline = "middle";
    ctx2.fillText(title, canvasW / 2, by + boxH * 0.22);
    const bodySize = Math.max(11, 13 * fontScale);
    ctx2.font = `${bodySize}px sans-serif`;
    ctx2.fillStyle = "#cccccc";
    const lines = body.split("\n");
    const lineH = bodySize * 1.5;
    const bodyStartY = by + boxH * 0.42;
    lines.forEach((line, i) => {
      ctx2.fillText(line, canvasW / 2, bodyStartY + i * lineH);
    });
    const btnW = boxW * 0.36;
    const btnH = Math.min(44, boxH * 0.25);
    const btnY = by + boxH - btnH - 14 * fontScale;
    const gap = boxW * 0.06;
    const yesBtn = {
      x: canvasW / 2 - btnW - gap / 2,
      y: btnY,
      w: btnW,
      h: btnH,
      action: yesAction,
      label: yesLabel,
      emoji: "\u2705",
      text: yesLabel.replace(/^[^\s]+\s*/, ""),
      visible: () => true
    };
    const noBtn = {
      x: canvasW / 2 + gap / 2,
      y: btnY,
      w: btnW,
      h: btnH,
      action: noAction,
      label: noLabel,
      emoji: "\u274C",
      text: noLabel.replace(/^[^\s]+\s*/, ""),
      visible: () => true
    };
    const palette = [
      { bg: "#2d7a2d", border: "#1a4f1a" },
      { bg: "#7a2d2d", border: "#4f1a1a" }
    ];
    for (const [i, btn] of [yesBtn, noBtn].entries()) {
      const p = palette[i];
      ctx2.fillStyle = p.bg;
      drawRoundRect(ctx2, btn.x, btn.y, btn.w, btn.h, 6);
      ctx2.fill();
      ctx2.strokeStyle = p.border;
      ctx2.lineWidth = 1.5;
      drawRoundRect(ctx2, btn.x, btn.y, btn.w, btn.h, 6);
      ctx2.stroke();
      const emojiSize = Math.max(14, Math.min(20, btn.h * 0.42));
      const textSize = Math.max(9, Math.min(12, btn.h * 0.26));
      ctx2.fillStyle = "#ffffff";
      ctx2.textAlign = "center";
      ctx2.font = `${emojiSize}px sans-serif`;
      ctx2.fillText(btn.emoji, btn.x + btn.w / 2, btn.y + btn.h * 0.4);
      ctx2.font = `bold ${textSize}px sans-serif`;
      ctx2.fillText(btn.text, btn.x + btn.w / 2, btn.y + btn.h * 0.8);
    }
    ctx2.textAlign = "left";
    ctx2.textBaseline = "alphabetic";
    return { yesBtn, noBtn };
  }
  function renderDoubleOfferPrompt(ctx2, canvasW, canvasH, fontScale, newCubeValue) {
    const loc = t();
    const msg = loc.aiOffersDouble.replace("{v}", String(newCubeValue));
    return renderConfirmDialog(
      ctx2,
      canvasW,
      canvasH,
      fontScale,
      msg,
      "",
      { type: "acceptDouble" },
      { type: "declineDouble" },
      loc.acceptDouble,
      loc.declineDouble,
      "#ffe066"
    );
  }
  function renderNewGameConfirm(ctx2, canvasW, canvasH, fontScale) {
    const loc = t();
    return renderConfirmDialog(
      ctx2,
      canvasW,
      canvasH,
      fontScale,
      loc.confirmNewGameTitle,
      loc.confirmNewGameBody,
      { type: "confirmNewGame" },
      { type: "cancelNewGame" },
      loc.confirmYes,
      loc.confirmNo,
      "#e07020"
    );
  }
  function renderClearSaveConfirm(ctx2, canvasW, canvasH, fontScale) {
    const loc = t();
    return renderConfirmDialog(
      ctx2,
      canvasW,
      canvasH,
      fontScale,
      loc.confirmClearSaveTitle,
      loc.confirmClearSaveBody,
      { type: "confirmClearSave" },
      { type: "cancelClearSave" },
      loc.confirmYes,
      loc.confirmNo,
      "#c0392b"
    );
  }

  // src/render/CanvasRenderer.ts
  var COLORS = {
    boardBg: "#1a472a",
    boardBorder: "#0d2a18",
    pointLight: "#c8a46e",
    pointDark: "#7b3f1e",
    barColor: "#2d5a3d",
    barBorder: "#1a3828",
    white: "#f5f0e8",
    whiteBorder: "#c8c0b0",
    black: "#1a1a2e",
    blackBorder: "#4a4a6e",
    selected: "#ffe066",
    validTarget: "#66ff99",
    validTargetBorder: "#00cc55",
    diceWhite: "#f5f0e8",
    diceDark: "#1a1a2e",
    diceDot: "#333",
    diceDotLight: "#eee",
    hudBg: "rgba(0,0,0,0.7)",
    textLight: "#ffffff",
    textDim: "#aaaaaa",
    error: "#ff6b6b",
    winBg: "rgba(0,0,0,0.85)",
    winText: "#ffe066",
    barHighlight: "#ffaa00"
  };
  var ANIM_DICE_MS = 650;
  function easeOutBack(t2) {
    const c1 = 1.70158;
    return 1 + (c1 + 1) * Math.pow(t2 - 1, 3) + c1 * Math.pow(t2 - 1, 2);
  }
  function easeOutCubicLocal(t2) {
    return 1 - Math.pow(1 - t2, 3);
  }
  var CanvasRenderer = class {
    constructor(ctx2) {
      this.width = 800;
      this.height = 600;
      this.layout = null;
      // Maps from point index to canvas coordinates (center-top for bottom points, center-bottom for top)
      this.pointCoords = /* @__PURE__ */ new Map();
      this.animSystem = new AnimationSystem();
      this.diceRollAnim = null;
      this.ctx = ctx2;
    }
    // ── Animation API ─────────────────────────────────────────────────────────────
    /** True if any checker animation, hit burst, or dice roll animation is active. */
    isAnimating() {
      if (this.animSystem.isActive()) return true;
      if (this.diceRollAnim) {
        return performance.now() - this.diceRollAnim.startTime < this.diceRollAnim.duration;
      }
      return false;
    }
    /**
     * Queue a checker-in-flight animation from pointIndex `fromIdx` to `toIdx`.
     * When `isHit` is true also queues:
     *   - a hit-burst at the impact point (timed to attacker arrival)
     *   - the captured piece flying from the impact point to its own bar
     * Call this BEFORE applying the state change so source coords are valid.
     * Returns the recommended delay (ms) the caller should wait before
     * starting the next move, so hit sequences have enough time to complete.
     */
    queueMoveAnim(fromIdx, toIdx, player, isHit) {
      const defaultDelay = ANIM_MOVE_MS + 70;
      if (!this.layout) return defaultDelay;
      const fromPos = this.getAnimPosition(fromIdx);
      const toPos = this.getAnimPosition(toIdx);
      if (!fromPos || !toPos) return defaultDelay;
      const now = performance.now();
      const r = this.layout.checkerR;
      this.animSystem.queue({
        kind: "move",
        fromX: fromPos.x,
        fromY: fromPos.y,
        toX: toPos.x,
        toY: toPos.y,
        player,
        r,
        startTime: now,
        duration: ANIM_MOVE_MS
      });
      if (!isHit) return defaultDelay;
      const impactDelay = ANIM_MOVE_MS * 0.8;
      this.animSystem.queue({
        kind: "hitBurst",
        x: toPos.x,
        y: toPos.y,
        r,
        startTime: now + impactDelay,
        duration: ANIM_HIT_MS
      });
      const captured = player === "white" ? "black" : "white";
      const capturedBarIdx = captured === "white" ? 0 : 25;
      const barPos = this.getAnimPosition(capturedBarIdx);
      if (barPos) {
        const captureDur = Math.round(ANIM_MOVE_MS * 0.85);
        this.animSystem.queue({
          kind: "move",
          fromX: toPos.x,
          fromY: toPos.y,
          toX: barPos.x,
          toY: barPos.y,
          player: captured,
          r,
          startTime: now + impactDelay,
          duration: captureDur
        });
        return Math.round(impactDelay + captureDur) + 80;
      }
      return defaultDelay;
    }
    /**
     * Queue a hit-burst + captured-piece-to-bar animation.
     * Used when the human player captures an AI piece.
     * `capturedPlayer` is the player whose piece was just taken.
     */
    queueHitBurst(toIdx, capturedPlayer) {
      if (!this.layout) return;
      const pos = this.getAnimPosition(toIdx);
      if (!pos) return;
      const r = this.layout.checkerR;
      const now = performance.now();
      this.animSystem.queue({
        kind: "hitBurst",
        x: pos.x,
        y: pos.y,
        r,
        startTime: now,
        duration: ANIM_HIT_MS
      });
      const barIdx = capturedPlayer === "white" ? 0 : 25;
      const barPos = this.getAnimPosition(barIdx);
      if (barPos) {
        this.animSystem.queue({
          kind: "move",
          fromX: pos.x,
          fromY: pos.y,
          toX: barPos.x,
          toY: barPos.y,
          player: capturedPlayer,
          r,
          startTime: now,
          duration: ANIM_MOVE_MS
        });
      }
    }
    /**
     * Queue a dice-tumble animation for two dice.
     * The animation shows random faces cycling rapidly, then settling on the
     * final values.  The rAF loop (startAnimLoop in main.ts) must be started
     * by the caller.
     */
    /** Compute the top-left origin and size for the two-dice display. */
    dicePlacement() {
      if (!this.layout) return null;
      const l = this.layout;
      const diceSize = Math.min(72, l.checkerR * 3.6, 88) * l.fontScale;
      const padding = 10;
      const totalW = diceSize * 2 + padding;
      let diceX, diceY;
      if (l.isPortrait) {
        diceX = l.boardX + l.boardW / 2 + (l.boardW / 2 - totalW) / 2;
      } else {
        diceX = l.barX + (l.barW - totalW) / 2;
      }
      diceY = l.boardY + l.boardH / 2 - diceSize / 2;
      return { diceX, diceY, diceSize };
    }
    queueDiceRoll(val1, val2) {
      const p = this.dicePlacement();
      if (!p) return;
      this.diceRollAnim = {
        val1,
        val2,
        diceX: p.diceX,
        diceY: p.diceY,
        diceSize: p.diceSize,
        startTime: performance.now(),
        duration: ANIM_DICE_MS
      };
    }
    /** Canvas position for a given point index, bar, or bear-off. */
    getAnimPosition(pointIndex) {
      if (pointIndex === -1) return this.getBearOffCenter("white");
      if (pointIndex === 26) return this.getBearOffCenter("black");
      return this.getPointCenter(pointIndex);
    }
    getBearOffCenter(player) {
      if (!this.layout) return null;
      const l = this.layout;
      if (!l.isPortrait) {
        return {
          x: (player === "white" ? l.whiteBearOffX : l.blackBearOffX) + l.bearOffW / 2,
          y: l.boardY + l.boardH / 2
        };
      }
      const bh = l.bearOffW;
      const y = player === "white" ? l.boardY + l.boardH + 4 + bh / 2 : l.boardY - bh / 2 - 4;
      return { x: l.boardX + l.boardW / 4, y };
    }
    setSize(w, h) {
      this.width = w;
      this.height = h;
      this.layout = this.computeLayout();
    }
    getLayout() {
      return this.layout;
    }
    computeLayout() {
      const isPortrait = this.width < 600;
      const msgH = 28;
      const btnAreaH = Math.max(52, Math.min(58, this.height * 0.08));
      const hudH = msgH + btnAreaH;
      if (isPortrait) {
        return this.computePortraitLayout(hudH, msgH, btnAreaH);
      } else {
        return this.computeLandscapeLayout(hudH, msgH, btnAreaH);
      }
    }
    computeLandscapeLayout(hudH, msgH, btnAreaH) {
      const w = this.width;
      const h = this.height;
      const fontScale = Math.min(w / 800, h / 500);
      const boardH = h - hudH - 6;
      const boardY = 4;
      const bearOffW = Math.min(50, w * 0.055);
      const boardX = bearOffW + 4;
      const boardW = w - bearOffW * 2 - 8;
      const barW = Math.max(30, boardW * 0.04);
      const pointW = (boardW - barW) / 12;
      const pointH = boardH * 0.42;
      const checkerR = Math.min(pointW * 0.44, pointH / 5.5);
      const barX = boardX + pointW * 6;
      const hudY = boardY + boardH + 2;
      return {
        boardX,
        boardY,
        boardW,
        boardH,
        pointW,
        pointH,
        barX,
        barW,
        checkerR,
        hudY,
        hudH,
        msgY: hudY,
        msgH,
        btnAreaY: hudY + msgH,
        btnAreaH,
        whiteBearOffX: 0,
        blackBearOffX: w - bearOffW,
        bearOffW,
        isPortrait: false,
        fontScale
      };
    }
    computePortraitLayout(hudH, msgH, btnAreaH) {
      const w = this.width;
      const h = this.height;
      const fontScale = Math.min(w / 390, h / 700);
      const bearOffH = Math.max(28, Math.min(40, h * 0.04));
      const hudY = h - hudH;
      const boardY = bearOffH + 4;
      const boardH = hudY - bearOffH - boardY - 4;
      const boardX = 4;
      const boardW = w - 8;
      const barH_val = Math.max(14, boardH * 0.025);
      const pointH = (boardH - barH_val) / 2;
      const pointW = boardW / 12;
      const checkerR = Math.min(pointW * 0.44, pointH / 5.5);
      const barX = boardX;
      const barW = boardW;
      return {
        boardX,
        boardY,
        boardW,
        boardH,
        pointW,
        pointH,
        barX,
        barW,
        checkerR,
        hudY,
        hudH,
        msgY: hudY,
        msgH,
        btnAreaY: hudY + msgH,
        btnAreaH,
        whiteBearOffX: boardX,
        blackBearOffX: boardX,
        bearOffW: bearOffH,
        isPortrait: true,
        fontScale
      };
    }
    // Get screen coordinates for a given point index (1-24), bar (0 or 25), or bear-off (-1, 26)
    getPointCenter(pointIndex) {
      if (!this.layout) return null;
      const l = this.layout;
      if (l.isPortrait) {
        return this.getPortraitPointCenter(pointIndex);
      } else {
        return this.getLandscapePointCenter(pointIndex);
      }
    }
    getLandscapePointCenter(pointIndex) {
      if (!this.layout) return null;
      const l = this.layout;
      if (pointIndex === 0) {
        return {
          x: l.barX + l.barW / 2,
          y: l.boardY + l.boardH * 0.75
        };
      }
      if (pointIndex === 25) {
        return {
          x: l.barX + l.barW / 2,
          y: l.boardY + l.boardH * 0.25
        };
      }
      if (pointIndex >= 1 && pointIndex <= 24) {
        const { x, isTop } = this.getPointX(pointIndex);
        const y = isTop ? l.boardY + l.pointH * 0.5 : l.boardY + l.boardH - l.pointH * 0.5;
        return { x, y };
      }
      return null;
    }
    getPortraitPointCenter(pointIndex) {
      if (!this.layout) return null;
      const l = this.layout;
      if (pointIndex === 0) {
        return { x: l.boardX + l.boardW / 2, y: l.boardY + l.boardH * 0.75 };
      }
      if (pointIndex === 25) {
        return { x: l.boardX + l.boardW / 2, y: l.boardY + l.boardH * 0.25 };
      }
      if (pointIndex >= 1 && pointIndex <= 12) {
        const col = pointIndex - 1;
        const displayCol = 11 - col;
        const x = l.boardX + displayCol * l.pointW + l.pointW / 2;
        const barCenterY = l.boardY + l.boardH / 2;
        const y = barCenterY + l.boardH * 0.02 + l.pointH * 0.5;
        return { x, y };
      }
      if (pointIndex >= 13 && pointIndex <= 24) {
        const col = pointIndex - 13;
        const x = l.boardX + col * l.pointW + l.pointW / 2;
        const barCenterY = l.boardY + l.boardH / 2;
        const y = barCenterY - l.boardH * 0.02 - l.pointH * 0.5;
        return { x, y };
      }
      return null;
    }
    // Get X position and top/bottom for landscape points
    getPointX(pointIndex) {
      if (!this.layout) return { x: 0, isTop: false };
      const l = this.layout;
      if (pointIndex >= 13 && pointIndex <= 24) {
        const col = pointIndex - 13;
        let x;
        if (col < 6) {
          x = l.boardX + col * l.pointW + l.pointW / 2;
        } else {
          x = l.boardX + l.barW + col * l.pointW + l.pointW / 2;
        }
        return { x, isTop: true };
      } else {
        const col = 12 - pointIndex;
        let x;
        if (col < 6) {
          x = l.boardX + col * l.pointW + l.pointW / 2;
        } else {
          x = l.boardX + l.barW + col * l.pointW + l.pointW / 2;
        }
        return { x, isTop: false };
      }
    }
    // Hit test: given screen coordinates, return which point was clicked
    hitTest(sx, sy) {
      if (!this.layout) return null;
      const l = this.layout;
      if (l.isPortrait) {
        return this.hitTestPortrait(sx, sy);
      } else {
        return this.hitTestLandscape(sx, sy);
      }
    }
    hitTestLandscape(sx, sy) {
      if (!this.layout) return null;
      const l = this.layout;
      if (sx >= l.whiteBearOffX && sx < l.whiteBearOffX + l.bearOffW) {
        if (sy >= l.boardY && sy <= l.boardY + l.boardH) return -1;
      }
      if (sx >= l.blackBearOffX && sx < l.blackBearOffX + l.bearOffW) {
        if (sy >= l.boardY && sy <= l.boardY + l.boardH) return 26;
      }
      const barCenterX = l.barX + l.barW / 2;
      const barHitHalf = Math.max(l.barW / 2, l.checkerR * 1.05 + 4);
      if (sx >= barCenterX - barHitHalf && sx <= barCenterX + barHitHalf) {
        if (sy >= l.boardY && sy <= l.boardY + l.boardH / 2) return 25;
        if (sy > l.boardY + l.boardH / 2 && sy <= l.boardY + l.boardH) return 0;
      }
      if (sy < l.boardY || sy > l.boardY + l.boardH) return null;
      if (sx < l.boardX || sx > l.boardX + l.boardW) return null;
      const isTop = sy <= l.boardY + l.boardH / 2;
      let adjustedX = sx - l.boardX;
      if (adjustedX >= l.pointW * 6) adjustedX -= l.barW;
      const col = Math.floor(adjustedX / l.pointW);
      if (col < 0 || col > 11) return null;
      if (isTop) {
        return 13 + col;
      } else {
        return 12 - col;
      }
    }
    hitTestPortrait(sx, sy) {
      if (!this.layout) return null;
      const l = this.layout;
      const bh = l.bearOffW;
      const whiteBearOffY = l.boardY + l.boardH + 4;
      const blackBearOffY = l.boardY - bh - 4;
      if (sx >= l.boardX && sx <= l.boardX + l.boardW) {
        if (sy >= whiteBearOffY && sy <= whiteBearOffY + bh) return -1;
        if (sy >= blackBearOffY && sy <= blackBearOffY + bh) return 26;
      }
      if (sx < l.boardX || sx > l.boardX + l.boardW) return null;
      if (sy < l.boardY || sy > l.boardY + l.boardH) return null;
      const midY = l.boardY + l.boardH / 2;
      const col = Math.floor((sx - l.boardX) / l.pointW);
      if (col < 0 || col > 11) return null;
      const barHitZone = Math.max(l.checkerR * 4.5, l.boardH * 0.07);
      if (sy < midY - barHitZone / 2) {
        return 13 + col;
      } else if (sy > midY + barHitZone / 2) {
        return 12 - col;
      }
      return sy < midY ? 25 : 0;
    }
    // Main render function
    render(state) {
      if (!this.layout) return;
      const ctx2 = this.ctx;
      const l = this.layout;
      ctx2.clearRect(0, 0, this.width, this.height);
      ctx2.fillStyle = "#0d1b0f";
      ctx2.fillRect(0, 0, this.width, this.height);
      if (l.isPortrait) {
        this.renderPortrait(state);
      } else {
        this.renderLandscape(state);
      }
      this.renderHUD(state);
      this.animSystem.render(this.ctx);
      this.renderDiceAnim();
      if (state.phase !== "gameOver") {
        const l2 = this.layout;
        const loc = t();
        const toastMaxW = l2.isPortrait ? l2.boardW * 0.46 : l2.pointW * 5.5;
        const toastCX = l2.isPortrait ? l2.boardX + l2.boardW * 0.23 : l2.boardX + l2.pointW * 2.8;
        const toastMidY = l2.boardY + l2.boardH / 2;
        const toastRowH = Math.max(12, 14 * l2.fontScale) + 14 + 4;
        let infoMsg = "";
        if (state.phase === "rollingForFirst") {
          if (!state.initialRoll) infoMsg = loc.rollForFirstPrompt;
          else if (state.initialRoll.white === state.initialRoll.black) infoMsg = loc.rollForFirstTie;
          else infoMsg = state.currentPlayer === "white" ? loc.rollForFirstWhiteFirst : loc.rollForFirstBlackFirst;
        } else if (state.phase === "waitingForRoll") {
          const name = state.currentPlayer === "white" ? loc.youTurn : loc.aiTurn;
          infoMsg = `${name}: ${loc.clickRoll}`;
        } else if (state.phase === "playerActing") {
          const name = state.currentPlayer === "white" ? loc.youTurn : loc.aiTurn;
          infoMsg = `${name}: ${loc.selectPiece}`;
        } else if (state.phase === "aiThinking") {
          infoMsg = loc.aiThinking;
        } else if (state.phase === "playerDecidingDouble") {
          infoMsg = loc.aiOffersDouble.replace("{v}", String(state.cube.value * 2));
        }
        const hasError = !!state.errorMessage;
        const hasInfo = !!infoMsg;
        const infoCY = hasError && hasInfo ? toastMidY - toastRowH / 2 - 2 : toastMidY;
        const errorCY = hasError && hasInfo ? toastMidY + toastRowH / 2 + 2 : toastMidY;
        if (hasInfo) {
          renderToast(this.ctx, infoMsg, toastCX, infoCY, toastMaxW, l2.fontScale, "info");
        }
        if (hasError) {
          renderToast(this.ctx, state.errorMessage, toastCX, errorCY, toastMaxW, l2.fontScale, "error");
        }
      }
      if (state.phase === "gameOver" && state.winner) {
        this.renderWinScreen(state);
      }
      if (state.phase === "rollingForFirst" && state.initialRoll) {
        this.renderInitialRollDice(state.initialRoll, state.currentPlayer);
      }
    }
    renderLandscape(state) {
      const ctx2 = this.ctx;
      const l = this.layout;
      ctx2.fillStyle = COLORS.boardBg;
      roundRect(ctx2, l.boardX, l.boardY, l.boardW, l.boardH, 6);
      ctx2.fill();
      ctx2.strokeStyle = COLORS.boardBorder;
      ctx2.lineWidth = 2;
      roundRect(ctx2, l.boardX, l.boardY, l.boardW, l.boardH, 6);
      ctx2.stroke();
      for (let i = 1; i <= 24; i++) {
        this.drawLandscapePoint(i, state);
      }
      ctx2.fillStyle = COLORS.barColor;
      ctx2.fillRect(l.barX, l.boardY, l.barW, l.boardH);
      ctx2.strokeStyle = COLORS.barBorder;
      ctx2.lineWidth = 1;
      ctx2.strokeRect(l.barX, l.boardY, l.barW, l.boardH);
      for (let i = 1; i <= 24; i++) {
        this.drawCheckersOnPoint(i, state);
      }
      this.drawBarCheckers(state);
      this.drawBearOffAreas(state);
      if (state.dice) {
        this.drawDice(state);
      }
      this.drawDoublingCube(state);
    }
    renderPortrait(state) {
      const ctx2 = this.ctx;
      const l = this.layout;
      ctx2.fillStyle = COLORS.boardBg;
      roundRect(ctx2, l.boardX, l.boardY, l.boardW, l.boardH, 6);
      ctx2.fill();
      ctx2.strokeStyle = COLORS.boardBorder;
      ctx2.lineWidth = 2;
      roundRect(ctx2, l.boardX, l.boardY, l.boardW, l.boardH, 6);
      ctx2.stroke();
      for (let i = 1; i <= 24; i++) {
        this.drawPortraitPoint(i, state);
      }
      const midY = l.boardY + l.boardH / 2;
      const barH = l.boardH * 0.04 + 2;
      ctx2.fillStyle = COLORS.barColor;
      ctx2.fillRect(l.boardX, midY - barH / 2, l.boardW, barH);
      ctx2.strokeStyle = COLORS.barBorder;
      ctx2.lineWidth = 1;
      ctx2.strokeRect(l.boardX, midY - barH / 2, l.boardW, barH);
      for (let i = 1; i <= 24; i++) {
        this.drawCheckersOnPoint(i, state);
      }
      this.drawBarCheckers(state);
      this.drawBearOffAreasPortrait(state);
      if (state.dice) {
        this.drawDice(state);
      }
      this.drawDoublingCube(state);
    }
    drawLandscapePoint(pointIndex, state) {
      const ctx2 = this.ctx;
      const l = this.layout;
      const { x, isTop } = this.getPointX(pointIndex);
      const selectablePoints = getSelectablePoints(state.legalSequences);
      const isSelectable = state.phase === "playerActing" && selectablePoints.has(pointIndex);
      const isSelected = state.selectedPoint === pointIndex;
      const isValidTarget = state.validMoves.some((m) => m.to === pointIndex);
      const color = pointIndex % 2 === 0 ? COLORS.pointDark : COLORS.pointLight;
      const tipY = isTop ? l.boardY + l.pointH : l.boardY + l.boardH - l.pointH;
      const baseY = isTop ? l.boardY : l.boardY + l.boardH;
      ctx2.beginPath();
      ctx2.moveTo(x - l.pointW / 2 + 1, baseY);
      ctx2.lineTo(x + l.pointW / 2 - 1, baseY);
      ctx2.lineTo(x, tipY);
      ctx2.closePath();
      if (isSelected) {
        ctx2.fillStyle = COLORS.selected;
      } else if (isValidTarget) {
        ctx2.fillStyle = COLORS.validTarget;
      } else if (isSelectable) {
        ctx2.fillStyle = lightenColor(color, 30);
      } else {
        ctx2.fillStyle = color;
      }
      ctx2.fill();
      ctx2.strokeStyle = "rgba(0,0,0,0.3)";
      ctx2.lineWidth = 0.5;
      ctx2.stroke();
      const labelY = isTop ? l.boardY + l.boardH - 6 : l.boardY + 14;
      const fontSize = Math.max(9, 11 * l.fontScale);
      ctx2.font = `${fontSize}px sans-serif`;
      ctx2.fillStyle = "rgba(255,255,255,0.5)";
      ctx2.textAlign = "center";
      ctx2.fillText(String(pointIndex), x, labelY);
    }
    drawPortraitPoint(pointIndex, state) {
      const ctx2 = this.ctx;
      const l = this.layout;
      const selectablePoints = getSelectablePoints(state.legalSequences);
      const isSelectable = state.phase === "playerActing" && selectablePoints.has(pointIndex);
      const isSelected = state.selectedPoint === pointIndex;
      const isValidTarget = state.validMoves.some((m) => m.to === pointIndex);
      const color = pointIndex % 2 === 0 ? COLORS.pointDark : COLORS.pointLight;
      let col, isTop, baseY, tipY, centerX;
      const midY = l.boardY + l.boardH / 2;
      if (pointIndex >= 13 && pointIndex <= 24) {
        col = pointIndex - 13;
        isTop = true;
        centerX = l.boardX + col * l.pointW + l.pointW / 2;
        baseY = l.boardY;
        tipY = l.boardY + l.pointH;
      } else {
        col = 12 - pointIndex;
        isTop = false;
        centerX = l.boardX + col * l.pointW + l.pointW / 2;
        baseY = l.boardY + l.boardH;
        tipY = l.boardY + l.boardH - l.pointH;
      }
      ctx2.beginPath();
      ctx2.moveTo(centerX - l.pointW / 2 + 1, baseY);
      ctx2.lineTo(centerX + l.pointW / 2 - 1, baseY);
      ctx2.lineTo(centerX, tipY);
      ctx2.closePath();
      if (isSelected) {
        ctx2.fillStyle = COLORS.selected;
      } else if (isValidTarget) {
        ctx2.fillStyle = COLORS.validTarget;
      } else if (isSelectable) {
        ctx2.fillStyle = lightenColor(color, 30);
      } else {
        ctx2.fillStyle = color;
      }
      ctx2.fill();
      ctx2.strokeStyle = "rgba(0,0,0,0.3)";
      ctx2.lineWidth = 0.5;
      ctx2.stroke();
      const fontSize = Math.max(8, 9 * l.fontScale);
      ctx2.font = `${fontSize}px sans-serif`;
      ctx2.fillStyle = "rgba(255,255,255,0.5)";
      ctx2.textAlign = "center";
      const labelY = isTop ? l.boardY + l.boardH - 8 : l.boardY + 12;
      ctx2.fillText(String(pointIndex), centerX, labelY);
    }
    drawCheckersOnPoint(pointIndex, state) {
      if (!this.layout) return;
      const l = this.layout;
      const pt = state.board[pointIndex];
      if (!pt || pt.count === 0) return;
      const center = this.getPointCenter(pointIndex);
      if (!center) return;
      const isTop = l.isPortrait ? pointIndex >= 13 : pointIndex >= 13 && pointIndex <= 24;
      const count = pt.count;
      const cx = center.x;
      const RATIO = 2.05;
      const maxR = l.pointH / (2 + (count - 1) * RATIO);
      const r = Math.min(l.checkerR, maxR);
      const spacing = r * RATIO;
      const dir = isTop ? 1 : -1;
      const baseY = isTop ? l.boardY + r : l.boardY + l.boardH - r;
      const isSelected = pointIndex === state.selectedPoint;
      const isBearOffSource = state.phase === "playerActing" && state.selectedPoint === null && state.legalSequences.some(
        (seq) => seq.length > 0 && seq[0].from === pointIndex && (seq[0].to === -1 || seq[0].to === 26)
      );
      for (let i = 0; i < count; i++) {
        const cy = baseY + dir * i * spacing;
        this.drawChecker(cx, cy, r, pt.owner, isSelected);
      }
      if (isBearOffSource) {
        const topCY = baseY + dir * (count - 1) * spacing;
        const ctx2 = this.ctx;
        ctx2.beginPath();
        ctx2.arc(cx, topCY, r * 1.32, 0, Math.PI * 2);
        ctx2.strokeStyle = "rgba(255, 210, 30, 0.92)";
        ctx2.lineWidth = Math.max(2, r * 0.18);
        ctx2.stroke();
        const arrowDir = pt.owner === "white" ? 1 : -1;
        const arrowTip = topCY + arrowDir * r * 2.1;
        const arrowBase = topCY + arrowDir * r * 1.55;
        const hw = r * 0.38;
        ctx2.beginPath();
        ctx2.moveTo(cx, arrowTip);
        ctx2.lineTo(cx - hw, arrowBase);
        ctx2.lineTo(cx + hw, arrowBase);
        ctx2.closePath();
        ctx2.fillStyle = "rgba(255, 210, 30, 0.88)";
        ctx2.fill();
      }
      if (r < l.checkerR * 0.6) {
        const innermostY = baseY + dir * (count - 1) * spacing;
        const fontSize = Math.max(8, r * 1);
        this.ctx.font = `bold ${fontSize}px sans-serif`;
        this.ctx.fillStyle = "#ffff55";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText(String(count), cx, innermostY);
        this.ctx.textBaseline = "alphabetic";
      }
    }
    drawChecker(cx, cy, r, owner, isSelected) {
      const ctx2 = this.ctx;
      const isWhite = owner === "white";
      ctx2.beginPath();
      ctx2.arc(cx + 1, cy + 1, r, 0, Math.PI * 2);
      ctx2.fillStyle = "rgba(0,0,0,0.4)";
      ctx2.fill();
      ctx2.beginPath();
      ctx2.arc(cx, cy, r, 0, Math.PI * 2);
      if (isSelected) {
        ctx2.fillStyle = COLORS.selected;
      } else {
        const grad = ctx2.createRadialGradient(
          cx - r * 0.3,
          cy - r * 0.3,
          r * 0.1,
          cx,
          cy,
          r
        );
        if (isWhite) {
          grad.addColorStop(0, "#ffffff");
          grad.addColorStop(0.7, COLORS.white);
          grad.addColorStop(1, "#a0a090");
        } else {
          grad.addColorStop(0, "#5a5a7a");
          grad.addColorStop(0.7, COLORS.black);
          grad.addColorStop(1, "#050510");
        }
        ctx2.fillStyle = grad;
      }
      ctx2.fill();
      ctx2.beginPath();
      ctx2.arc(cx, cy, r, 0, Math.PI * 2);
      ctx2.strokeStyle = isWhite ? COLORS.whiteBorder : COLORS.blackBorder;
      ctx2.lineWidth = Math.max(1, r * 0.12);
      ctx2.stroke();
      ctx2.beginPath();
      ctx2.arc(cx, cy, r * 0.65, 0, Math.PI * 2);
      ctx2.strokeStyle = isWhite ? "rgba(180,170,150,0.6)" : "rgba(100,100,140,0.6)";
      ctx2.lineWidth = Math.max(0.5, r * 0.08);
      ctx2.stroke();
    }
    drawBarCheckers(state) {
      if (!this.layout) return;
      const l = this.layout;
      for (const player of ["white", "black"]) {
        const barIdx = barIndex(player);
        const barPt = state.board[barIdx];
        if (!barPt || barPt.owner !== player || barPt.count === 0) continue;
        const center = this.getPointCenter(barIdx);
        if (!center) continue;
        const isSelected = state.selectedPoint === barIdx;
        const selectablePoints = getSelectablePoints(state.legalSequences);
        const isSelectable = state.phase === "playerActing" && selectablePoints.has(barIdx);
        if (isSelectable || isSelected) {
          const ctx2 = this.ctx;
          ctx2.save();
          if (l.isPortrait) {
            const midY = l.boardY + l.boardH / 2;
            const bh = l.boardH * 0.04 + 2;
            ctx2.fillStyle = isSelected ? COLORS.selected : COLORS.barHighlight;
            ctx2.globalAlpha = 0.4;
            ctx2.fillRect(l.boardX, midY - bh / 2 - l.checkerR * 2, l.boardW, l.checkerR * 4 + bh);
          } else {
            ctx2.fillStyle = isSelected ? COLORS.selected : COLORS.barHighlight;
            ctx2.globalAlpha = 0.4;
            ctx2.fillRect(
              l.barX,
              l.boardY + l.boardH / 2 - l.checkerR * 2.5,
              l.barW,
              l.checkerR * 5
            );
          }
          ctx2.restore();
        }
        const count = barPt.count;
        for (let i = 0; i < count && i < 4; i++) {
          const cx = center.x;
          let cy;
          if (l.isPortrait) {
            const midY = l.boardY + l.boardH / 2;
            const dir = player === "black" ? -1 : 1;
            cy = midY + dir * (i + 0.5) * l.checkerR * 2.1;
          } else {
            const dir = player === "black" ? 1 : -1;
            cy = center.y + dir * i * l.checkerR * 2.1;
          }
          this.drawChecker(cx, cy, l.checkerR * 0.9, player, isSelected);
        }
        if (count > 0) {
          const fontSize = Math.max(10, 12 * l.fontScale);
          this.ctx.font = `bold ${fontSize}px sans-serif`;
          this.ctx.fillStyle = "#ffff00";
          this.ctx.textAlign = "center";
          this.ctx.fillText(`\xD7${count}`, center.x, center.y + l.checkerR * 2.2);
        }
      }
      this.drawBarValidTargets(state);
    }
    drawBarValidTargets(state) {
      if (!this.layout) return;
      const l = this.layout;
    }
    /** True when the player has pre-selection bear-off moves available */
    anyBearOffPossible(state) {
      return state.phase === "playerActing" && state.selectedPoint === null && state.legalSequences.some(
        (seq) => seq.length > 0 && (seq[0].to === -1 || seq[0].to === 26)
      );
    }
    drawBearOffAreas(state) {
      if (!this.layout) return;
      const l = this.layout;
      const ctx2 = this.ctx;
      const canBearOff4 = this.anyBearOffPossible(state);
      ctx2.fillStyle = canBearOff4 ? "rgba(255,210,30,0.18)" : "rgba(245,240,232,0.15)";
      ctx2.fillRect(l.whiteBearOffX, l.boardY, l.bearOffW, l.boardH);
      ctx2.strokeStyle = canBearOff4 ? "rgba(255,210,30,0.75)" : "rgba(245,240,232,0.4)";
      ctx2.lineWidth = canBearOff4 ? 2 : 1;
      ctx2.strokeRect(l.whiteBearOffX, l.boardY, l.bearOffW, l.boardH);
      const wX = l.whiteBearOffX + l.bearOffW / 2;
      const fontSize = Math.max(10, 11 * l.fontScale);
      ctx2.font = `bold ${fontSize}px sans-serif`;
      ctx2.fillStyle = "#ffffff";
      ctx2.textAlign = "center";
      ctx2.fillText("\u2659", wX, l.boardY + 16);
      ctx2.fillText(`${state.whiteBorneOff}`, wX, l.boardY + 32);
      for (let i = 0; i < Math.min(state.whiteBorneOff, 8); i++) {
        const cy = l.boardY + l.boardH - 10 - i * (l.bearOffW * 0.35 + 2);
        this.drawChecker(wX, cy, l.bearOffW * 0.35, "white", false);
      }
      ctx2.fillStyle = canBearOff4 ? "rgba(255,210,30,0.18)" : "rgba(26,26,46,0.25)";
      ctx2.fillRect(l.blackBearOffX, l.boardY, l.bearOffW, l.boardH);
      ctx2.strokeStyle = canBearOff4 ? "rgba(255,210,30,0.75)" : "rgba(100,100,140,0.4)";
      ctx2.lineWidth = canBearOff4 ? 2 : 1;
      ctx2.strokeRect(l.blackBearOffX, l.boardY, l.bearOffW, l.boardH);
      const bX = l.blackBearOffX + l.bearOffW / 2;
      ctx2.font = `bold ${fontSize}px sans-serif`;
      ctx2.fillStyle = "#aaaaff";
      ctx2.textAlign = "center";
      ctx2.fillText("\u265F", bX, l.boardY + 16);
      ctx2.fillText(`${state.blackBorneOff}`, bX, l.boardY + 32);
      for (let i = 0; i < Math.min(state.blackBorneOff, 8); i++) {
        const cy = l.boardY + l.boardH - 10 - i * (l.bearOffW * 0.35 + 2);
        this.drawChecker(bX, cy, l.bearOffW * 0.35, "black", false);
      }
    }
    drawBearOffAreasPortrait(state) {
      if (!this.layout) return;
      const l = this.layout;
      const ctx2 = this.ctx;
      const bh = l.bearOffW;
      const canBearOff4 = this.anyBearOffPossible(state);
      const whiteY = l.boardY + l.boardH + 4;
      ctx2.fillStyle = canBearOff4 ? "rgba(255,210,30,0.18)" : "rgba(245,240,232,0.12)";
      ctx2.fillRect(l.boardX, whiteY, l.boardW, bh);
      ctx2.strokeStyle = canBearOff4 ? "rgba(255,210,30,0.75)" : "rgba(245,240,232,0.3)";
      ctx2.lineWidth = canBearOff4 ? 2 : 1;
      ctx2.strokeRect(l.boardX, whiteY, l.boardW, bh);
      const fontSize = Math.max(9, 10 * l.fontScale);
      ctx2.font = `${fontSize}px sans-serif`;
      ctx2.fillStyle = COLORS.textLight;
      ctx2.textAlign = "left";
      ctx2.fillText(`\u2659 ${state.whiteBorneOff}`, l.boardX + 4, whiteY + bh / 2 + 4);
      const blackY = l.boardY - bh - 4;
      ctx2.fillStyle = canBearOff4 ? "rgba(255,210,30,0.18)" : "rgba(26,26,46,0.2)";
      ctx2.fillRect(l.boardX, blackY, l.boardW, bh);
      ctx2.strokeStyle = canBearOff4 ? "rgba(255,210,30,0.75)" : "rgba(100,100,140,0.3)";
      ctx2.lineWidth = canBearOff4 ? 2 : 1;
      ctx2.strokeRect(l.boardX, blackY, l.boardW, bh);
      ctx2.font = `${fontSize}px sans-serif`;
      ctx2.fillStyle = "#aaaaff";
      ctx2.textAlign = "left";
      ctx2.fillText(`\u265F ${state.blackBorneOff}`, l.boardX + 4, blackY + bh / 2 + 4);
    }
    drawDoublingCube(state) {
      if (!this.layout) return;
      const cube = state.cube;
      const l = this.layout;
      const ctx2 = this.ctx;
      const size = Math.min(28, l.checkerR * 1.4) * l.fontScale;
      let cx, cy;
      if (l.isPortrait) {
        cx = l.boardX + l.boardW * 0.78;
        cy = l.boardY + l.boardH / 2;
      } else {
        cx = l.barX + l.barW / 2;
        cy = l.boardY + l.boardH / 2 + size * 1.4;
      }
      let bgColor = "#d4a020";
      if (cube.owner === "white") bgColor = "#e8e0d0";
      if (cube.owner === "black") bgColor = "#3030a0";
      ctx2.fillStyle = "rgba(0,0,0,0.5)";
      roundRect(ctx2, cx - size / 2 + 2, cy - size / 2 + 2, size, size, 4);
      ctx2.fill();
      ctx2.fillStyle = bgColor;
      roundRect(ctx2, cx - size / 2, cy - size / 2, size, size, 4);
      ctx2.fill();
      ctx2.strokeStyle = "rgba(0,0,0,0.5)";
      ctx2.lineWidth = 1.5;
      roundRect(ctx2, cx - size / 2, cy - size / 2, size, size, 4);
      ctx2.stroke();
      const valStr = String(cube.value);
      const fontSize = Math.max(8, size * 0.48);
      ctx2.font = `bold ${fontSize}px sans-serif`;
      ctx2.textAlign = "center";
      ctx2.textBaseline = "middle";
      ctx2.fillStyle = cube.owner === "black" ? "#ffffff" : "#1a1a00";
      ctx2.fillText(valStr, cx, cy);
      if (cube.owner) {
        const arrSize = size * 0.3;
        const dir = cube.owner === "white" ? 1 : -1;
        const ax = cx + size / 2 + 4;
        const ay = cy + dir * arrSize;
        ctx2.beginPath();
        ctx2.moveTo(ax, ay);
        ctx2.lineTo(ax - arrSize * 0.5, ay - dir * arrSize);
        ctx2.lineTo(ax + arrSize * 0.5, ay - dir * arrSize);
        ctx2.closePath();
        ctx2.fillStyle = bgColor;
        ctx2.fill();
      }
      if (cube.value > 1) {
        const labelFont = Math.max(7, size * 0.35);
        ctx2.font = `${labelFont}px sans-serif`;
        ctx2.fillStyle = "rgba(255,220,80,0.9)";
        ctx2.textAlign = "center";
        ctx2.textBaseline = "alphabetic";
        ctx2.fillText(`\xD7${cube.value}`, cx, cy + size / 2 + labelFont + 2);
      }
      ctx2.textAlign = "left";
      ctx2.textBaseline = "alphabetic";
    }
    drawDice(state) {
      if (!state.dice) return;
      if (!this.layout) return;
      if (this.diceRollAnim && performance.now() - this.diceRollAnim.startTime < this.diceRollAnim.duration) return;
      const l = this.layout;
      const ctx2 = this.ctx;
      const diceSize = Math.min(72, l.checkerR * 3.6, 88) * l.fontScale;
      const padding = 10;
      const player = state.currentPlayer;
      let diceX, diceY;
      const p = this.dicePlacement();
      if (!p) return;
      diceX = p.diceX;
      diceY = p.diceY;
      const isWhite = player === "white";
      state.dice.values.forEach((val, idx) => {
        let used;
        if (state.dice.values[0] === state.dice.values[1]) {
          const remainingCount = state.dice.remaining.length;
          used = idx >= remainingCount;
        } else {
          used = !state.dice.remaining.includes(val);
        }
        const x = diceX + idx * (diceSize + padding);
        this.drawDie(x, diceY, diceSize, val, isWhite, used);
      });
      if (state.dice.values[0] === state.dice.values[1]) {
        const fontSize = Math.max(9, 11 * l.fontScale);
        ctx2.font = `${fontSize}px sans-serif`;
        ctx2.fillStyle = COLORS.textLight;
        ctx2.textAlign = "left";
        ctx2.fillText(`\xD7${state.dice.remaining.length}`, diceX, diceY + diceSize + 16);
      }
    }
    /**
     * Render the dice-tumble animation overlay.
     * Called once per rAF frame from render().
     */
    renderDiceAnim() {
      if (!this.diceRollAnim) return;
      const a = this.diceRollAnim;
      const elapsed = performance.now() - a.startTime;
      if (elapsed >= a.duration) {
        this.diceRollAnim = null;
        return;
      }
      const t2 = elapsed / a.duration;
      const SETTLE = 0.65;
      const alpha = t2 < 0.08 ? t2 / 0.08 : t2 > 0.82 ? (1 - t2) / 0.18 : 1;
      const bucket = Math.floor(elapsed / 65);
      const v1 = t2 < SETTLE ? (bucket * 7 + 1) % 6 + 1 : a.val1;
      const v2 = t2 < SETTLE ? (bucket * 11 + 4) % 6 + 1 : a.val2;
      let scale;
      if (t2 < 0.12) {
        scale = easeOutBack(t2 / 0.12);
      } else if (t2 < SETTLE) {
        const spinProgress = (t2 - 0.12) / (SETTLE - 0.12);
        scale = 1 + Math.sin(elapsed / 80) * 0.04 * (1 - spinProgress);
      } else {
        const st = (t2 - SETTLE) / (1 - SETTLE);
        scale = 1 + Math.sin(st * Math.PI) * 0.05;
      }
      const tNorm = Math.min(t2 / SETTLE, 1);
      const easeT = easeOutCubicLocal(tNorm);
      const angle1 = easeT * Math.PI * 8;
      const angle2 = -easeT * Math.PI * 6;
      const size = a.diceSize * scale;
      const padding = 10;
      const cx1 = a.diceX + a.diceSize / 2;
      const cx2 = a.diceX + a.diceSize + padding + a.diceSize / 2;
      const cy = a.diceY + a.diceSize / 2;
      const ctx2 = this.ctx;
      ctx2.save();
      ctx2.translate(cx1, cy);
      ctx2.rotate(angle1);
      this.drawDie(-size / 2, -size / 2, size, v1, true, false, alpha);
      ctx2.restore();
      ctx2.save();
      ctx2.translate(cx2, cy);
      ctx2.rotate(angle2);
      this.drawDie(-size / 2, -size / 2, size, v2, true, false, alpha);
      ctx2.restore();
    }
    drawDie(x, y, size, value, isWhite, used, alpha = 1) {
      const ctx2 = this.ctx;
      const r = size * 0.15;
      ctx2.globalAlpha = used ? 0.35 * alpha : alpha;
      ctx2.fillStyle = "rgba(0,0,0,0.4)";
      roundRect(ctx2, x + 2, y + 2, size, size, r);
      ctx2.fill();
      ctx2.fillStyle = isWhite ? COLORS.diceWhite : COLORS.diceDark;
      roundRect(ctx2, x, y, size, size, r);
      ctx2.fill();
      ctx2.strokeStyle = isWhite ? "#999" : "#555";
      ctx2.lineWidth = 1.5;
      roundRect(ctx2, x, y, size, size, r);
      ctx2.stroke();
      const dotColor = isWhite ? COLORS.diceDot : COLORS.diceDotLight;
      const dotR = size * 0.1;
      const m = size * 0.25;
      const c = size / 2;
      const dotPositions = [
        [[c, c]],
        [[m, m], [size - m, size - m]],
        [[m, m], [c, c], [size - m, size - m]],
        [[m, m], [size - m, m], [m, size - m], [size - m, size - m]],
        [[m, m], [size - m, m], [c, c], [m, size - m], [size - m, size - m]],
        [[m, m], [size - m, m], [m, c], [size - m, c], [m, size - m], [size - m, size - m]]
      ];
      const positions = dotPositions[value - 1] || [];
      ctx2.fillStyle = dotColor;
      for (const [dx, dy] of positions) {
        ctx2.beginPath();
        ctx2.arc(x + dx, y + dy, dotR, 0, Math.PI * 2);
        ctx2.fill();
      }
      ctx2.globalAlpha = 1;
    }
    renderHUD(state) {
      if (!this.layout) return;
      const l = this.layout;
      const ctx2 = this.ctx;
      ctx2.fillStyle = "rgba(0,0,0,0.75)";
      ctx2.fillRect(0, l.msgY, this.width, l.msgH);
      const fontSize = Math.max(11, 13 * l.fontScale);
      const smallFont = Math.max(9, 11 * l.fontScale);
      const msgCY = l.msgY + l.msgH / 2;
      const loc = t();
      ctx2.textAlign = "left";
      ctx2.textBaseline = "middle";
      ctx2.font = `bold ${fontSize}px sans-serif`;
      if (state.phase === "gameOver") {
        ctx2.fillStyle = COLORS.winText;
        ctx2.fillText(state.winner === "white" ? loc.youWin : loc.aiWins, 8, msgCY);
      } else {
        const playerColor = state.currentPlayer === "white" ? "#f5f0e8" : "#8888cc";
        ctx2.fillStyle = playerColor;
        ctx2.fillText(state.currentPlayer === "white" ? loc.youTurn : loc.aiTurn, 8, msgCY);
      }
      const m = state.match;
      const matchStr = `${m.whiteScore}/${m.targetScore} - ${m.blackScore}/${m.targetScore}`;
      ctx2.font = `${smallFont}px sans-serif`;
      ctx2.fillStyle = m.isCrawford ? "#ffcc44" : COLORS.textDim;
      ctx2.textAlign = "center";
      const crawfordTag = m.isCrawford ? " [Crawford]" : "";
      ctx2.fillText(`${loc.matchScore}: ${matchStr}${crawfordTag}`, this.width / 2, msgCY);
      ctx2.textAlign = "right";
      if (state.dice) {
        ctx2.font = `${smallFont}px sans-serif`;
        ctx2.fillStyle = COLORS.textDim;
        ctx2.fillText(`\u{1F3B2} [${state.dice.remaining.join(", ")}]`, this.width - 8, msgCY);
      } else if (state.phase !== "gameOver") {
        const wPip = getPipCount(state.board, "white", state.whiteBorneOff);
        const bPip = getPipCount(state.board, "black", state.blackBorneOff);
        ctx2.font = `${smallFont}px sans-serif`;
        ctx2.fillStyle = COLORS.textDim;
        ctx2.fillText(`pip \u2659${wPip} \u265F${bPip}`, this.width - 8, msgCY);
      } else if (state.lastSaveTime) {
        ctx2.font = `${smallFont}px sans-serif`;
        ctx2.fillStyle = "#558855";
        ctx2.fillText(`\u{1F4BE} ${formatTime(state.lastSaveTime)}`, this.width - 8, msgCY);
      }
      ctx2.fillStyle = "rgba(0,0,0,0.60)";
      ctx2.fillRect(0, l.btnAreaY, this.width, l.btnAreaH);
      ctx2.strokeStyle = "rgba(255,255,255,0.08)";
      ctx2.lineWidth = 1;
      ctx2.beginPath();
      ctx2.moveTo(0, l.btnAreaY);
      ctx2.lineTo(this.width, l.btnAreaY);
      ctx2.stroke();
      ctx2.textAlign = "left";
      ctx2.textBaseline = "alphabetic";
    }
    renderWinScreen(state) {
      if (!state.winner) return;
      const winner = state.winner;
      const ctx2 = this.ctx;
      const fs = this.layout?.fontScale ?? 1;
      ctx2.fillStyle = COLORS.winBg;
      ctx2.fillRect(0, 0, this.width, this.height);
      const cx = this.width / 2;
      const cy = this.height / 2;
      const loc = t();
      ctx2.textAlign = "center";
      ctx2.textBaseline = "middle";
      ctx2.font = `bold ${Math.max(26, 34 * fs)}px sans-serif`;
      ctx2.fillStyle = COLORS.winText;
      const matchOver = state.match.matchOver;
      let headline = winner === "white" ? loc.youWin : loc.aiWins;
      if (matchOver) headline = winner === "white" ? loc.matchWon : loc.aiWins;
      ctx2.fillText(headline, cx, cy - 56 * fs);
      if (state.winType && state.winType !== "single") {
        const pts = state.cube.value * (state.winType === "gammon" ? 2 : 3);
        const winMsg = state.winType === "gammon" ? loc.gammonWin.replace("{v}", String(pts)) : loc.backgammonWin.replace("{v}", String(pts));
        ctx2.font = `bold ${Math.max(14, 18 * fs)}px sans-serif`;
        ctx2.fillStyle = "#ff9944";
        ctx2.fillText(winMsg, cx, cy - 22 * fs);
      }
      const m = state.match;
      ctx2.font = `${Math.max(13, 16 * fs)}px sans-serif`;
      ctx2.fillStyle = "#ccddcc";
      ctx2.fillText(`${loc.matchScore}: ${m.whiteScore} - ${m.blackScore}  (to ${m.targetScore})`, cx, cy + 14 * fs);
      ctx2.font = `${Math.max(12, 14 * fs)}px sans-serif`;
      ctx2.fillStyle = "#aaaaaa";
      if (!matchOver) {
        ctx2.fillText(loc.newGameHint, cx, cy + 42 * fs);
      } else {
        ctx2.fillText(loc.newGameHint, cx, cy + 42 * fs);
      }
      ctx2.textAlign = "left";
      ctx2.textBaseline = "alphabetic";
    }
    // Draw initial roll result: two dice side by side with player labels
    renderInitialRollDice(initialRoll, winner) {
      if (!this.layout) return;
      const l = this.layout;
      const ctx2 = this.ctx;
      const isTie = initialRoll.white === initialRoll.black;
      const diceSize = Math.min(64, l.checkerR * 3.2, 80) * l.fontScale;
      const gap = diceSize * 0.4;
      const totalW = diceSize * 2 + gap;
      const cx = this.width / 2;
      const diceY = l.boardY + l.boardH / 2 - diceSize / 2;
      const whiteX = cx - totalW / 2;
      const blackX = cx + gap / 2 + diceSize;
      ctx2.fillStyle = "rgba(0,0,0,0.45)";
      const padH = diceSize * 0.5;
      const padV = diceSize * 0.55;
      roundRect(ctx2, cx - totalW / 2 - padH, diceY - padV, totalW + padH * 2, diceSize + padV * 2, 12);
      ctx2.fill();
      const isWhiteWinner = !isTie && winner === "white";
      const isBlackWinner = !isTie && winner === "black";
      ctx2.globalAlpha = isTie || isWhiteWinner ? 1 : 0.5;
      this.drawDie(whiteX, diceY, diceSize, initialRoll.white, true, false);
      ctx2.globalAlpha = isTie || isBlackWinner ? 1 : 0.5;
      this.drawDie(blackX, diceY, diceSize, initialRoll.black, false, false);
      ctx2.globalAlpha = 1;
      const labelFont = Math.max(10, 12 * l.fontScale);
      ctx2.font = `bold ${labelFont}px sans-serif`;
      ctx2.fillStyle = "rgba(255,255,255,0.6)";
      ctx2.textAlign = "center";
      ctx2.textBaseline = "middle";
      ctx2.fillText("VS", cx, diceY + diceSize / 2);
      const nameFont = Math.max(9, 11 * l.fontScale);
      ctx2.font = `${nameFont}px sans-serif`;
      const loc = t();
      ctx2.fillStyle = isTie || isWhiteWinner ? "#f5f0e8" : "rgba(245,240,232,0.4)";
      ctx2.fillText(loc.labelWhite, whiteX + diceSize / 2, diceY + diceSize + diceSize * 0.3);
      ctx2.fillStyle = isTie || isBlackWinner ? "#aaaaff" : "rgba(170,170,255,0.4)";
      ctx2.fillText(loc.labelBlack, blackX + diceSize / 2, diceY + diceSize + diceSize * 0.3);
      ctx2.textAlign = "left";
      ctx2.textBaseline = "alphabetic";
    }
    // Highlight valid target points with a glow effect
    renderValidTargets(state) {
      if (!this.layout) return;
      const l = this.layout;
      const ctx2 = this.ctx;
      for (const move of state.validMoves) {
        if (move.to === -1 || move.to === 26) {
          this.drawBearOffHighlight(move.to, state.currentPlayer);
          continue;
        }
        const center = this.getPointCenter(move.to);
        if (!center) continue;
        ctx2.beginPath();
        ctx2.arc(center.x, center.y, l.checkerR * 1.1, 0, Math.PI * 2);
        ctx2.strokeStyle = COLORS.validTargetBorder;
        ctx2.lineWidth = 3;
        ctx2.setLineDash([4, 3]);
        ctx2.stroke();
        ctx2.setLineDash([]);
      }
    }
    drawBearOffHighlight(to, player) {
      if (!this.layout) return;
      const l = this.layout;
      const ctx2 = this.ctx;
      ctx2.strokeStyle = COLORS.validTargetBorder;
      ctx2.lineWidth = 3;
      ctx2.setLineDash([5, 3]);
      if (!l.isPortrait) {
        const bearX = player === "white" ? l.whiteBearOffX : l.blackBearOffX;
        roundRect(ctx2, bearX + 2, l.boardY + 2, l.bearOffW - 4, l.boardH - 4, 4);
        ctx2.stroke();
      } else {
        const bearY = player === "white" ? l.boardY + l.boardH + 4 : l.boardY - l.bearOffW - 4;
        roundRect(ctx2, l.boardX + 2, bearY + 2, l.boardW - 4, l.bearOffW - 4, 4);
        ctx2.stroke();
      }
      ctx2.setLineDash([]);
    }
  };
  function roundRect(ctx2, x, y, w, h, r) {
    ctx2.beginPath();
    ctx2.moveTo(x + r, y);
    ctx2.lineTo(x + w - r, y);
    ctx2.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx2.lineTo(x + w, y + h - r);
    ctx2.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx2.lineTo(x + r, y + h);
    ctx2.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx2.lineTo(x, y + r);
    ctx2.quadraticCurveTo(x, y, x + r, y);
    ctx2.closePath();
  }
  function lightenColor(hex, amount) {
    const num = parseInt(hex.replace("#", ""), 16);
    const r = Math.min(255, (num >> 16) + amount);
    const g = Math.min(255, (num >> 8 & 255) + amount);
    const b = Math.min(255, (num & 255) + amount);
    return `rgb(${r},${g},${b})`;
  }
  function formatTime(ts) {
    const d = new Date(ts);
    const h = d.getHours().toString().padStart(2, "0");
    const m = d.getMinutes().toString().padStart(2, "0");
    const s = d.getSeconds().toString().padStart(2, "0");
    return `${h}:${m}:${s}`;
  }

  // src/utils/AudioSystem.ts
  var AudioSystem = class {
    constructor() {
      this.ctx = null;
      this.masterGain = null;
      this._muted = false;
    }
    // ─── AudioContext lifecycle ────────────────────────────────────────────────
    /** Lazily create and resume the AudioContext (needs user gesture first). */
    acquire() {
      if (this._muted) return null;
      if (!this.ctx) {
        try {
          this.ctx = new AudioContext();
          this.masterGain = this.ctx.createGain();
          this.masterGain.gain.value = 1;
          this.masterGain.connect(this.ctx.destination);
        } catch {
          return null;
        }
      }
      if (this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {
        });
      }
      return this.ctx;
    }
    get out() {
      return this.masterGain;
    }
    // ─── Low-level helpers ─────────────────────────────────────────────────────
    /** Schedule a single oscillator note. */
    tone(freq, type, start, duration, peak, attack = 5e-3) {
      const ctx2 = this.ctx;
      const out = this.out;
      if (!ctx2 || !out) return;
      const osc = ctx2.createOscillator();
      const gain = ctx2.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(peak, start + attack);
      gain.gain.exponentialRampToValueAtTime(1e-4, start + duration);
      osc.connect(gain);
      gain.connect(out);
      osc.start(start);
      osc.stop(start + duration + 0.02);
    }
    /** Schedule a noise burst through a bandpass filter. */
    noise(duration, start, peak, decay, filterHz = 1e3, filterQ = 1) {
      const ctx2 = this.ctx;
      const out = this.out;
      if (!ctx2 || !out) return;
      const len = Math.ceil(ctx2.sampleRate * duration);
      const buf = ctx2.createBuffer(1, len, ctx2.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx2.createBufferSource();
      src.buffer = buf;
      const filter = ctx2.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = filterHz;
      filter.Q.value = filterQ;
      const gain = ctx2.createGain();
      gain.gain.setValueAtTime(peak, start);
      gain.gain.exponentialRampToValueAtTime(1e-4, start + decay);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(out);
      src.start(start);
      src.stop(start + duration);
    }
    // ─── Public sounds ─────────────────────────────────────────────────────────
    /** Dice rattling on the board. */
    playDiceRoll() {
      const ctx2 = this.acquire();
      if (!ctx2) return;
      const t2 = ctx2.currentTime;
      for (let i = 0; i < 3; i++) {
        const at = t2 + i * 0.1;
        this.noise(0.1, at, 0.35, 0.09, 900, 1.2);
        this.tone(180 - i * 18, "sine", at, 0.08, 0.18);
      }
    }
    /** Checker placed on a point — wooden thud. */
    playCheckerMove() {
      const ctx2 = this.acquire();
      if (!ctx2) return;
      const t2 = ctx2.currentTime;
      this.tone(400, "sine", t2, 0.09, 0.28, 3e-3);
      this.tone(220, "sine", t2 + 0.01, 0.07, 0.16, 2e-3);
      this.noise(0.05, t2, 0.18, 0.04, 2200, 1.5);
    }
    /** Checker captured / hit — heavy impact. */
    playHit() {
      const ctx2 = this.acquire();
      if (!ctx2) return;
      const t2 = ctx2.currentTime;
      this.tone(140, "sawtooth", t2, 0.2, 0.48, 4e-3);
      this.tone(90, "sine", t2 + 0.02, 0.15, 0.32, 4e-3);
      this.noise(0.08, t2, 0.38, 0.07, 550, 0.8);
    }
    /** Checker bears off — upward swoosh. */
    playBearOff() {
      const ctx2 = this.acquire();
      if (!ctx2 || !this.out) return;
      const t2 = ctx2.currentTime;
      const osc = ctx2.createOscillator();
      const gain = ctx2.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(350, t2);
      osc.frequency.exponentialRampToValueAtTime(950, t2 + 0.2);
      gain.gain.setValueAtTime(0, t2);
      gain.gain.linearRampToValueAtTime(0.3, t2 + 0.04);
      gain.gain.exponentialRampToValueAtTime(1e-4, t2 + 0.24);
      osc.connect(gain);
      gain.connect(this.out);
      osc.start(t2);
      osc.stop(t2 + 0.26);
    }
    /** Victory fanfare — ascending C-major arpeggio. */
    playWin() {
      const ctx2 = this.acquire();
      if (!ctx2) return;
      const t2 = ctx2.currentTime;
      [523, 659, 784, 1047].forEach((f, i) => {
        this.tone(f, "triangle", t2 + i * 0.14, 0.45, 0.28, 0.01);
      });
      [523, 659, 784].forEach((f) => {
        this.tone(f, "sine", t2 + 0.6, 0.7, 0.14, 0.03);
      });
    }
    /** Defeat sound — descending minor phrase. */
    playLose() {
      const ctx2 = this.acquire();
      if (!ctx2) return;
      const t2 = ctx2.currentTime;
      [392, 349, 311, 294].forEach((f, i) => {
        this.tone(f, "sine", t2 + i * 0.22, 0.4, 0.24, 0.01);
      });
    }
    /** Doubling cube is offered or accepted — weighty thud + rising pitch. */
    playDouble() {
      const ctx2 = this.acquire();
      if (!ctx2) return;
      const t2 = ctx2.currentTime;
      this.tone(120, "sine", t2, 0.18, 0.55, 5e-3);
      this.tone(240, "triangle", t2 + 0.03, 0.12, 0.38, 5e-3);
      this.noise(0.06, t2, 0.28, 0.05, 400, 0.6);
      if (this.ctx && this.out) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(280, t2 + 0.06);
        osc.frequency.exponentialRampToValueAtTime(560, t2 + 0.28);
        gain.gain.setValueAtTime(0, t2 + 0.06);
        gain.gain.linearRampToValueAtTime(0.22, t2 + 0.1);
        gain.gain.exponentialRampToValueAtTime(1e-4, t2 + 0.32);
        osc.connect(gain);
        gain.connect(this.out);
        osc.start(t2 + 0.06);
        osc.stop(t2 + 0.34);
      }
    }
    /** Decliner concedes — descending "surrender" phrase. */
    playDecline() {
      const ctx2 = this.acquire();
      if (!ctx2) return;
      const t2 = ctx2.currentTime;
      this.tone(330, "sine", t2, 0.22, 0.28, 0.01);
      this.tone(220, "sine", t2 + 0.18, 0.28, 0.24, 0.01);
      this.noise(0.08, t2 + 0.02, 0.12, 0.07, 600, 0.7);
    }
    /** Match is completely won — extended grand fanfare. */
    playMatchWin() {
      const ctx2 = this.acquire();
      if (!ctx2) return;
      const t2 = ctx2.currentTime;
      const arpNotes = [523, 659, 784, 1047, 1319];
      arpNotes.forEach((f, i) => {
        this.tone(f, "triangle", t2 + i * 0.12, 0.55, 0.32, 0.01);
      });
      [523, 659, 784].forEach((f) => {
        this.tone(f, "sine", t2 + 0.72, 1.2, 0.18, 0.04);
      });
      [2093, 2637].forEach((f) => {
        this.tone(f, "sine", t2 + 0.7, 0.6, 0.06, 0.02);
      });
    }
    /** Gammon or backgammon win — win fanfare + extra triumphant accent. */
    playGammonWin() {
      const ctx2 = this.acquire();
      if (!ctx2) return;
      const t2 = ctx2.currentTime;
      [523, 659, 784, 1047].forEach((f, i) => {
        this.tone(f, "triangle", t2 + i * 0.14, 0.48, 0.3, 0.01);
      });
      this.tone(2093, "sine", t2 + 0.6, 0.28, 0.14, 0.01);
      this.tone(1047, "triangle", t2 + 0.65, 0.6, 0.5, 0.03);
      this.tone(784, "sine", t2 + 0.65, 0.6, 0.5, 0.03);
    }
    /** Subtle UI click feedback. */
    playButtonClick() {
      const ctx2 = this.acquire();
      if (!ctx2) return;
      const t2 = ctx2.currentTime;
      this.tone(680, "sine", t2, 0.055, 0.1, 3e-3);
    }
    // ─── Mute control ──────────────────────────────────────────────────────────
    toggleMute() {
      this._muted = !this._muted;
      if (this.masterGain) {
        this.masterGain.gain.value = this._muted ? 0 : 1;
      }
    }
    get muted() {
      return this._muted;
    }
  };
  var audioSystem = new AudioSystem();

  // src/input/InputController.ts
  var InputController = class {
    constructor(canvas2, renderer2, onAction) {
      this.buttons = [];
      this.currentState = null;
      this.canvas = canvas2;
      this.renderer = renderer2;
      this.onAction = onAction;
      this.setupEventListeners();
      this.setupButtons();
    }
    /** Called before each render so click handlers can check button visibility. */
    setState(state) {
      this.currentState = state;
    }
    setupEventListeners() {
      this.canvas.addEventListener("mousedown", this.handleMouseDown.bind(this));
      this.canvas.addEventListener("touchstart", this.handleTouchStart.bind(this), {
        passive: false
      });
      this.canvas.addEventListener("touchend", this.handleTouchEnd.bind(this), {
        passive: false
      });
    }
    setupButtons() {
    }
    // Update button layout based on current canvas/HUD dimensions
    updateLayout(canvasW, canvasH) {
      const layout = this.renderer.getLayout();
      if (!layout) return;
      const btnAreaY = layout.btnAreaY;
      const btnAreaH = layout.btnAreaH;
      const btnH = Math.max(46, Math.min(54, btnAreaH * 0.9));
      const btnY = btnAreaY + (btnAreaH - btnH) / 2;
      const margin = 6;
      const loc = t();
      const soundEmoji = audioSystem.muted ? "\u{1F507}" : "\u{1F50A}";
      const soundText = audioSystem.muted ? loc.btnSoundOffText : loc.btnSoundOnText;
      const rollBtnW = Math.min(180, canvasW * 0.26);
      const rollBtnH = Math.min(90, layout.boardH * 0.28);
      const rollBtnCX = layout.isPortrait ? layout.boardX + layout.boardW / 2 : layout.boardX + layout.boardW * 0.625;
      const rollBtnCY = layout.boardY + layout.boardH / 2 - rollBtnH / 2 - 12;
      const rollBtn = {
        x: rollBtnCX - rollBtnW / 2,
        y: rollBtnCY - rollBtnH / 2,
        w: rollBtnW,
        h: rollBtnH,
        action: { type: "rollDice" },
        label: loc.btnRoll,
        emoji: loc.btnRollEmoji,
        text: loc.btnRollText,
        visible: (s) => s.phase === "waitingForRoll" && s.currentPlayer === "white" || s.phase === "rollingForFirst"
      };
      const doubleBtnW = Math.min(80, canvasW * 0.12);
      const doubleBtnH = Math.min(52, layout.boardH * 0.17);
      const doubleBtn = {
        x: rollBtnCX - rollBtnW / 2 - doubleBtnW - 8,
        y: rollBtnCY - doubleBtnH / 2,
        w: doubleBtnW,
        h: doubleBtnH,
        action: { type: "offerDouble" },
        label: loc.btnDoubleText,
        emoji: loc.btnDoubleEmoji,
        text: loc.btnDoubleText,
        visible: (s) => canOfferDouble(s) && s.currentPlayer === "white"
      };
      const nextGameBtnW = Math.min(160, canvasW * 0.22);
      const nextGameBtnH = Math.min(52, layout.boardH * 0.17);
      const nextGameBtn = {
        x: layout.boardX + layout.boardW / 2 - nextGameBtnW / 2,
        y: layout.boardY + layout.boardH / 2 + 30,
        w: nextGameBtnW,
        h: nextGameBtnH,
        action: { type: "nextGame" },
        label: loc.nextGameBtn,
        emoji: "\u25B6",
        text: loc.nextGameBtn,
        visible: (s) => s.phase === "gameOver" && !s.match.matchOver
      };
      if (layout.isPortrait) {
        const totalMargin = margin * 5;
        const btnW = Math.floor((canvasW - totalMargin) / 4);
        this.buttons = [
          rollBtn,
          doubleBtn,
          nextGameBtn,
          {
            x: margin,
            y: btnY,
            w: btnW,
            h: btnH,
            action: { type: "newGame" },
            label: loc.btnNewGame,
            emoji: loc.btnNewGameEmoji,
            text: loc.btnNewGameText,
            visible: (_) => true
          },
          {
            x: margin * 2 + btnW,
            y: btnY,
            w: btnW,
            h: btnH,
            action: { type: "clearSave" },
            label: loc.btnClearSave,
            emoji: loc.btnClearSaveEmoji,
            text: loc.btnClearSaveText,
            visible: (_) => true
          },
          {
            x: margin * 3 + btnW * 2,
            y: btnY,
            w: btnW,
            h: btnH,
            action: { type: "toggleSound" },
            label: soundEmoji,
            emoji: soundEmoji,
            text: soundText,
            visible: (_) => true
          },
          {
            x: margin * 4 + btnW * 3,
            y: btnY,
            w: btnW,
            h: btnH,
            action: { type: "toggleLang" },
            label: loc.btnLang,
            emoji: loc.btnLangEmoji,
            text: loc.btnLangText,
            visible: (_) => true
          }
        ];
      } else {
        const btnW = Math.min(88, canvasW * 0.14);
        const smallW = Math.min(72, canvasW * 0.1);
        const rightEdge = canvasW - margin;
        this.buttons = [
          rollBtn,
          doubleBtn,
          nextGameBtn,
          {
            x: rightEdge - btnW * 2 - smallW * 2 - margin * 3,
            y: btnY,
            w: btnW,
            h: btnH,
            action: { type: "newGame" },
            label: loc.btnNewGame,
            emoji: loc.btnNewGameEmoji,
            text: loc.btnNewGameText,
            visible: (_) => true
          },
          {
            x: rightEdge - btnW - smallW * 2 - margin * 2,
            y: btnY,
            w: btnW,
            h: btnH,
            action: { type: "clearSave" },
            label: loc.btnClearSave,
            emoji: loc.btnClearSaveEmoji,
            text: loc.btnClearSaveText,
            visible: (_) => true
          },
          {
            x: rightEdge - smallW * 2 - margin,
            y: btnY,
            w: smallW,
            h: btnH,
            action: { type: "toggleSound" },
            label: soundEmoji,
            emoji: soundEmoji,
            text: soundText,
            visible: (_) => true
          },
          {
            x: rightEdge - smallW,
            y: btnY,
            w: smallW,
            h: btnH,
            action: { type: "toggleLang" },
            label: loc.btnLang,
            emoji: loc.btnLangEmoji,
            text: loc.btnLangText,
            visible: (_) => true
          }
        ];
      }
    }
    getButtons() {
      return this.buttons;
    }
    getCanvasCoords(e) {
      const rect = this.canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
    handleMouseDown(e) {
      e.preventDefault();
      const { x, y } = this.getCanvasCoords(e);
      this.handleClick(x, y);
    }
    handleTouchStart(e) {
      e.preventDefault();
      if (e.touches.length > 0) {
        const { x, y } = this.getCanvasCoords(e.touches[0]);
        this.handleClick(x, y);
      }
    }
    handleTouchEnd(e) {
      e.preventDefault();
    }
    handleClick(x, y) {
      for (const btn of this.buttons) {
        if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
          if (this.currentState && !btn.visible(this.currentState)) continue;
          audioSystem.playButtonClick();
          this.onAction(btn.action);
          return;
        }
      }
      const pointIndex = this.renderer.hitTest(x, y);
      if (pointIndex !== null) {
        this.onAction({ type: "selectPoint", pointIndex });
      }
    }
    // Called by main.ts with current state to process a point selection
    processPointClick(pointIndex, state) {
      if (state.phase !== "playerActing") return null;
      const player = state.currentPlayer;
      const barIdx = barIndex(player);
      if (state.selectedPoint === pointIndex) {
        return { type: "selectPoint", pointIndex: -1 };
      }
      if (state.selectedPoint !== null) {
        const validMove = state.validMoves.find((m) => m.to === pointIndex);
        if (validMove) {
          return { type: "makeMove", move: validMove };
        }
        if (pointIndex === -1 || pointIndex === 26) {
          const bearMove = state.validMoves.find(
            (m) => m.to === -1 || m.to === 26
          );
          if (bearMove) {
            return { type: "makeMove", move: bearMove };
          }
        }
      }
      const selectable = getSelectablePoints(state.legalSequences);
      if (selectable.has(pointIndex)) {
        return { type: "selectPoint", pointIndex };
      }
      return null;
    }
  };

  // src/persistence/IndexedDbStore.ts
  var DB_NAME = "BackgammonDB";
  var DB_VERSION = 1;
  var STORE_NAME = "saves";
  var SAVE_KEY = "currentGame";
  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error("IndexedDB is not supported in this browser."));
        return;
      }
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = (event) => {
        const db = event.target.result;
        db.onversionchange = () => {
          db.close();
          console.warn("IndexedDB version changed; connection closed.");
        };
        resolve(db);
      };
      request.onerror = (event) => {
        const err2 = event.target.error;
        reject(new Error(`IndexedDB open failed: ${err2?.message ?? "unknown error"}`));
      };
      request.onblocked = () => {
        reject(new Error("IndexedDB open blocked by another connection."));
      };
    });
  }
  async function saveGame(data) {
    let db;
    try {
      db = await openDatabase();
    } catch (e) {
      console.error("[IndexedDB] Cannot open DB for save:", e);
      throw e;
    }
    return new Promise((resolve, reject) => {
      let tx;
      try {
        tx = db.transaction(STORE_NAME, "readwrite");
      } catch (e) {
        db.close();
        reject(new Error(`Cannot create transaction: ${e}`));
        return;
      }
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(data, SAVE_KEY);
      req.onsuccess = () => {
      };
      req.onerror = (event) => {
        const err2 = event.target.error;
        console.error("[IndexedDB] Save put failed:", err2);
        reject(new Error(`Save put failed: ${err2?.message ?? "unknown"}`));
      };
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = (event) => {
        const err2 = event.target.error;
        db.close();
        reject(new Error(`Save transaction failed: ${err2?.message ?? "unknown"}`));
      };
      tx.onabort = () => {
        db.close();
        reject(new Error("Save transaction aborted."));
      };
    });
  }
  async function loadGame() {
    let db;
    try {
      db = await openDatabase();
    } catch (e) {
      console.error("[IndexedDB] Cannot open DB for load:", e);
      return null;
    }
    return new Promise((resolve) => {
      let tx;
      try {
        tx = db.transaction(STORE_NAME, "readonly");
      } catch (e) {
        db.close();
        console.error("[IndexedDB] Cannot create read transaction:", e);
        resolve(null);
        return;
      }
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(SAVE_KEY);
      req.onsuccess = (event) => {
        const result = event.target.result;
        db.close();
        resolve(result ?? null);
      };
      req.onerror = (event) => {
        const err2 = event.target.error;
        console.error("[IndexedDB] Load failed:", err2);
        db.close();
        resolve(null);
      };
    });
  }
  async function deleteSave() {
    let db;
    try {
      db = await openDatabase();
    } catch (e) {
      console.error("[IndexedDB] Cannot open DB for delete:", e);
      throw e;
    }
    return new Promise((resolve, reject) => {
      let tx;
      try {
        tx = db.transaction(STORE_NAME, "readwrite");
      } catch (e) {
        db.close();
        reject(new Error(`Cannot create transaction: ${e}`));
        return;
      }
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(SAVE_KEY);
      req.onerror = (event) => {
        const err2 = event.target.error;
        console.error("[IndexedDB] Delete failed:", err2);
        reject(new Error(`Delete failed: ${err2?.message ?? "unknown"}`));
      };
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = (event) => {
        const err2 = event.target.error;
        db.close();
        reject(new Error(`Delete transaction failed: ${err2?.message ?? "unknown"}`));
      };
    });
  }

  // src/persistence/SaveValidation.ts
  var SCHEMA_VERSION = 2;
  var APP_VERSION = "1.1.0";
  function err(errors, msg) {
    errors.push(msg);
  }
  function validateSaveData(data) {
    const errors = [];
    if (!data || typeof data !== "object") {
      err(errors, "Save data is not an object");
      return { valid: false, errors };
    }
    const d = data;
    if (typeof d.schemaVersion !== "number") {
      err(errors, "Missing or invalid schemaVersion");
    } else if (d.schemaVersion !== SCHEMA_VERSION && d.schemaVersion !== 1) {
      err(errors, `Schema version mismatch: expected ${SCHEMA_VERSION}, got ${d.schemaVersion}`);
    }
    if (typeof d.timestamp !== "number" || d.timestamp <= 0) {
      err(errors, "Missing or invalid timestamp");
    }
    if (typeof d.appVersion !== "string") {
      err(errors, "Missing appVersion (warning)");
    }
    if (!d.gameState || typeof d.gameState !== "object") {
      err(errors, "Missing gameState");
      return { valid: errors.length === 0, errors };
    }
    const gs = d.gameState;
    validateGameState(gs, errors);
    return { valid: errors.length === 0, errors };
  }
  function validateGameState(gs, errors) {
    if (!Array.isArray(gs.board)) {
      err(errors, "gameState.board is not an array");
      return;
    }
    if (gs.board.length !== 26) {
      err(errors, `gameState.board must have 26 entries, got ${gs.board.length}`);
      return;
    }
    let whiteTotalOnBoard = 0;
    let blackTotalOnBoard = 0;
    for (let i = 0; i < 26; i++) {
      const pt = gs.board[i];
      if (!pt || typeof pt !== "object") {
        err(errors, `board[${i}] is not an object`);
        continue;
      }
      if (pt.owner !== null && pt.owner !== "white" && pt.owner !== "black") {
        err(errors, `board[${i}].owner is invalid: ${pt.owner}`);
      }
      if (typeof pt.count !== "number" || pt.count < 0 || pt.count > 15) {
        err(errors, `board[${i}].count is invalid: ${pt.count}`);
      }
      if (pt.owner === "white") whiteTotalOnBoard += pt.count || 0;
      if (pt.owner === "black") blackTotalOnBoard += pt.count || 0;
    }
    if (typeof gs.whiteBorneOff !== "number" || gs.whiteBorneOff < 0 || gs.whiteBorneOff > 15) {
      err(errors, `whiteBorneOff invalid: ${gs.whiteBorneOff}`);
    }
    if (typeof gs.blackBorneOff !== "number" || gs.blackBorneOff < 0 || gs.blackBorneOff > 15) {
      err(errors, `blackBorneOff invalid: ${gs.blackBorneOff}`);
    }
    const whiteBorneOff = gs.whiteBorneOff || 0;
    const blackBorneOff = gs.blackBorneOff || 0;
    const whiteTotal = whiteTotalOnBoard + whiteBorneOff;
    const blackTotal = blackTotalOnBoard + blackBorneOff;
    if (whiteTotal !== 15) {
      err(errors, `White checker total is ${whiteTotal}, expected 15`);
    }
    if (blackTotal !== 15) {
      err(errors, `Black checker total is ${blackTotal}, expected 15`);
    }
    const validPlayers = ["white", "black"];
    if (!validPlayers.includes(gs.currentPlayer)) {
      err(errors, `currentPlayer invalid: ${gs.currentPlayer}`);
    }
    const validPhases = [
      "rollingForFirst",
      "waitingForRoll",
      "playerActing",
      "aiThinking",
      "playerDecidingDouble",
      "gameOver"
    ];
    if (!validPhases.includes(gs.phase)) {
      err(errors, `phase invalid: ${gs.phase}`);
    }
    if (gs.dice !== null && gs.dice !== void 0) {
      validateDiceState(gs.dice, errors);
    }
    if (gs.winner !== null && gs.winner !== void 0 && !validPlayers.includes(gs.winner)) {
      err(errors, `winner invalid: ${gs.winner}`);
    }
  }
  function validateDiceState(dice, errors) {
    if (!Array.isArray(dice.values) || dice.values.length !== 2) {
      err(errors, "dice.values must be array of length 2");
      return;
    }
    for (const v of dice.values) {
      if (typeof v !== "number" || v < 1 || v > 6) {
        err(errors, `dice.values contains invalid value: ${v}`);
      }
    }
    if (!Array.isArray(dice.remaining)) {
      err(errors, "dice.remaining must be an array");
      return;
    }
    for (const v of dice.remaining) {
      if (typeof v !== "number" || v < 1 || v > 6) {
        err(errors, `dice.remaining contains invalid value: ${v}`);
      }
    }
    if (dice.remaining.length > 4 || dice.remaining.length < 0) {
      err(errors, `dice.remaining length invalid: ${dice.remaining.length}`);
    }
  }

  // src/utils/random.ts
  function rollDie() {
    return Math.floor(Math.random() * 6) + 1;
  }
  function rollTwoDice() {
    return [rollDie(), rollDie()];
  }

  // src/main.ts
  var gameState = startNewGame();
  var canvas;
  var ctx;
  var renderer;
  var inputController;
  var aiInProgress = false;
  var startupPhase = "loading";
  var savedData = null;
  var restoreButtons = null;
  var confirmingNewGame = false;
  var confirmingClearSave = false;
  var confirmButtons = null;
  var suppressConfirmHandling = false;
  var showingDoubleOffer = false;
  var errorClearTimeout = null;
  var rafId = null;
  async function init() {
    canvas = document.getElementById("game-canvas");
    if (!canvas) {
      console.error("Cannot find canvas element");
      return;
    }
    const context = canvas.getContext("2d");
    if (!context) {
      console.error("Cannot get 2D context from canvas");
      document.body.innerHTML = '<div style="color:red;padding:20px">Cannot initialize canvas rendering context.</div>';
      return;
    }
    ctx = context;
    renderer = new CanvasRenderer(ctx);
    const container = document.getElementById("game-container");
    function resizeCanvas() {
      const vv = window.visualViewport;
      const w = vv ? Math.round(vv.width) : window.innerWidth || container.clientWidth;
      const h = vv ? Math.round(vv.height) : window.innerHeight || container.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      canvas.style.left = (vv ? vv.offsetLeft : 0) + "px";
      canvas.style.top = (vv ? vv.offsetTop : 0) + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderer.setSize(w, h);
      inputController?.updateLayout(w, h);
      render();
    }
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", resizeCanvas);
      window.visualViewport.addEventListener("scroll", resizeCanvas);
    }
    const ro = new ResizeObserver(() => {
      resizeCanvas();
    });
    ro.observe(container);
    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("orientationchange", () => {
      setTimeout(resizeCanvas, 150);
    });
    inputController = new InputController(canvas, renderer, handleAction);
    resizeCanvas();
    await tryLoadSavedGame();
  }
  async function tryLoadSavedGame() {
    try {
      savedData = await loadGame();
    } catch (e) {
      console.error("[Save] Failed to load save data:", e);
      savedData = null;
    }
    if (savedData !== null) {
      const validation = validateSaveData(savedData);
      if (!validation.valid) {
        console.warn("[Save] Save data invalid, discarding:", validation.errors);
        savedData = null;
        try {
          await deleteSave();
        } catch (e) {
          console.error("[Save] Failed to delete invalid save:", e);
        }
      }
    }
    if (savedData !== null) {
      startupPhase = "promptRestore";
      render();
    } else {
      startupPhase = "playing";
      gameState = startNewGame();
      autoSave();
      render();
    }
  }
  function handleAction(action) {
    if (confirmingNewGame) {
      if (action.type === "confirmNewGame") {
        confirmingNewGame = false;
        confirmButtons = null;
        handleNewGame();
      } else if (action.type === "cancelNewGame") {
        confirmingNewGame = false;
        confirmButtons = null;
        render();
      }
      return;
    }
    if (confirmingClearSave) {
      if (action.type === "confirmClearSave") {
        confirmingClearSave = false;
        confirmButtons = null;
        handleClearSave();
      } else if (action.type === "cancelClearSave") {
        confirmingClearSave = false;
        confirmButtons = null;
        render();
      }
      return;
    }
    if (showingDoubleOffer || gameState.phase === "playerDecidingDouble") {
      if (action.type === "acceptDouble") {
        showingDoubleOffer = false;
        confirmButtons = null;
        gameState = acceptDouble(gameState);
        audioSystem.playDouble();
        autoSave();
        render();
        scheduleAITurn();
        return;
      } else if (action.type === "declineDouble") {
        showingDoubleOffer = false;
        confirmButtons = null;
        gameState = declineDouble(gameState);
        audioSystem.playDecline();
        autoSave();
        render();
        return;
      }
      return;
    }
    if (startupPhase === "promptRestore") {
      if (action.type === "continueGame") {
        loadSavedGame();
        return;
      } else if (action.type === "newGame") {
        startupPhase = "playing";
        confirmingNewGame = true;
        render();
        return;
      }
      return;
    }
    if (startupPhase !== "playing") return;
    switch (action.type) {
      case "rollDice":
        if (gameState.phase === "rollingForFirst") {
          handleRollForFirst();
        } else {
          handleRollDice();
        }
        break;
      case "selectPoint":
        handleSelectPoint(action.pointIndex);
        break;
      case "makeMove":
        handleMakeMove(action.move);
        break;
      case "newGame":
        confirmingNewGame = true;
        suppressConfirmHandling = true;
        setTimeout(() => {
          suppressConfirmHandling = false;
        }, 0);
        render();
        break;
      case "clearSave":
        confirmingClearSave = true;
        suppressConfirmHandling = true;
        setTimeout(() => {
          suppressConfirmHandling = false;
        }, 0);
        render();
        break;
      case "continueGame":
        loadSavedGame();
        break;
      case "toggleLang":
        toggleLang();
        break;
      case "toggleSound":
        audioSystem.toggleMute();
        inputController.updateLayout(
          canvas.clientWidth,
          canvas.clientHeight
        );
        render();
        break;
      case "offerDouble":
        handleOfferDouble();
        break;
      case "nextGame":
        handleNextGame();
        break;
    }
  }
  function handleRollForFirst() {
    if (gameState.phase !== "rollingForFirst") return;
    audioSystem.playDiceRoll();
    const [wRoll, bRoll] = rollTwoDice();
    gameState = rollForFirst(gameState, wRoll, bRoll);
    renderer.queueDiceRoll(wRoll, bRoll);
    startAnimLoop();
    render();
    if (wRoll !== bRoll) {
      setTimeout(() => {
        gameState = cloneGameState(gameState);
        gameState.phase = "waitingForRoll";
        gameState.initialRoll = null;
        autoSave();
        render();
        if (gameState.currentPlayer === "black") {
          scheduleAITurn();
        }
      }, 1500);
    }
  }
  function handleRollDice() {
    if (gameState.phase !== "waitingForRoll") return;
    if (gameState.currentPlayer !== "white") return;
    audioSystem.playDiceRoll();
    const [d1, d2] = rollTwoDice();
    gameState = rollDice(gameState, d1, d2);
    autoSave();
    renderer.queueDiceRoll(d1, d2);
    startAnimLoop();
    render();
    if (gameState.phase === "waitingForRoll" && gameState.currentPlayer === "black") {
      scheduleAITurn();
    }
  }
  function handleSelectPoint(pointIndex) {
    if (gameState.phase !== "playerActing") return;
    if (pointIndex === -1 || pointIndex === 26) {
      if (gameState.selectedPoint !== null) {
        const bearOffMove = gameState.validMoves.find(
          (m) => m.to === pointIndex
        );
        if (bearOffMove) {
          handleMakeMove(bearOffMove);
          return;
        }
        const anyBearOff = gameState.validMoves.find(
          (m) => m.to === -1 || m.to === 26
        );
        if (anyBearOff) {
          handleMakeMove(anyBearOff);
          return;
        }
      }
      return;
    }
    if (gameState.selectedPoint !== null) {
      const moveMatch = gameState.validMoves.find((m) => m.to === pointIndex);
      if (moveMatch) {
        handleMakeMove(moveMatch);
        return;
      }
      if (gameState.selectedPoint === pointIndex) {
        const bearOff = gameState.validMoves.find((m) => m.to === -1 || m.to === 26);
        if (bearOff) {
          handleMakeMove(bearOff);
          return;
        }
      }
    }
    const processed = inputController.processPointClick(pointIndex, gameState);
    if (processed) {
      if (processed.type === "selectPoint") {
        if (processed.pointIndex === -1) {
          gameState = cloneGameState(gameState);
          gameState.selectedPoint = null;
          gameState.validMoves = [];
        } else {
          gameState = selectPoint(gameState, processed.pointIndex);
        }
      } else if (processed.type === "makeMove") {
        handleMakeMove(processed.move);
        return;
      }
    } else {
      setError(t().errCannotMove);
    }
    render();
  }
  function handleMakeMove(move) {
    if (gameState.phase !== "playerActing") return;
    const prevState = gameState;
    gameState = applyPlayerMove(gameState, move);
    if (gameState === prevState) {
      setError(t().errInvalidMove);
      render();
      return;
    }
    autoSave();
    if (move.isHit) {
      audioSystem.playHit();
    } else if (move.to === -1 || move.to === 26) {
      audioSystem.playBearOff();
    } else {
      audioSystem.playCheckerMove();
    }
    if (move.isHit) {
      const captured = gameState.currentPlayer === "white" ? "black" : "white";
      renderer.queueHitBurst(move.to, captured);
      startAnimLoop();
    }
    render();
    if (gameState.phase === "waitingForRoll" && gameState.currentPlayer === "black") {
      scheduleAITurn();
    } else if (gameState.phase === "gameOver") {
      playGameOverSound(gameState);
      autoSave();
      render();
    }
  }
  function handleOfferDouble() {
    if (!canOfferDouble(gameState)) return;
    gameState = offerDouble(gameState);
    audioSystem.playDouble();
    autoSave();
    render();
    const loc = t();
    setError(loc.youDoubled.replace("{v}", String(gameState.cube.value)));
  }
  function handleNextGame() {
    if (gameState.phase !== "gameOver") return;
    if (gameState.match.matchOver) return;
    if (aiInProgress) {
      aiInProgress = false;
    }
    gameState = startNextGame(gameState);
    autoSave();
    render();
  }
  function handleNewGame() {
    if (aiInProgress) {
      aiInProgress = false;
    }
    gameState = startNewGame();
    autoSave();
    render();
  }
  async function handleClearSave() {
    try {
      await deleteSave();
      setError(t().msgSaveCleared);
    } catch (e) {
      console.error("[Save] Failed to clear save:", e);
      setError(t().errClearFailed);
    }
    render();
  }
  function playGameOverSound(state, perspective = "player") {
    const isPlayerWin = state.winner === "white";
    if (isPlayerWin) {
      if (state.match.matchOver) {
        audioSystem.playMatchWin();
      } else if (state.winType === "gammon" || state.winType === "backgammon") {
        audioSystem.playGammonWin();
      } else {
        audioSystem.playWin();
      }
    } else {
      audioSystem.playLose();
    }
  }
  function aiShouldDouble(state) {
    if (!canOfferDouble(state)) return false;
    if (state.currentPlayer !== "black") return false;
    const bPip = getPipCount(state.board, "black", state.blackBorneOff);
    const wPip = getPipCount(state.board, "white", state.whiteBorneOff);
    const totalMoved = state.blackBorneOff + state.whiteBorneOff;
    if (totalMoved < 2) return false;
    if (bPip === 0) return false;
    return wPip > bPip * 1.25;
  }
  function scheduleAITurn() {
    if (aiInProgress) return;
    aiInProgress = true;
    setTimeout(() => runAITurn(), 400);
  }
  async function runAITurn() {
    if (!aiInProgress) return;
    if (gameState.currentPlayer !== "black") {
      aiInProgress = false;
      return;
    }
    if (gameState.phase === "gameOver") {
      aiInProgress = false;
      return;
    }
    if (gameState.phase === "waitingForRoll") {
      if (aiShouldDouble(gameState)) {
        gameState = offerDouble(gameState);
        audioSystem.playDouble();
        autoSave();
        showingDoubleOffer = true;
        render();
        aiInProgress = false;
        return;
      }
    }
    if (gameState.phase === "waitingForRoll") {
      audioSystem.playDiceRoll();
      const [d1, d2] = rollTwoDice();
      gameState = rollDice(gameState, d1, d2);
      autoSave();
      renderer.queueDiceRoll(d1, d2);
      startAnimLoop();
      render();
      await delay(Math.ceil(ANIM_DICE_MS * 0.68));
      if (gameState.phase === "waitingForRoll") {
        aiInProgress = false;
        render();
        return;
      }
    }
    if (gameState.phase !== "aiThinking") {
      aiInProgress = false;
      render();
      return;
    }
    while (gameState.phase === "aiThinking" && aiInProgress) {
      const bestSeq = chooseBestSequence(gameState);
      if (!bestSeq || bestSeq.length === 0) {
        break;
      }
      const move = bestSeq[0];
      const moveDelay = renderer.queueMoveAnim(
        move.from,
        move.to,
        gameState.currentPlayer,
        move.isHit
      );
      if (move.isHit) {
        audioSystem.playHit();
      } else if (move.to === -1 || move.to === 26) {
        audioSystem.playBearOff();
      } else {
        audioSystem.playCheckerMove();
      }
      gameState = applyMoveInternal(gameState, move);
      autoSave();
      startAnimLoop();
      if (gameState.phase === "gameOver") {
        playGameOverSound(gameState, "ai");
        aiInProgress = false;
        return;
      }
      await delay(moveDelay);
    }
    aiInProgress = false;
    autoSave();
    render();
  }
  async function autoSave() {
    try {
      const saveData = {
        schemaVersion: SCHEMA_VERSION,
        appVersion: APP_VERSION,
        timestamp: Date.now(),
        gameState: {
          board: gameState.board.map((p) => ({ owner: p.owner, count: p.count })),
          whiteBorneOff: gameState.whiteBorneOff,
          blackBorneOff: gameState.blackBorneOff,
          currentPlayer: gameState.currentPlayer,
          dice: gameState.dice ? {
            values: [gameState.dice.values[0], gameState.dice.values[1]],
            remaining: [...gameState.dice.remaining]
          } : null,
          phase: gameState.phase,
          winner: gameState.winner,
          winType: gameState.winType,
          cube: { ...gameState.cube },
          match: { ...gameState.match }
        }
      };
      await saveGame(saveData);
      gameState = cloneGameState(gameState);
      gameState.lastSaveTime = saveData.timestamp;
    } catch (e) {
      console.error("[Save] Auto-save failed:", e);
    }
  }
  function loadSavedGame() {
    if (!savedData) {
      startupPhase = "playing";
      gameState = startNewGame();
      autoSave();
      render();
      return;
    }
    try {
      const gs = savedData.gameState;
      const restored = {
        board: gs.board.map((p) => ({ owner: p.owner, count: p.count })),
        whiteBorneOff: gs.whiteBorneOff,
        blackBorneOff: gs.blackBorneOff,
        currentPlayer: gs.currentPlayer,
        dice: gs.dice ? {
          values: [gs.dice.values[0], gs.dice.values[1]],
          remaining: [...gs.dice.remaining]
        } : null,
        phase: gs.phase,
        selectedPoint: null,
        validMoves: [],
        legalSequences: [],
        winner: gs.winner,
        winType: gs.winType ?? null,
        lastSaveTime: savedData.timestamp,
        errorMessage: null,
        initialRoll: null,
        cube: gs.cube ? { ...gs.cube } : { value: 1, owner: null },
        match: gs.match ? { ...gs.match } : {
          targetScore: 5,
          whiteScore: 0,
          blackScore: 0,
          isCrawford: false,
          postCrawford: false,
          matchOver: false,
          matchWinner: null
        }
      };
      gameState = restoreFromSave(restored);
      startupPhase = "playing";
      render();
      if (gameState.currentPlayer === "black" && (gameState.phase === "waitingForRoll" || gameState.phase === "aiThinking")) {
        scheduleAITurn();
      }
    } catch (e) {
      console.error("[Save] Failed to restore saved game:", e);
      startupPhase = "playing";
      gameState = startNewGame();
      setError(t().errRestoreFailed);
      autoSave();
      render();
    }
  }
  function render() {
    if (!renderer || !ctx) return;
    try {
      if (startupPhase === "loading") {
        renderLoadingScreen();
        return;
      }
      if (startupPhase === "promptRestore") {
        renderStartupPrompt();
        return;
      }
      renderer.render(gameState);
      if (gameState.selectedPoint !== null) {
        renderer.renderValidTargets(gameState);
      }
      inputController.setState(gameState);
      const layout = renderer.getLayout();
      if (layout) {
        renderButtons(ctx, inputController.getButtons(), gameState, layout.fontScale);
      }
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const fs = layout?.fontScale ?? 1;
      if (confirmingNewGame) {
        confirmButtons = renderNewGameConfirm(ctx, w, h, fs);
      } else if (confirmingClearSave) {
        confirmButtons = renderClearSaveConfirm(ctx, w, h, fs);
      } else if (showingDoubleOffer || gameState.phase === "playerDecidingDouble") {
        confirmButtons = renderDoubleOfferPrompt(ctx, w, h, fs, gameState.cube.value * 2);
      } else {
        confirmButtons = null;
      }
    } catch (e) {
      console.error("[Render] Error during render:", e);
    }
  }
  function renderLoadingScreen() {
    ctx.fillStyle = "#0d1b0f";
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    ctx.font = "20px sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText("Loading...", canvas.clientWidth / 2, canvas.clientHeight / 2);
    ctx.textAlign = "left";
  }
  function renderStartupPrompt() {
    if (!savedData) return;
    renderer.render(gameState);
    const layout = renderer.getLayout();
    const fontScale = layout?.fontScale ?? 1;
    const result = renderRestorePrompt(
      ctx,
      canvas.clientWidth,
      canvas.clientHeight,
      savedData.timestamp,
      fontScale
    );
    restoreButtons = result;
    canvas.onclick = null;
  }
  function setError(msg) {
    if (errorClearTimeout) clearTimeout(errorClearTimeout);
    gameState = cloneGameState(gameState);
    gameState.errorMessage = msg;
    errorClearTimeout = setTimeout(() => {
      gameState = cloneGameState(gameState);
      gameState.errorMessage = null;
      render();
    }, 2500);
  }
  function handleStartupClick(x, y) {
    if (startupPhase !== "promptRestore" || !restoreButtons) return;
    const { continueBtn, newGameBtn } = restoreButtons;
    if (x >= continueBtn.x && x <= continueBtn.x + continueBtn.w && y >= continueBtn.y && y <= continueBtn.y + continueBtn.h) {
      loadSavedGame();
      return;
    }
    if (x >= newGameBtn.x && x <= newGameBtn.x + newGameBtn.w && y >= newGameBtn.y && y <= newGameBtn.y + newGameBtn.h) {
      startupPhase = "playing";
      gameState = startNewGame();
      autoSave();
      render();
      return;
    }
  }
  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  function startAnimLoop() {
    if (rafId !== null) return;
    function loop() {
      render();
      if (renderer?.isAnimating()) {
        rafId = requestAnimationFrame(loop);
      } else {
        rafId = null;
        render();
      }
    }
    rafId = requestAnimationFrame(loop);
  }
  function handleConfirmClick(x, y) {
    if (suppressConfirmHandling) return false;
    if (!confirmButtons) return false;
    const { yesBtn, noBtn } = confirmButtons;
    if (x >= yesBtn.x && x <= yesBtn.x + yesBtn.w && y >= yesBtn.y && y <= yesBtn.y + yesBtn.h) {
      handleAction(yesBtn.action);
      return true;
    }
    if (x >= noBtn.x && x <= noBtn.x + noBtn.w && y >= noBtn.y && y <= noBtn.y + noBtn.h) {
      handleAction(noBtn.action);
      return true;
    }
    handleAction(noBtn.action);
    return true;
  }
  function setupStartupClickInterceptor() {
    canvas.addEventListener("mousedown", (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (confirmingNewGame || confirmingClearSave) {
        handleConfirmClick(x, y);
        return;
      }
      if (startupPhase === "promptRestore") handleStartupClick(x, y);
    });
    canvas.addEventListener("touchstart", (e) => {
      if (e.touches.length === 0) return;
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const x = e.touches[0].clientX - rect.left;
      const y = e.touches[0].clientY - rect.top;
      if (confirmingNewGame || confirmingClearSave) {
        handleConfirmClick(x, y);
        return;
      }
      if (startupPhase === "promptRestore") handleStartupClick(x, y);
    }, { passive: false });
  }
  document.addEventListener("DOMContentLoaded", async () => {
    try {
      await init();
      setupStartupClickInterceptor();
      onLangChange(() => {
        const layout = renderer.getLayout();
        if (layout) {
          inputController.updateLayout(layout.boardX + layout.boardW + (layout.bearOffW || 0) * 2, layout.hudY + layout.hudH);
        }
        const vv = window.visualViewport;
        const w = vv ? Math.round(vv.width) : window.innerWidth;
        const h = vv ? Math.round(vv.height) : window.innerHeight;
        inputController.updateLayout(w, h);
        render();
      });
    } catch (e) {
      console.error("[App] Fatal initialization error:", e);
      document.body.innerHTML = `
      <div style="color:white;padding:20px;background:#1a1a2e;height:100vh;display:flex;align-items:center;justify-content:center;">
        <div>
          <h2 style="color:#ff6b6b">Failed to start game</h2>
          <p>${e instanceof Error ? e.message : String(e)}</p>
          <button onclick="location.reload()" style="margin-top:20px;padding:10px 20px;cursor:pointer">Reload</button>
        </div>
      </div>
    `;
    }
  });
})();
//# sourceMappingURL=main.js.map
