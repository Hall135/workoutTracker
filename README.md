# Workout Tracker PWA

A browser-based workout tracker for creating reusable plans, recording exercise sets, reviewing workout history, and graphing progress. It uses a responsive dark theme and can work offline after the application files have been cached.

The application uses:

- **Plain HTML, CSS, and JavaScript**, with no build step or package installation.
- **IndexedDB** for browser-local workout plans and recorded sets.
- A **service worker** that pre-caches the application files for offline use.
- **Bundled Chart.js** for graphs and a **local Material Icons font** for interface icons. These existing assets require no CDN requests.

---

## Features at a Glance

### Plans and workout entry

- Create named workout plans and add exercises to each plan.
- Keep plan management in a collapsible section below workout entry.
- Start with four set rows per exercise; add another row to every exercise with **Add Set**.
- Record weight and reps for each completed set using **Log Entire Workout**.
- Save only rows containing both weight and reps; leave incomplete rows unrecorded.
- Display save feedback and clear recorded inputs after a successful save.

### History and trends

- Review recorded sets by date or by plan.
- Edit a recorded date, weight, or rep count directly in the history table, then select **Save set**.
- Delete an individual recorded set.
- Graph weight or reps for a selected plan, exercise, and set number, or compare all set numbers.
- Filter weight graphs by minimum reps and rep graphs by weight.

### Backups and offline use

- Export complete in-memory plans and logs as JSON.
- Validate JSON and confirm replacement before restoring plans and logs.
- Export recorded sets as CSV, append CSV records, or rebuild plans and logs using **Full CSV Import**.
- Inspect plan definitions as formatted JSON on the Developer page.
- Load cached pages, record workouts, review history, and view graphs without an internet connection.

---

## Project Structure

```text
WorkoutTracker/
├── index.html
├── historyTab.html
├── graphsTab.html
├── developerTab.html
├── manifest.json
├── service-worker.js
├── README.md
├── assets/
│   ├── fitness_center.png
│   └── font/
│       └── materialIconsFont.woff2
├── css/
│   └── styles.css
├── js/
│   ├── storage.js
│   ├── dataTransfer.js
│   └── app.js
├── libs/
│   └── chartjs/
│       └── chart.js
├── Misc/
│   ├── TestData.csv
│   └── OpenSSL_HTTPSNotes.txt
└── certificate/
    ├── localhost.pem
    └── localhost.key
```

| File or directory | Purpose |
|---|---|
| `index.html` | Dashboard: select a plan, enter sets, create plans, and add exercises. Calls `init()`. |
| `historyTab.html` | Date/plan selectors and editable history tables. Calls `initHistoryTab()`. |
| `graphsTab.html` | Trend filters and chart canvas. Loads bundled Chart.js before the application scripts, then calls `initGraphs()`. |
| `developerTab.html` | JSON/CSV transfer controls and plan-data inspection. Calls `initDeveloperTab()`. |
| `js/storage.js` | Shared state, atomic storage, save queue, and date conversion. |
| `js/dataTransfer.js` | JSON/CSV reading, validation, confirmation, and downloads. |
| `js/app.js` | Page rendering, workout actions, graph configuration, initialization, and feedback. |
| `css/styles.css` | Dark theme, responsive layouts, local icon font, controls, tables, and navigation. |
| `manifest.json` | PWA name, standalone display mode, start URL, portrait orientation, dark theme colors, and app icon. |
| `service-worker.js` | Versioned application cache and offline fetch handling. |
| `assets/` | App icon and locally hosted icon font. |
| `libs/chartjs/chart.js` | Existing third-party chart library; no runtime download is required. |
| `Misc/TestData.csv` | Sample workout records for the CSV import format. |
| `Misc/OpenSSL_HTTPSNotes.txt` | Earlier local-server and certificate setup notes; contains machine-specific examples. |
| `certificate/` | Existing local HTTPS development certificate and key; unnecessary for the localhost HTTP setup below. Keep private keys out of public deployments. |
| `README.md` | Consolidated setup, data flow, storage, transfer, and function documentation. |

---

## Running the App Locally

From the project folder, run:

```bash
python3 -m http.server 8080 --bind 127.0.0.1
```

