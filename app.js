// ---------- IndexedDB Setup ----------
let db;
let plans = {};
let workoutLogs = [];
let setsPerExercise = 4;
let chart;

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("workoutTrackerDB", 1);
        request.onupgradeneeded = (e) => {
            db = e.target.result;
            if (!db.objectStoreNames.contains("plans")) {
                db.createObjectStore("plans", { keyPath: "name" });
            }
            if (!db.objectStoreNames.contains("logs")) {
                db.createObjectStore("logs", { keyPath: "id" });
            }
        };
        request.onsuccess = (e) => { db = e.target.result; resolve(); };
        request.onerror = (e) => reject(e);
    });
}

function saveData() {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(["plans","logs"], "readwrite");
        const planStore = tx.objectStore("plans");
        const logStore = tx.objectStore("logs");

        planStore.clear();
        for (let name in plans) planStore.put({ name, exercises: plans[name] });

        logStore.clear();
        workoutLogs.forEach(log => logStore.put(log));

        tx.oncomplete = resolve;
        tx.onerror = reject;
    });
}

function loadData() {
    return new Promise((resolve) => {
        plans = {};
        workoutLogs = [];

        const tx = db.transaction(["plans","logs"], "readonly");
        const planStore = tx.objectStore("plans");
        const logStore = tx.objectStore("logs");

        planStore.getAll().onsuccess = (e) => e.target.result.forEach(p => plans[p.name] = p.exercises || []);
        logStore.getAll().onsuccess = (e) => workoutLogs = e.target.result || [];

        tx.oncomplete = resolve;
    });
}

// ---------- Core Functions ----------
function createPlan() {
    const planName = document.getElementById("planName").value.trim();
    if (!planName || plans[planName]) return;
    plans[planName] = [];
    updatePlanSelectors();
    document.getElementById("planName").value = "";
    saveData();
}

function addExercise() {
    const plan = document.getElementById("planSelect").value;
    const exercise = document.getElementById("exerciseName").value.trim();
    if (plan && exercise && !plans[plan].includes(exercise)) {
        plans[plan].push(exercise);
        document.getElementById("exerciseName").value = "";
        if (document.getElementById("logPlanSelect").value === plan) renderExerciseInputs();
        saveData();
    }
}

function updatePlanSelectors() {
    const planSelects = [document.getElementById("planSelect"), document.getElementById("logPlanSelect")];
    planSelects.forEach(select => {
        select.innerHTML = "";
        for (let plan in plans) {
            const opt = document.createElement("option");
            opt.value = plan;
            opt.textContent = plan;
            select.appendChild(opt);
        }
    });
    renderExerciseInputs();
}

// ---------- Log Workout UI ----------
function renderExerciseInputs() {
    const plan = document.getElementById("logPlanSelect").value;
    const container = document.getElementById("exerciseInputsContainer");
    container.innerHTML = "";
    if (!plans[plan]) return;

    // Reset to default (4 sets) every time plan changes
    setsPerExercise = 4;

    plans[plan].forEach(exercise => {
        const block = document.createElement("div");
        block.className = "exercise-block";
        block.setAttribute("data-exercise", exercise);
        block.innerHTML = `<h3>${exercise}</h3>`;
        for (let i = 1; i <= setsPerExercise; i++) {
        block.appendChild(createSetRow(exercise, i));
        }
        container.appendChild(block);
    });
}

function createSetRow(exercise, setNumber) {
    const row = document.createElement("div");
    row.className = "set-row";
    row.innerHTML = `
        <label>Set ${setNumber}</label>
        <input type="number" placeholder="Weight" id="${exercise}-weight-${setNumber}" />
        <input type="number" placeholder="Reps" id="${exercise}-reps-${setNumber}" />
    `;
    return row;
}

function addSet() {
    setsPerExercise++; // increase for all exercises
    document.querySelectorAll(".exercise-block").forEach(block => {
        const exercise = block.getAttribute("data-exercise");
        const newRow = createSetRow(exercise, setsPerExercise);
        block.appendChild(newRow);
    });
}

