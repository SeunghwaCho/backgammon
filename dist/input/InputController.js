// InputController: handles mouse and touch events, maps them to game actions
import { barIndex } from '../game/GameState.js';
import { getSelectablePoints } from '../game/MoveGenerator.js';
import { t } from '../i18n/Locale.js';
export class InputController {
    constructor(canvas, renderer, onAction) {
        this.buttons = [];
        this.canvas = canvas;
        this.renderer = renderer;
        this.onAction = onAction;
        this.setupEventListeners();
        this.setupButtons();
    }
    setupEventListeners() {
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), {
            passive: false,
        });
        // Touch end for drag-like interactions (future use)
        this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this), {
            passive: false,
        });
    }
    setupButtons() {
        // Buttons are positioned in HUD area; positions updated on resize
        // We'll define them by role and compute position in updateButtonLayout
    }
    // Update button layout based on current canvas/HUD dimensions
    updateLayout(canvasW, canvasH) {
        const layout = this.renderer.getLayout();
        if (!layout)
            return;
        const hudY = layout.hudY;
        const hudH = layout.hudH;
        // Button height: at least 36px for touch targets, max 40px.
        const btnH = Math.max(36, Math.min(40, hudH * 0.7));
        const btnY = hudY + (hudH - btnH) / 2;
        const margin = 6;
        const loc = t();
        if (layout.isPortrait) {
            // Portrait (Fold 7 folded): 4 equal buttons across full width
            const totalMargin = margin * 5; // left + between*3 + right
            const btnW = Math.floor((canvasW - totalMargin) / 4);
            this.buttons = [
                {
                    x: margin,
                    y: btnY,
                    w: btnW,
                    h: btnH,
                    action: { type: 'rollDice' },
                    label: loc.btnRollShort,
                    visible: (s) => s.phase === 'waitingForRoll' && s.currentPlayer === 'white',
                },
                {
                    x: margin * 2 + btnW,
                    y: btnY,
                    w: btnW,
                    h: btnH,
                    action: { type: 'newGame' },
                    label: loc.btnNewGameShort,
                    visible: (_) => true,
                },
                {
                    x: margin * 3 + btnW * 2,
                    y: btnY,
                    w: btnW,
                    h: btnH,
                    action: { type: 'clearSave' },
                    label: loc.btnClearSaveShort,
                    visible: (_) => true,
                },
                {
                    x: margin * 4 + btnW * 3,
                    y: btnY,
                    w: btnW,
                    h: btnH,
                    action: { type: 'toggleLang' },
                    label: loc.btnLang,
                    visible: (_) => true,
                },
            ];
        }
        else {
            // Landscape (Fold 7 unfolded / desktop): buttons on the right side
            const btnW = Math.min(95, canvasW * 0.16);
            const langBtnW = Math.min(70, canvasW * 0.1);
            const rightEdge = canvasW - margin;
            this.buttons = [
                {
                    x: rightEdge - btnW * 3 - langBtnW - margin * 3,
                    y: btnY,
                    w: btnW,
                    h: btnH,
                    action: { type: 'rollDice' },
                    label: loc.btnRoll,
                    visible: (s) => s.phase === 'waitingForRoll' && s.currentPlayer === 'white',
                },
                {
                    x: rightEdge - btnW * 2 - langBtnW - margin * 2,
                    y: btnY,
                    w: btnW,
                    h: btnH,
                    action: { type: 'newGame' },
                    label: loc.btnNewGame,
                    visible: (_) => true,
                },
                {
                    x: rightEdge - btnW - langBtnW - margin,
                    y: btnY,
                    w: btnW,
                    h: btnH,
                    action: { type: 'clearSave' },
                    label: loc.btnClearSave,
                    visible: (_) => true,
                },
                {
                    x: rightEdge - langBtnW,
                    y: btnY,
                    w: langBtnW,
                    h: btnH,
                    action: { type: 'toggleLang' },
                    label: loc.btnLang,
                    visible: (_) => true,
                },
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
            y: e.clientY - rect.top,
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
        // Already handled on touchstart
    }
    handleClick(x, y) {
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
    processPointClick(pointIndex, state) {
        if (state.phase !== 'playerActing')
            return null;
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
                const bearMove = state.validMoves.find(m => m.to === -1 || m.to === 26);
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
//# sourceMappingURL=InputController.js.map