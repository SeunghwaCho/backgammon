// main.ts: Application entry point
// Wires together all modules: game logic, rendering, input, AI, persistence

import { GameState, Move, Player, SaveData } from './game/Types.js';
import { cloneGameState } from './game/GameState.js';
import {
  rollDice as reducerRollDice,
  rollForFirst as reducerRollForFirst,
  selectPoint as reducerSelectPoint,
  applyPlayerMove,
  applyMoveInternal,
  startNewGame,
  restoreFromSave,
} from './game/Reducer.js';
import { chooseBestSequence } from './ai/BackgammonAI.js';
import { CanvasRenderer } from './render/CanvasRenderer.js';
import { InputController, InputAction, ButtonArea } from './input/InputController.js';
import { renderButtons, renderRestorePrompt, renderNewGameConfirm, renderClearSaveConfirm, ConfirmButtons } from './ui/HUD.js';
import { saveGame, loadGame, deleteSave } from './persistence/IndexedDbStore.js';
import {
  validateSaveData,
  SCHEMA_VERSION,
  APP_VERSION,
} from './persistence/SaveValidation.js';
import { rollTwoDice } from './utils/random.js';
import { toggleLang, onLangChange, t } from './i18n/Locale.js';
import { ANIM_MOVE_MS } from './render/AnimationSystem.js';

// ─── App State ────────────────────────────────────────────────────────────────

let gameState: GameState = startNewGame();
let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let renderer: CanvasRenderer;
let inputController: InputController;
let aiInProgress = false;

// Startup prompt state
type StartupPhase = 'loading' | 'promptRestore' | 'playing';
let startupPhase: StartupPhase = 'loading';
let savedData: SaveData | null = null;
let restoreButtons: { continueBtn: ButtonArea; newGameBtn: ButtonArea } | null = null;

// Confirmation overlays
let confirmingNewGame = false;
let confirmingClearSave = false;
let confirmButtons: ConfirmButtons | null = null;
// Suppress confirm-click handling for the same event that opened the dialog.
// The button click that opens the dialog and the interceptor both fire on the
// same mousedown/touchstart event; without this guard the dialog opens and
// immediately closes because the interceptor sees "tap outside".
let suppressConfirmHandling = false;

// Error display timeout
let errorClearTimeout: ReturnType<typeof setTimeout> | null = null;

// requestAnimationFrame loop (runs while animations are active)
let rafId: number | null = null;

// ─── Initialization ───────────────────────────────────────────────────────────

async function init(): Promise<void> {
  canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('Cannot find canvas element');
    return;
  }

  const context = canvas.getContext('2d');
  if (!context) {
    console.error('Cannot get 2D context from canvas');
    document.body.innerHTML =
      '<div style="color:red;padding:20px">Cannot initialize canvas rendering context.</div>';
    return;
  }
  ctx = context;

  renderer = new CanvasRenderer(ctx);

  // Setup resize handler
  const container = document.getElementById('game-container')!;

  function resizeCanvas(): void {
    // visualViewport gives the actual visible area on mobile browsers,
    // correctly excluding the address bar and navigation bar on Galaxy Fold.
    // Falls back to window.innerWidth/Height, then container client size.
    const vv = window.visualViewport;
    const w = vv ? Math.round(vv.width) : (window.innerWidth || container.clientWidth);
    const h = vv ? Math.round(vv.height) : (window.innerHeight || container.clientHeight);
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    // Position canvas to match visualViewport offset (handles address bar shrink)
    canvas.style.left = (vv ? vv.offsetLeft : 0) + 'px';
    canvas.style.top = (vv ? vv.offsetTop : 0) + 'px';

    // Reset transform and scale for DPR
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    renderer.setSize(w, h);
    inputController?.updateLayout(w, h);
    render();
  }

  // visualViewport resize: fires when address bar shows/hides or fold/unfold
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', resizeCanvas);
    window.visualViewport.addEventListener('scroll', resizeCanvas);
  }

  // Use ResizeObserver for Galaxy Fold 7 fold/unfold events
  const ro = new ResizeObserver(() => {
    resizeCanvas();
  });
  ro.observe(container);

  // Also listen for window resize as fallback
  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('orientationchange', () => {
    setTimeout(resizeCanvas, 150); // slight delay for orientation change
  });

  // Setup input controller
  inputController = new InputController(canvas, renderer, handleAction);

  // Initial resize
  resizeCanvas();

  // Try to load saved game
  await tryLoadSavedGame();
}