Open `http://localhost:8080/` in a browser. On Windows, `py -m http.server 8080 --bind 127.0.0.1` is an alternative when the Python launcher is installed.

Use HTTP on localhost or HTTPS on a hosted origin for service-worker support. Opening the HTML files directly through `file:///` does not provide the intended offline/PWA experience. A phone accessing another computer's plain HTTP LAN address is not equivalent to localhost; use a suitable HTTPS origin for installed/offline phone use.

### Install and use offline

1. Serve the application and load it while connected.
2. Allow the service worker to finish caching all required files.
3. Use the browser's install or add-to-home-screen action when available.
4. Reopen the cached application to use it offline.

There is no build step. When hosting, preserve the HTML pages, `manifest.json`, `service-worker.js`, and the `js/`, `css/`, `assets/`, and `libs/` directories. Local development certificates and miscellaneous notes are not required application assets.

---

## Data Storage

The database remains `workoutTrackerDB`, version `1`. Its `plans` store uses key path `name`; its `logs` store uses key path `id`. No database reset is required for this update.

| Working state | Meaning |
|---|---|
| `db` | Open IndexedDB connection. |
| `plans` | Object mapping plan names to exercise-name arrays. |
| `workoutLogs` | Array of individual recorded sets. |
| `saveQueue` | Promise chain serializing changes within the current page. |
| `setsPerExercise`, `chart`, `loggingWorkout` | Workout-entry row count, Chart.js instance, and duplicate-submit guard. |

A stored plan is `{ name, exercises }`. A log contains `{ id, date, plan, exercise, set, weight, reps }`:

```json
{
  "id": "d03d69db-5356-4940-b72b-92a780266d59",
  "date": "2025-12-20",
  "plan": "Upper Body",
  "exercise": "Bench Press",
  "set": 1,
  "weight": "22.5",
  "reps": "10"
}
```

New records use `crypto.randomUUID()`. Existing numeric IDs remain unchanged and continue to work in history, exports, and JSON imports. History actions read row IDs as text and compare both formats consistently.

### Saving and loading

`changeData(change)` queues a change, clones the latest committed working state, applies the change to the draft, and awaits `saveData(nextPlans, nextLogs)`. Only a successful transaction publishes the draft as `plans` and `workoutLogs`. Failed changes leave the prior working state and saved records intact; later queued changes can still proceed.

`saveData()` clears and rewrites both stores in one atomic read/write transaction. Even a single-set edit saves a complete snapshot. UI actions catch errors and display feedback. Workout inputs clear only after saving succeeds; failed history edits stay visible for retry without changing committed records. Page controls stay disabled until initialization succeeds, and remain disabled if loading fails.

`loadData()` reads both stores in one transaction, normalizes legacy dates, and persists a date migration only when necessary. It publishes loaded state only after reads and any migration save succeed. Database request errors and transaction aborts reject promises instead of silently leaving initialization pending.

### Date compatibility

Dates are stored as local calendar strings in `YYYY-MM-DD` format, allowing chronological string sorting without UTC date shifts. Date selectors and history headings format dates for the browser's locale; editable date cells, chart categories, and exported dates use the stored format.

Existing ISO dates and slash dates such as `12/20/2025` are accepted. Slash dates with a first component above 12 are recognized as day-first, for example `20/12/2025`. Ambiguous dates such as `01/02/2025` are interpreted as **month/day/year**, matching the existing US-style sample data. Other legacy locale formats cannot be inferred reliably and produce an error instead of silently changing dates. Unsupported or invalid dates leave saved records unchanged. If needed, export from the previous version and convert dates in a backup before importing it.

### Storage boundaries

IndexedDB stores workouts; the service-worker cache stores application files. Data belongs to the browser profile and origin, including the port. There is no account or cloud sync. Clearing site data removes records, so keep exported backups when needed.

The save queue coordinates operations within one page. It does not detect concurrent changes from another open tab; each page loads its own working snapshot. Avoid editing the same data in multiple tabs simultaneously.

---

## High-Level Information Flow

This section traces user actions before the detailed function reference.

### 1. Opening a page

All pages load scripts in this order: `storage.js` → `dataTransfer.js` → `app.js`. The Graphs page loads bundled Chart.js first. Ordinary scripts share browser globals; no build step is involved.

