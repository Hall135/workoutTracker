# IndexedDB Core Functions Explained

This document explains the three core functions used to manage IndexedDB in the Workout Tracker app:

- `openDB()`
- `saveData()`
- `loadData()`

It also describes the IndexedDB APIs they rely on and how the **database** relates to the app’s **in-memory JavaScript objects**.

---

## Big Picture: Database vs In-Memory State

The app uses **two layers of data**:

### 1. In-memory JavaScript objects (working state)

```js
let plans = {};
let workoutLogs = [];
```

- Fast to read and modify
- Used directly by the UI
- Lost when the page reloads

### 2. IndexedDB (persistent storage)

- Survives page reloads and browser restarts
- Shared across multiple HTML pages (same origin)
- Slower, asynchronous access

### Sync strategy

| Direction | Function |
|---------|---------|
| DB → Memory | `loadData()` |
| Memory → DB | `saveData()` |
| Setup / Schema | `openDB()` |

The app **always works from memory**, and IndexedDB is used only for persistence.

---

## 1. `openDB()` — Open and Initialize the Database

```js
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("workoutTrackerDB", 1);
    ...
  });
}
```

### Purpose

- Opens the IndexedDB database
- Creates object stores if they don’t exist
- Makes the database connection available globally (`db`)

This function must run **before any read or write operation**.

---

### IndexedDB APIs Used

#### `indexedDB.open(name, version)`

```js
indexedDB.open("workoutTrackerDB", 1);
```

| Parameter | Meaning |
|--------|--------|
| `name` | Database name (shared across pages) |
| `version` | Schema version number |

Changing the version triggers a schema upgrade.

---

#### `onupgradeneeded`

```js
request.onupgradeneeded = (e) => {
  db = e.target.result;
};
```

Runs when:
- The database is created for the first time, or
- The version number increases

Used to define **schema** (object stores and keys).

---

#### `db.createObjectStore(name, options)`

```js
db.createObjectStore("plans", { keyPath: "name" });
db.createObjectStore("logs", { keyPath: "id" });
```

Defines storage “tables”:

| Store | Key | Purpose |
|-----|----|--------|
| `plans` | `name` | Workout plans and exercises |
| `logs` | `id` | Individual workout sets |

---

#### `onsuccess / onerror`

```js
request.onsuccess = () => resolve();
request.onerror = e => reject(e);
```

Signals whether the database is ready for use.

---

### Output

- Returns a `Promise`
- Resolves when the database is open and ready
- Does **not** return data directly

---

## 2. `saveData()` — Persist Memory to IndexedDB

```js
function saveData() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["plans","logs"], "readwrite");
    ...
  });
}
```

### Purpose

- Writes the current in-memory state to IndexedDB
- Keeps database contents in sync with the app state
- Performs a **full overwrite** of stored data

---

### IndexedDB APIs Used

#### `db.transaction(storeNames, mode)`

```js
const tx = db.transaction(["plans","logs"], "readwrite");
```

| Argument | Meaning |
|--------|--------|
| `storeNames` | Object stores involved |
| `mode` | `readwrite` allows changes |

Transactions are **atomic**: all operations succeed or fail together.

---

#### `transaction.objectStore(name)`

```js
const planStore = tx.objectStore("plans");
const logStore = tx.objectStore("logs");
```

Accesses a specific object store inside the transaction.

---

#### `objectStore.clear()`

```js
planStore.clear();
logStore.clear();
```

Deletes all existing records before rewriting.

This guarantees the database exactly matches memory.

---

#### `objectStore.put(value)`

```js
planStore.put({ name, exercises: plans[name] });
logStore.put(log);
```

- Inserts or updates records
- Uses the store’s `keyPath` automatically

---

#### `transaction.oncomplete / onerror`

```js
tx.oncomplete = resolve;
tx.onerror = reject;
```

Signals when all writes finish.

---

### Output

- Returns a `Promise`
- Resolves when all data is safely written

---

## 3. `loadData()` — Load IndexedDB into Memory

```js
function loadData() {
  return new Promise(resolve => {
    plans = {};
    workoutLogs = [];
    ...
  });
}
```

### Purpose

- Reads all stored data from IndexedDB
- Reconstructs in-memory objects
- Called during app initialization

---

### IndexedDB APIs Used

#### Read-only transaction

```js
const tx = db.transaction(["plans","logs"], "readonly");
```

Prevents accidental modification and improves performance.

---

#### `objectStore.getAll()`

```js
planStore.getAll().onsuccess = e => { ... };
logStore.getAll().onsuccess = e => { ... };
```

Reads all records from a store in one operation.

---

### Mapping DB → Memory

```js
plans[p.name] = p.exercises || [];
workoutLogs = e.target.result || [];
```

Transforms raw DB records into the app’s working structures.

---

#### `transaction.oncomplete`

```js
tx.oncomplete = resolve;
```

Ensures all reads finish before the app continues.

---

### Output

- Returns a `Promise`
- Resolves when in-memory state is fully rebuilt

---

## Lifecycle Summary

```text
Page Load
  ↓
openDB()
  ↓
loadData()
  ↓
User interacts with UI (memory only)
  ↓
saveData()
  ↓
IndexedDB updated
```

---

## Why This Architecture Works Well

- ✔ Fast UI (memory-based)
- ✔ Reliable persistence (IndexedDB)
- ✔ Shared data across multiple pages
- ✔ Simple mental model

This pattern is intentionally simple and scales well for small-to-medium web apps.

---

**End of document**