async function tryLoadSavedGame(): Promise<void> {
  try {
    savedData = await loadGame();
  } catch (e) {
    console.error('[Save] Failed to load save data:', e);
    savedData = null;
  }

  if (savedData !== null) {
    // Validate the data
    const validation = validateSaveData(savedData);
    if (!validation.valid) {
      console.warn('[Save] Save data invalid, discarding:', validation.errors);
      savedData = null;
      try {
        await deleteSave();
      } catch (e) {
        console.error('[Save] Failed to delete invalid save:', e);
      }
    }
  }

  if (savedData !== null) {
    // Show restore prompt
    startupPhase = 'promptRestore';
    render();
  } else {
    // Start fresh — game begins in rollingForFirst, no AI scheduling needed
    startupPhase = 'playing';
    gameState = startNewGame();
    autoSave();
    render();
  }
}

// ─── Action Handler ───────────────────────────────────────────────────────────

function handleAction(action: InputAction): void {
  // ── Confirmation overlay intercepts all actions ────────────────────────────
  if (confirmingNewGame) {
    if (action.type === 'confirmNewGame') {
      confirmingNewGame = false;
      confirmButtons = null;
      handleNewGame();
    } else if (action.type === 'cancelNewGame') {
      confirmingNewGame = false;
      confirmButtons = null;
      render();
    }
    // Block every other action while the dialog is open
    return;
  }

  if (confirmingClearSave) {
    if (action.type === 'confirmClearSave') {
      confirmingClearSave = false;
      confirmButtons = null;
      handleClearSave();
    } else if (action.type === 'cancelClearSave') {
      confirmingClearSave = false;
      confirmButtons = null;
      render();
    }
    // Block every other action while the dialog is open
    return;
  }

  // ── Startup restore prompt ─────────────────────────────────────────────────
  if (startupPhase === 'promptRestore') {
    if (action.type === 'continueGame') {
      loadSavedGame();
      return;
    } else if (action.type === 'newGame') {
      // Even from the restore prompt, ask for confirmation
      startupPhase = 'playing';
      confirmingNewGame = true;
      render();
      return;
    }
    return;
  }

  if (startupPhase !== 'playing') return;

  switch (action.type) {
    case 'rollDice':
      if (gameState.phase === 'rollingForFirst') {
        handleRollForFirst();
      } else {
        handleRollDice();
      }
      break;

    case 'selectPoint':
      handleSelectPoint(action.pointIndex);
      break;

    case 'makeMove':
      handleMakeMove(action.move);
      break;

    case 'newGame':
      // Show confirmation dialog instead of acting immediately.
      // Suppress the interceptor for the current event so it doesn't
      // immediately dismiss the dialog as an "outside tap".
      confirmingNewGame = true;
      suppressConfirmHandling = true;
      setTimeout(() => { suppressConfirmHandling = false; }, 0);
      render();
      break;

    case 'clearSave':
      confirmingClearSave = true;
      suppressConfirmHandling = true;
      setTimeout(() => { suppressConfirmHandling = false; }, 0);
      render();
      break;

    case 'continueGame':
      loadSavedGame();
      break;

    case 'toggleLang':
      toggleLang();
      break;
  }
}

function handleRollForFirst(): void {
  if (gameState.phase !== 'rollingForFirst') return;

  const [wRoll, bRoll] = rollTwoDice();
  gameState = reducerRollForFirst(gameState, wRoll, bRoll);
  render();

  if (wRoll !== bRoll) {
    // Winner determined — show result briefly, then transition to actual play
    setTimeout(() => {
      gameState = cloneGameState(gameState);
      gameState.phase = 'waitingForRoll';
      gameState.initialRoll = null;
      autoSave();
      render();
      if (gameState.currentPlayer === 'black') {
        scheduleAITurn();
      }
    }, 1500);
  }
  // Tie: phase stays rollingForFirst; user clicks Roll again to re-roll
}

function handleRollDice(): void {
  if (gameState.phase !== 'waitingForRoll') return;
  if (gameState.currentPlayer !== 'white') return; // Only player can click roll

  const [d1, d2] = rollTwoDice();
  gameState = reducerRollDice(gameState, d1, d2);

  autoSave();
  render();

  // If no moves were available, the state already switched to AI's turn or next roll
  // Check if it ended up in a state needing AI
  if (gameState.phase === 'waitingForRoll' && gameState.currentPlayer === 'black') {
    scheduleAITurn();
  }
}