```text
Page initializer → initializePage(render)
  → Disable controls
  → openDB() → loadData() → normalizeDate() for saved log dates
  → Save converted dates if necessary
  → Enable controls → page-specific rendering
  → On failure: keep controls disabled and showError(error)
```

| Page | Initializer | Rendering after loading |
|---|---|---|
| Dashboard | `init()` | `updatePlanSelectors()` → `renderExerciseInputs()` → `createSetRow()`. |
| History | `initHistoryTab()` | `updateHistoryPlanSelector()` → `updateDateSelector()` → `renderWorkoutTable()`. |
| Graphs | `initGraphs()` | `populatePlanSelect()` → `updateExerciseSelect()` → `updateSetSelect()` → `renderGraph()`; `toggleGraphMetric()` synchronizes the initial filter label and redraws. |
| Developer | `initDeveloperTab()` | `refreshDevTab()`. |

Each HTML page separately registers `service-worker.js` in its window load handler. Cache installation is independent of loading workout records.

### 2. Creating plans and exercises

```text
Plan name → createPlan()
  → changeData(draft => add plan) → saveData() → publish committed state
  → updatePlanSelectors() → renderExerciseInputs() → clear name input

Selected plan + exercise name → addExercise()
  → changeData(draft => append exercise) → saveData() → publish committed state
  → Clear exercise-name input and redraw logging inputs when applicable
```

Blank/duplicate names are ignored as before. Selector rebuilding still selects the first available plan; rebuilding exercise inputs still resets them to four blank rows. Preserving unfinished entries/selections was not part of this update.

### 3. Recording a workout

```text
Plan changes → renderExerciseInputs() → createSetRow() for each set
Add Set → addSet() → createSetRow() for every exercise card

Log Entire Workout → logEntireWorkout()
  → Read complete weight/rep pairs
  → Generate UUIDs and today's localDate()
  → changeData(draft => append pending logs) → saveData()
  → Success: clear recorded inputs and display the set count
  → Failure: retain inputs and committed data; show feedback
```

The save button is disabled while its request is pending, and a guard blocks duplicate workout submissions. Incomplete pairs remain unrecorded. Workout-entry and history numeric validation have not been expanded in this update; stricter numeric checks apply to imported records only.

### 4. Reviewing and editing history

```text
View/date/plan controls → toggleHistoryView() or selected table renderer
  → Filter, group, and sort committed workoutLogs
  → Display editable rows

Save set → updateLog(id) → normalizeDate(edited date)
  → changeData(draft => update matching log) → saveData()
  → updateDateSelector() → toggleHistoryView()

Delete set → deleteLog(id)
  → changeData(draft => remove matching log) → saveData()
  → updateDateSelector() → toggleHistoryView()
```

The two history renderers remain separate. Date mode groups by plan/exercise; plan mode groups by date/exercise. Date choices are rebuilt after saves and default to the newest date. Set deletion still has no confirmation/undo flow.

### 5. Viewing graphs

```text
Plan → updateExerciseSelect() → updateSetSelect() → renderGraph()
Exercise → updateSetSelect() → renderGraph()
Set or filter → renderGraph()
Metric → toggleGraphMetric() → renderGraph()
```

`renderGraph()` filters logs, sorts ISO dates, builds datasets, destroys the previous chart, and creates a replacement. Weight mode filters by minimum reps; Reps mode compares the complete numeric weight, including decimals such as `22.5`. All Sets creates a dataset per set number. Graphs do not modify saved data.

### 6. Importing, exporting, and inspecting

```text
Export JSON/CSV → wait for saveQueue → serialize committed state
  → downloadFile() → Blob URL → browser download

Import button → hidden file input → importDB/importCSV/importFullCSV
  → importData() → await file.text()
  → JSON: JSON.parse() → validateImport()
  → CSV: csvData() → parseCSV() → validateImport()
  → Replacement only: confirm record counts and overwrite
  → changeData() → saveData() → publish state
  → refreshDevTab() → success feedback
```

Parsing/validation happens before changing any working or saved data. Invalid files, canceled replacements, read failures, and failed writes leave prior records unchanged. Import promises settle after processing, including the save. File inputs reset afterward so the same file can be selected again.

`refreshDevTab()` formats committed `plans` as JSON; it does not fetch from the database or display logs.

