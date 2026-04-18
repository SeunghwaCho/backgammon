// InputController: handles mouse and touch events, maps them to game actions

import { GameState, Move } from '../game/Types.js';
import { CanvasRenderer } from '../render/CanvasRenderer.js';
import { getSelectablePoints } from '../game/MoveGenerator.js';
import { canOfferDouble } from '../game/Reducer.js';
import { t } from '../i18n/Locale.js';
import { audioSystem } from '../utils/AudioSystem.js';

export type InputAction =
  | { type: 'rollDice' }
  | { type: 'selectPoint'; pointIndex: number }
  | { type: 'makeMove'; move: Move }
  | { type: 'newGame' }           // request — shows confirmation dialog
  | { type: 'confirmNewGame' }    // user pressed Yes
  | { type: 'cancelNewGame' }     // user pressed No
  | { type: 'clearSave' }         // request — shows confirmation dialog
  | { type: 'confirmClearSave' }  // user pressed Yes
  | { type: 'cancelClearSave' }   // user pressed No
  | { type: 'continueGame' }
  | { type: 'toggleLang' }
  | { type: 'toggleSound' }
  | { type: 'offerDouble' }       // player offers to double
  | { type: 'acceptDouble' }      // player accepts AI's double
  | { type: 'declineDouble' }     // player declines AI's double
  | { type: 'nextGame' };         // start next game in match

export interface ButtonArea {
  x: number;
  y: number;
  w: number;
  h: number;
  action: InputAction;
  label: string;   // full label (fallback)
  emoji: string;   // rendered large
  text: string;    // rendered small below emoji
  visible: (state: GameState) => boolean;
}