function handleSelectPoint(pointIndex: number): void {
  if (gameState.phase !== 'playerActing') return;

  // -1 = white bear-off area, 26 = black bear-off area
  // These are only valid as destinations, not sources
  if (pointIndex === -1 || pointIndex === 26) {
    if (gameState.selectedPoint !== null) {
      // Check if we have a bear-off move from the selected point
      const bearOffMove = gameState.validMoves.find(
        m => m.to === pointIndex
      );
      if (bearOffMove) {
        handleMakeMove(bearOffMove);
        return;
      }
      // Also try any bear-off move regardless of exact value
      const anyBearOff = gameState.validMoves.find(
        m => m.to === -1 || m.to === 26
      );
      if (anyBearOff) {
        handleMakeMove(anyBearOff);
        return;
      }
    }
    return;
  }

  // Check if clicking on a valid move destination (with a piece already selected)
  if (gameState.selectedPoint !== null) {
    const moveMatch = gameState.validMoves.find(m => m.to === pointIndex);
    if (moveMatch) {
      handleMakeMove(moveMatch);
      return;
    }
  }

  // Try to select as a source
  const processed = inputController.processPointClick(pointIndex, gameState);
  if (processed) {
    if (processed.type === 'selectPoint') {
      if (processed.pointIndex === -1) {
        gameState = cloneGameState(gameState);
        gameState.selectedPoint = null;
        gameState.validMoves = [];
      } else {
        gameState = reducerSelectPoint(gameState, processed.pointIndex);
      }
    } else if (processed.type === 'makeMove') {
      handleMakeMove(processed.move);
      return;
    }
  } else {
    // Invalid click
    setError(t().errCannotMove);
  }

  render();
}

function handleMakeMove(move: Move): void {
  if (gameState.phase !== 'playerActing') return;

  const prevState = gameState;
  gameState = applyPlayerMove(gameState, move);

  if (gameState === prevState) {
    // Move was rejected
    setError(t().errInvalidMove);
    render();
    return;
  }

  autoSave();

  // Hit effect when the human player captures an AI checker:
  // burst + captured piece flying to bar
  if (move.isHit) {
    const captured: Player = gameState.currentPlayer === 'white' ? 'black' : 'white';
    renderer.queueHitBurst(move.to, captured);
    startAnimLoop();
  }

  render();

  // Check if the turn is over (no more dice or legal moves)
  if (
    gameState.phase === 'waitingForRoll' &&
    gameState.currentPlayer === 'black'
  ) {
    scheduleAITurn();
  } else if (gameState.phase === 'gameOver') {
    autoSave();
    render();
  }
}

function handleNewGame(): void {
  if (aiInProgress) {
    aiInProgress = false; // Cancel AI turn
  }
  gameState = startNewGame(); // starts in rollingForFirst phase
  autoSave();
  render();
  // No AI scheduling here — first player is determined by initial roll
}

async function handleClearSave(): Promise<void> {
  try {
    await deleteSave();
    setError(t().msgSaveCleared);
  } catch (e) {
    console.error('[Save] Failed to clear save:', e);
    setError(t().errClearFailed);
  }
  render();
}

// ─── AI Turn ──────────────────────────────────────────────────────────────────

function scheduleAITurn(): void {
  if (aiInProgress) return;
  aiInProgress = true;
  setTimeout(() => runAITurn(), 400);
}

async function runAITurn(): Promise<void> {
  if (!aiInProgress) return;
  if (gameState.currentPlayer !== 'black') {
    aiInProgress = false;
    return;
  }
  if (gameState.phase === 'gameOver') {
    aiInProgress = false;
    return;
  }

  // Roll dice for AI
  if (gameState.phase === 'waitingForRoll') {
    const [d1, d2] = rollTwoDice();
    gameState = reducerRollDice(gameState, d1, d2);
    autoSave();
    render();
    await delay(300);

    // If no legal moves, already ended turn
    if (gameState.phase === 'waitingForRoll') {
      aiInProgress = false;
      render();
      return;
    }
  }

  if (gameState.phase !== 'aiThinking') {
    aiInProgress = false;
    render();
    return;
  }

  // Execute best sequence move by move
  while (gameState.phase === 'aiThinking' && aiInProgress) {
    const bestSeq = chooseBestSequence(gameState);

    if (!bestSeq || bestSeq.length === 0) {
      // No more moves
      break;
    }

    const move = bestSeq[0];

    // Queue animation before applying the state change so source coords are valid.
    // Returns the recommended delay that covers the full sequence (including
    // captured-piece flight when isHit is true).
    const moveDelay = renderer.queueMoveAnim(
      move.from, move.to, gameState.currentPlayer, move.isHit
    );

    gameState = applyMoveInternal(gameState, move);
    autoSave();

    // Start (or keep) the rAF loop which re-renders each frame during animation
    startAnimLoop();

    if (gameState.phase === 'gameOver') {
      aiInProgress = false;
      return;
    }

    // Wait long enough for the full animation sequence to finish
    await delay(moveDelay);
  }

  // AI turn complete
  aiInProgress = false;
  autoSave();
  render();
}

