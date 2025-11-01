/**
 * Generic IndexedDB Manager
 * 
 * Provides a type-safe, reusable API for IndexedDB operations.
 * Can be used for any store: offline chapters, TTS cache, bookmarks, etc.
 */

export interface StoreConfig {
    name: string;
    keyPath: string;
    indexes?: Array<{ name: string; keyPath: string | string[]; unique?: boolean }>;
}

export interface IndexedDBConfig {
    dbName: string;
    version: number;
    stores: StoreConfig[];
}

/**
 * Creates and manages an IndexedDB database
 */
export class IndexedDBManager {
    private config: IndexedDBConfig;
    private dbPromise: Promise<IDBDatabase> | null = null;

    constructor(config: IndexedDBConfig) {
        this.config = config;
    }

    /**
     * Opens the database and creates/upgrades stores as needed
     */
    private openDB(): Promise<IDBDatabase> {
        if (this.dbPromise) {
            return this.dbPromise;
        }

        this.dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(this.config.dbName, this.config.version);

            request.onupgradeneeded = () => {
                const db = request.result;
                
                // Create or upgrade stores
                for (const storeConfig of this.config.stores) {
                    if (!db.objectStoreNames.contains(storeConfig.name)) {
                        const store = db.createObjectStore(storeConfig.name, { 
                            keyPath: storeConfig.keyPath 
                        });

                        // Create indexes if specified
                        if (storeConfig.indexes) {
                            for (const index of storeConfig.indexes) {
                                store.createIndex(index.name, index.keyPath, { 
                                    unique: index.unique || false 
                                });
                            }
                        }
                    }
                }
            };

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        return this.dbPromise;
    }

    /**
     * Executes a function with a store transaction
     */
    private async withStore<T>(
        storeName: string, 
        mode: IDBTransactionMode, 
        fn: (store: IDBObjectStore) => Promise<T> | T
    ): Promise<T> {
        const db = await this.openDB();
        return new Promise<T>((resolve, reject) => {
            const tx = db.transaction(storeName, mode);
            const store = tx.objectStore(storeName);
            
            Promise.resolve(fn(store))
                .then((result) => {
                    tx.oncomplete = () => resolve(result);
                    tx.onerror = () => reject(tx.error);
                    tx.onabort = () => reject(tx.error);
                })
                .catch(reject);
        });
    }

    /**
     * Gets a single record by key
     */
    async get<T>(storeName: string, key: string | number): Promise<T | undefined> {
        return this.withStore<T | undefined>(storeName, 'readonly', (store) => {
            const req = store.get(key);
            return new Promise((resolve) => {
                req.onsuccess = () => resolve(req.result || undefined);
                req.onerror = () => resolve(undefined);
            });
        });
    }

    /**
     * Gets all records from a store
     */
    async getAll<T>(storeName: string): Promise<T[]> {
        return this.withStore<T[]>(storeName, 'readonly', (store) => {
            const req = store.getAll();
            return new Promise((resolve) => {
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => resolve([]);
            });
        });
    }

    /**
     * Gets records by index
     */
    async getByIndex<T>(
        storeName: string, 
        indexName: string, 
        value: string | number
    ): Promise<T[]> {
        return this.withStore<T[]>(storeName, 'readonly', (store) => {
            const index = store.index(indexName);
            const req = index.getAll(value);
            return new Promise((resolve) => {
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => resolve([]);
            });
        });
    }

    /**
     * Puts (inserts or updates) a record
     */
    async put<T>(storeName: string, record: T): Promise<void> {
        await this.withStore<void>(storeName, 'readwrite', (store) => {
            store.put(record);
            return Promise.resolve();
        });
    }

    /**
     * Deletes a record by key
     */
    async delete(storeName: string, key: string | number): Promise<void> {
        await this.withStore<void>(storeName, 'readwrite', (store) => {
            store.delete(key);
            return Promise.resolve();
        });
    }

    /**
     * Clears all records from a store
     */
    async clear(storeName: string): Promise<void> {
        await this.withStore<void>(storeName, 'readwrite', (store) => {
            store.clear();
            return Promise.resolve();
        });
    }

    /**
     * Counts records in a store
     */
    async count(storeName: string): Promise<number> {
        return this.withStore<number>(storeName, 'readonly', (store) => {
            const req = store.count();
            return new Promise((resolve) => {
                req.onsuccess = () => resolve(req.result || 0);
                req.onerror = () => resolve(0);
            });
        });
    }

    /**
     * Executes a custom transaction function
     * Useful for complex operations that need multiple store operations
     */
    async transaction<T>(
        storeName: string,
        mode: IDBTransactionMode,
        fn: (store: IDBObjectStore) => Promise<T> | T
    ): Promise<T> {
        return this.withStore(storeName, mode, fn);
    }
}

/**
 * Creates a singleton IndexedDB manager
 */
export function createIndexedDBManager(config: IndexedDBConfig): IndexedDBManager {
    return new IndexedDBManager(config);
}

