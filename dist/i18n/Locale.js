// Locale.ts: bilingual UI strings (Korean / English)
// Language preference is persisted in localStorage under 'bg_lang'.
const KO = {
    youTurn: '나 (흰색)',
    aiTurn: 'AI (검정)',
    clickRoll: '주사위를 굴리세요 🎲',
    selectPiece: '말을 선택하세요 ♟️',
    aiThinking: 'AI 생각 중... 🤔',
    youWin: '🎉 승리! 🎉',
    aiWins: '🤖 AI 승리!',
    diceLabel: '주사위',
    savedAt: '저장됨',
    btnRollEmoji: '🎲',
    btnRollText: '굴리기',
    btnNewGameEmoji: '🔄',
    btnNewGameText: '새 게임',
    btnClearSaveEmoji: '🗑️',
    btnClearSaveText: '삭제',
    btnLangEmoji: '🌐',
    btnLangText: 'EN',
    btnRoll: '🎲 굴리기',
    btnRollShort: '🎲',
    btnNewGame: '🔄 새 게임',
    btnNewGameShort: '🔄',
    btnClearSave: '🗑️ 저장 삭제',
    btnClearSaveShort: '🗑️',
    btnLang: 'EN',
    newGameHint: '🔄 새 게임 버튼을 눌러 다시 시작하세요',
    savedGameFound: '💾 저장된 게임이 있습니다',
    lastSaved: '마지막 저장',
    btnContinue: '▶️ 이어하기',
    btnContinueText: '이어하기',
    btnNewGamePrompt: '🔄 새 게임',
    labelWhite: '흰색',
    labelBlack: '검정',
    bornOffWhite: '흰 bear-off',
    bornOffBlack: '검 bear-off',
    confirmNewGameTitle: '새 게임 시작',
    confirmNewGameBody: '진행 중인 게임이 사라집니다.\n정말 새 게임을 시작하시겠습니까?',
    confirmYes: '✅ 확인',
    confirmNo: '❌ 취소',
    confirmClearSaveTitle: '저장 데이터 삭제',
    confirmClearSaveBody: '저장된 게임 데이터가 삭제됩니다.\n정말 삭제하시겠습니까?',
    errCannotMove: '그 곳으로 이동할 수 없습니다.',
    errInvalidMove: '잘못된 이동입니다.',
    msgSaveCleared: '저장 데이터가 삭제되었습니다.',
    errClearFailed: '저장 삭제에 실패했습니다.',
    errRestoreFailed: '복원 실패. 새 게임을 시작합니다.',
};
const EN = {
    youTurn: 'YOU (White)',
    aiTurn: 'AI (Black)',
    clickRoll: 'Roll the dice 🎲',
    selectPiece: 'Select a piece ♟️',
    aiThinking: 'AI thinking... 🤔',
    youWin: '🎉 YOU WIN! 🎉',
    aiWins: '🤖 AI WINS!',
    diceLabel: 'Dice',
    savedAt: 'Saved',
    btnRollEmoji: '🎲',
    btnRollText: 'Roll',
    btnNewGameEmoji: '🔄',
    btnNewGameText: 'New',
    btnClearSaveEmoji: '🗑️',
    btnClearSaveText: 'Clear',
    btnLangEmoji: '🌐',
    btnLangText: '한국어',
    btnRoll: '🎲 Roll',
    btnRollShort: '🎲',
    btnNewGame: '🔄 New Game',
    btnNewGameShort: '🔄',
    btnClearSave: '🗑️ Clear Save',
    btnClearSaveShort: '🗑️',
    btnLang: '한국어',
    newGameHint: 'Press 🔄 New Game to play again',
    savedGameFound: '💾 Saved Game Found',
    lastSaved: 'Last saved',
    btnContinue: '▶️ Continue',
    btnContinueText: 'Continue',
    btnNewGamePrompt: '🔄 New Game',
    labelWhite: 'White',
    labelBlack: 'Black',
    bornOffWhite: 'White off',
    bornOffBlack: 'Black off',
    confirmNewGameTitle: 'New Game',
    confirmNewGameBody: 'Your current game will be lost.\nAre you sure you want to start a new game?',
    confirmYes: '✅ Yes',
    confirmNo: '❌ No',
    confirmClearSaveTitle: 'Delete Save Data',
    confirmClearSaveBody: 'Saved game data will be deleted.\nAre you sure?',
    errCannotMove: 'Cannot move there.',
    errInvalidMove: 'Invalid move.',
    msgSaveCleared: 'Save data cleared.',
    errClearFailed: 'Failed to clear save.',
    errRestoreFailed: 'Could not restore. Starting new game.',
};
const LOCALES = { ko: KO, en: EN };
// ── Singleton state ───────────────────────────────────────────────────────────
const STORAGE_KEY = 'bg_lang';
function loadLang() {
    try {
        const v = localStorage.getItem(STORAGE_KEY);
        if (v === 'ko' || v === 'en')
            return v;
    }
    catch { /* ignore */ }
    return 'ko'; // default to Korean
}
let _current = loadLang();
let _onChange = null;
export function getLang() { return _current; }
export function setLang(lang) {
    _current = lang;
    try {
        localStorage.setItem(STORAGE_KEY, lang);
    }
    catch { /* ignore */ }
    _onChange?.();
}
export function toggleLang() {
    setLang(_current === 'ko' ? 'en' : 'ko');
}
/** Register a callback that fires whenever the language changes. */
export function onLangChange(cb) {
    _onChange = cb;
}
/** Returns the current locale string table. */
export function t() {
    return LOCALES[_current];
}
//# sourceMappingURL=Locale.js.map