import type { FeedbackMedia } from "@/types";

const databaseName = "jianfeng-feedback-media-v1";
const storeName = "media";

export interface StoredFeedbackMedia extends FeedbackMedia {
  key: string;
  participationId: string;
  lastModified: number;
  blob: Blob;
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(databaseName, 1);
    request.onerror = () => reject(request.error ?? new Error("无法打开本地素材库"));
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(storeName)) {
        const store = database.createObjectStore(storeName, { keyPath: "key" });
        store.createIndex("participationId", "participationId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function runRequest<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) {
  return openDatabase().then((database) => new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const request = action(transaction.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("素材保存失败"));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("素材保存失败"));
    };
  }));
}

export async function saveFeedbackMedia(participationId: string, file: File): Promise<StoredFeedbackMedia> {
  const id = window.crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const media: StoredFeedbackMedia = {
    key: `${participationId}:${id}`,
    participationId,
    id,
    name: file.name,
    type: file.type,
    size: file.size,
    lastModified: file.lastModified,
    blob: file,
  };
  await runRequest("readwrite", (store) => store.put(media));
  return media;
}

export function listFeedbackMedia(participationId: string): Promise<StoredFeedbackMedia[]> {
  return openDatabase().then((database) => new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).index("participationId").getAll(participationId);
    request.onsuccess = () => resolve((request.result as StoredFeedbackMedia[]).sort((a, b) => a.lastModified - b.lastModified));
    request.onerror = () => reject(request.error ?? new Error("无法读取已保存素材"));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("无法读取已保存素材"));
    };
  }));
}

export function removeFeedbackMedia(participationId: string, id: string) {
  return runRequest("readwrite", (store) => store.delete(`${participationId}:${id}`));
}

export async function clearFeedbackMedia() {
  if (typeof window === "undefined" || !window.indexedDB) return;
  await runRequest("readwrite", (store) => store.clear());
}
