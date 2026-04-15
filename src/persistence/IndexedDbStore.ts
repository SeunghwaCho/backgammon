// IndexedDB persistence module
// Saves and loads game state using browser's IndexedDB API
// Does NOT use localStorage

import { SaveData } from '../game/Types.js';

const DB_NAME = 'BackgammonDB';
const DB_VERSION = 1;
const STORE_NAME = 'saves';
const SAVE_KEY = 'currentGame';

// Open (or create) the database
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this browser.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      // Handle unexpected version changes
      db.onversionchange = () => {
        db.close();
        console.warn('IndexedDB version changed; connection closed.');
      };
      resolve(db);
    };

    request.onerror = (event) => {
      const err = (event.target as IDBOpenDBRequest).error;
      reject(new Error(`IndexedDB open failed: ${err?.message ?? 'unknown error'}`));
    };

    request.onblocked = () => {
      reject(new Error('IndexedDB open blocked by another connection.'));
    };
  });
}

// Save game data to IndexedDB
export async function saveGame(data: SaveData): Promise<void> {
  let db: IDBDatabase;
  try {
    db = await openDatabase();
  } catch (e) {
    console.error('[IndexedDB] Cannot open DB for save:', e);
    throw e;
  }

  return new Promise((resolve, reject) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(STORE_NAME, 'readwrite');
    } catch (e) {
      db.close();
      reject(new Error(`Cannot create transaction: ${e}`));
      return;
    }

    const store = tx.objectStore(STORE_NAME);
    const req = store.put(data, SAVE_KEY);

    req.onsuccess = () => {
      // Don't resolve until transaction completes
    };

    req.onerror = (event) => {
      const err = (event.target as IDBRequest).error;
      console.error('[IndexedDB] Save put failed:', err);
      reject(new Error(`Save put failed: ${err?.message ?? 'unknown'}`));
    };

    tx.oncomplete = () => {
      db.close();
      resolve();
    };

    tx.onerror = (event) => {
      const err = (event.target as IDBTransaction).error;
      db.close();
      reject(new Error(`Save transaction failed: ${err?.message ?? 'unknown'}`));
    };

    tx.onabort = () => {
      db.close();
      reject(new Error('Save transaction aborted.'));
    };
  });
}

// Load game data from IndexedDB
// Returns null if no save exists
export async function loadGame(): Promise<SaveData | null> {
  let db: IDBDatabase;
  try {
    db = await openDatabase();
  } catch (e) {
    console.error('[IndexedDB] Cannot open DB for load:', e);
    return null; // Fail gracefully - return null so app can start fresh
  }

  return new Promise((resolve) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(STORE_NAME, 'readonly');
    } catch (e) {
      db.close();
      console.error('[IndexedDB] Cannot create read transaction:', e);
      resolve(null);
      return;
    }

    const store = tx.objectStore(STORE_NAME);
    const req = store.get(SAVE_KEY);

    req.onsuccess = (event) => {
      const result = (event.target as IDBRequest<SaveData | undefined>).result;
      db.close();
      resolve(result ?? null);
    };

    req.onerror = (event) => {
      const err = (event.target as IDBRequest).error;
      console.error('[IndexedDB] Load failed:', err);
      db.close();
      resolve(null); // Graceful failure
    };
  });
}

// Delete saved game from IndexedDB
export async function deleteSave(): Promise<void> {
  let db: IDBDatabase;
  try {
    db = await openDatabase();
  } catch (e) {
    console.error('[IndexedDB] Cannot open DB for delete:', e);
    throw e;
  }

  return new Promise((resolve, reject) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(STORE_NAME, 'readwrite');
    } catch (e) {
      db.close();
      reject(new Error(`Cannot create transaction: ${e}`));
      return;
    }

    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(SAVE_KEY);

    req.onerror = (event) => {
      const err = (event.target as IDBRequest).error;
      console.error('[IndexedDB] Delete failed:', err);
      reject(new Error(`Delete failed: ${err?.message ?? 'unknown'}`));
    };

    tx.oncomplete = () => {
      db.close();
      resolve();
    };

    tx.onerror = (event) => {
      const err = (event.target as IDBTransaction).error;
      db.close();
      reject(new Error(`Delete transaction failed: ${err?.message ?? 'unknown'}`));
    };
  });
}

// Check if a save exists
export async function hasSave(): Promise<boolean> {
  const data = await loadGame();
  return data !== null;
}
