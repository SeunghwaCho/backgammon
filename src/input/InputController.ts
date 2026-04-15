// InputController: handles mouse and touch events, maps them to game actions

import { GameState, Move } from '../game/Types.js';
import { CanvasRenderer } from '../render/CanvasRenderer.js';
import { barIndex } from '../game/GameState.js';
import { getSelectablePoints, getMovesFromPoint } from '../game/MoveGenerator.js';

export type InputAction =
  | { type: 'rollDice' }
  | { type: 'selectPoint'; pointIndex: number }
  | { type: 'makeMove'; move: Move }
  | { type: 'newGame' }
  | { type: 'clearSave' }
  | { type: 'continueGame' };

export interface ButtonArea {
  x: number;
  y: number;
  w: number;
  h: number;
  action: InputAction;
  label: string;
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
    const btnH = Math.min(32, hudH * 0.55);
    const btnW = Math.min(90, canvasW * 0.2);
    const fontSize = layout.fontScale;

    // Right side buttons in HUD
    const margin = 8;
    const rightEdge = canvasW - margin;

    this.buttons = [
      {
        x: rightEdge - btnW * 3 - margin * 2,
        y: hudY + (hudH - btnH) / 2,
        w: btnW,
        h: btnH,
        action: { type: 'rollDice' },
        label: 'ROLL',
        visible: (s) => s.phase === 'waitingForRoll' && s.currentPlayer === 'white',
      },
      {
        x: rightEdge - btnW * 2 - margin,
        y: hudY + (hudH - btnH) / 2,
        w: btnW,
        h: btnH,
        action: { type: 'newGame' },
        label: 'New Game',
        visible: (_) => true,
      },
      {
        x: rightEdge - btnW,
        y: hudY + (hudH - btnH) / 2,
        w: btnW,
        h: btnH,
        action: { type: 'clearSave' },
        label: 'Clear Save',
        visible: (_) => true,
      },
    ];
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
