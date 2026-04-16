// HUD: renders on-canvas UI elements (buttons, status)
// This module draws interactive UI on top of the game canvas
import { t } from '../i18n/Locale.js';
const BUTTON_COLORS = {
    roll: { bg: '#3d8b3d', hover: '#4da84d', text: '#ffffff', border: '#2a5f2a' },
    newGame: { bg: '#8b3d3d', hover: '#a84d4d', text: '#ffffff', border: '#5f2a2a' },
    clearSave: { bg: '#4a4a5a', hover: '#5a5a6a', text: '#cccccc', border: '#333344' },
    default: { bg: '#3d5a8b', hover: '#4d6aa8', text: '#ffffff', border: '#2a3f5f' },
};
export function renderButtons(ctx, buttons, state, fontScale) {
    for (const btn of buttons) {
        if (!btn.visible(state))
            continue;
        let colors = BUTTON_COLORS.default;
        if (btn.action.type === 'rollDice')
            colors = BUTTON_COLORS.roll;
        else if (btn.action.type === 'newGame')
            colors = BUTTON_COLORS.newGame;
        else if (btn.action.type === 'clearSave')
            colors = BUTTON_COLORS.clearSave;
        // Button shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        drawRoundRect(ctx, btn.x + 2, btn.y + 2, btn.w, btn.h, 5);
        ctx.fill();
        // Button background
        ctx.fillStyle = colors.bg;
        drawRoundRect(ctx, btn.x, btn.y, btn.w, btn.h, 5);
        ctx.fill();
        ctx.strokeStyle = colors.border;
        ctx.lineWidth = 1.5;
        drawRoundRect(ctx, btn.x, btn.y, btn.w, btn.h, 5);
        ctx.stroke();
        // Highlight at top of button for 3D effect
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        drawRoundRect(ctx, btn.x + 1, btn.y + 1, btn.w - 2, btn.h / 2 - 1, 4);
        ctx.fill();
        // Button label: emoji (large) on top half, short text (small) on bottom half
        const cx = btn.x + btn.w / 2;
        ctx.fillStyle = colors.text;
        ctx.textAlign = 'center';
        if (btn.emoji && btn.text) {
            // Two-line layout
            const emojiSize = Math.max(16, Math.min(22, btn.h * 0.48));
            const textSize = Math.max(9, Math.min(12, btn.h * 0.27));
            // vertical split: emoji center at 38% from top, text center at 78%
            const emojiY = btn.y + btn.h * 0.40;
            const textY = btn.y + btn.h * 0.80;
            ctx.font = `${emojiSize}px sans-serif`;
            ctx.textBaseline = 'middle';
            ctx.fillText(btn.emoji, cx, emojiY);
            ctx.font = `bold ${textSize}px sans-serif`;
            ctx.fillText(btn.text, cx, textY);
        }
        else {
            // Fallback single-line
            const fontSize = Math.max(11, Math.min(14, btn.h * 0.35));
            ctx.font = `bold ${fontSize}px sans-serif`;
            ctx.textBaseline = 'middle';
            ctx.fillText(btn.label, cx, btn.y + btn.h / 2);
        }
        ctx.textBaseline = 'alphabetic';
        ctx.textAlign = 'left';
    }
}
function drawRoundRect(ctx, x, y, w, h, r) {
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
const TOAST_STYLES = {
    error: {
        bg: 'rgba(30,10,10,0.92)',
        border: '#ff5555',
        highlight: 'rgba(255,100,100,0.12)',
        text: '#ffcccc',
    },
    info: {
        bg: 'rgba(10,20,40,0.88)',
        border: '#4488cc',
        highlight: 'rgba(80,140,220,0.12)',
        text: '#aad4ff',
    },
};
// Render a notification/toast message centered at (cx, cy) with a maximum width.
export function renderToast(ctx, message, cx, cy, maxWidth, fontScale, variant = 'error') {
    const style = TOAST_STYLES[variant];
    const fontSize = Math.max(12, 14 * fontScale);
    ctx.font = `bold ${fontSize}px sans-serif`;
    const textW = ctx.measureText(message).width;
    const padH = 14;
    const padV = 7;
    const boxW = Math.min(textW + padH * 2, maxWidth);
    const boxH = fontSize + padV * 2;
    const x = cx - boxW / 2;
    const y = cy - boxH / 2;
    // Drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    drawRoundRect(ctx, x + 2, y + 2, boxW, boxH, 8);
    ctx.fill();
    // Background
    ctx.fillStyle = style.bg;
    drawRoundRect(ctx, x, y, boxW, boxH, 8);
    ctx.fill();
    // Border
    ctx.strokeStyle = style.border;
    ctx.lineWidth = 2;
    drawRoundRect(ctx, x, y, boxW, boxH, 8);
    ctx.stroke();
    // Top highlight
    ctx.fillStyle = style.highlight;
    drawRoundRect(ctx, x + 1, y + 1, boxW - 2, boxH / 2, 7);
    ctx.fill();
    // Text (clip to maxWidth to avoid overflow)
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 4, y, boxW - 8, boxH);
    ctx.clip();
    ctx.fillStyle = style.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(message, cx, cy);
    ctx.restore();
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
}
// Render save/restore prompt at startup
export function renderRestorePrompt(ctx, canvasW, canvasH, saveTime, fontScale) {
    const boxW = Math.min(320 * fontScale, canvasW * 0.8);
    const boxH = Math.min(160 * fontScale, canvasH * 0.35);
    const x = (canvasW - boxW) / 2;
    const y = (canvasH - boxH) / 2;
    // Overlay
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, canvasW, canvasH);
    // Box
    ctx.fillStyle = '#1a2a3a';
    drawRoundRect(ctx, x, y, boxW, boxH, 10);
    ctx.fill();
    ctx.strokeStyle = '#4a6a8a';
    ctx.lineWidth = 2;
    drawRoundRect(ctx, x, y, boxW, boxH, 10);
    ctx.stroke();
    const loc = t();
    // Title
    const titleFont = Math.max(14, 18 * fontScale);
    ctx.font = `bold ${titleFont}px sans-serif`;
    ctx.fillStyle = '#ffe066';
    ctx.textAlign = 'center';
    ctx.fillText(loc.savedGameFound, canvasW / 2, y + 30 * fontScale);
    const d = new Date(saveTime);
    const timeStr = d.toLocaleString();
    const infoFont = Math.max(10, 12 * fontScale);
    ctx.font = `${infoFont}px sans-serif`;
    ctx.fillStyle = '#aacccc';
    ctx.fillText(`${loc.lastSaved}: ${timeStr}`, canvasW / 2, y + 55 * fontScale);
    const btnW = boxW * 0.38;
    const btnH = Math.min(52, boxH * 0.28);
    const btnY = y + boxH - btnH - 12 * fontScale;
    const continueBtn = {
        x: canvasW / 2 - btnW - 8,
        y: btnY,
        w: btnW,
        h: btnH,
        action: { type: 'continueGame' },
        label: loc.btnContinue,
        emoji: '▶️',
        text: loc.btnContinueText,
        visible: () => true,
    };
    const newGameBtn = {
        x: canvasW / 2 + 8,
        y: btnY,
        w: btnW,
        h: btnH,
        action: { type: 'newGame' },
        label: loc.btnNewGamePrompt,
        emoji: '🔄',
        text: loc.btnNewGameText,
        visible: () => true,
    };
    // Draw buttons
    const btnColors = [
        { bg: '#3d8b3d', border: '#2a5f2a', text: '#ffffff' },
        { bg: '#8b3d3d', border: '#5f2a2a', text: '#ffffff' },
    ];
    for (const [i, btn] of [continueBtn, newGameBtn].entries()) {
        const c = btnColors[i];
        ctx.fillStyle = c.bg;
        drawRoundRect(ctx, btn.x, btn.y, btn.w, btn.h, 5);
        ctx.fill();
        ctx.strokeStyle = c.border;
        ctx.lineWidth = 1;
        drawRoundRect(ctx, btn.x, btn.y, btn.w, btn.h, 5);
        ctx.stroke();
        ctx.font = `bold ${infoFont}px sans-serif`;
        ctx.fillStyle = c.text;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2);
        ctx.textBaseline = 'alphabetic';
    }
    ctx.textAlign = 'left';
    return { continueBtn, newGameBtn };
}
/**
 * Renders a generic confirmation dialog and returns button hit areas.
 * accentColor: border/accent color for the dialog box.
 */
