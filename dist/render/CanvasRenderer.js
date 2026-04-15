// CanvasRenderer: renders the backgammon board using Canvas 2D API
// Supports both landscape (≥600px) and portrait (<600px) modes for Galaxy Fold 7
import { barIndex } from '../game/GameState.js';
import { getSelectablePoints } from '../game/MoveGenerator.js';
import { t } from '../i18n/Locale.js';
import { AnimationSystem, ANIM_MOVE_MS, ANIM_HIT_MS } from './AnimationSystem.js';
// Layout constants
const COLORS = {
    boardBg: '#1a472a',
    boardBorder: '#0d2a18',
    pointLight: '#c8a46e',
    pointDark: '#7b3f1e',
    barColor: '#2d5a3d',
    barBorder: '#1a3828',
    white: '#f5f0e8',
    whiteBorder: '#c8c0b0',
    black: '#1a1a2e',
    blackBorder: '#4a4a6e',
    selected: '#ffe066',
    validTarget: '#66ff99',
    validTargetBorder: '#00cc55',
    diceWhite: '#f5f0e8',
    diceDark: '#1a1a2e',
    diceDot: '#333',
    diceDotLight: '#eee',
    hudBg: 'rgba(0,0,0,0.7)',
    textLight: '#ffffff',
    textDim: '#aaaaaa',
    error: '#ff6b6b',
    winBg: 'rgba(0,0,0,0.85)',
    winText: '#ffe066',
    barHighlight: '#ffaa00',
};
export class CanvasRenderer {
    constructor(ctx) {
        this.width = 800;
        this.height = 600;
        this.layout = null;
        // Maps from point index to canvas coordinates (center-top for bottom points, center-bottom for top)
        this.pointCoords = new Map();
        this.animSystem = new AnimationSystem();
        this.ctx = ctx;
    }
    // ── Animation API ─────────────────────────────────────────────────────────────
    /** True if any checker animation or hit burst is currently active. */
    isAnimating() {
        return this.animSystem.isActive();
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
        if (!this.layout)
            return defaultDelay;
        const fromPos = this.getAnimPosition(fromIdx);
        const toPos = this.getAnimPosition(toIdx);
        if (!fromPos || !toPos)
            return defaultDelay;
        const now = performance.now();
        const r = this.layout.checkerR;
        // 1. Attacker slides from→to
        this.animSystem.queue({
            kind: 'move',
            fromX: fromPos.x, fromY: fromPos.y,
            toX: toPos.x, toY: toPos.y,
            player, r,
            startTime: now,
            duration: ANIM_MOVE_MS,
        });
        if (!isHit)
            return defaultDelay;
        // 2. Impact burst — starts as attacker approaches the destination
        const impactDelay = ANIM_MOVE_MS * 0.80;
        this.animSystem.queue({
            kind: 'hitBurst',
            x: toPos.x, y: toPos.y,
            r,
            startTime: now + impactDelay,
            duration: ANIM_HIT_MS,
        });
        // 3. Captured piece flies from impact point to its bar
        const captured = player === 'white' ? 'black' : 'white';
        const capturedBarIdx = captured === 'white' ? 0 : 25;
        const barPos = this.getAnimPosition(capturedBarIdx);
        if (barPos) {
            const captureDur = Math.round(ANIM_MOVE_MS * 0.85);
            this.animSystem.queue({
                kind: 'move',
                fromX: toPos.x, fromY: toPos.y,
                toX: barPos.x, toY: barPos.y,
                player: captured,
                r,
                startTime: now + impactDelay,
                duration: captureDur,
            });
            // Wait until the captured piece fully arrives
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
        if (!this.layout)
            return;
        const pos = this.getAnimPosition(toIdx);
        if (!pos)
            return;
        const r = this.layout.checkerR;
        const now = performance.now();
        // Burst at capture point
        this.animSystem.queue({
            kind: 'hitBurst',
            x: pos.x, y: pos.y,
            r,
            startTime: now,
            duration: ANIM_HIT_MS,
        });
        // Captured piece flies to its bar
        const barIdx = capturedPlayer === 'white' ? 0 : 25;
        const barPos = this.getAnimPosition(barIdx);
        if (barPos) {
            this.animSystem.queue({
                kind: 'move',
                fromX: pos.x, fromY: pos.y,
                toX: barPos.x, toY: barPos.y,
                player: capturedPlayer,
                r,
                startTime: now,
                duration: ANIM_MOVE_MS,
            });
        }
    }
    /** Canvas position for a given point index, bar, or bear-off. */
    getAnimPosition(pointIndex) {
        if (pointIndex === -1)
            return this.getBearOffCenter('white');
        if (pointIndex === 26)
            return this.getBearOffCenter('black');
        return this.getPointCenter(pointIndex);
    }
    getBearOffCenter(player) {
        if (!this.layout)
            return null;
        const l = this.layout;
        if (!l.isPortrait) {
            return {
                x: (player === 'white' ? l.whiteBearOffX : l.blackBearOffX) + l.bearOffW / 2,
                y: l.boardY + l.boardH / 2,
            };
        }
        const bh = l.bearOffW;
        const y = player === 'white'
            ? l.boardY + l.boardH + 4 + bh / 2
            : l.boardY - bh / 2 - 4;
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
        // HUD = message row (28px) + button row (52px) = 80px total
        const msgH = 28;
        const btnAreaH = Math.max(52, Math.min(58, this.height * 0.08));
        const hudH = msgH + btnAreaH;
        if (isPortrait) {
            return this.computePortraitLayout(hudH, msgH, btnAreaH);
        }
        else {
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
            boardX, boardY, boardW, boardH,
            pointW, pointH, barX, barW, checkerR,
            hudY, hudH,
            msgY: hudY, msgH,
            btnAreaY: hudY + msgH, btnAreaH,
            whiteBearOffX: 0,
            blackBearOffX: w - bearOffW,
            bearOffW,
            isPortrait: false,
            fontScale,
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
            boardX, boardY, boardW, boardH,
            pointW, pointH, barX, barW, checkerR,
            hudY, hudH,
            msgY: hudY, msgH,
            btnAreaY: hudY + msgH, btnAreaH,
            whiteBearOffX: boardX,
            blackBearOffX: boardX,
            bearOffW: bearOffH,
            isPortrait: true,
            fontScale,
        };
    }
    // Get screen coordinates for a given point index (1-24), bar (0 or 25), or bear-off (-1, 26)
    getPointCenter(pointIndex) {
        if (!this.layout)
            return null;
        const l = this.layout;
        if (l.isPortrait) {
            return this.getPortraitPointCenter(pointIndex);
        }
        else {
            return this.getLandscapePointCenter(pointIndex);
        }
    }
    getLandscapePointCenter(pointIndex) {
        if (!this.layout)
            return null;
        const l = this.layout;
        if (pointIndex === 0) {
            // White bar: center of bar, bottom half
            return {
                x: l.barX + l.barW / 2,
                y: l.boardY + l.boardH * 0.75,
            };
        }
        if (pointIndex === 25) {
            // Black bar: center of bar, top half
            return {
                x: l.barX + l.barW / 2,
                y: l.boardY + l.boardH * 0.25,
            };
        }
        if (pointIndex >= 1 && pointIndex <= 24) {
            const { x, isTop } = this.getPointX(pointIndex);
            const y = isTop
                ? l.boardY + l.pointH * 0.5
                : l.boardY + l.boardH - l.pointH * 0.5;
            return { x, y };
        }
        return null;
    }
    getPortraitPointCenter(pointIndex) {
        if (!this.layout)
            return null;
        const l = this.layout;
        if (pointIndex === 0) {
            // White bar: bottom center
            return { x: l.boardX + l.boardW / 2, y: l.boardY + l.boardH * 0.75 };
        }
        if (pointIndex === 25) {
            // Black bar: top center
            return { x: l.boardX + l.boardW / 2, y: l.boardY + l.boardH * 0.25 };
        }
        if (pointIndex >= 1 && pointIndex <= 12) {
            // Bottom half: points 1-12, displayed right to left
            // Point 1 = rightmost column, point 12 = leftmost column
            const col = pointIndex - 1; // 0-11
            const displayCol = 11 - col; // 11=left, 0=right
            const x = l.boardX + displayCol * l.pointW + l.pointW / 2;
            const barCenterY = l.boardY + l.boardH / 2;
            const y = barCenterY + l.boardH * 0.02 + l.pointH * 0.5;
            return { x, y };
        }
        if (pointIndex >= 13 && pointIndex <= 24) {
            // Top half: points 13-24, displayed left to right
            // Point 13 = leftmost, point 24 = rightmost
            const col = pointIndex - 13; // 0-11
            const x = l.boardX + col * l.pointW + l.pointW / 2;
            const barCenterY = l.boardY + l.boardH / 2;
            const y = barCenterY - l.boardH * 0.02 - l.pointH * 0.5;
            return { x, y };
        }
        return null;
    }
    // Get X position and top/bottom for landscape points
    getPointX(pointIndex) {
        if (!this.layout)
            return { x: 0, isTop: false };
        const l = this.layout;
        // Landscape:
        // Top row: points 13 (leftmost) to 24 (rightmost)
        // Bottom row: points 12 (leftmost) to 1 (rightmost)
        if (pointIndex >= 13 && pointIndex <= 24) {
            const col = pointIndex - 13; // 0=leftmost
            let x;
            if (col < 6) {
                x = l.boardX + col * l.pointW + l.pointW / 2;
            }
            else {
                x = l.boardX + l.barW + col * l.pointW + l.pointW / 2;
            }
            return { x, isTop: true };
        }
        else {
            // Points 1-12: bottom row, 1=rightmost, 12=leftmost
            const col = 12 - pointIndex; // 0=leftmost (pt12), 11=rightmost (pt1)
            let x;
            if (col < 6) {
                x = l.boardX + col * l.pointW + l.pointW / 2;
            }
            else {
                x = l.boardX + l.barW + col * l.pointW + l.pointW / 2;
            }
            return { x, isTop: false };
        }
    }
    // Hit test: given screen coordinates, return which point was clicked
    hitTest(sx, sy) {
        if (!this.layout)
            return null;
        const l = this.layout;
        if (l.isPortrait) {
            return this.hitTestPortrait(sx, sy);
        }
        else {
            return this.hitTestLandscape(sx, sy);
        }
    }
    hitTestLandscape(sx, sy) {
        if (!this.layout)
            return null;
        const l = this.layout;
        // Bear-off area clicks (outside main board)
        if (sx >= l.whiteBearOffX && sx < l.whiteBearOffX + l.bearOffW) {
            if (sy >= l.boardY && sy <= l.boardY + l.boardH)
                return -1; // white bear off
        }
        if (sx >= l.blackBearOffX && sx < l.blackBearOffX + l.bearOffW) {
            if (sy >= l.boardY && sy <= l.boardY + l.boardH)
                return 26; // black bear off
        }
        // Bar check — use a hit zone wide enough to cover the checker visual.
        // barW is a narrow rendering column (~33px) but bar checkers are drawn with
        // radius checkerR * 0.9, which overflows barX..barX+barW on both sides.
        const barCenterX = l.barX + l.barW / 2;
        const barHitHalf = Math.max(l.barW / 2, l.checkerR * 1.05 + 4);
        if (sx >= barCenterX - barHitHalf && sx <= barCenterX + barHitHalf) {
            if (sy >= l.boardY && sy <= l.boardY + l.boardH / 2)
                return 25; // black bar
            if (sy > l.boardY + l.boardH / 2 && sy <= l.boardY + l.boardH)
                return 0; // white bar
        }
        if (sy < l.boardY || sy > l.boardY + l.boardH)
            return null;
        if (sx < l.boardX || sx > l.boardX + l.boardW)
            return null;
        const isTop = sy <= l.boardY + l.boardH / 2;
        // Adjust for bar
        let adjustedX = sx - l.boardX;
        if (adjustedX >= l.pointW * 6)
            adjustedX -= l.barW;
        const col = Math.floor(adjustedX / l.pointW);
        if (col < 0 || col > 11)
            return null;
        if (isTop) {
            return 13 + col; // col 0=13, col 11=24
        }
        else {
            return 12 - col; // col 0=12, col 11=1
        }
    }
    hitTestPortrait(sx, sy) {
        if (!this.layout)
            return null;
        const l = this.layout;
        // Bear-off areas (above/below board in portrait)
        const bh = l.bearOffW;
        const whiteBearOffY = l.boardY + l.boardH + 4;
        const blackBearOffY = l.boardY - bh - 4;
        if (sx >= l.boardX && sx <= l.boardX + l.boardW) {
            if (sy >= whiteBearOffY && sy <= whiteBearOffY + bh)
                return -1; // white bear off
            if (sy >= blackBearOffY && sy <= blackBearOffY + bh)
                return 26; // black bear off
        }
        if (sx < l.boardX || sx > l.boardX + l.boardW)
            return null;
        if (sy < l.boardY || sy > l.boardY + l.boardH)
            return null;
        const midY = l.boardY + l.boardH / 2;
        // 12 columns of width pointW each (pointW = boardW/12)
        const col = Math.floor((sx - l.boardX) / l.pointW);
        if (col < 0 || col > 11)
            return null;
        // Bar zone height must cover the full visible extent of the first stacked
        // bar checker.  First checker center = midY ± checkerR * 1.05, radius =
        // checkerR, so the outermost edge sits at midY ± checkerR * 2.05.
        // Add a finger-touch margin of ~4 px.
        const barHitZone = Math.max(l.checkerR * 4.5, l.boardH * 0.07);
        if (sy < midY - barHitZone / 2) {
            // Top half: points 13-24, col 0=13, col 11=24
            return 13 + col;
        }
        else if (sy > midY + barHitZone / 2) {
            // Bottom half: points 1-12, displayed right-to-left; col 0=12, col 11=1
            return 12 - col;
        }
        // In bar area
        return sy < midY ? 25 : 0;
    }
    // Main render function
    render(state) {
        if (!this.layout)
            return;
        const ctx = this.ctx;
        const l = this.layout;
        ctx.clearRect(0, 0, this.width, this.height);
        // Background
        ctx.fillStyle = '#0d1b0f';
        ctx.fillRect(0, 0, this.width, this.height);
        if (l.isPortrait) {
            this.renderPortrait(state);
        }
        else {
            this.renderLandscape(state);
        }
        this.renderHUD(state);
        // Animation overlay: in-flight checkers and hit bursts (above board/HUD, below modal overlays)
        this.animSystem.render(this.ctx);
        if (state.phase === 'gameOver' && state.winner) {
            this.renderWinScreen(state.winner);
        }
        if (state.phase === 'rollingForFirst' && state.initialRoll) {
            this.renderInitialRollDice(state.initialRoll, state.currentPlayer);
        }
    }
    renderLandscape(state) {
        const ctx = this.ctx;
        const l = this.layout;
        // Draw board background
        ctx.fillStyle = COLORS.boardBg;
        roundRect(ctx, l.boardX, l.boardY, l.boardW, l.boardH, 6);
        ctx.fill();
        ctx.strokeStyle = COLORS.boardBorder;
        ctx.lineWidth = 2;
        roundRect(ctx, l.boardX, l.boardY, l.boardW, l.boardH, 6);
        ctx.stroke();
        // Draw triangular points
        for (let i = 1; i <= 24; i++) {
            this.drawLandscapePoint(i, state);
        }
        // Draw bar
        ctx.fillStyle = COLORS.barColor;
        ctx.fillRect(l.barX, l.boardY, l.barW, l.boardH);
        ctx.strokeStyle = COLORS.barBorder;
        ctx.lineWidth = 1;
        ctx.strokeRect(l.barX, l.boardY, l.barW, l.boardH);
        // Draw checkers on all points
        for (let i = 1; i <= 24; i++) {
            this.drawCheckersOnPoint(i, state);
        }
        // Draw bar checkers
        this.drawBarCheckers(state);
        // Draw bear-off areas
        this.drawBearOffAreas(state);
        // Draw dice
        if (state.dice) {
            this.drawDice(state);
        }
    }
    renderPortrait(state) {
        const ctx = this.ctx;
        const l = this.layout;
        // Board background
        ctx.fillStyle = COLORS.boardBg;
        roundRect(ctx, l.boardX, l.boardY, l.boardW, l.boardH, 6);
        ctx.fill();
        ctx.strokeStyle = COLORS.boardBorder;
        ctx.lineWidth = 2;
        roundRect(ctx, l.boardX, l.boardY, l.boardW, l.boardH, 6);
        ctx.stroke();
        // Draw points
        for (let i = 1; i <= 24; i++) {
            this.drawPortraitPoint(i, state);
        }
        // Draw bar
        const midY = l.boardY + l.boardH / 2;
        const barH = l.boardH * 0.04 + 2;
        ctx.fillStyle = COLORS.barColor;
        ctx.fillRect(l.boardX, midY - barH / 2, l.boardW, barH);
        ctx.strokeStyle = COLORS.barBorder;
        ctx.lineWidth = 1;
        ctx.strokeRect(l.boardX, midY - barH / 2, l.boardW, barH);
        // Draw checkers
        for (let i = 1; i <= 24; i++) {
            this.drawCheckersOnPoint(i, state);
        }
        this.drawBarCheckers(state);
        this.drawBearOffAreasPortrait(state);
        if (state.dice) {
            this.drawDice(state);
        }
    }
    drawLandscapePoint(pointIndex, state) {
        const ctx = this.ctx;
        const l = this.layout;
        const { x, isTop } = this.getPointX(pointIndex);
        const selectablePoints = getSelectablePoints(state.legalSequences);
        const isSelectable = state.phase === 'playerActing' && selectablePoints.has(pointIndex);
        const isSelected = state.selectedPoint === pointIndex;
        const isValidTarget = state.validMoves.some(m => m.to === pointIndex);
        const color = (pointIndex % 2 === 0) ? COLORS.pointDark : COLORS.pointLight;
        const tipY = isTop
            ? l.boardY + l.pointH
            : l.boardY + l.boardH - l.pointH;
        const baseY = isTop ? l.boardY : l.boardY + l.boardH;
        ctx.beginPath();
        ctx.moveTo(x - l.pointW / 2 + 1, baseY);
        ctx.lineTo(x + l.pointW / 2 - 1, baseY);
        ctx.lineTo(x, tipY);
        ctx.closePath();
        if (isSelected) {
            ctx.fillStyle = COLORS.selected;
        }
        else if (isValidTarget) {
            ctx.fillStyle = COLORS.validTarget;
        }
        else if (isSelectable) {
            ctx.fillStyle = lightenColor(color, 30);
        }
        else {
            ctx.fillStyle = color;
        }
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
        // Point number label
        const labelY = isTop
            ? l.boardY + l.boardH - 6
            : l.boardY + 14;
        const fontSize = Math.max(9, 11 * l.fontScale);
        ctx.font = `${fontSize}px sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.textAlign = 'center';
        ctx.fillText(String(pointIndex), x, labelY);
    }
    drawPortraitPoint(pointIndex, state) {
        const ctx = this.ctx;
        const l = this.layout;
        const selectablePoints = getSelectablePoints(state.legalSequences);
        const isSelectable = state.phase === 'playerActing' && selectablePoints.has(pointIndex);
        const isSelected = state.selectedPoint === pointIndex;
        const isValidTarget = state.validMoves.some(m => m.to === pointIndex);
        const color = (pointIndex % 2 === 0) ? COLORS.pointDark : COLORS.pointLight;
        let col, isTop, baseY, tipY, centerX;
        const midY = l.boardY + l.boardH / 2;
        if (pointIndex >= 13 && pointIndex <= 24) {
            col = pointIndex - 13;
            isTop = true;
            centerX = l.boardX + col * l.pointW + l.pointW / 2;
            baseY = l.boardY;
            tipY = l.boardY + l.pointH;
        }
        else {
            col = 12 - pointIndex; // 0=pt12(left), 11=pt1(right)
            isTop = false;
            centerX = l.boardX + col * l.pointW + l.pointW / 2;
            baseY = l.boardY + l.boardH;
            tipY = l.boardY + l.boardH - l.pointH;
        }
        ctx.beginPath();
        ctx.moveTo(centerX - l.pointW / 2 + 1, baseY);
        ctx.lineTo(centerX + l.pointW / 2 - 1, baseY);
        ctx.lineTo(centerX, tipY);
        ctx.closePath();
        if (isSelected) {
            ctx.fillStyle = COLORS.selected;
        }
        else if (isValidTarget) {
            ctx.fillStyle = COLORS.validTarget;
        }
        else if (isSelectable) {
            ctx.fillStyle = lightenColor(color, 30);
        }
        else {
            ctx.fillStyle = color;
        }
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
        // Label
        const fontSize = Math.max(8, 9 * l.fontScale);
        ctx.font = `${fontSize}px sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.textAlign = 'center';
        const labelY = isTop
            ? l.boardY + l.boardH - 8
            : l.boardY + 12;
        ctx.fillText(String(pointIndex), centerX, labelY);
    }
    drawCheckersOnPoint(pointIndex, state) {
        if (!this.layout)
            return;
        const l = this.layout;
        const pt = state.board[pointIndex];
        if (!pt || pt.count === 0)
            return;
        const center = this.getPointCenter(pointIndex);
        if (!center)
            return;
        const isTop = l.isPortrait
            ? pointIndex >= 13
            : pointIndex >= 13 && pointIndex <= 24;
        const count = pt.count;
        const cx = center.x;
        // Dynamic sizing: all checkers always drawn, no visual overlap.
        //
        // spacing ratio ≥ 2.0  →  spacing ≥ diameter  →  checkers never overlap.
        // Using 2.05 gives a small gap between consecutive checkers.
        //
        // Total stack height  = 2r + (count-1)*spacing
        //                     = 2r + (count-1)*r*RATIO
        //                     = r * (2 + (count-1)*RATIO)
        //
        // Solve for max r that fits inside pointH:
        //   r_max = pointH / (2 + (count-1)*RATIO)
        //
        // Use full checkerR when it fits; otherwise shrink.
        const RATIO = 2.05; // ≥ 2 → no overlap, slight gap
        const maxR = l.pointH / (2 + (count - 1) * RATIO);
        const r = Math.min(l.checkerR, maxR);
        const spacing = r * RATIO;
        const dir = isTop ? 1 : -1;
        const baseY = isTop
            ? l.boardY + r
            : l.boardY + l.boardH - r;
        const isSelected = pointIndex === state.selectedPoint;
        // Detect if this point has a bear-off move available (pre-selection only)
        const isBearOffSource = state.phase === 'playerActing' &&
            state.selectedPoint === null &&
            state.legalSequences.some(seq => seq.length > 0 && seq[0].from === pointIndex &&
                (seq[0].to === -1 || seq[0].to === 26));
        for (let i = 0; i < count; i++) {
            const cy = baseY + dir * i * spacing;
            this.drawChecker(cx, cy, r, pt.owner, isSelected);
        }
        // Gold ring on the innermost (most accessible) checker when bear-off is possible
        if (isBearOffSource) {
            const topCY = baseY + dir * (count - 1) * spacing;
            const ctx = this.ctx;
            ctx.beginPath();
            ctx.arc(cx, topCY, r * 1.32, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 210, 30, 0.92)';
            ctx.lineWidth = Math.max(2, r * 0.18);
            ctx.stroke();
            // Small arrow pointing toward bear-off zone
            const arrowDir = (pt.owner === 'white') ? 1 : -1; // white=down, black=up in portrait
            const arrowTip = topCY + arrowDir * r * 2.1;
            const arrowBase = topCY + arrowDir * r * 1.55;
            const hw = r * 0.38;
            ctx.beginPath();
            ctx.moveTo(cx, arrowTip);
            ctx.lineTo(cx - hw, arrowBase);
            ctx.lineTo(cx + hw, arrowBase);
            ctx.closePath();
            ctx.fillStyle = 'rgba(255, 210, 30, 0.88)';
            ctx.fill();
        }
        // Show count badge when checkers are small (r shrunk below 60% of default).
        if (r < l.checkerR * 0.6) {
            const innermostY = baseY + dir * (count - 1) * spacing;
            const fontSize = Math.max(8, r * 1.0);
            this.ctx.font = `bold ${fontSize}px sans-serif`;
            this.ctx.fillStyle = '#ffff55';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(String(count), cx, innermostY);
            this.ctx.textBaseline = 'alphabetic';
        }
    }
    drawChecker(cx, cy, r, owner, isSelected) {
        const ctx = this.ctx;
        const isWhite = owner === 'white';
        // Shadow
        ctx.beginPath();
        ctx.arc(cx + 1, cy + 1, r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fill();
        // Main body
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        if (isSelected) {
            ctx.fillStyle = COLORS.selected;
        }
        else {
            const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
            if (isWhite) {
                grad.addColorStop(0, '#ffffff');
                grad.addColorStop(0.7, COLORS.white);
                grad.addColorStop(1, '#a0a090');
            }
            else {
                grad.addColorStop(0, '#5a5a7a');
                grad.addColorStop(0.7, COLORS.black);
                grad.addColorStop(1, '#050510');
            }
            ctx.fillStyle = grad;
        }
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = isWhite ? COLORS.whiteBorder : COLORS.blackBorder;
        ctx.lineWidth = Math.max(1, r * 0.12);
        ctx.stroke();
        // Inner ring decoration
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.65, 0, Math.PI * 2);
        ctx.strokeStyle = isWhite ? 'rgba(180,170,150,0.6)' : 'rgba(100,100,140,0.6)';
        ctx.lineWidth = Math.max(0.5, r * 0.08);
        ctx.stroke();
    }
    drawBarCheckers(state) {
        if (!this.layout)
            return;
        const l = this.layout;
        for (const player of ['white', 'black']) {
            const barIdx = barIndex(player);
            const barPt = state.board[barIdx];
            if (!barPt || barPt.owner !== player || barPt.count === 0)
                continue;
            const center = this.getPointCenter(barIdx);
            if (!center)
                continue;
            const isSelected = state.selectedPoint === barIdx;
            const selectablePoints = getSelectablePoints(state.legalSequences);
            const isSelectable = state.phase === 'playerActing' && selectablePoints.has(barIdx);
            // Draw bar highlight if selectable
            if (isSelectable || isSelected) {
                const ctx = this.ctx;
                ctx.save();
                if (l.isPortrait) {
                    const midY = l.boardY + l.boardH / 2;
                    const bh = l.boardH * 0.04 + 2;
                    ctx.fillStyle = isSelected ? COLORS.selected : COLORS.barHighlight;
                    ctx.globalAlpha = 0.4;
                    ctx.fillRect(l.boardX, midY - bh / 2 - l.checkerR * 2, l.boardW, l.checkerR * 4 + bh);
                }
                else {
                    ctx.fillStyle = isSelected ? COLORS.selected : COLORS.barHighlight;
                    ctx.globalAlpha = 0.4;
                    ctx.fillRect(l.barX, l.boardY + l.boardH / 2 - l.checkerR * 2.5, l.barW, l.checkerR * 5);
                }
                ctx.restore();
            }
            // Draw each checker on bar
            const count = barPt.count;
            for (let i = 0; i < count && i < 4; i++) {
                const cx = center.x;
                let cy;
                if (l.isPortrait) {
                    const midY = l.boardY + l.boardH / 2;
                    const dir = player === 'black' ? -1 : 1;
                    cy = midY + dir * (i + 0.5) * l.checkerR * 2.1;
                }
                else {
                    const dir = player === 'black' ? 1 : -1;
                    cy = center.y + dir * i * l.checkerR * 2.1;
                }
                this.drawChecker(cx, cy, l.checkerR * 0.9, player, isSelected);
            }
            // Count label
            if (count > 0) {
                const fontSize = Math.max(10, 12 * l.fontScale);
                this.ctx.font = `bold ${fontSize}px sans-serif`;
                this.ctx.fillStyle = '#ffff00';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(`×${count}`, center.x, center.y + l.checkerR * 2.2);
            }
        }
        // Draw valid target highlight on bar (for re-entry targets)
        this.drawBarValidTargets(state);
    }
    drawBarValidTargets(state) {
        if (!this.layout)
            return;
        const l = this.layout;
        // Valid moves may go to board points (not bar); bar targets handled elsewhere
    }
    /** True when the player has pre-selection bear-off moves available */
    anyBearOffPossible(state) {
        return state.phase === 'playerActing' &&
            state.selectedPoint === null &&
            state.legalSequences.some(seq => seq.length > 0 && (seq[0].to === -1 || seq[0].to === 26));
    }
    drawBearOffAreas(state) {
        if (!this.layout)
            return;
        const l = this.layout;
        const ctx = this.ctx;
        const canBearOff = this.anyBearOffPossible(state);
        // White bear-off (left side)
        ctx.fillStyle = canBearOff ? 'rgba(255,210,30,0.18)' : 'rgba(245,240,232,0.15)';
        ctx.fillRect(l.whiteBearOffX, l.boardY, l.bearOffW, l.boardH);
        ctx.strokeStyle = canBearOff ? 'rgba(255,210,30,0.75)' : 'rgba(245,240,232,0.4)';
        ctx.lineWidth = canBearOff ? 2 : 1;
        ctx.strokeRect(l.whiteBearOffX, l.boardY, l.bearOffW, l.boardH);
        const wX = l.whiteBearOffX + l.bearOffW / 2;
        const fontSize = Math.max(10, 11 * l.fontScale);
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText('♙', wX, l.boardY + 16);
        ctx.fillText(`${state.whiteBorneOff}`, wX, l.boardY + 32);
        // Draw borne-off white checkers
        for (let i = 0; i < Math.min(state.whiteBorneOff, 8); i++) {
            const cy = l.boardY + l.boardH - 10 - i * (l.bearOffW * 0.35 + 2);
            this.drawChecker(wX, cy, l.bearOffW * 0.35, 'white', false);
        }
        // Black bear-off (right side)
        ctx.fillStyle = canBearOff ? 'rgba(255,210,30,0.18)' : 'rgba(26,26,46,0.25)';
        ctx.fillRect(l.blackBearOffX, l.boardY, l.bearOffW, l.boardH);
        ctx.strokeStyle = canBearOff ? 'rgba(255,210,30,0.75)' : 'rgba(100,100,140,0.4)';
        ctx.lineWidth = canBearOff ? 2 : 1;
        ctx.strokeRect(l.blackBearOffX, l.boardY, l.bearOffW, l.boardH);
        const bX = l.blackBearOffX + l.bearOffW / 2;
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillStyle = '#aaaaff';
        ctx.textAlign = 'center';
        ctx.fillText('♟', bX, l.boardY + 16);
        ctx.fillText(`${state.blackBorneOff}`, bX, l.boardY + 32);
        for (let i = 0; i < Math.min(state.blackBorneOff, 8); i++) {
            const cy = l.boardY + l.boardH - 10 - i * (l.bearOffW * 0.35 + 2);
            this.drawChecker(bX, cy, l.bearOffW * 0.35, 'black', false);
        }
    }
    drawBearOffAreasPortrait(state) {
        if (!this.layout)
            return;
        const l = this.layout;
        const ctx = this.ctx;
        const bh = l.bearOffW;
        const canBearOff = this.anyBearOffPossible(state);
        // White bear-off: below the board
        const whiteY = l.boardY + l.boardH + 4;
        ctx.fillStyle = canBearOff ? 'rgba(255,210,30,0.18)' : 'rgba(245,240,232,0.12)';
        ctx.fillRect(l.boardX, whiteY, l.boardW, bh);
        ctx.strokeStyle = canBearOff ? 'rgba(255,210,30,0.75)' : 'rgba(245,240,232,0.3)';
        ctx.lineWidth = canBearOff ? 2 : 1;
        ctx.strokeRect(l.boardX, whiteY, l.boardW, bh);
        const fontSize = Math.max(9, 10 * l.fontScale);
        ctx.font = `${fontSize}px sans-serif`;
        ctx.fillStyle = COLORS.textLight;
        ctx.textAlign = 'left';
        ctx.fillText(`♙ ${state.whiteBorneOff}`, l.boardX + 4, whiteY + bh / 2 + 4);
        // Black bear-off: above the board
        const blackY = l.boardY - bh - 4;
        ctx.fillStyle = canBearOff ? 'rgba(255,210,30,0.18)' : 'rgba(26,26,46,0.2)';
        ctx.fillRect(l.boardX, blackY, l.boardW, bh);
        ctx.strokeStyle = canBearOff ? 'rgba(255,210,30,0.75)' : 'rgba(100,100,140,0.3)';
        ctx.lineWidth = canBearOff ? 2 : 1;
        ctx.strokeRect(l.boardX, blackY, l.boardW, bh);
        ctx.font = `${fontSize}px sans-serif`;
        ctx.fillStyle = '#aaaaff';
        ctx.textAlign = 'left';
        ctx.fillText(`♟ ${state.blackBorneOff}`, l.boardX + 4, blackY + bh / 2 + 4);
    }
    drawDice(state) {
        if (!state.dice)
            return;
        if (!this.layout)
            return;
        const l = this.layout;
        const ctx = this.ctx;
        // ~2× larger than before: was min(36, checkerR*1.8, 44), now min(72, checkerR*3.6, 88)
        const diceSize = Math.min(72, l.checkerR * 3.6, 88) * l.fontScale;
        const padding = 10;
        const player = state.currentPlayer;
        let diceX, diceY;
        if (l.isPortrait) {
            // Center the two dice horizontally in the right half of the board
            const totalW = diceSize * 2 + padding;
            diceX = l.boardX + l.boardW / 2 + (l.boardW / 2 - totalW) / 2;
            diceY = l.boardY + l.boardH / 2 - diceSize / 2;
        }
        else {
            // Center inside the bar area
            const totalW = diceSize * 2 + padding;
            diceX = l.barX + (l.barW - totalW) / 2;
            diceY = l.boardY + l.boardH / 2 - diceSize / 2;
        }
        const isWhite = player === 'white';
        state.dice.values.forEach((val, idx) => {
            // Determine if this die has been used
            let used;
            if (state.dice.values[0] === state.dice.values[1]) {
                // Doubles: 4 original moves, check remaining count
                const remainingCount = state.dice.remaining.length;
                used = idx >= remainingCount;
            }
            else {
                // Normal: check if this value still in remaining
                used = !state.dice.remaining.includes(val);
            }
            const x = diceX + idx * (diceSize + padding);
            this.drawDie(x, diceY, diceSize, val, isWhite, used);
        });
        // For doubles, show remaining count
        if (state.dice.values[0] === state.dice.values[1]) {
            const fontSize = Math.max(9, 11 * l.fontScale);
            ctx.font = `${fontSize}px sans-serif`;
            ctx.fillStyle = COLORS.textLight;
            ctx.textAlign = 'left';
            ctx.fillText(`×${state.dice.remaining.length}`, diceX, diceY + diceSize + 16);
        }
    }
    drawDie(x, y, size, value, isWhite, used) {
        const ctx = this.ctx;
        const r = size * 0.15;
        ctx.globalAlpha = used ? 0.35 : 1.0;
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        roundRect(ctx, x + 2, y + 2, size, size, r);
        ctx.fill();
        // Die body
        ctx.fillStyle = isWhite ? COLORS.diceWhite : COLORS.diceDark;
        roundRect(ctx, x, y, size, size, r);
        ctx.fill();
        ctx.strokeStyle = isWhite ? '#999' : '#555';
        ctx.lineWidth = 1.5;
        roundRect(ctx, x, y, size, size, r);
        ctx.stroke();
        // Dots
        const dotColor = isWhite ? COLORS.diceDot : COLORS.diceDotLight;
        const dotR = size * 0.1;
        const m = size * 0.25; // margin from edge to dot center
        const c = size / 2; // center
        const dotPositions = [
            [[c, c]],
            [[m, m], [size - m, size - m]],
            [[m, m], [c, c], [size - m, size - m]],
            [[m, m], [size - m, m], [m, size - m], [size - m, size - m]],
            [[m, m], [size - m, m], [c, c], [m, size - m], [size - m, size - m]],
            [[m, m], [size - m, m], [m, c], [size - m, c], [m, size - m], [size - m, size - m]],
        ];
        const positions = dotPositions[value - 1] || [];
        ctx.fillStyle = dotColor;
        for (const [dx, dy] of positions) {
            ctx.beginPath();
            ctx.arc(x + dx, y + dy, dotR, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1.0;
    }
    renderHUD(state) {
        if (!this.layout)
            return;
        const l = this.layout;
        const ctx = this.ctx;
        // ── Message row (top) ─────────────────────────────────────────────────────
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillRect(0, l.msgY, this.width, l.msgH);
        const fontSize = Math.max(11, 13 * l.fontScale);
        const smallFont = Math.max(9, 11 * l.fontScale);
        const msgCY = l.msgY + l.msgH / 2;
        const loc = t();
        const playerColor = state.currentPlayer === 'white' ? '#f5f0e8' : '#8888cc';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        // Left: player status
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillStyle = playerColor;
        const playerName = state.currentPlayer === 'white' ? loc.youTurn : loc.aiTurn;
        let statusMsg = '';
        if (state.phase === 'rollingForFirst') {
            ctx.fillStyle = '#aaccff';
            if (!state.initialRoll) {
                statusMsg = loc.rollForFirstPrompt;
            }
            else if (state.initialRoll.white === state.initialRoll.black) {
                statusMsg = loc.rollForFirstTie;
            }
            else {
                statusMsg = state.currentPlayer === 'white' ? loc.rollForFirstWhiteFirst : loc.rollForFirstBlackFirst;
            }
        }
        else if (state.phase === 'waitingForRoll') {
            statusMsg = `${playerName}: ${loc.clickRoll}`;
        }
        else if (state.phase === 'playerActing') {
            statusMsg = `${playerName}: ${loc.selectPiece}`;
        }
        else if (state.phase === 'aiThinking') {
            ctx.fillStyle = '#aaaacc';
            statusMsg = loc.aiThinking;
        }
        else if (state.phase === 'gameOver') {
            ctx.fillStyle = COLORS.winText;
            statusMsg = state.winner === 'white' ? loc.youWin : loc.aiWins;
        }
        ctx.fillText(statusMsg, 8, msgCY);
        // Right: dice remaining  |  save time  (no overlap with left text)
        ctx.textAlign = 'right';
        if (state.errorMessage) {
            ctx.font = `${smallFont}px sans-serif`;
            ctx.fillStyle = COLORS.error;
            ctx.fillText(state.errorMessage, this.width - 8, msgCY);
        }
        else if (state.dice) {
            ctx.font = `${smallFont}px sans-serif`;
            ctx.fillStyle = COLORS.textDim;
            ctx.fillText(`🎲 [${state.dice.remaining.join(', ')}]`, this.width - 8, msgCY);
        }
        else if (state.lastSaveTime) {
            ctx.font = `${smallFont}px sans-serif`;
            ctx.fillStyle = '#558855';
            ctx.fillText(`💾 ${formatTime(state.lastSaveTime)}`, this.width - 8, msgCY);
        }
        // ── Button row (bottom) ───────────────────────────────────────────────────
        ctx.fillStyle = 'rgba(0,0,0,0.60)';
        ctx.fillRect(0, l.btnAreaY, this.width, l.btnAreaH);
        // Thin separator line between the two rows
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, l.btnAreaY);
        ctx.lineTo(this.width, l.btnAreaY);
        ctx.stroke();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
    }
    renderWinScreen(winner) {
        const ctx = this.ctx;
        ctx.fillStyle = COLORS.winBg;
        ctx.fillRect(0, 0, this.width, this.height);
        const cx = this.width / 2;
        const cy = this.height / 2;
        ctx.textAlign = 'center';
        ctx.font = `bold ${Math.max(28, 36 * (this.layout?.fontScale ?? 1))}px sans-serif`;
        ctx.fillStyle = COLORS.winText;
        const loc = t();
        ctx.fillText(winner === 'white' ? loc.youWin : loc.aiWins, cx, cy - 20);
        ctx.font = `${Math.max(14, 18 * (this.layout?.fontScale ?? 1))}px sans-serif`;
        ctx.fillStyle = '#cccccc';
        ctx.fillText(loc.newGameHint, cx, cy + 20);
        ctx.textAlign = 'left';
    }
    // Draw initial roll result: two dice side by side with player labels
    renderInitialRollDice(initialRoll, winner) {
        if (!this.layout)
            return;
        const l = this.layout;
        const ctx = this.ctx;
        const isTie = initialRoll.white === initialRoll.black;
        const diceSize = Math.min(64, l.checkerR * 3.2, 80) * l.fontScale;
        const gap = diceSize * 0.4;
        const totalW = diceSize * 2 + gap;
        const cx = this.width / 2;
        // Center vertically in the board area
        const diceY = l.boardY + l.boardH / 2 - diceSize / 2;
        const whiteX = cx - totalW / 2;
        const blackX = cx + gap / 2 + diceSize;
        // Dim overlay behind dice to make them pop
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        const padH = diceSize * 0.5;
        const padV = diceSize * 0.55;
        roundRect(ctx, cx - totalW / 2 - padH, diceY - padV, totalW + padH * 2, diceSize + padV * 2, 12);
        ctx.fill();
        // Draw dice — white die on left, black die on right
        const isWhiteWinner = !isTie && winner === 'white';
        const isBlackWinner = !isTie && winner === 'black';
        ctx.globalAlpha = isTie || isWhiteWinner ? 1.0 : 0.5;
        this.drawDie(whiteX, diceY, diceSize, initialRoll.white, true, false);
        ctx.globalAlpha = isTie || isBlackWinner ? 1.0 : 0.5;
        this.drawDie(blackX, diceY, diceSize, initialRoll.black, false, false);
        ctx.globalAlpha = 1.0;
        // "VS" label between dice
        const labelFont = Math.max(10, 12 * l.fontScale);
        ctx.font = `bold ${labelFont}px sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('VS', cx, diceY + diceSize / 2);
        // Player labels below dice
        const nameFont = Math.max(9, 11 * l.fontScale);
        ctx.font = `${nameFont}px sans-serif`;
        const loc = t();
        ctx.fillStyle = isTie || isWhiteWinner ? '#f5f0e8' : 'rgba(245,240,232,0.4)';
        ctx.fillText(loc.labelWhite, whiteX + diceSize / 2, diceY + diceSize + diceSize * 0.3);
        ctx.fillStyle = isTie || isBlackWinner ? '#aaaaff' : 'rgba(170,170,255,0.4)';
        ctx.fillText(loc.labelBlack, blackX + diceSize / 2, diceY + diceSize + diceSize * 0.3);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
    }
    // Highlight valid target points with a glow effect
    renderValidTargets(state) {
        if (!this.layout)
            return;
        const l = this.layout;
        const ctx = this.ctx;
        for (const move of state.validMoves) {
            if (move.to === -1 || move.to === 26) {
                // Bear off highlight
                this.drawBearOffHighlight(move.to, state.currentPlayer);
                continue;
            }
            const center = this.getPointCenter(move.to);
            if (!center)
                continue;
            ctx.beginPath();
            ctx.arc(center.x, center.y, l.checkerR * 1.1, 0, Math.PI * 2);
            ctx.strokeStyle = COLORS.validTargetBorder;
            ctx.lineWidth = 3;
            ctx.setLineDash([4, 3]);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }
    drawBearOffHighlight(to, player) {
        if (!this.layout)
            return;
        const l = this.layout;
        const ctx = this.ctx;
        ctx.strokeStyle = COLORS.validTargetBorder;
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 3]);
        if (!l.isPortrait) {
            const bearX = player === 'white' ? l.whiteBearOffX : l.blackBearOffX;
            roundRect(ctx, bearX + 2, l.boardY + 2, l.bearOffW - 4, l.boardH - 4, 4);
            ctx.stroke();
        }
        else {
            const bearY = player === 'white'
                ? l.boardY + l.boardH + 4
                : l.boardY - l.bearOffW - 4;
            roundRect(ctx, l.boardX + 2, bearY + 2, l.boardW - 4, l.bearOffW - 4, 4);
            ctx.stroke();
        }
        ctx.setLineDash([]);
    }
}
// Utility: draw a rounded rectangle path
function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}
function lightenColor(hex, amount) {
    // Simple lightening for CSS hex colors
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, (num >> 16) + amount);
    const g = Math.min(255, ((num >> 8) & 0xff) + amount);
    const b = Math.min(255, (num & 0xff) + amount);
    return `rgb(${r},${g},${b})`;
}
function formatTime(ts) {
    const d = new Date(ts);
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    const s = d.getSeconds().toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
}
//# sourceMappingURL=CanvasRenderer.js.map