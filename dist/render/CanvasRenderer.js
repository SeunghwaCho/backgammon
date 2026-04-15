// CanvasRenderer: renders the backgammon board using Canvas 2D API
// Supports both landscape (≥600px) and portrait (<600px) modes for Galaxy Fold 7
import { barIndex } from '../game/GameState.js';
import { getSelectablePoints } from '../game/MoveGenerator.js';
import { t } from '../i18n/Locale.js';
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
        this.ctx = ctx;
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
        // HUD height: at least 52px so buttons are always tappable.
        // Use 13% of height but clamp between 52 and 80px.
        const hudH = Math.max(52, Math.min(80, this.height * 0.13));
        if (isPortrait) {
            return this.computePortraitLayout(hudH);
        }
        else {
            return this.computeLandscapeLayout(hudH);
        }
    }
    computeLandscapeLayout(hudH) {
        const w = this.width;
        const h = this.height;
        const fontScale = Math.min(w / 800, h / 500);
        // Reserve hudH at the bottom + a small gap so nothing spills under the HUD.
        const boardH = h - hudH - 6;
        const boardY = 4;
        // Bear-off areas on left and right sides
        const bearOffW = Math.min(50, w * 0.055);
        const boardX = bearOffW + 4;
        const boardW = w - bearOffW * 2 - 8;
        // 12 points per side + bar in middle
        const barW = Math.max(30, boardW * 0.04);
        const pointW = (boardW - barW) / 12;
        const pointH = boardH * 0.42;
        const checkerR = Math.min(pointW * 0.44, pointH / 5.5);
        const barX = boardX + pointW * 6;
        // HUD starts right after the board area.
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
            whiteBearOffX: 0,
            blackBearOffX: w - bearOffW,
            bearOffW,
            isPortrait: false,
            fontScale,
        };
    }
    computePortraitLayout(hudH) {
        const w = this.width;
        const h = this.height;
        const fontScale = Math.min(w / 390, h / 700);
        // Bear-off strips at the very top and just above the HUD.
        const bearOffH = Math.max(28, Math.min(40, h * 0.04));
        // HUD is at the bottom; board occupies the space between the top bear-off
        // strip and the bottom bear-off strip, which sits just above the HUD.
        const hudY = h - hudH;
        const boardY = bearOffH + 4;
        const boardH = hudY - bearOffH - boardY - 4; // gap between board and HUD
        const boardX = 4;
        const boardW = w - 8;
        // In portrait: 12 points per row (top row: 13-24, bottom row: 1-12)
        const barH_val = Math.max(14, boardH * 0.025);
        const pointH = (boardH - barH_val) / 2;
        const pointW = boardW / 12;
        const checkerR = Math.min(pointW * 0.44, pointH / 5.5);
        // For portrait, barX/barW used differently - we'll use barW as barH
        const barX = boardX;
        const barW = boardW; // full width bar in portrait
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
            whiteBearOffX: boardX,
            blackBearOffX: boardX,
            bearOffW: bearOffH, // used as height in portrait
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
        // Bar check
        if (sx >= l.barX && sx <= l.barX + l.barW) {
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
        if (sx >= l.boardX && sx <= l.boardX + l.boardW / 2) {
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
        const barHitZone = Math.max(20, l.boardH * 0.06);
        if (sy < midY - barHitZone / 2) {
            // Top half: points 13-24, col 0=13, col 11=24
            return 13 + col;
        }
        else if (sy > midY + barHitZone / 2) {
            // Bottom half: points 1-12, displayed right-to-left; col 0=12, col 11=1
            return 12 - col;
        }
        // In bar area (generous hit zone)
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
        if (state.phase === 'gameOver' && state.winner) {
            this.renderWinScreen(state.winner);
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
        const maxVisible = 5;
        const spacing = Math.min(l.checkerR * 1.9, l.pointH / (maxVisible + 0.5));
        const dir = isTop ? 1 : -1;
        const cx = center.x;
        // Determine start Y: checkers stack from the board edge inward
        const baseY = isTop
            ? l.boardY + l.checkerR
            : l.boardY + l.boardH - l.checkerR;
        for (let i = 0; i < pt.count && i < maxVisible; i++) {
            const cy = baseY + dir * i * spacing;
            this.drawChecker(cx, cy, l.checkerR, pt.owner, pointIndex === state.selectedPoint);
        }
        // If more than maxVisible, show count
        if (pt.count > maxVisible) {
            const cx = center.x;
            let labelY;
            if (l.isPortrait) {
                if (pointIndex >= 13) {
                    labelY = l.boardY + spacing * maxVisible + l.checkerR * 1.5;
                }
                else {
                    labelY = l.boardY + l.boardH - spacing * maxVisible - l.checkerR * 1.5;
                }
            }
            else {
                labelY = isTop
                    ? l.boardY + spacing * maxVisible + l.checkerR * 1.5
                    : l.boardY + l.boardH - spacing * maxVisible - l.checkerR * 1.5;
            }
            const fontSize = Math.max(10, 12 * l.fontScale);
            this.ctx.font = `bold ${fontSize}px sans-serif`;
            this.ctx.fillStyle = '#ffff00';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(`+${pt.count - maxVisible}`, cx, labelY);
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
    drawBearOffAreas(state) {
        if (!this.layout)
            return;
        const l = this.layout;
        const ctx = this.ctx;
        // White bear-off (left side)
        ctx.fillStyle = 'rgba(245,240,232,0.15)';
        ctx.fillRect(l.whiteBearOffX, l.boardY, l.bearOffW, l.boardH);
        ctx.strokeStyle = 'rgba(245,240,232,0.4)';
        ctx.lineWidth = 1;
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
        ctx.fillStyle = 'rgba(26,26,46,0.25)';
        ctx.fillRect(l.blackBearOffX, l.boardY, l.bearOffW, l.boardH);
        ctx.strokeStyle = 'rgba(100,100,140,0.4)';
        ctx.lineWidth = 1;
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
        // White bear-off: below the board
        const whiteY = l.boardY + l.boardH + 4;
        ctx.fillStyle = 'rgba(245,240,232,0.12)';
        ctx.fillRect(l.boardX, whiteY, l.boardW / 2, bh);
        ctx.strokeStyle = 'rgba(245,240,232,0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(l.boardX, whiteY, l.boardW / 2, bh);
        const fontSize = Math.max(9, 10 * l.fontScale);
        ctx.font = `${fontSize}px sans-serif`;
        ctx.fillStyle = COLORS.textLight;
        ctx.textAlign = 'left';
        ctx.fillText(`♙ ${state.whiteBorneOff}`, l.boardX + 4, whiteY + bh / 2 + 4);
        // Black bear-off: above the board
        const blackY = l.boardY - bh - 4;
        ctx.fillStyle = 'rgba(26,26,46,0.2)';
        ctx.fillRect(l.boardX, blackY, l.boardW / 2, bh);
        ctx.strokeStyle = 'rgba(100,100,140,0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(l.boardX, blackY, l.boardW / 2, bh);
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
        const diceSize = Math.min(36, l.checkerR * 1.8, 44) * l.fontScale;
        const padding = 6;
        const player = state.currentPlayer;
        let diceX, diceY;
        if (l.isPortrait) {
            diceX = l.boardX + l.boardW / 2 + 4;
            diceY = l.boardY + l.boardH / 2 - diceSize - padding;
        }
        else {
            // Place dice in bar area
            diceX = l.barX + l.barW / 2 - diceSize - padding / 2;
            diceY = l.boardY + l.boardH / 2 - diceSize;
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
            const rx = l.isPortrait
                ? diceX
                : l.barX + l.barW / 2 - diceSize;
            ctx.fillText(`×${state.dice.remaining.length}`, rx, diceY + diceSize + 14);
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
        // HUD background
        ctx.fillStyle = COLORS.hudBg;
        ctx.fillRect(0, l.hudY, this.width, l.hudH);
        const fontSize = Math.max(11, 13 * l.fontScale);
        const smallFont = Math.max(9, 11 * l.fontScale);
        ctx.textAlign = 'left';
        let x = 8;
        const cy = l.hudY + l.hudH / 2;
        // Current player indicator
        ctx.font = `bold ${fontSize}px sans-serif`;
        const playerColor = state.currentPlayer === 'white' ? '#f5f0e8' : '#8888cc';
        ctx.fillStyle = playerColor;
        const loc = t();
        const playerName = state.currentPlayer === 'white' ? loc.youTurn : loc.aiTurn;
        if (state.phase === 'waitingForRoll') {
            ctx.fillText(`${playerName}: ${loc.clickRoll}`, x, cy - 4);
        }
        else if (state.phase === 'playerActing') {
            ctx.fillText(`${playerName}: ${loc.selectPiece}`, x, cy - 4);
        }
        else if (state.phase === 'aiThinking') {
            ctx.fillStyle = '#aaaacc';
            ctx.fillText(loc.aiThinking, x, cy - 4);
        }
        else if (state.phase === 'gameOver') {
            ctx.fillStyle = COLORS.winText;
            ctx.fillText(state.winner === 'white' ? loc.youWin : loc.aiWins, x, cy - 4);
        }
        // Dice info
        if (state.dice) {
            const diceStr = `🎲 ${loc.diceLabel}: [${state.dice.remaining.join(', ')}]`;
            ctx.font = `${smallFont}px sans-serif`;
            ctx.fillStyle = COLORS.textDim;
            ctx.fillText(diceStr, x, cy + 12);
        }
        // Save status
        if (state.lastSaveTime) {
            const saveStr = `💾 ${loc.savedAt} ${formatTime(state.lastSaveTime)}`;
            ctx.font = `${smallFont}px sans-serif`;
            ctx.fillStyle = '#558855';
            ctx.textAlign = 'right';
            ctx.fillText(saveStr, this.width - 8, l.hudY + l.hudH - 6);
        }
        // Error message
        if (state.errorMessage) {
            ctx.font = `${smallFont}px sans-serif`;
            ctx.fillStyle = COLORS.error;
            ctx.textAlign = 'center';
            ctx.fillText(state.errorMessage, this.width / 2, l.hudY + l.hudH - 6);
        }
        ctx.textAlign = 'left';
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
            roundRect(ctx, l.boardX + 2, bearY + 2, l.boardW / 2 - 4, l.bearOffW - 4, 4);
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