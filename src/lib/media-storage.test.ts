import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  type PersistedMediaRecord,
  deleteMediaAssetFromDb,
  loadAllMediaAssetsFromDb,
  saveMediaAssetToDb,
} from "./media-storage";

type Handler = (() => void) | null;
type FailureMode = "none" | "put-error" | "abort-on-put" | "get-all-error";

class FakeRequest<T> {
  onsuccess: Handler = null;
  onerror: Handler = null;
  result: T;
  error: Error | null = null;

  constructor(result: T) {
    this.result = result;
  }
}

class FakeObjectStore {
  constructor(private readonly transaction: FakeTransaction) {}

  put(record: PersistedMediaRecord): FakeRequest<unknown> {
    return this.write(() => {
      this.transaction.database.records.set(record.id, record);
    });
  }

  delete(id: string): FakeRequest<unknown> {
    return this.write(() => {
      this.transaction.database.records.delete(id);
    });
  }

  getAll(): FakeRequest<PersistedMediaRecord[]> {
    const transaction = this.transaction;
    const request = new FakeRequest<PersistedMediaRecord[]>([]);
    transaction.trackRequest();

    setTimeout(() => {
      if (transaction.database.failure === "get-all-error") {
        request.error = new DOMException("Read failed", "UnknownError");
        request.onerror?.();
        if (!transaction.aborted) transaction.abort();
        transaction.finishRequest();
        return;
      }

      request.result = Array.from(transaction.database.records.values());
      request.onsuccess?.();
      transaction.database.completedReads += 1;
      transaction.finishRequest();
    }, 0);

    return request;
  }

  private write(apply: () => void): FakeRequest<unknown> {
    const transaction = this.transaction;
    const request = new FakeRequest<unknown>(undefined);
    transaction.trackRequest();

    setTimeout(() => {
      const failure = transaction.database.failure;

      if (failure === "put-error") {
        request.error = new DOMException("Quota exceeded", "QuotaExceededError");
        request.onerror?.();
        if (!transaction.aborted) transaction.abort();
        transaction.finishRequest();
        return;
      }

      if (failure === "abort-on-put") {
        transaction.error = new DOMException(
          "Transaction aborted by browser",
          "AbortError"
        );
        transaction.abort();
        transaction.finishRequest();
        return;
      }

      apply();
      request.onsuccess?.();
      transaction.database.completedWrites += 1;
      transaction.finishRequest();
    }, 0);

    return request;
  }
}

class FakeTransaction {
  oncomplete: Handler = null;
  onerror: Handler = null;
  onabort: Handler = null;
  error: Error | null = null;
  aborted = false;
  finished = false;

  private pendingRequests = 0;

  constructor(
    public readonly database: FakeDatabase,
    private readonly autoCommit: boolean
  ) {}

  objectStore(): FakeObjectStore {
    if (this.database.failObjectStore) {
      throw new Error("Store unavailable");
    }
    return new FakeObjectStore(this);
  }

  trackRequest(): void {
    this.pendingRequests += 1;
  }

  finishRequest(): void {
    this.pendingRequests -= 1;
    if (
      this.autoCommit &&
      this.pendingRequests <= 0 &&
      !this.aborted &&
      !this.finished
    ) {
      this.completeNow();
    }
  }

  abort(): void {
    if (this.aborted || this.finished) return;
    this.aborted = true;
    this.finished = true;
    this.database.activeTransaction = null;
    setTimeout(() => this.onabort?.(), 0);
  }

  /** Test-only hook that simulates the browser committing a transaction. */
  completeNow(): void {
    if (this.finished) return;
    this.finished = true;
    this.database.activeTransaction = null;
    this.oncomplete?.();
  }
}

class FakeDatabase {
  readonly records = new Map<string, PersistedMediaRecord>();
  readonly objectStoreNames = { contains: () => true };
  failure: FailureMode = "none";
  autoCommit = false;
  failOpen = false;
  failObjectStore = false;
  closedCount = 0;
  completedWrites = 0;
  completedReads = 0;
  activeTransaction: FakeTransaction | null = null;

  transaction(): FakeTransaction {
    const transaction = new FakeTransaction(this, this.autoCommit);
    this.activeTransaction = transaction;
    return transaction;
  }

  close(): void {
    this.closedCount += 1;
  }
}

function createFakeIndexedDb(database: FakeDatabase) {
  return {
    open() {
      const request = {
        result: database as unknown,
        error: null as Error | null,
        onsuccess: null as Handler,
        onerror: null as Handler,
        onupgradeneeded: null as ((event: { target: unknown }) => void) | null,
        onblocked: null as Handler,
      };

      setTimeout(() => {
        if (database.failOpen) {
          request.error = new Error("Failed to open database");
          request.onerror?.();
          return;
        }
        request.onupgradeneeded?.({ target: request });
        request.onsuccess?.();
      }, 0);

      return request;
    },
  };
}

const globalWithWindow = globalThis as unknown as { window?: unknown };
const originalWindow = globalWithWindow.window;

let database: FakeDatabase;

beforeEach(() => {
  database = new FakeDatabase();
  globalWithWindow.window = { indexedDB: createFakeIndexedDb(database) };
});

afterEach(() => {
  globalWithWindow.window = originalWindow;
});

