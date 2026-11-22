const CSV_COLUMNS = ["Date", "Plan", "Exercise", "Set", "Weight", "Reps"];

function downloadFile(filename, content, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function exportDB() {
    await saveQueue;
    downloadFile("workout_backup.json", JSON.stringify({ plans, workoutLogs }, null, 2), "application/json");
}

function csvCell(value) {
    const text = String(value);
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

async function downloadCSV() {
    await saveQueue;
    if (!workoutLogs.length) return;
    const rows = workoutLogs.map(log => [log.date, log.plan, log.exercise, log.set, log.weight, log.reps]);
    const csv = [CSV_COLUMNS, ...rows].map(row => row.map(csvCell).join(",")).join("\n");
    downloadFile("workout_full_export.csv", csv, "text/csv");
}

// Read standard quoted CSV, including embedded commas, quotes, and line breaks.
function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;
    let closedQuote = false;
    text = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
    for (let index = 0; index <= text.length; index++) {
        const character = text[index];
        if (quoted) {
            if (character === undefined) throw new Error("CSV contains an unclosed quote.");
            if (character === '"') {
                if (text[index + 1] === '"') { field += '"'; index++; }
                else { quoted = false; closedQuote = true; }
            } else field += character;
        } else if (character === "," || character === "\n" || character === undefined) {
            row.push(field.trim());
            field = "";
            closedQuote = false;
            if (character !== ",") {
                if (row.some(value => value !== "")) rows.push(row);
                row = [];
            }
        } else if (character === '"') {
            if (field.trim() || closedQuote) throw new Error("Unexpected quote in CSV field.");
            field = "";
            quoted = true;
        } else {
            if (closedQuote && !/\s/.test(character)) throw new Error("Unexpected text after CSV quote.");
            field += character;
        }
    }
    const header = rows.shift();
    if (!header || header.length !== CSV_COLUMNS.length || header.some((value, index) => value !== CSV_COLUMNS[index])) {
        throw new Error(`Expected CSV header: ${CSV_COLUMNS.join(",")}`);
    }
    return rows.map((values, index) => {
        if (values.length !== CSV_COLUMNS.length) throw new Error(`CSV record ${index + 2} must have six fields.`);
        const [date, plan, exercise, set, weight, reps] = values;
        return { id: crypto.randomUUID(), date, plan, exercise, set: Number(set), weight, reps };
    });
}

function validateName(value) {
    if (typeof value !== "string" || !value.trim() || ["__proto__", "constructor", "prototype"].includes(value)) {
        throw new Error("Plan and exercise names must be nonblank text without reserved object names.");
    }
}

// Validate imports in isolation before asking to replace or writing any records.
function validateImport(data) {
    if (!data || typeof data !== "object" || !data.plans || Array.isArray(data.plans) ||
        typeof data.plans !== "object" || !Array.isArray(data.workoutLogs)) {
        throw new Error("JSON must contain a plans object and a workoutLogs array.");
    }
    const importedPlans = {};
    Object.entries(data.plans).forEach(([name, exercises]) => {
        validateName(name);
        if (!Array.isArray(exercises)) throw new Error(`Exercises for ${name} must be an array.`);
        exercises.forEach(validateName);
        if (new Set(exercises).size !== exercises.length) throw new Error(`Duplicate exercise in ${name}.`);
        importedPlans[name] = [...exercises];
    });
    const ids = new Set();
    const logs = data.workoutLogs.map((log, index) => {
        if (!log || typeof log !== "object") throw new Error(`Invalid log at record ${index + 1}.`);
        validateName(log.plan);
        validateName(log.exercise);
        const validId = (typeof log.id === "number" && Number.isSafeInteger(log.id)) ||
            (typeof log.id === "string" && /^[A-Za-z0-9_-]+$/.test(log.id));
        if (!validId || ids.has(String(log.id))) throw new Error(`Missing, invalid, or duplicate ID at record ${index + 1}.`);
        ids.add(String(log.id));
        if (!Number.isInteger(log.set) || log.set < 1 ||
            !["string", "number"].includes(typeof log.weight) || String(log.weight).trim() === "" ||
            !Number.isFinite(Number(log.weight)) || Number(log.weight) < 0 ||
            !["string", "number"].includes(typeof log.reps) || String(log.reps).trim() === "" ||
            !Number.isInteger(Number(log.reps)) || Number(log.reps) < 1) {
            throw new Error(`Invalid set, weight, or reps at record ${index + 1}.`);
        }
        if (!Object.hasOwn(importedPlans, log.plan) || !importedPlans[log.plan].includes(log.exercise)) {
            throw new Error(`Unknown plan or exercise at record ${index + 1}.`);
        }
        return { ...log, date: normalizeDate(log.date) };
    });
    return { plans: importedPlans, workoutLogs: logs };
}

function csvData(text) {
    const logs = parseCSV(text);
    const importedPlans = {};
    logs.forEach(log => {
        validateName(log.plan);
        validateName(log.exercise);
        if (!Object.hasOwn(importedPlans, log.plan)) importedPlans[log.plan] = [];
        if (!importedPlans[log.plan].includes(log.exercise)) importedPlans[log.plan].push(log.exercise);
    });
    return validateImport({ plans: importedPlans, workoutLogs: logs });
}

async function importData(event, type, replace) {
    const input = event.target;
    const file = input.files[0];
    if (!file) return;
    input.disabled = true;
    try {
        const text = await file.text();
        const imported = type === "json" ? validateImport(JSON.parse(text)) : csvData(text);
        if (replace && !confirm(`Replace all existing plans and workouts with ${Object.keys(imported.plans).length} plans and ${imported.workoutLogs.length} sets? Export a backup first if needed.`)) return;
        await changeData(draft => {
            if (replace) {
                draft.plans = imported.plans;
                draft.workoutLogs = imported.workoutLogs;
            } else {
                Object.entries(imported.plans).forEach(([plan, exercises]) => {
                    if (!Object.hasOwn(draft.plans, plan)) draft.plans[plan] = [];
                    exercises.forEach(exercise => {
                        if (!draft.plans[plan].includes(exercise)) draft.plans[plan].push(exercise);
                    });
                });
                draft.workoutLogs.push(...imported.workoutLogs);
            }
        });
        refreshDevTab();
        alert("Import successful.");
    } catch (error) {
        showError(error);
    } finally {
        input.disabled = false;
        input.value = "";
    }
}

async function importDB(event) {
    await importData(event, "json", true);
}

async function importCSV(event) {
    await importData(event, "csv", false);
}

async function importFullCSV(event) {
    await importData(event, "csv", true);
}