---

## Backup and Restore Formats

| Action | File | Behavior |
|---|---|---|
| Export JSON | `workout_backup.json` | Includes all plan definitions and logs, preserving numeric/UUID IDs. |
| Import JSON | App-format JSON | Validate every record, confirm replacement, and atomically replace plans/logs. |
| Export CSV | `workout_full_export.csv` | Export logged sets only; no download when there are no logs. |
| Import CSV | Six-column CSV | Validate all rows, append new logs with UUIDs, and add missing plans/exercises. Repeated imports can duplicate sets. |
| Full CSV Import | Six-column CSV | Validate all rows, confirm replacement, and rebuild plans/logs with new UUIDs. |

### JSON

```json
{
  "plans": { "Upper Body": ["Bench Press"] },
  "workoutLogs": [{
    "id": 42,
    "date": "12/20/2025",
    "plan": "Upper Body",
    "exercise": "Bench Press",
    "set": 1,
    "weight": "22.5",
    "reps": "10"
  }]
}
```

Both collections are required. Imports check nonblank plan/exercise names, exercise arrays, duplicate exercises/IDs, plan/exercise references, dates, positive integer set/rep values, and finite nonnegative weights. Legacy numeric IDs are accepted. String IDs must contain letters, digits, hyphens, or underscores. Reserved object names `__proto__`, `constructor`, and `prototype` are rejected for plan/exercise definitions.

### CSV

```csv
Date,Plan,Exercise,Set,Weight,Reps
2025-12-20,Upper Body,Bench Press,1,22.5,10
2025-12-20,"Upper Body, Day A","Press ""A""",2,22.5,8
```

The exact six-column header/order is required after trimming cells. The shared parser supports standard quoted cells, doubled quote escaping, embedded commas/line breaks, Windows/Unix newlines, a leading BOM, and blank lines. Surrounding field whitespace is trimmed. Malformed quotes, missing/extra columns, and invalid records reject the entire import.

CSV exports quote/escape cells as needed. They contain no IDs and cannot represent plans or exercises with no recorded sets. Use JSON for a complete backup. A header-only CSV represents zero sets; a confirmed full import of it clears both collections.

JSON/full-CSV replacement confirmation includes incoming plan/set counts. Export current data first if it needs to be retained. Append CSV remains an additive import without duplicate-set detection.

---

## Updating the PWA

```js
const CACHE_PREFIX = 'workout-tracker-cache-';
const CACHE_NAME = CACHE_PREFIX + 'v8';
```

Increment the version when changing cached files, and deploy all changed files together. The explicit cache list now includes `storage.js` and `dataTransfer.js` as well as all four HTML pages, `app.js`, stylesheet, manifest, icon, icon font, and Chart.js. Missing required files cause installation to fail; documentation, sample files, and certificates are not cached.

When the browser detects changed worker contents, the install handler fills the new cache. After successful installation, `skipWaiting()` requests activation without waiting for older tabs to close. The activate handler deletes only caches that start with `CACHE_PREFIX` and differ from `CACHE_NAME`, then awaits client claiming. Cleanup runs on activation, including first install; it does not run on every app action or every worker wake-up.

This prefix matters on GitHub Pages: project URLs such as `https://name.github.io/WorkoutTracker/` and `https://name.github.io/BasketballTracker/` share one origin and cache namespace. The previous broad cleanup could delete another app's offline assets. The new cleanup leaves differently prefixed caches untouched. Each app sharing that origin should follow the same rule.

The fetch handler remains cache-first, falling back to the network for uncached requests. It does not automatically cache arbitrary network results or provide a separate offline navigation fallback. Reopen/reload while connected to receive updates. Updating these caches does not delete IndexedDB records.

---

# File and Function Reference

Inputs below include arguments and implicit DOM/shared-state reads. Outputs describe return values and side effects. An `async` function returns a promise; UI action functions catch operational errors and show feedback, so their promises generally settle after handling errors. Unless otherwise specified, synchronous UI functions return `undefined`.

## `js/storage.js`

### `openDB()`

- **Purpose:** Open the existing database and create missing stores during upgrade.
- **Inputs:** No arguments; IndexedDB database name/version.
- **Outputs:** Promise resolving after assigning `db`, rejecting on open errors/blocked upgrades. Closes the connection if another version requests an upgrade.

