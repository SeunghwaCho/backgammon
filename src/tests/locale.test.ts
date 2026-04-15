import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  getLang,
  setLang,
  toggleLang,
  t,
  type Lang,
} from '../i18n/Locale.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** All keys defined in the LocaleStrings interface, derived from one locale object */
function getLocaleKeys(): string[] {
  setLang('ko');
  return Object.keys(t());
}

// ── Language switching ────────────────────────────────────────────────────────

describe('getLang / setLang / toggleLang', () => {
  test('setLang("en") makes getLang() return "en"', () => {
    setLang('en');
    assert.equal(getLang(), 'en');
  });

  test('setLang("ko") makes getLang() return "ko"', () => {
    setLang('ko');
    assert.equal(getLang(), 'ko');
  });

  test('toggleLang switches ko → en', () => {
    setLang('ko');
    toggleLang();
    assert.equal(getLang(), 'en');
  });

  test('toggleLang switches en → ko', () => {
    setLang('en');
    toggleLang();
    assert.equal(getLang(), 'ko');
  });

  test('t() returns strings matching current language', () => {
    setLang('en');
    assert.ok(t().youTurn.includes('White'), 'EN youTurn should mention White');
    setLang('ko');
    assert.ok(t().youTurn.includes('흰색'), 'KO youTurn should mention 흰색');
  });
});

// ── Completeness: all keys present and non-empty in both languages ─────────

describe('KO locale completeness', () => {
  test('all LocaleStrings keys are present and non-empty', () => {
    setLang('ko');
    const loc = t();
    const keys = getLocaleKeys();
    for (const key of keys) {
      const value = (loc as unknown as Record<string, string>)[key];
      assert.ok(
        typeof value === 'string' && value.length > 0,
        `KO["${key}"] should be a non-empty string, got: ${JSON.stringify(value)}`
      );
    }
  });
});

describe('EN locale completeness', () => {
  test('all LocaleStrings keys are present and non-empty', () => {
    setLang('en');
    const loc = t();
    const keys = getLocaleKeys();
    for (const key of keys) {
      const value = (loc as unknown as Record<string, string>)[key];
      assert.ok(
        typeof value === 'string' && value.length > 0,
        `EN["${key}"] should be a non-empty string, got: ${JSON.stringify(value)}`
      );
    }
  });
});

describe('KO and EN have the same set of keys', () => {
  test('no key is missing from either locale', () => {
    setLang('ko');
    const koKeys = new Set(Object.keys(t()));
    setLang('en');
    const enKeys = new Set(Object.keys(t()));

    for (const k of koKeys) {
      assert.ok(enKeys.has(k), `Key "${k}" exists in KO but not in EN`);
    }
    for (const k of enKeys) {
      assert.ok(koKeys.has(k), `Key "${k}" exists in EN but not in KO`);
    }
  });
});

// ── Confirm-dialog strings (added with clear-save confirmation) ───────────

describe('confirm dialog strings', () => {
  test('KO confirmNewGameTitle is non-empty', () => {
    setLang('ko');
    assert.ok(t().confirmNewGameTitle.length > 0);
  });

  test('KO confirmNewGameBody contains newline for two-line layout', () => {
    setLang('ko');
    assert.ok(t().confirmNewGameBody.includes('\n'), 'Body should have \\n for line break');
  });

  test('EN confirmNewGameBody contains newline for two-line layout', () => {
    setLang('en');
    assert.ok(t().confirmNewGameBody.includes('\n'));
  });

  test('KO confirmClearSaveTitle is non-empty', () => {
    setLang('ko');
    assert.ok(t().confirmClearSaveTitle.length > 0);
  });

  test('EN confirmClearSaveTitle is non-empty', () => {
    setLang('en');
    assert.ok(t().confirmClearSaveTitle.length > 0);
  });

  test('KO confirmClearSaveBody contains newline', () => {
    setLang('ko');
    assert.ok(t().confirmClearSaveBody.includes('\n'));
  });

  test('EN confirmClearSaveBody contains newline', () => {
    setLang('en');
    assert.ok(t().confirmClearSaveBody.includes('\n'));
  });

  test('confirmNewGame and confirmClearSave have different titles', () => {
    setLang('ko');
    assert.notEqual(t().confirmNewGameTitle, t().confirmClearSaveTitle);
    setLang('en');
    assert.notEqual(t().confirmNewGameTitle, t().confirmClearSaveTitle);
  });

  test('confirmYes and confirmNo are different', () => {
    setLang('ko');
    assert.notEqual(t().confirmYes, t().confirmNo);
    setLang('en');
    assert.notEqual(t().confirmYes, t().confirmNo);
  });
});

// ── Language-specific content spot-checks ────────────────────────────────

describe('language-specific content', () => {
  test('KO and EN youTurn strings are different', () => {
    setLang('ko');
    const ko = t().youTurn;
    setLang('en');
    const en = t().youTurn;
    assert.notEqual(ko, en);
  });

  test('KO and EN aiTurn strings are different', () => {
    setLang('ko');
    const ko = t().aiTurn;
    setLang('en');
    const en = t().aiTurn;
    assert.notEqual(ko, en);
  });

  test('btnLangText: KO shows "EN", EN shows "한국어"', () => {
    setLang('ko');
    assert.equal(t().btnLangText, 'EN');
    setLang('en');
    assert.equal(t().btnLangText, '한국어');
  });

  test('error messages differ between KO and EN', () => {
    setLang('ko');
    const koErr = t().errCannotMove;
    setLang('en');
    const enErr = t().errCannotMove;
    assert.notEqual(koErr, enErr);
  });
});