export function renderConfirmDialog(ctx, canvasW, canvasH, fontScale, title, body, yesAction, noAction, yesLabel, noLabel, accentColor = '#e07020') {
    // Dim background
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, canvasW, canvasH);
    // Dialog box
    const boxW = Math.min(320 * fontScale, canvasW * 0.85);
    const boxH = Math.min(170 * fontScale, canvasH * 0.38);
    const bx = (canvasW - boxW) / 2;
    const by = (canvasH - boxH) / 2;
    ctx.fillStyle = '#1e2020';
    drawRoundRect(ctx, bx, by, boxW, boxH, 12);
    ctx.fill();
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2;
    drawRoundRect(ctx, bx, by, boxW, boxH, 12);
    ctx.stroke();
    // Title
    const titleSize = Math.max(15, 19 * fontScale);
    ctx.font = `bold ${titleSize}px sans-serif`;
    ctx.fillStyle = '#ffe066';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, canvasW / 2, by + boxH * 0.22);
    // Body (supports \n)
    const bodySize = Math.max(11, 13 * fontScale);
    ctx.font = `${bodySize}px sans-serif`;
    ctx.fillStyle = '#cccccc';
    const lines = body.split('\n');
    const lineH = bodySize * 1.5;
    const bodyStartY = by + boxH * 0.42;
    lines.forEach((line, i) => {
        ctx.fillText(line, canvasW / 2, bodyStartY + i * lineH);
    });
    // Buttons
    const btnW = boxW * 0.36;
    const btnH = Math.min(44, boxH * 0.25);
    const btnY = by + boxH - btnH - 14 * fontScale;
    const gap = boxW * 0.06;
    const yesBtn = {
        x: canvasW / 2 - btnW - gap / 2,
        y: btnY, w: btnW, h: btnH,
        action: yesAction,
        label: yesLabel,
        emoji: '✅', text: yesLabel.replace(/^[^\s]+\s*/, ''),
        visible: () => true,
    };
    const noBtn = {
        x: canvasW / 2 + gap / 2,
        y: btnY, w: btnW, h: btnH,
        action: noAction,
        label: noLabel,
        emoji: '❌', text: noLabel.replace(/^[^\s]+\s*/, ''),
        visible: () => true,
    };
    // Draw yes (green) / no (red)
    const palette = [
        { bg: '#2d7a2d', border: '#1a4f1a' },
        { bg: '#7a2d2d', border: '#4f1a1a' },
    ];
    for (const [i, btn] of [yesBtn, noBtn].entries()) {
        const p = palette[i];
        ctx.fillStyle = p.bg;
        drawRoundRect(ctx, btn.x, btn.y, btn.w, btn.h, 6);
        ctx.fill();
        ctx.strokeStyle = p.border;
        ctx.lineWidth = 1.5;
        drawRoundRect(ctx, btn.x, btn.y, btn.w, btn.h, 6);
        ctx.stroke();
        const emojiSize = Math.max(14, Math.min(20, btn.h * 0.42));
        const textSize = Math.max(9, Math.min(12, btn.h * 0.26));
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.font = `${emojiSize}px sans-serif`;
        ctx.fillText(btn.emoji, btn.x + btn.w / 2, btn.y + btn.h * 0.40);
        ctx.font = `bold ${textSize}px sans-serif`;
        ctx.fillText(btn.text, btn.x + btn.w / 2, btn.y + btn.h * 0.80);
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    return { yesBtn, noBtn };
}
export function renderNewGameConfirm(ctx, canvasW, canvasH, fontScale) {
    const loc = t();
    return renderConfirmDialog(ctx, canvasW, canvasH, fontScale, loc.confirmNewGameTitle, loc.confirmNewGameBody, { type: 'confirmNewGame' }, { type: 'cancelNewGame' }, loc.confirmYes, loc.confirmNo, '#e07020');
}
export function renderClearSaveConfirm(ctx, canvasW, canvasH, fontScale) {
    const loc = t();
    return renderConfirmDialog(ctx, canvasW, canvasH, fontScale, loc.confirmClearSaveTitle, loc.confirmClearSaveBody, { type: 'confirmClearSave' }, { type: 'cancelClearSave' }, loc.confirmYes, loc.confirmNo, '#c0392b');
}
//# sourceMappingURL=HUD.js.map