### `saveData(nextPlans = plans, nextLogs = workoutLogs)`

- **Purpose:** Write a complete snapshot atomically without publishing it to working state.
- **Inputs:** `nextPlans = plans`, `nextLogs = workoutLogs`; open `db`.
- **Outputs:** Promise resolving after commit or rejecting on transaction failure, abort, or synchronous write errors. Clears/rewrites both stores.

### `changeData(change)`

- **Purpose:** Serialize draft changes and publish only successful saves.
- **Inputs:** `change` — synchronous callback receiving a cloned `{ plans, workoutLogs }` draft.
- **Outputs:** Promise for the queued mutation/save. Success assigns committed globals; failure preserves them and allows later operations to run.

### `loadData()`

- **Purpose:** Load stored records and convert supported legacy dates.
- **Inputs:** No arguments; open `db`, both stores.
- **Outputs:** Promise resolving after reads and any required migration save, then publishes state. Rejects on read, date-conversion, or migration-write failure without changing working state.

### `localDate(date = new Date())`

- **Purpose:** Build a local calendar date without UTC conversion.
- **Inputs:** `date = new Date()` — JavaScript Date object.
- **Outputs:** Returns `YYYY-MM-DD` text.

### `normalizeDate(value)`

- **Purpose:** Convert supported stored/imported/edited dates to one format.
- **Inputs:** `value` — ISO date or supported slash date.
- **Outputs:** Returns validated `YYYY-MM-DD`; throws on invalid/unsupported dates. Ambiguous slash dates use month/day/year.

### `formatDate(value)`

- **Purpose:** Format an ISO calendar date for display.
- **Inputs:** `value` — normalized ISO date.
- **Outputs:** Returns local date text from a locally constructed Date, avoiding UTC day shifts.

## `js/dataTransfer.js`

### `downloadFile(filename, content, type)`

- **Purpose:** Download text without a server upload.
- **Inputs:** `filename`, `content`, `type` — download name, text, and MIME type.
- **Outputs:** Creates a Blob/object URL, clicks a download anchor, and schedules URL revocation. Returns no file object.

### `exportDB()`

- **Purpose:** Export complete committed state as JSON.
- **Inputs:** No arguments; `saveQueue`, `plans`, `workoutLogs`.
- **Outputs:** Promise; waits for queued changes, then downloads `workout_backup.json` using `downloadFile()`.

### `csvCell(value)`

- **Purpose:** Escape one CSV cell.
- **Inputs:** `value` — stringifiable field value.
- **Outputs:** Returns text with required quoting and doubled internal quotes for comma/quote/newline-containing fields.

### `downloadCSV()`

- **Purpose:** Export recorded sets as CSV.
- **Inputs:** No arguments; `saveQueue`, `workoutLogs`, `CSV_COLUMNS`.
- **Outputs:** Promise; waits for queued changes and downloads `workout_full_export.csv` through `csvCell()`/`downloadFile()`. No download for empty logs.

### `parseCSV(text)`

- **Purpose:** Parse the shared six-column workout format.
- **Inputs:** `text` — CSV file contents.
- **Outputs:** Returns log objects with generated UUIDs and numeric sets; supports quoting, blank lines, BOM and newline variants. Throws on malformed syntax/header/field counts; does not mutate state.

### `validateName(value)`

- **Purpose:** Check imported plan/exercise names.
- **Inputs:** `value` — imported name.
- **Outputs:** Returns no value when valid; throws for blank/nonstring or reserved object names.

### `validateImport(data)`

- **Purpose:** Validate an entire backup without changing working state.
- **Inputs:** `data` — object with `plans` and `workoutLogs`.
- **Outputs:** Returns copied plan arrays and validated logs with normalized dates. Throws on invalid structure, relationships, IDs, dates, or imported numeric values.

### `csvData(text)`

- **Purpose:** Build and validate an isolated import from CSV.
- **Inputs:** `text` — CSV contents.
- **Outputs:** Calls `parseCSV()`, reconstructs plan/exercise definitions, and returns `validateImport()` results. No state/database mutation.

### `importData(event, type, replace)`

