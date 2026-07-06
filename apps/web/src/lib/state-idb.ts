const DB_NAME = 'chat2chat-state-v1';
const STORE = 'kv';

export type StateIdbKey = 'sealed' | 'device-key';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
  });
}

function idbRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

function awaitTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

export async function idbGet(key: StateIdbKey): Promise<string | null> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, 'readonly');
    const value = await idbRequest(tx.objectStore(STORE).get(key));
    return typeof value === 'string' ? value : null;
  } finally {
    db.close();
  }
}

export async function idbSet(key: StateIdbKey, value: string): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    await awaitTransaction(tx);
  } finally {
    db.close();
  }
}

export async function idbRemove(key: StateIdbKey): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    await awaitTransaction(tx);
  } finally {
    db.close();
  }
}

export async function idbClear(): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    await awaitTransaction(tx);
  } finally {
    db.close();
  }
}
