// HUD: renders on-canvas UI elements (buttons, status)
// This module draws interactive UI on top of the game canvas

import { GameState, Player } from '../game/Types.js';
import { ButtonArea } from '../input/InputController.js';

const BUTTON_COLORS = {
  roll: { bg: '#3d8b3d', hover: '#4da84d', text: '#ffffff', border: '#2a5f2a' },
  newGame: { bg: '#8b3d3d', hover: '#a84d4d', text: '#ffffff', border: '#5f2a2a' },
  clearSave: { bg: '#4a4a5a', hover: '#5a5a6a', text: '#cccccc', border: '#333344' },
  default: { bg: '#3d5a8b', hover: '#4d6aa8', text: '#ffffff', border: '#2a3f5f' },
};

export function renderButtons(
  ctx: CanvasRenderingContext2D,
  buttons: ButtonArea[],
  state: GameState,
  fontScale: number
): void {
  for (const btn of buttons) {
    if (!btn.visible(state)) continue;

    let colors = BUTTON_COLORS.default;
    if (btn.action.type === 'rollDice') colors = BUTTON_COLORS.roll;
    else if (btn.action.type === 'newGame') colors = BUTTON_COLORS.newGame;
    else if (btn.action.type === 'clearSave') colors = BUTTON_COLORS.clearSave;

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

    // Button label
    const fontSize = Math.max(10, 12 * fontScale);
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.fillStyle = colors.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
  }
}

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
): void {
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

// Render a notification/toast message
export function renderToast(
  ctx: CanvasRenderingContext2D,
  message: string,
  canvasW: number,
  canvasH: number,
  fontScale: number
): void {
  const fontSize = Math.max(12, 14 * fontScale);
  ctx.font = `${fontSize}px sans-serif`;
  const textW = ctx.measureText(message).width;
  const padH = 10;
  const padV = 6;
  const boxW = textW + padH * 2;
  const boxH = fontSize + padV * 2;
  const x = (canvasW - boxW) / 2;
  const y = canvasH * 0.6;

  ctx.fillStyle = 'rgba(20,20,40,0.85)';
  drawRoundRect(ctx, x, y, boxW, boxH, 6);
  ctx.fill();

  ctx.strokeStyle = '#ff6b6b';
  ctx.lineWidth = 1.5;
  drawRoundRect(ctx, x, y, boxW, boxH, 6);
  ctx.stroke();

  ctx.fillStyle = '#ff9999';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(message, canvasW / 2, y + boxH / 2);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
}

// Render save/restore prompt at startup
export function renderRestorePrompt(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  saveTime: number,
  fontScale: number
): { continueBtn: ButtonArea; newGameBtn: ButtonArea } {
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

  // Title
  const titleFont = Math.max(14, 18 * fontScale);
  ctx.font = `bold ${titleFont}px sans-serif`;
  ctx.fillStyle = '#ffe066';
  ctx.textAlign = 'center';
  ctx.fillText('Saved Game Found', canvasW / 2, y + 30 * fontScale);

  const d = new Date(saveTime);
  const timeStr = d.toLocaleString();
  const infoFont = Math.max(10, 12 * fontScale);
  ctx.font = `${infoFont}px sans-serif`;
  ctx.fillStyle = '#aacccc';
  ctx.fillText(`Last saved: ${timeStr}`, canvasW / 2, y + 55 * fontScale);

  const btnW = boxW * 0.38;
  const btnH = Math.min(36, boxH * 0.22);
  const btnY = y + boxH - btnH - 16 * fontScale;

  const continueBtn: ButtonArea = {
    x: canvasW / 2 - btnW - 8,
    y: btnY,
    w: btnW,
    h: btnH,
    action: { type: 'continueGame' },
    label: 'Continue',
    visible: () => true,
  };

  const newGameBtn: ButtonArea = {
    x: canvasW / 2 + 8,
    y: btnY,
    w: btnW,
    h: btnH,
    action: { type: 'newGame' },
    label: 'New Game',
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