- **Purpose:** Coordinate reading, validation, confirmation, and saving.
- **Inputs:** `event` — file-input change event; `type` — `json`/`csv`; `replace` — replacement boolean.
- **Outputs:** Promise covering `file.text()`, parsing, validation, confirmation when replacing, and `changeData()`. Success refreshes plan JSON and alerts; errors use `showError()`. Finally resets/re-enables file input. Cancellation preserves state.

### `importDB(event)`

- **Purpose:** Restore a JSON backup with confirmation.
- **Inputs:** `event` — JSON input change event.
- **Outputs:** Promise awaiting `importData(event, "json", true)`.

### `importCSV(event)`

- **Purpose:** Append validated CSV records and missing definitions.
- **Inputs:** `event` — CSV input change event.
- **Outputs:** Promise awaiting `importData(event, "csv", false)`. Does not deduplicate sets across imports.

### `importFullCSV(event)`

- **Purpose:** Replace plans/logs with validated CSV records after confirmation.
- **Inputs:** `event` — full CSV input change event.
- **Outputs:** Promise awaiting `importData(event, "csv", true)` through completed saving and feedback.

## `js/app.js`

### `createPlan()`

- **Purpose:** Save a new reusable plan.
- **Inputs:** No arguments; trimmed `#planName`, current `plans`.
- **Outputs:** Promise; ignores blank/existing names, queues an empty plan, then refreshes selectors and clears the input only after saving. Errors use `showError()`.

### `addExercise()`

- **Purpose:** Save a distinct exercise in the selected plan.
- **Inputs:** No arguments; management/logging selectors, exercise-name input, `plans`.
- **Outputs:** Promise; queues the addition, then clears the input and conditionally redraws workout rows. Errors preserve committed state and use `showError()`.

### `updatePlanSelectors()`

- **Purpose:** Populate both Dashboard plan selectors from working state.
- **Inputs:** No arguments. Reads plan names from `plans` and requires `#planSelect` and `#logPlanSelect`.
- **Outputs:** Replaces both selectors' options and calls `renderExerciseInputs()`. Does not persist data.

### `renderExerciseInputs()`

- **Purpose:** Draw workout entry for the selected plan or explain how to get started.
- **Inputs:** No arguments. Reads `#logPlanSelect` and `plans`.
- **Outputs:** Replaces `#exerciseInputsContainer`, clears workout status, and enables/disables logging buttons. With no exercises, shows guidance and opens plan management. Otherwise resets `setsPerExercise` to four and appends exercise cards with rows from `createSetRow()`. Existing unsaved input values are discarded when rebuilt.

### `createSetRow(exercise, setNumber)`

- **Purpose:** Construct one reusable weight/rep input row.
- **Inputs:** `exercise` — exercise-name string; `setNumber` — numeric set index, normally starting at one.
- **Outputs:** Returns a detached `HTMLDivElement` with class `set-row`, its displayed set number, and two number inputs. Input IDs follow `${exercise}-weight-${setNumber}` and `${exercise}-reps-${setNumber}`. Includes accessible labels and appropriate numeric keyboards. The caller appends the row; this function does not save anything.

### `addSet()`

- **Purpose:** Add the next set row to every visible exercise.
- **Inputs:** No arguments. Reads `setsPerExercise` and each `.exercise-block` element's `data-exercise` attribute.
- **Outputs:** Increments `setsPerExercise` and appends a row created by `createSetRow()` to each card. Does not create saved log records.

### `logEntireWorkout()`

- **Purpose:** Save all complete set inputs for the selected plan.
- **Inputs:** No arguments; logging plan, exercise/set input pairs, `localDate()` and `crypto.randomUUID()`.
- **Outputs:** Promise; guards duplicate submits, queues pending logs, clears saved input pairs on success, preserves inputs on failure, and updates status. With no complete sets, displays guidance.

### `updateDateSelector()`

- **Purpose:** Populate history dates in descending order.
- **Inputs:** No arguments; normalized dates in `workoutLogs`.
- **Outputs:** Unique ISO-valued options with localized labels, newest selected by default, and a localized history heading.

### `updateHistoryPlanSelector()`

- **Purpose:** Populate plan-based history choices.
- **Inputs:** No arguments. Reads plan names from `plans`.
- **Outputs:** Replaces `#historyPlanSelect` options. Returns without changes if that selector is absent.

