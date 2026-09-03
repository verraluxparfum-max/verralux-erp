/* Verralux Parfum ERP — IndexedDB layer
   Single-user, fully offline. All persistence lives here. */

const DB_NAME = 'verralux_erp';
const DB_VERSION = 1;

const STORES = {
  materials:   { keyPath: 'id', indexes: ['name', 'category', 'supplierId'] },
  suppliers:   { keyPath: 'id', indexes: ['name'] },
  customers:   { keyPath: 'id', indexes: ['name'] },
  formulas:    { keyPath: 'id', indexes: ['sku', 'name'] },
  batches:     { keyPath: 'id', indexes: ['formulaId', 'batchNumber', 'date'] },
  finishedGoods:{ keyPath: 'id', indexes: ['sku', 'batchId'] },
  assets:      { keyPath: 'id', indexes: ['name', 'category'] },
  expenses:    { keyPath: 'id', indexes: ['date', 'category'] },
  purchaseOrders: { keyPath: 'id', indexes: ['supplierId', 'date', 'status'] },
  grns:        { keyPath: 'id', indexes: ['poId', 'date'] },
  salesInvoices: { keyPath: 'id', indexes: ['customerId', 'date', 'status'] },
  payments:    { keyPath: 'id', indexes: ['type', 'date', 'refId'] },
  meta:        { keyPath: 'key', indexes: [] }
};

let _db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (_db) return resolve(_db);
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      for (const [storeName, cfg] of Object.entries(STORES)) {
        if (!db.objectStoreNames.contains(storeName)) {
          const store = db.createObjectStore(storeName, { keyPath: cfg.keyPath });
          for (const idx of cfg.indexes) {
            store.createIndex(idx, idx, { unique: false });
          }
        }
      }
    };

    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror = (e) => reject(e.target.error);
  });
}

function genId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function tx(storeName, mode = 'readonly') {
  return openDB().then(db => db.transaction(storeName, mode).objectStore(storeName));
}

const DB = {
  async put(storeName, record) {
    const store = await tx(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.put(record);
      req.onsuccess = () => resolve(record);
      req.onerror = (e) => reject(e.target.error);
    });
  },

  async add(storeName, record, prefix) {
    if (!record.id) record.id = genId(prefix || storeName.slice(0, 3));
    if (!record.createdAt) record.createdAt = new Date().toISOString();
    return DB.put(storeName, record);
  },

  async get(storeName, id) {
    const store = await tx(storeName);
    return new Promise((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = (e) => reject(e.target.error);
    });
  },

  async getAll(storeName) {
    const store = await tx(storeName);
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = (e) => reject(e.target.error);
    });
  },

  async getByIndex(storeName, indexName, value) {
    const store = await tx(storeName);
    return new Promise((resolve, reject) => {
      const req = store.index(indexName).getAll(value);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = (e) => reject(e.target.error);
    });
  },

  async delete(storeName, id) {
    const store = await tx(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = (e) => reject(e.target.error);
    });
  },

  async clear(storeName) {
    const store = await tx(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = (e) => reject(e.target.error);
    });
  },

  async exportAll() {
    const out = {};
    for (const storeName of Object.keys(STORES)) {
      out[storeName] = await DB.getAll(storeName);
    }
    return out;
  },

  async importAll(data) {
    for (const [storeName, records] of Object.entries(data)) {
      if (!STORES[storeName]) continue;
      for (const record of records) {
        await DB.put(storeName, record);
      }
    }
  }
};

window.DB = DB;
window.genId = genId;
