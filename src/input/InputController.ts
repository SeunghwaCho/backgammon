// InputController: handles mouse and touch events, maps them to game actions

import { GameState, Move } from '../game/Types.js';
import { CanvasRenderer } from '../render/CanvasRenderer.js';
import { barIndex } from '../game/GameState.js';
import { getSelectablePoints, getMovesFromPoint } from '../game/MoveGenerator.js';
import { t } from '../i18n/Locale.js';

export type InputAction =
  | { type: 'rollDice' }
  | { type: 'selectPoint'; pointIndex: number }
  | { type: 'makeMove'; move: Move }
  | { type: 'newGame' }
  | { type: 'clearSave' }
  | { type: 'continueGame' }
  | { type: 'toggleLang' };

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
  private buttons: ButtonArea[] = [];

  constructor(
    canvas: HTMLCanvasElement,
    renderer: CanvasRenderer,
    onAction: (action: InputAction) => void
  ) {
    this.canvas = canvas;
    this.renderer = renderer;
    this.onAction = onAction;

    this.setupEventListeners();
    this.setupButtons();
  }

  private setupEventListeners(): void {
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
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
  updateLayout(canvasW: number, canvasH: number): void {
    const layout = this.renderer.getLayout();
    if (!layout) return;

    const hudY = layout.hudY;
    const hudH = layout.hudH;
    // Button height: at least 46px to fit emoji + text two-line layout.
    const btnH = Math.max(46, Math.min(54, hudH * 0.82));
    const btnY = hudY + (hudH - btnH) / 2;

    const margin = 6;

    const loc = t();

    if (layout.isPortrait) {
      // Portrait (Fold 7 folded): 4 equal buttons across full width
      const totalMargin = margin * 5;
      const btnW = Math.floor((canvasW - totalMargin) / 4);
      this.buttons = [
        {
          x: margin,
          y: btnY,
          w: btnW,
          h: btnH,
          action: { type: 'rollDice' },
          label: loc.btnRoll,
          emoji: loc.btnRollEmoji,
          text: loc.btnRollText,
          visible: (s) => s.phase === 'waitingForRoll' && s.currentPlayer === 'white',
        },
        {
          x: margin * 2 + btnW,
          y: btnY,
          w: btnW,
          h: btnH,
          action: { type: 'newGame' },
          label: loc.btnNewGame,
          emoji: loc.btnNewGameEmoji,
          text: loc.btnNewGameText,
          visible: (_) => true,
        },
        {
          x: margin * 3 + btnW * 2,
          y: btnY,
          w: btnW,
          h: btnH,
          action: { type: 'clearSave' },
          label: loc.btnClearSave,
          emoji: loc.btnClearSaveEmoji,
          text: loc.btnClearSaveText,
          visible: (_) => true,
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
          visible: (_) => true,
        },
      ];
    } else {
      // Landscape (Fold 7 unfolded / desktop): buttons on the right side
      const btnW = Math.min(88, canvasW * 0.14);
      const langBtnW = Math.min(72, canvasW * 0.1);
      const rightEdge = canvasW - margin;
      this.buttons = [
        {
          x: rightEdge - btnW * 3 - langBtnW - margin * 3,
          y: btnY,
          w: btnW,
          h: btnH,
          action: { type: 'rollDice' },
          label: loc.btnRoll,
          emoji: loc.btnRollEmoji,
          text: loc.btnRollText,
          visible: (s) => s.phase === 'waitingForRoll' && s.currentPlayer === 'white',
        },
        {
          x: rightEdge - btnW * 2 - langBtnW - margin * 2,
          y: btnY,
          w: btnW,
          h: btnH,
          action: { type: 'newGame' },
          label: loc.btnNewGame,
          emoji: loc.btnNewGameEmoji,
          text: loc.btnNewGameText,
          visible: (_) => true,
        },
        {
          x: rightEdge - btnW - langBtnW - margin,
          y: btnY,
          w: btnW,
          h: btnH,
          action: { type: 'clearSave' },
          label: loc.btnClearSave,
          emoji: loc.btnClearSaveEmoji,
          text: loc.btnClearSaveText,
          visible: (_) => true,
        },
        {
          x: rightEdge - langBtnW,
          y: btnY,
          w: langBtnW,
          h: btnH,
          action: { type: 'toggleLang' },
          label: loc.btnLang,
          emoji: loc.btnLangEmoji,
          text: loc.btnLangText,
          visible: (_) => true,
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
    // Check button clicks first
    for (const btn of this.buttons) {
      if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
        this.onAction(btn.action);
        return;
      }
    }

    // Board clicks - need state from outside; emit a raw coordinate event
    // We'll handle this via the point hit test
    const pointIndex = this.renderer.hitTest(x, y);
    if (pointIndex !== null) {
      this.onAction({ type: 'selectPoint', pointIndex });
    }
  }

  // Called by main.ts with current state to process a point selection
  processPointClick(
    pointIndex: number,
    state: GameState
  ): InputAction | null {
    if (state.phase !== 'playerActing') return null;

    const player = state.currentPlayer;
    const barIdx = barIndex(player);

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