### `toggleHistoryView()`

- **Purpose:** Switch between date-based and plan-based history.
- **Inputs:** No arguments. Reads `#historyViewSelect`.
- **Outputs:** Shows the appropriate controls/table, hides the other mode, and calls `renderWorkoutTable()` or `renderWorkoutTableByPlan()`. An unsupported value hides both modes and clears the title.

### `renderWorkoutTable()`

- **Purpose:** Display all sets recorded on one selected date.
- **Inputs:** No arguments. Reads `#historyDateSelect` and `workoutLogs`.
- **Outputs:** Replaces the date table body, updates the title and empty state, groups records by plan and exercise, and sorts sets within each exercise by set number. Creates editable date/weight/reps cells and Save/Delete buttons. Does not save changes itself.

### `renderWorkoutTableByPlan()`

- **Purpose:** Display the recorded history of one plan.
- **Inputs:** No arguments. Reads `#historyPlanSelect` and `workoutLogs`.
- **Outputs:** Replaces the plan table body, updates title/empty state, sorts matching logs by descending ISO date, and groups them by date and exercise. Displays set rows in numeric order with editable cells and action buttons.

### `updateLog(id)`

- **Purpose:** Save an edited historical set.
- **Inputs:** `id` — numeric or string ID; active table row and edited date/weight/reps.
- **Outputs:** Promise; normalizes the date, queues an update matching IDs as strings, then redraws dates/history. Errors show feedback and leave committed records unchanged.

### `deleteLog(id)`

- **Purpose:** Remove a historical set after a successful save.
- **Inputs:** `id` — numeric or string ID; committed logs.
- **Outputs:** Promise; queues removal using consistent string comparison, then refreshes history. Errors preserve committed records and show feedback.

### `populatePlanSelect()`

- **Purpose:** Start the Graphs selector/rendering chain.
- **Inputs:** No arguments. Reads plan names from `plans`.
- **Outputs:** Replaces `#graphPlanSelect` options and calls `updateExerciseSelect()`.

### `updateExerciseSelect()`

- **Purpose:** Populate graph exercises for the chosen plan.
- **Inputs:** No arguments. Reads `#graphPlanSelect` and `plans`.
- **Outputs:** Clears/rebuilds `#graphExerciseSelect`, then calls `updateSetSelect()`, including when no matching plan exists.

### `updateSetSelect()`

- **Purpose:** Offer recorded set numbers for the selected plan/exercise.
- **Inputs:** No arguments. Reads `#graphPlanSelect`, `#graphExerciseSelect`, and `workoutLogs`.
- **Outputs:** Replaces `#graphSetSelect` options with unique numeric set values in ascending order plus **All Sets** with value `All`. Calls `renderGraph()`.

### `toggleGraphMetric()`

- **Purpose:** Explain the filter appropriate for the selected metric and redraw the graph.
- **Inputs:** No arguments. Reads `#graphMetricSelect`.
- **Outputs:** Changes the filter label/placeholder to minimum reps for weight mode or exact weight for reps mode, then calls `renderGraph()`. Does not reset the current filter value.

### `renderGraph()`

- **Purpose:** Build a dark progress chart from committed records.
- **Inputs:** No arguments; graph selectors/filter, normalized `workoutLogs`, current `chart`, bundled `Chart`.
- **Outputs:** Filters by minimum reps or full numeric weight, sorts ISO dates, builds datasets, updates empty/accessibility labels, destroys the prior chart, and assigns the replacement instance. Does not save.

### `refreshDevTab()`

- **Purpose:** Display the current plan definitions for inspection.
- **Inputs:** No arguments. Reads `plans`.
- **Outputs:** Writes `JSON.stringify(plans, null, 2)` to `#rawData.textContent`. Does not display workout logs or reload records from IndexedDB.

### `showError(error)`

- **Purpose:** Display a consistent operational error.
- **Inputs:** `error` — Error object or error value.
- **Outputs:** Logs the error and shows a readable alert; returns no value.

### `initializePage(render)`

- **Purpose:** Load storage before enabling a page.
- **Inputs:** `render` — callback for page-specific initial rendering; main controls.
- **Outputs:** Promise; disables controls, awaits open/load, enables controls and renders. On failure keeps controls disabled and calls `showError()`.