function createRecord(overrides: Partial<PersistedMediaRecord> = {}): PersistedMediaRecord {
  return {
    id: "asset-1",
    name: "scene.png",
    category: "image",
    mimeType: "image/png",
    size: 1024,
    blob: new Blob(["scene"], { type: "image/png" }),
    thumbnailBlob: null,
    duration: null,
    width: 1280,
    height: 720,
    importedAt: 100,
    lastModified: 50,
    ...overrides,
  };
}

function flushAsync(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 5));
}

async function waitFor(predicate: () => boolean, label: string): Promise<void> {
  const deadline = Date.now() + 2000;
  while (!predicate()) {
    if (Date.now() > deadline) {
      throw new Error(`Timed out waiting for ${label}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
}

describe("media IndexedDB transaction integrity", () => {
  it("resolves a save only after the transaction commits", async () => {
    const record = createRecord();
    let state: "pending" | "resolved" | "rejected" = "pending";

    const promise = saveMediaAssetToDb(record);
    promise.then(
      () => {
        state = "resolved";
      },
      () => {
        state = "rejected";
      }
    );

    await waitFor(() => database.completedWrites === 1, "put request");

    // The put request succeeded, but the transaction has not committed yet.
    expect(state).toBe("pending");
    expect(database.activeTransaction).not.toBeNull();
    expect(database.closedCount).toBe(0);

    database.activeTransaction?.completeNow();
    await promise;
    await flushAsync();

    expect(state).toBe("resolved");
    expect(database.closedCount).toBe(1);
    expect(database.records.get(record.id)?.name).toBe("scene.png");
  });

  it("settles a successful save exactly once even if completion fires again", async () => {
    const record = createRecord();
    let resolvedCount = 0;
    let rejectedCount = 0;

    const promise = saveMediaAssetToDb(record).then(
      () => {
        resolvedCount += 1;
      },
      () => {
        rejectedCount += 1;
      }
    );

    await waitFor(() => database.completedWrites === 1, "put request");
    const transaction = database.activeTransaction;
    transaction?.completeNow();
    await promise;
    await flushAsync();

    transaction?.completeNow();
    transaction?.abort();
    await flushAsync();

    expect(resolvedCount).toBe(1);
    expect(rejectedCount).toBe(0);
    expect(database.closedCount).toBe(1);
  });

  it("rejects with the quota error when a put request fails and settles once", async () => {
    database.failure = "put-error";
    const record = createRecord();
    let resolvedCount = 0;
    let rejectedCount = 0;
    let capturedError: unknown = null;

    const promise = saveMediaAssetToDb(record).then(
      () => {
        resolvedCount += 1;
      },
      (error: unknown) => {
        rejectedCount += 1;
        capturedError = error;
      }
    );

    await promise;
    await flushAsync();
    await flushAsync();

    expect(resolvedCount).toBe(0);
    expect(rejectedCount).toBe(1);
    expect((capturedError as Error).name).toBe("QuotaExceededError");
    expect(database.records.has(record.id)).toBe(false);
    expect(database.closedCount).toBe(1);
  });

  it("rejects when the transaction aborts without a request error", async () => {
    database.failure = "abort-on-put";

    await expect(saveMediaAssetToDb(createRecord())).rejects.toThrow(
      "Transaction aborted by browser"
    );
    expect(database.closedCount).toBe(1);
  });

  it("propagates readonly transaction failures", async () => {
    database.failure = "get-all-error";

    await expect(loadAllMediaAssetsFromDb()).rejects.toThrow("Read failed");
    expect(database.closedCount).toBe(1);
  });

  it("resolves a load only after commit and sorts newest first", async () => {
    database.records.set("asset-old", createRecord({ id: "asset-old", importedAt: 10 }));
    database.records.set(
      "asset-new",
      createRecord({ id: "asset-new", importedAt: 300 })
    );
    database.records.set(
      "asset-middle",
      createRecord({ id: "asset-middle", importedAt: 100 })
    );

    const promise = loadAllMediaAssetsFromDb();
    await waitFor(() => database.completedReads === 1, "getAll request");

    expect(database.closedCount).toBe(0);

    database.activeTransaction?.completeNow();
    const records = await promise;

    expect(records.map((record) => record.id)).toEqual([
      "asset-new",
      "asset-middle",
      "asset-old",
    ]);
    expect(database.closedCount).toBe(1);
  });

  it("resolves a delete only after the transaction commits", async () => {
    const record = createRecord();
    database.records.set(record.id, record);

    let resolved = false;
    const promise = deleteMediaAssetFromDb(record.id);
    promise.then(() => {
      resolved = true;
    });

    await waitFor(() => database.completedWrites === 1, "delete request");

    expect(resolved).toBe(false);
    expect(database.activeTransaction).not.toBeNull();

    database.activeTransaction?.completeNow();
    await promise;
    await flushAsync();

    expect(resolved).toBe(true);
    expect(database.records.has(record.id)).toBe(false);
    expect(database.closedCount).toBe(1);
  });

  it("reports database open failures without using a transaction", async () => {
    database.failOpen = true;

    await expect(saveMediaAssetToDb(createRecord())).rejects.toThrow(
      "Failed to open database"
    );
    expect(database.activeTransaction).toBeNull();
    expect(database.closedCount).toBe(0);
  });

  it("rejects with the original error when the transaction cannot create a store", async () => {
    database.failObjectStore = true;

    await expect(saveMediaAssetToDb(createRecord())).rejects.toThrow(
      "Store unavailable"
    );
    expect(database.closedCount).toBe(1);
  });
});
