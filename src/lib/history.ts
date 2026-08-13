import type { HistoryEntry, LocalProfile } from '../types';

const DB_NAME = 'document-power-toolkit';
const STORE_NAME = 'operation-history';
const PROFILE_STORE = 'local-profile';
const DB_VERSION = 3;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp');
      }
      if (!db.objectStoreNames.contains(PROFILE_STORE)) db.createObjectStore(PROFILE_STORE, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open local history database'));
  });
}

export async function getLocalProfile(): Promise<LocalProfile> {
  const db = await openDb();
  const stored = await new Promise<{ key: string; value: LocalProfile } | undefined>((resolve, reject) => {
    const request = db.transaction(PROFILE_STORE).objectStore(PROFILE_STORE).get('profile');
    request.onsuccess = () => resolve(request.result as { key: string; value: LocalProfile } | undefined);
    request.onerror = () => reject(request.error ?? new Error('Unable to read profile'));
  });
  db.close();
  if (stored?.value) {
    const normalized = { ...stored.value, cloudDeviceId: stored.value.cloudDeviceId || crypto.randomUUID() };
    if (normalized.cloudDeviceId !== stored.value.cloudDeviceId) await saveLocalProfile(normalized);
    return normalized;
  }
  const now = new Date().toISOString();
  const profile: LocalProfile = {
    name: 'Local workspace',
    email: '',
    accountId: `ACC-LOCAL-${shortId()}`,
    deviceId: `DEV-WEB-${shortId()}`,
    cloudDeviceId: crypto.randomUUID(),
    releaseChannel: 'developer',
    syncHistory: false,
    syncDiagnostics: false,
    createdAt: now,
    updatedAt: now,
  };
  await saveLocalProfile(profile);
  return profile;
}

export async function saveLocalProfile(profile: LocalProfile): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(PROFILE_STORE, 'readwrite');
    transaction.objectStore(PROFILE_STORE).put({ key: 'profile', value: { ...profile, updatedAt: new Date().toISOString() } });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Unable to save profile'));
  });
  db.close();
}

function shortId(): string {
  return crypto.randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase();
}

export async function saveHistory(entry: HistoryEntry): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(entry);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Unable to save history'));
  });
  db.close();
}

export async function getHistory(limit = 20): Promise<HistoryEntry[]> {
  const db = await openDb();
  const entries = await new Promise<HistoryEntry[]>((resolve, reject) => {
    const request = db.transaction(STORE_NAME).objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as HistoryEntry[]);
    request.onerror = () => reject(request.error ?? new Error('Unable to read history'));
  });
  db.close();
  return entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, limit);
}

export async function clearHistory(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Unable to clear history'));
  });
  db.close();
}