export class InputController {
  private canvas: HTMLCanvasElement;
  private renderer: CanvasRenderer;
  private onAction: (action: InputAction) => void;
  private onUiChange: () => void;
  private buttons: ButtonArea[] = [];
  private currentState: GameState | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    renderer: CanvasRenderer,
    onAction: (action: InputAction) => void,
    onUiChange: () => void
  ) {
    this.canvas = canvas;
    this.renderer = renderer;
    this.onAction = onAction;
    this.onUiChange = onUiChange;

    this.setupEventListeners();
    this.setupButtons();
  }

  /** Called before each render so click handlers can check button visibility. */
  setState(state: GameState): void {
    this.currentState = state;
  }

  private setupEventListeners(): void {
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.canvas.addEventListener('mouseleave', this.handleMouseLeave.bind(this));
    this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), {
      passive: false,
    });
    // Touch end for drag-like interactions (future use)
    this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this), {
      passive: false,
    });
  }

  private setupButtons(): void {
    // Buttons are positioned in HUD area; positions updated on resize
    // We'll define them by role and compute position in updateButtonLayout
  }

  // Update button layout based on current canvas/HUD dimensions
  updateLayout(canvasW: number, _canvasH: number): void {
    const layout = this.renderer.getLayout();
    if (!layout) return;

    const btnAreaY = layout.btnAreaY;
    const btnAreaH = layout.btnAreaH;
    // Button height: fill most of the button row.
    const btnH = Math.max(46, Math.min(54, btnAreaH * 0.90));
    const btnY = btnAreaY + (btnAreaH - btnH) / 2;

    const margin = 6;

    const loc = t();

    const soundEmoji = audioSystem.muted ? '🔇' : '🔊';
    const soundText  = audioSystem.muted ? loc.btnSoundOffText : loc.btnSoundOnText;

    // ── Roll Dice button: overlaid on the board center (same area as the dice) ──
    // Wider/taller than HUD buttons so it's easy to click in the middle of the board.
    const rollBtnW = Math.min(180, canvasW * 0.26);
    const rollBtnH = Math.min(90, layout.boardH * 0.28);
    const rollBtnCX = layout.isPortrait
      ? layout.boardX + layout.boardW / 2
      : layout.boardX + layout.boardW * 0.625;   // right of center (mirrors dice placement)
    const rollBtnCY = layout.boardY + layout.boardH / 2 - rollBtnH / 2 - 12;

    const rollBtn: ButtonArea = {
      x: rollBtnCX - rollBtnW / 2,
      y: rollBtnCY - rollBtnH / 2,
      w: rollBtnW,
      h: rollBtnH,
      action: { type: 'rollDice' },
      label: loc.btnRoll,
      emoji: loc.btnRollEmoji,
      text: loc.btnRollText,
      visible: (s) => (s.phase === 'waitingForRoll' && s.currentPlayer === 'white') || s.phase === 'rollingForFirst',
    };

    const doubleBtnW = Math.min(80, canvasW * 0.12);
    const doubleBtnH = Math.min(52, layout.boardH * 0.17);
    const doubleBtn: ButtonArea = {
      x: rollBtnCX - rollBtnW / 2 - doubleBtnW - 8,
      y: rollBtnCY - doubleBtnH / 2,
      w: doubleBtnW,
      h: doubleBtnH,
      action: { type: 'offerDouble' },
      label: loc.btnDoubleText,
      emoji: loc.btnDoubleEmoji,
      text: loc.btnDoubleText,
      visible: (s) => canOfferDouble(s) && s.currentPlayer === 'white',
    };

    const nextGameBtnW = Math.min(160, canvasW * 0.22);
    const nextGameBtnH = Math.min(52, layout.boardH * 0.17);
    const nextGameBtn: ButtonArea = {
      x: layout.boardX + layout.boardW / 2 - nextGameBtnW / 2,
      y: layout.boardY + layout.boardH / 2 + 30,
      w: nextGameBtnW,
      h: nextGameBtnH,
      action: { type: 'nextGame' },
      label: loc.nextGameBtn,
      emoji: '▶',
      text: loc.nextGameBtn,
      visible: (s) => s.phase === 'gameOver' && !s.match.matchOver,
    };

    if (layout.isPortrait) {
      // Portrait: 4 equal buttons across full width (roll moved to board center)
      const totalMargin = margin * 5;
      const btnW = Math.floor((canvasW - totalMargin) / 4);
      this.buttons = [
        rollBtn, doubleBtn, nextGameBtn,
        {
          x: margin,
          y: btnY,
          w: btnW,
          h: btnH,
          action: { type: 'newGame' },
          label: loc.btnNewGame,
          emoji: loc.btnNewGameEmoji,
          text: loc.btnNewGameText,
          visible: (_: GameState) => true,
        },
        {
          x: margin * 2 + btnW,
          y: btnY,
          w: btnW,
          h: btnH,
          action: { type: 'clearSave' },
          label: loc.btnClearSave,
          emoji: loc.btnClearSaveEmoji,
          text: loc.btnClearSaveText,
          visible: (_: GameState) => true,
        },
        {
          x: margin * 3 + btnW * 2,
          y: btnY,
          w: btnW,
          h: btnH,
          action: { type: 'toggleSound' },
          label: soundEmoji,
          emoji: soundEmoji,
          text: soundText,
          visible: (_: GameState) => true,
        },
        {
          x: margin * 4 + btnW * 3,
          y: btnY,
          w: btnW,
          h: btnH,
          action: { type: 'toggleLang' },
          label: loc.btnLang,
          emoji: loc.btnLangEmoji,
          text: loc.btnLangText,
          visible: (_: GameState) => true,
        },
      ];
    } else {
      // Landscape: 4 HUD buttons on the right (roll moved to board center)
      const btnW   = Math.min(88, canvasW * 0.14);
      const smallW = Math.min(72, canvasW * 0.1);
      const rightEdge = canvasW - margin;
      this.buttons = [
        rollBtn, doubleBtn, nextGameBtn,
        {
          x: rightEdge - btnW * 2 - smallW * 2 - margin * 3,
          y: btnY,
          w: btnW,
          h: btnH,
          action: { type: 'newGame' },
          label: loc.btnNewGame,
          emoji: loc.btnNewGameEmoji,
          text: loc.btnNewGameText,
          visible: (_: GameState) => true,
        },
        {
          x: rightEdge - btnW - smallW * 2 - margin * 2,
          y: btnY,
          w: btnW,
          h: btnH,
          action: { type: 'clearSave' },
          label: loc.btnClearSave,
          emoji: loc.btnClearSaveEmoji,
          text: loc.btnClearSaveText,
          visible: (_: GameState) => true,
        },
        {
          x: rightEdge - smallW * 2 - margin,
          y: btnY,
          w: smallW,
          h: btnH,
          action: { type: 'toggleSound' },
          label: soundEmoji,
          emoji: soundEmoji,
          text: soundText,
          visible: (_: GameState) => true,
        },
        {
          x: rightEdge - smallW,
          y: btnY,
          w: smallW,
          h: btnH,
          action: { type: 'toggleLang' },
          label: loc.btnLang,
          emoji: loc.btnLangEmoji,
          text: loc.btnLangText,
          visible: (_: GameState) => true,
        },
      ];
    }
  }

  getButtons(): ButtonArea[] {
    return this.buttons;
  }

  private getCanvasCoords(e: MouseEvent | Touch): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  private handleMouseDown(e: MouseEvent): void {
    e.preventDefault();
    const { x, y } = this.getCanvasCoords(e);
    this.handleClick(x, y);
  }

  private handleMouseMove(e: MouseEvent): void {
    const { x, y } = this.getCanvasCoords(e);
    const hovered = this.renderer.isPointInDoublingCube(x, y);
    if (this.renderer.setCubeTooltipHovered(hovered)) {
      this.onUiChange();
    }
  }

  private handleMouseLeave(): void {
    if (this.renderer.setCubeTooltipHovered(false)) {
      this.onUiChange();
    }
  }

  private handleTouchStart(e: TouchEvent): void {
    e.preventDefault();
    if (e.touches.length > 0) {
      const { x, y } = this.getCanvasCoords(e.touches[0]);
      this.handleClick(x, y);
    }
  }

  private handleTouchEnd(e: TouchEvent): void {
    e.preventDefault();
    // Already handled on touchstart
  }

  private handleClick(x: number, y: number): void {
    if (this.renderer.isPointInDoublingCube(x, y)) {
      this.renderer.toggleCubeTooltipPinned();
      this.onUiChange();
      return;
    }

    const hidTooltip = this.renderer.hideCubeTooltip();

    // Check button clicks first; only fire if currently visible
    for (const btn of this.buttons) {
      if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
        if (this.currentState && !btn.visible(this.currentState)) continue;
        if (hidTooltip) this.onUiChange();
        audioSystem.playButtonClick();
        this.onAction(btn.action);
        return;
      }
    }

    // Board clicks - need state from outside; emit a raw coordinate event
    // We'll handle this via the point hit test
    const pointIndex = this.renderer.hitTest(x, y);
    if (pointIndex !== null) {
      if (hidTooltip) this.onUiChange();
      this.onAction({ type: 'selectPoint', pointIndex });
      return;
    }

    if (hidTooltip) this.onUiChange();
  }

  // Called by main.ts with current state to process a point selection
  processPointClick(
    pointIndex: number,
    state: GameState
  ): InputAction | null {
    if (state.phase !== 'playerActing') return null;


    // If clicking the same selected point, deselect
    if (state.selectedPoint === pointIndex) {
      return { type: 'selectPoint', pointIndex: -1 }; // deselect
    }

    // If a point is already selected, check if this is a valid destination
    if (state.selectedPoint !== null) {
      const validMove = state.validMoves.find(m => m.to === pointIndex);
      if (validMove) {
        return { type: 'makeMove', move: validMove };
      }
      // Check bear-off: clicking bear-off area
      if (pointIndex === -1 || pointIndex === 26) {
        const bearMove = state.validMoves.find(
          m => m.to === -1 || m.to === 26
        );
        if (bearMove) {
          return { type: 'makeMove', move: bearMove };
        }
      }
    }

    // Otherwise try to select the point as a source
    const selectable = getSelectablePoints(state.legalSequences);
    if (selectable.has(pointIndex)) {
      return { type: 'selectPoint', pointIndex };
    }

    return null;
  }
}
