const DB_NAME = 'minhas-financas-offline-db'
const DB_VERSION = 1
const STORE_NAME = 'api-cache'

let dbPromise: Promise<IDBDatabase> | null = null

function getDB(): Promise<IDBDatabase> {
    if (dbPromise) return dbPromise

    if (typeof window === 'undefined') {
        return Promise.reject(new Error('IndexedDB is not available'))
    }

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION)

        request.onerror = () => {
            reject(request.error)
        }

        request.onsuccess = () => {
            resolve(request.result)
        }

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME)
            }
        }
    })

    return dbPromise
}

export async function setCache<T>(key: string, data: T): Promise<void> {
    try {
        const db = await getDB()
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite')
            const store = transaction.objectStore(STORE_NAME)

            const request = store.put({
                data,
                timestamp: Date.now()
            }, key)

            request.onsuccess = () => resolve()
            request.onerror = () => reject(request.error)
        })
    } catch (err) {
        console.warn('Failed to save to offline cache:', err)
    }
}

export async function getCache<T>(key: string): Promise<T | null> {
    try {
        const db = await getDB()
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly')
            const store = transaction.objectStore(STORE_NAME)

            const request = store.get(key)

            request.onsuccess = () => {
                if (request.result) {
                    resolve(request.result.data as T)
                } else {
                    resolve(null)
                }
            }
            request.onerror = () => reject(request.error)
        })
    } catch (err) {
        console.warn('Failed to read from offline cache:', err)
        return null
    }
}

export async function clearCacheByKeyPrefix(prefix: string): Promise<void> {
    try {
        const db = await getDB()
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite')
            const store = transaction.objectStore(STORE_NAME)

            const request = store.openCursor()

            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
                if (cursor) {
                    if (typeof cursor.key === 'string' && cursor.key.startsWith(prefix)) {
                        cursor.delete()
                    }
                    cursor.continue()
                } else {
                    resolve()
                }
            }

            request.onerror = () => reject(request.error)
        })
    } catch (err) {
        console.warn('Failed to clear offline cache with prefix:', err)
    }
}