function logEntireWorkout() {
    const plan = document.getElementById("logPlanSelect").value;
    if (!plan) return;
    const date = new Date().toLocaleDateString();

    plans[plan].forEach(exercise => {
        // Find all inputs for this exercise
        let setNumber = 1;
        while (true) {
            const weightEl = document.getElementById(`${exercise}-weight-${setNumber}`);
            const repsEl = document.getElementById(`${exercise}-reps-${setNumber}`);
            if (!weightEl || !repsEl) break; // stop when no more inputs

            const weight = weightEl.value.trim();
            const reps = repsEl.value.trim();

            if (weight && reps) {
                const log = {
                id: Date.now() + Math.floor(Math.random() * 1000),
                date,
                plan,
                exercise,
                set: setNumber,
                weight,
                reps
                };
                workoutLogs.push(log);
            }

            // Clear inputs after logging
            weightEl.value = "";
            repsEl.value = "";
            setNumber++;
        }
    });

    saveData().then(() => {
        //updateDateSelector();
        //renderWorkoutTable();
        alert("✅ Workout Logged!");
    });
}

// ---------- Workout History ----------
function updateDateSelector() {
    const dateSelect = document.getElementById("historyDateSelect");
    
    const uniqueDates = [...new Set(workoutLogs.map(l => l.date))].sort((a,b)=> {
        // try to keep newest first by parsing date strings if possible
        const da = new Date(a), db = new Date(b);
        return db - da;
    });

    dateSelect.innerHTML = "";
    uniqueDates.forEach(date => {
        const opt = document.createElement("option");
        opt.value = date;
        opt.textContent = date;
        dateSelect.appendChild(opt);
    });

    if (uniqueDates.length > 0) dateSelect.value = uniqueDates[0];
    
    document.getElementById("historyTitle").textContent = uniqueDates.length ? `Workout for ${dateSelect.value}` : "";
}

function updateHistoryPlanSelector() {
    const select = document.getElementById("historyPlanSelect");
    if (!select) return;

    select.innerHTML = "";
    Object.keys(plans).forEach(plan => {
        const opt = document.createElement("option");
        opt.value = plan;
        opt.textContent = plan;
        select.appendChild(opt);
    });
}

function toggleHistoryView() {
    const view = document.getElementById("historyViewSelect").value;

    const dateControls = document.getElementById("dateHistoryControls");
    const planControls = document.getElementById("planHistoryControls");

    const dateTable = document.getElementById("workoutTableByDate");
    const planTable = document.getElementById("workoutTableByPlan");

    if (view === "date") {
        dateControls.style.display = "block";
        planControls.style.display = "none";

        dateTable.style.display = "table";
        planTable.style.display = "none";

        renderWorkoutTable();
    } 
    
    else if (view === "plan") {
        dateControls.style.display = "none";
        planControls.style.display = "block";

        dateTable.style.display = "none";
        planTable.style.display = "table";

        renderWorkoutTableByPlan();
    }

    else {
        dateControls.style.display = "none";
        planControls.style.display = "none";

        dateTable.style.display = "none";
        planTable.style.display = "none";

        document.getElementById("historyTitle").textContent = "";
    }
    
}

