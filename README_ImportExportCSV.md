# CSV Import and Export Functions Explained

This document explains how the following CSV-related functions work in the Workout Tracker app:

- `downloadCSV()`
- `importCSV(event)`
- `importFullCSV(event)`

It focuses on **purpose**, **inputs**, **outputs**, and the **JavaScript / Web APIs** used inside each function.

---

## Big Picture

CSV features provide a **human-readable interchange format** for workout data:

| Feature | Behavior |
|------|--------|
| Export CSV | Converts in-memory logs → downloadable file |
| Import CSV | Appends CSV rows into existing data |
| Full CSV Import | Replaces all existing data with CSV contents |

All three functions operate on the **in-memory state** first (`workoutLogs`, `plans`) and then persist changes using `saveData()`.

---

## 1. `downloadCSV()` — Export Workout Data

```js
function downloadCSV() { ... }
```

### Purpose

- Exports **all workout data** currently stored in memory (`workoutLogs`) into a single CSV file.
- Generates a complete CSV backup of every logged workout
- Can be safely re-imported using the **Full CSV Import** feature

---

### Inputs

| Input | Source |
|----|------|
| Workout logs | `workoutLogs` array |

---

### Outputs

- A downloaded `.csv` file containing all dates, plans, exercises, and sets
- No return value

---

### Methods & APIs Used

#### `Array.map()`

```js
logs.map(log => [...].join(","))
```

Transforms each log object into a CSV row.

---

#### `Array.join()`

```js
headers.join(",")
```

Combines columns into CSV-compatible lines.

---

#### `Blob`

```js
new Blob([csv], { type: "text/csv" })
```

Creates a file-like object in memory representing the CSV contents.

---

#### `URL.createObjectURL()`

```js
URL.createObjectURL(blob)
```

Generates a temporary URL pointing to the Blob.

---

#### Programmatic `<a>` click

```js
a.click();
```

Triggers the browser download dialog.

---

## 2. `importCSV(event)` — Append CSV Data

```js
function importCSV(event) { ... }
```

### Purpose

- Imports CSV data and **adds it** to existing workouts
- Auto-creates missing plans and exercises
- Preserves existing IndexedDB data

---

### Inputs

| Input | Description |
|----|-----------|
| `event` | File input change event |
| CSV file | User-selected `.csv` |

---

### Outputs

- New entries added to `workoutLogs`
- Updated `plans`
- IndexedDB updated via `saveData()`

---

### Methods & APIs Used

#### `<input type="file">` + `change` event

Allows the user to select a local CSV file.

---

#### `FileReader`

```js
const reader = new FileReader();
reader.readAsText(file);
```

Reads file contents asynchronously.

---

#### `String.split()`

```js
text.split("\n")
```

Breaks CSV text into rows and columns.

---

#### Header validation

```js
required.some((h,i)=>headers[i] !== h)
```

Ensures CSV column order matches expectations.

---

#### `parseInt(value, 10)`

```js
set: parseInt(set, 10)
```

Converts CSV string values into numbers.

---

#### In-memory merge logic

```js
workoutLogs.push({ ... })
```

Appends logs instead of replacing them.

---

#### `saveData()`

Persists merged data to IndexedDB.

---

## 3. `importFullCSV(event)` — Replace All Data

```js
async function importFullCSV(event) { ... }
```

### Purpose

- Performs a **destructive import**
- Completely replaces all existing data
- CSV equivalent of JSON restore

---

### Inputs

| Input | Description |
|----|-----------|
| `event` | File input change event |
| CSV file | Full database backup |

---

### Outputs

- `plans` and `workoutLogs` fully rebuilt
- IndexedDB overwritten

---

### Methods & APIs Used

#### Memory reset

```js
plans = {};
workoutLogs = [];
```

Clears all existing state before import.

---

#### Strict header validation

```js
header.join(",") !== required.join(",")
```

Prevents importing incompatible CSV formats.

---

#### Rebuild-from-scratch logic

```js
plans[plan].push(exercise)
```

Reconstructs all relationships from CSV rows.

---

#### `await saveData()`

Ensures IndexedDB is fully overwritten before continuing.

---

#### File input reset

```js
event.target.value = "";
```

Allows re-importing the same file again if needed.

---

## Comparison Summary

| Feature | importCSV | importFullCSV |
|------|----------|---------------|
| Overwrites DB | ❌ No | ✅ Yes |
| Appends data | ✅ Yes | ❌ No |
| Clears memory first | ❌ No | ✅ Yes |
| Safe for incremental imports | ✅ | ❌ |

---

## Data Flow Overview

```text
CSV File
  ↓
FileReader
  ↓
Parse + Validate
  ↓
In-Memory Objects
  ↓
saveData()
  ↓
IndexedDB
```

---

## Key Takeaways

- CSV export/import never touches IndexedDB directly
- All operations go through in-memory state
- `saveData()` is the single persistence boundary
- Full CSV import is intentionally destructive

This design keeps behavior predictable and easy to reason about.

---

**End of document**

