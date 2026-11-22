// Shared working state. Publish changes only after IndexedDB commits them.
let db;
let plans = {};
let workoutLogs = [];
let saveQueue = Promise.resolve();

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("workoutTrackerDB", 1);
        request.onupgradeneeded = () => {
            const database = request.result;
            if (!database.objectStoreNames.contains("plans")) {
                database.createObjectStore("plans", { keyPath: "name" });
            }
            if (!database.objectStoreNames.contains("logs")) {
                database.createObjectStore("logs", { keyPath: "id" });
            }
        };
        request.onsuccess = () => {
            db = request.result;
            db.onversionchange = () => db.close();
            resolve();
        };
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error("Close other Workout Tracker tabs and reload."));
    });
}

function saveData(nextPlans = plans, nextLogs = workoutLogs) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(["plans", "logs"], "readwrite");
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error || new Error("Database transaction failed."));
        transaction.onabort = () => reject(transaction.error || new Error("Saving was canceled."));
        try {
            const planStore = transaction.objectStore("plans");
            const logStore = transaction.objectStore("logs");
            planStore.clear();
            logStore.clear();
            Object.entries(nextPlans).forEach(([name, exercises]) => {
                planStore.put({ name, exercises });
            });
            nextLogs.forEach(log => logStore.put(log));
        } catch (error) {
            transaction.abort();
            reject(error);
        }
    });
}

// Queue changes against the latest committed state, including rapid clicks.
function changeData(change) {
    const operation = saveQueue.then(async () => {
        const draft = structuredClone({ plans, workoutLogs });
        change(draft);
        await saveData(draft.plans, draft.workoutLogs);
        plans = draft.plans;
        workoutLogs = draft.workoutLogs;
    });
    saveQueue = operation.catch(() => {}); // A failed save must not block the next one.
    return operation;
}

async function loadData() {
    const loaded = await new Promise((resolve, reject) => {
        const transaction = db.transaction(["plans", "logs"], "readonly");
        const planRequest = transaction.objectStore("plans").getAll();
        const logRequest = transaction.objectStore("logs").getAll();
        transaction.oncomplete = () => resolve({
            plans: Object.fromEntries(planRequest.result.map(plan => [plan.name, plan.exercises || []])),
            workoutLogs: logRequest.result
        });
        transaction.onerror = () => reject(transaction.error || new Error("Database transaction failed."));
        transaction.onabort = () => reject(transaction.error || new Error("Loading was canceled."));
    });
    const nextLogs = loaded.workoutLogs.map(log => ({ ...log, date: normalizeDate(log.date) }));
    // Migrate dates atomically, preserving all existing numeric IDs and other fields.
    if (nextLogs.some((log, index) => log.date !== loaded.workoutLogs[index].date)) {
        await saveData(loaded.plans, nextLogs);
    }
    plans = loaded.plans;
    workoutLogs = nextLogs;
}

function localDate(date = new Date()) {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
}

function normalizeDate(value) {
    const text = String(value).trim();
    let year, month, day;
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
        [year, month, day] = text.split("-").map(Number);
    } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(text)) {
        [month, day, year] = text.split("/").map(Number);
        // Older exports used local dates. Recognize unambiguous day-first dates too.
        if (month > 12) [month, day] = [day, month];
    } else {
        throw new Error(`Unsupported date: ${text}. Use YYYY-MM-DD or M/D/YYYY.`);
    }
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
        throw new Error(`Invalid calendar date: ${text}`);
    }
    return localDate(date);
}

function formatDate(value) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString();
}