function renderWorkoutTable() {
    const tbody = document.querySelector("#workoutTableByDate tbody");
    tbody.innerHTML = "";

    const selectedDate = document.getElementById("historyDateSelect").value;
    document.getElementById("historyTitle").textContent = selectedDate ? `Workout for ${selectedDate}` : "";

    if (!selectedDate) return;

    const logsForDate = workoutLogs.filter(l => l.date === selectedDate);
    if (logsForDate.length === 0) return;

    const grouped = {};
    logsForDate.forEach(log => {
        if (!grouped[log.plan]) grouped[log.plan] = {};
        if (!grouped[log.plan][log.exercise]) grouped[log.plan][log.exercise] = [];
        grouped[log.plan][log.exercise].push(log);
    });

    for (const plan in grouped) {
        const planRow = document.createElement("tr");
        planRow.innerHTML = `<td colspan="5" style="text-align:center;"><strong>${plan}</strong></td>`;
        tbody.appendChild(planRow);

        for (const exercise in grouped[plan]) {
            const exRow = document.createElement("tr");
            exRow.innerHTML = `<td colspan="5" style="text-align:center;"><em>${exercise}</em></td>`;
            tbody.appendChild(exRow);

            grouped[plan][exercise].sort((a,b)=>a.set-b.set).forEach(log => {
                const row = document.createElement("tr");
                row.setAttribute("data-id", log.id);
                row.innerHTML = `
                    <td contenteditable="true">${log.date}</td>
                    <td>${log.set}</td>
                    <td contenteditable="true">${log.weight}</td>
                    <td contenteditable="true">${log.reps}</td>
                    <td>
                    <button class="action-btn" onclick="updateLog(${log.id})">💾</button>
                    <button class="action-btn" onclick="deleteLog(${log.id})">🗑️</button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        }
    }
}

function renderWorkoutTableByPlan() {
    const plan = document.getElementById("historyPlanSelect").value;
    const tbody = document.querySelector("#workoutTableByPlan tbody");

    tbody.innerHTML = "";
    if (!plan) return;
    
    document.getElementById("historyTitle").textContent = plan ? `Workout Plan - ${plan}` : "";

    // Filter logs for selected plan
    const logs = workoutLogs
        .filter(l => l.plan === plan)
        .sort((a,b) => new Date(a.date) - new Date(b.date));

    if (logs.length === 0) return;

    // Group by date → exercise
    const grouped = {};
    logs.forEach(log => {
        if (!grouped[log.date]) grouped[log.date] = {};
        if (!grouped[log.date][log.exercise]) grouped[log.date][log.exercise] = [];
        grouped[log.date][log.exercise].push(log);
    });

    for (const date in grouped) {
        /* ---------- DATE ROW ---------- */
        const dateRow = document.createElement("tr");
        dateRow.innerHTML = `<td colspan="5" style="text-align:center;"><strong>${date}</strong></td>`;
        tbody.appendChild(dateRow);

        /* ---------- PLAN ROW ---------- */
        const planRow = document.createElement("tr");
        planRow.innerHTML = `<td colspan="5" style="text-align:center;"><em>${plan}</em></td>`;
        tbody.appendChild(planRow);

        for (const exercise in grouped[date]) {
        /* ---------- EXERCISE ROW ---------- */
        const exerciseRow = document.createElement("tr");
        exerciseRow.innerHTML = `<td colspan="5" style="text-align:center;">${exercise}</td>`;
        tbody.appendChild(exerciseRow);

        grouped[date][exercise]
            .sort((a,b) => a.set - b.set)
            .forEach(log => {
            const row = document.createElement("tr");
            row.setAttribute("data-id", log.id);
            row.innerHTML = `
                <td contenteditable="true">${log.date}</td>
                <td>${log.set}</td>
                <td contenteditable="true">${log.weight}</td>
                <td contenteditable="true">${log.reps}</td>
                <td>
                <button class="action-btn" onclick="updateLog(${log.id})">💾</button>
                <button class="action-btn" onclick="deleteLog(${log.id})">🗑️</button>
                </td>
            `;
            tbody.appendChild(row);
            });
        }
    }
}

function updateLog(id) {
    const row = document.querySelector(`tr[data-id="${id}"]`);
    if (!row) return;
    const cells = row.querySelectorAll("td");
    const index = workoutLogs.findIndex(l => l.id === id);
    if (index === -1) return;
    // cells[0] = date, cells[1] = set, cells[2] = weight, cells[3] = reps
    workoutLogs[index].date   = cells[0].textContent.trim();
    workoutLogs[index].weight = cells[2].textContent.trim();
    workoutLogs[index].reps = cells[3].textContent.trim();
    saveData().then(() => {
        updateDateSelector();
        renderWorkoutTable();
    });
}

function deleteLog(id) {
    workoutLogs = workoutLogs.filter(l => l.id !== id);
    saveData().then(() => {
        updateDateSelector();
        renderWorkoutTable();
    });
}

// ---------- Graph Functionality --------
function populatePlanSelect() {
    const select = document.getElementById("graphPlanSelect");
    select.innerHTML = "";

    for (let plan in plans) {
        const opt = document.createElement("option");
        opt.value = plan;
        opt.textContent = plan;
        select.appendChild(opt);
    }

    updateExerciseSelect();
}

function updateExerciseSelect() {
    const plan = document.getElementById("graphPlanSelect").value;
    const select = document.getElementById("graphExerciseSelect");
    select.innerHTML = "";

    if (!plans[plan]) return;

    plans[plan].forEach(ex => {
        const opt = document.createElement("option");
        opt.value = ex;
        opt.textContent = ex;
        select.appendChild(opt);
    });

    updateSetSelect();
}

function updateSetSelect() {
    const plan = document.getElementById("graphPlanSelect").value;
    const exercise = document.getElementById("graphExerciseSelect").value;
    const select = document.getElementById("graphSetSelect");
    select.innerHTML = "";

    const sets = new Set(
    workoutLogs
        .filter(l => l.plan === plan && l.exercise === exercise)
        .map(l => l.set)
    );

    [...sets].sort((a,b)=>a-b).forEach(s => {
        const opt = document.createElement("option");
        opt.value = s;
        opt.textContent = `Set ${s}`;
        select.appendChild(opt);
    });

    renderGraph();
}

// ---------------- Graph Rendering ----------------
function toggleGraphMetric() {
    const metric = document.getElementById("graphMetricSelect").value;
    const label = document.getElementById("metricFilterLabel");
    const input = document.getElementById("metricFilterInput");

    if (metric === "weight") {
        label.textContent = "Min Reps";
        input.placeholder = "Minimum reps";
    } 
    else if (metric === "reps") {
        label.textContent = "Weight:";
        input.placeholder = "Exact weight";
    }
    else {
        label.textContent = "N/A";
        input.placeholder = "N/A";
    }

    renderGraph();
}

function renderGraph() {
    const plan = document.getElementById("graphPlanSelect").value;
    const exercise = document.getElementById("graphExerciseSelect").value;
    const set = parseInt(document.getElementById("graphSetSelect").value, 10);
    const metric = document.getElementById("graphMetricSelect").value;
    const filterValue = parseInt(document.getElementById("metricFilterInput").value || "0", 10);

    const filtered = workoutLogs
    .filter(l =>
        l.plan === plan &&
        l.exercise === exercise &&
        l.set === set &&
        (
            metric === "weight"
                ? parseInt(l.reps, 10) >= filterValue
                : parseInt(l.weight, 10) === filterValue
        )
    )
    .sort((a,b)=> new Date(a.date) - new Date(b.date));

    //"labels" and "dataPoints" are the data being used to feed the graph
    const labels = filtered.map(l => l.date);
    const dataPoints =
    metric === "weight"
        ? filtered.map(l => parseFloat(l.weight))
        : filtered.map(l => parseInt(l.reps, 10));

    //"yLabel" and "title" are used to fill in the y_Axis Label and the Title of the Graph respectively
    const yLabel = metric === "weight" ? "Weight" : "Reps";
    const title =
        metric === "weight"
            ? `${plan} — ${exercise} — Set ${set} — Min Reps ${filterValue}`
            : `${plan} — ${exercise} — Set ${set} — Weight ${filterValue}`;

    const data = {
    labels,
    datasets: [{
        label: yLabel,
        data: dataPoints,
        fill: false,
        tension: 0.2
    }]
    };

    const config = {
    type: "line",
    data,
    options: {
        responsive: true,
        plugins: {
        title: {
            display: true,
            text: title
        },
        legend: {
            display: false
        }
        },
        scales: {
        x: {
            title: { display: true, text: "Date" }
        },
        y: {
            title: { display: true, text: yLabel },
            beginAtZero: true
        }
        }
    }
    };

    if (chart) chart.destroy();
    chart = new Chart(document.getElementById("trendChart"), config);
}

// ---------- Developer Tab ----------
function toggleDevTab() {
    const tab = document.getElementById("developerTab");
    tab.style.display = tab.style.display === "none" ? "block" : "none";
    if (tab.style.display === "block") refreshDevTab();
}

function refreshDevTab() {
    document.getElementById("rawData").textContent = JSON.stringify(plans, null, 2);
}

function exportDB() {
    const data = { plans, workoutLogs };
    const blob = new Blob([JSON.stringify(data,null,2)], { type:"application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "workout_backup.json"; a.click();
    URL.revokeObjectURL(url);
}

function importDB(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            plans = data.plans || {};
            workoutLogs = data.workoutLogs || [];
            saveData().then(() => {
                updatePlanSelectors();
                updateDateSelector();
                renderWorkoutTable();
                refreshDevTab();
                alert("✅ Import successful!");
            });
        } catch (err) {
            alert("❌ Failed to import data: " + err.message);
        }
    };
    reader.readAsText(file);
}

function downloadCSV() {
    if (workoutLogs.length === 0) return;

    const headers = ["Date","Plan","Exercise","Set","Weight","Reps"];

    const rows = workoutLogs.map(log =>
        [
            log.date,
            log.plan,
            log.exercise,
            log.set,
            log.weight,
            log.reps
        ].join(",")
    );

    const csv = [headers.join(","), ...rows].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "workout_full_export.csv";
    a.click();

    URL.revokeObjectURL(url);
}

function importCSV(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const lines = e.target.result.split("\n").map(l=>l.trim()).filter(l=>l);
            const headers = lines.shift().split(",");
            const required = ["Date","Plan","Exercise","Set","Weight","Reps"];
            if (required.some((h,i)=>headers[i] !== h)) throw new Error("CSV headers do not match expected format.");
            lines.forEach(line => {
                const [date, plan, exercise, set, weight, reps] = line.split(",");
                if (!plans[plan]) plans[plan] = [];
                if (exercise && !plans[plan].includes(exercise)) plans[plan].push(exercise);
                workoutLogs.push({
                    id: Date.now() + Math.floor(Math.random()*1000),
                    date,
                    plan,
                    exercise,
                    set: parseInt(set,10),
                    weight,
                    reps
                });
            });
            saveData().then(() => {
                //updatePlanSelectors();
                //updateDateSelector();
                //renderWorkoutTable();
                refreshDevTab();
                alert("✅ CSV Import successful!");
            });
        } catch (err) {
            alert("❌ Failed to import CSV: " + err.message);
        }
    };
    reader.readAsText(file);
}

async function importFullCSV(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async e => {
        const lines = e.target.result.trim().split("\n");
        const header = lines.shift().split(",").map(h => h.trim());
        const required = ["Date","Plan","Exercise","Set","Weight","Reps"];

        // Validate header order
        if (header.join(",") !== required.join(",")) {
            alert("Invalid CSV header. Expected columns: " + required.join(", "));
            return;
        }

        // Clear existing data
        plans = {};
        workoutLogs = [];

        // Parse and rebuild fresh data
        lines.forEach(line => {
            const [date, plan, exercise, set, weight, reps] = line.split(",").map(v => v.trim());
            if (!plans[plan]) plans[plan] = [];
            if (exercise && !plans[plan].includes(exercise)) plans[plan].push(exercise);

            workoutLogs.push({
                id: Date.now() + Math.floor(Math.random() * 1000),
                date,
                plan,
                exercise,
                set: parseInt(set, 10),
                weight,
                reps
            });
        });

        await saveData();
        //updateDateSelector();
        alert("Full CSV import complete. All previous data was overwritten.");
        event.target.value = ""; // reset file input
    };
    reader.readAsText(file);
}

// ---------- Init ----------
async function init() {
    await openDB();
    await loadData();
    updatePlanSelectors();
}

async function initHistoryTab() {
    await openDB();
    await loadData();
    updateHistoryPlanSelector();
    updateDateSelector();
    renderWorkoutTable();
}

async function initDeveloperTab() {
    await openDB();
    await loadData();
    refreshDevTab();
}

async function initGraphs() {
    await openDB();
    await loadData();
    populatePlanSelect();
}