// ─── Persistence ──────────────────────────────────────────────────────────────

async function autoSave(): Promise<void> {
  try {
    const saveData: SaveData = {
      schemaVersion: SCHEMA_VERSION,
      appVersion: APP_VERSION,
      timestamp: Date.now(),
      gameState: {
        board: gameState.board.map(p => ({ owner: p.owner, count: p.count })),
        whiteBorneOff: gameState.whiteBorneOff,
        blackBorneOff: gameState.blackBorneOff,
        currentPlayer: gameState.currentPlayer,
        dice: gameState.dice
          ? {
              values: [gameState.dice.values[0], gameState.dice.values[1]],
              remaining: [...gameState.dice.remaining],
            }
          : null,
        phase: gameState.phase,
        winner: gameState.winner,
      },
    };
    await saveGame(saveData);
    gameState = cloneGameState(gameState);
    gameState.lastSaveTime = saveData.timestamp;
  } catch (e) {
    console.error('[Save] Auto-save failed:', e);
    // Don't crash - just log the error
  }
}

function loadSavedGame(): void {
  if (!savedData) {
    startupPhase = 'playing';
    gameState = startNewGame();
    autoSave();
    render();
    return;
  }

  try {
    const gs = savedData.gameState;

    // Reconstruct GameState from serialized data
    const restored: GameState = {
      board: gs.board.map(p => ({ owner: p.owner, count: p.count })),
      whiteBorneOff: gs.whiteBorneOff,
      blackBorneOff: gs.blackBorneOff,
      currentPlayer: gs.currentPlayer,
      dice: gs.dice
        ? {
            values: [gs.dice.values[0], gs.dice.values[1]],
            remaining: [...gs.dice.remaining],
          }
        : null,
      phase: gs.phase,
      selectedPoint: null,
      validMoves: [],
      legalSequences: [],
      winner: gs.winner,
      lastSaveTime: savedData.timestamp,
      errorMessage: null,
      initialRoll: null,
    };

    // Restore using reducer (re-generates legal sequences)
    gameState = restoreFromSave(restored);
    startupPhase = 'playing';
    render();

    // If it's AI's turn after restore, schedule AI
    if (
      gameState.currentPlayer === 'black' &&
      (gameState.phase === 'waitingForRoll' || gameState.phase === 'aiThinking')
    ) {
      scheduleAITurn();
    }
  } catch (e) {
    console.error('[Save] Failed to restore saved game:', e);
    // Safe fallback: start new game
    startupPhase = 'playing';
    gameState = startNewGame();
    setError(t().errRestoreFailed);
    autoSave();
    render();
  }
}

// ─── Rendering ────────────────────────────────────────────────────────────────

function render(): void {
  if (!renderer || !ctx) return;

  try {
    if (startupPhase === 'loading') {
      renderLoadingScreen();
      return;
    }

    if (startupPhase === 'promptRestore') {
      renderStartupPrompt();
      return;
    }

    // Main game render
    renderer.render(gameState);

    // Render valid target overlays
    if (gameState.selectedPoint !== null) {
      renderer.renderValidTargets(gameState);
    }

    // Render HUD buttons
    const layout = renderer.getLayout();
    if (layout) {
      renderButtons(ctx, inputController.getButtons(), gameState, layout.fontScale);
    }

    // Render confirmation overlays (on top of everything)
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const fs = layout?.fontScale ?? 1;
    if (confirmingNewGame) {
      confirmButtons = renderNewGameConfirm(ctx, w, h, fs);
    } else if (confirmingClearSave) {
      confirmButtons = renderClearSaveConfirm(ctx, w, h, fs);
    } else {
      confirmButtons = null;
    }
  } catch (e) {
    console.error('[Render] Error during render:', e);
  }
}