### `init()`

- **Purpose:** Initialize Dashboard.
- **Inputs:** No arguments; Dashboard markup.
- **Outputs:** Promise awaiting `initializePage(updatePlanSelectors)`.

### `initHistoryTab()`

- **Purpose:** Initialize History.
- **Inputs:** No arguments; History markup.
- **Outputs:** Promise; initializes storage, then populates plan/date selectors and draws date history.

### `initDeveloperTab()`

- **Purpose:** Initialize Developer.
- **Inputs:** No arguments; Developer markup.
- **Outputs:** Promise awaiting `initializePage(refreshDevTab)`.

### `initGraphs()`

- **Purpose:** Initialize Graphs and its correct filter label.
- **Inputs:** No arguments; Graphs markup and loaded Chart.js.
- **Outputs:** Promise; initializes storage, cascades selector population, then calls `toggleGraphMetric()` to synchronize label/placeholder and redraw.

## HTML and Asynchronous Callbacks

| Handler | Inputs | Outputs and purpose |
|---|---|---|
| Startup scripts | Loaded DOM and application scripts. | Invoke the appropriate page initializer. |
| Button/select/input handlers | User event and current controls. | Invoke the named plan, workout, history, graph, and transfer functions. |
| Import-button click | Matching hidden file input. | Open the file chooser; its change event invokes the importer. |
| Window load | Browser load event and service-worker support. | Register `service-worker.js`; log registration failures. |
| IndexedDB callbacks | Upgrade, request success/error, completion, or abort. | Create stores, provide read results, and settle storage promises. |
| Draft callbacks | Cloned latest committed state. | Apply one queued mutation before atomic saving. |
| Collection callbacks | Records, indexes, or comparator pairs. | Filter, group, map, sort, and render data inside named functions. |
| Download timer | Temporary Blob URL. | Release the URL after initiating the download. |

## `service-worker.js`

| Handler | Inputs | Outputs and purpose |
|---|---|---|
| `install` | Install event, cache name, required file list. | `waitUntil()` caches required files; `skipWaiting()` requests prompt activation after installation. |
| `activate` | Activate event and origin-wide cache names. | Await deletion of only older caches with this app's prefix, then await `clients.claim()`. Other prefixes and current cache remain. |
| `fetch` | Fetch event/request. | `respondWith()` a cached response when available, otherwise network `fetch()`. Does not mutate workout records. |

## Key Browser APIs

| API | Inputs | Outputs and role |
|---|---|---|
| IndexedDB `open()` | Database name/version. | Request providing an open database or error. |
| `transaction()` / `objectStore()` | Stores/mode or store name. | Atomic transaction and scoped store handle. |
| Store `getAll()` / `clear()` / `put()` | No argument or a keyed record. | Requests to read, clear, or insert/replace records within a transaction. |
| `structuredClone()` | Working state. | Independent draft for an operation. |
| `crypto.randomUUID()` | None. | UUID for a new set. |
| `file.text()` | Selected File object. | Promise resolving to file text or rejecting on reading failure. |
| `JSON.parse()` / `JSON.stringify()` | Text or data. | Parsed records or serialized JSON. |
| `Blob`, object URLs, anchor click | Serialized text and MIME/name information. | Local browser download; no upload. |
| `new Chart()` / `destroy()` | Canvas/configuration or prior instance. | Create/release the bundled Chart.js graph. |
| `waitUntil()` / `respondWith()` | Lifecycle/response promise. | Keep worker lifecycle work alive or supply a response. |

---

## Manual Verification

For browser verification, create a plan/exercise, log a workout, reload, edit both old numeric-ID and new UUID-ID sets, test decimal graph filtering and initial labels, check JSON/CSV imports using backups or disposable data, and reopen cached pages after stopping the server. Confirm replacements can be canceled. Desktop/phone dark layouts remain unchanged by this refactor.

## Source Style

Named functions and ordinary browser globals keep the code direct. Storage, transfers, and UI have separate responsibilities, loaded in a fixed order. Errors are handled at user-action boundaries; the save queue centralizes atomic state publication. There is no frontend framework, module bundler, server database, or newly added library.