function renderLoadingScreen(): void {
  ctx.fillStyle = '#0d1b0f';
  ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  ctx.font = '20px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText('Loading...', canvas.clientWidth / 2, canvas.clientHeight / 2);
  ctx.textAlign = 'left';
}

function renderStartupPrompt(): void {
  if (!savedData) return;

  // Render background game board
  renderer.render(gameState);

  const layout = renderer.getLayout();
  const fontScale = layout?.fontScale ?? 1;

  // Render restore prompt overlay
  const result = renderRestorePrompt(
    ctx,
    canvas.clientWidth,
    canvas.clientHeight,
    savedData.timestamp,
    fontScale
  );
  restoreButtons = result;

  // Override action handler for prompt buttons
  canvas.onclick = null;
}

// ─── Error Display ────────────────────────────────────────────────────────────

function setError(msg: string): void {
  if (errorClearTimeout) clearTimeout(errorClearTimeout);
  gameState = cloneGameState(gameState);
  gameState.errorMessage = msg;
  errorClearTimeout = setTimeout(() => {
    gameState = cloneGameState(gameState);
    gameState.errorMessage = null;
    render();
  }, 2500);
}

// ─── Touch/Mouse for Startup Prompt ──────────────────────────────────────────

// Override input for startup prompt clicks
function handleStartupClick(x: number, y: number): void {
  if (startupPhase !== 'promptRestore' || !restoreButtons) return;

  const { continueBtn, newGameBtn } = restoreButtons;

  if (
    x >= continueBtn.x && x <= continueBtn.x + continueBtn.w &&
    y >= continueBtn.y && y <= continueBtn.y + continueBtn.h
  ) {
    loadSavedGame();
    return;
  }

  if (
    x >= newGameBtn.x && x <= newGameBtn.x + newGameBtn.w &&
    y >= newGameBtn.y && y <= newGameBtn.y + newGameBtn.h
  ) {
    startupPhase = 'playing';
    gameState = startNewGame(); // starts in rollingForFirst
    autoSave();
    render();
    return;
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Start a requestAnimationFrame render loop that keeps going as long as
 * renderer.isAnimating() returns true.  Safe to call when a loop is already
 * running — it's a no-op in that case.
 */
function startAnimLoop(): void {
  if (rafId !== null) return; // already running
  function loop(): void {
    render();
    if (renderer?.isAnimating()) {
      rafId = requestAnimationFrame(loop);
    } else {
      rafId = null;
    }
  }
  rafId = requestAnimationFrame(loop);
}

// ─── Canvas Click Intercept for Startup ───────────────────────────────────────

function handleConfirmClick(x: number, y: number): boolean {
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
  // Tap outside = cancel
  handleAction(noBtn.action);
  return true;
}

function setupStartupClickInterceptor(): void {
  canvas.addEventListener('mousedown', (e: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (confirmingNewGame || confirmingClearSave) { handleConfirmClick(x, y); return; }
    if (startupPhase === 'promptRestore') handleStartupClick(x, y);
  });

  canvas.addEventListener('touchstart', (e: TouchEvent) => {
    if (e.touches.length === 0) return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const x = e.touches[0].clientX - rect.left;
    const y = e.touches[0].clientY - rect.top;
    if (confirmingNewGame || confirmingClearSave) { handleConfirmClick(x, y); return; }
    if (startupPhase === 'promptRestore') handleStartupClick(x, y);
  }, { passive: false });
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await init();
    setupStartupClickInterceptor();

    // When language changes: rebuild button labels and re-render immediately.
    onLangChange(() => {
      const layout = renderer.getLayout();
      if (layout) {
        inputController.updateLayout(layout.boardX + layout.boardW + (layout.bearOffW || 0) * 2, layout.hudY + layout.hudH);
      }
      // Simpler: just use current canvas logical size stored by resizeCanvas
      const vv = window.visualViewport;
      const w = vv ? Math.round(vv.width) : window.innerWidth;
      const h = vv ? Math.round(vv.height) : window.innerHeight;
      inputController.updateLayout(w, h);
      render();
    });
  } catch (e) {
    console.error('[App] Fatal initialization error:', e);
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
