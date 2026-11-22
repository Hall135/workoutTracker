// ---------- Workout UI ----------
let setsPerExercise = 4;
let chart;
let loggingWorkout = false;

// ---------- Core Functions ----------
async function createPlan() {
    const input = document.getElementById("planName");
    const name = input.value.trim();
    if (!name || plans[name]) return;
    try {
        await changeData(draft => {
            if (!Object.hasOwn(draft.plans, name)) draft.plans[name] = [];
        });
        updatePlanSelectors();
        input.value = "";
    } catch (error) {
        showError(error);
    }
}

async function addExercise() {
    const plan = document.getElementById("planSelect").value;
    const input = document.getElementById("exerciseName");
    const exercise = input.value.trim();
    if (!plan || !exercise || plans[plan].includes(exercise)) return;
    try {
        await changeData(draft => {
            if (!draft.plans[plan].includes(exercise)) draft.plans[plan].push(exercise);
        });
        input.value = "";
        if (document.getElementById("logPlanSelect").value === plan) renderExerciseInputs();
    } catch (error) {
        showError(error);
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
    const exercises = plans[plan] || [];
    const hasExercises = exercises.length > 0;
    document.getElementById("addSetButton").disabled = !hasExercises;
    document.getElementById("logWorkoutButton").disabled = !hasExercises;
    document.getElementById("workoutStatus").textContent = "";

    if (!hasExercises) {
        const message = document.createElement("p");
        message.className = "empty-state";
        message.textContent = plan
            ? "This plan has no exercises yet. Add an exercise below to get started."
            : "Create your first workout plan below, then add your exercises.";
        container.appendChild(message);
        document.getElementById("planManagement").open = true;
        return;
    }

    // Reset to four sets when the selected plan changes.
    setsPerExercise = 4;
    exercises.forEach(exercise => {
        const block = document.createElement("section");
        block.className = "exercise-block";
        block.setAttribute("data-exercise", exercise);
        const heading = document.createElement("h2");
        heading.textContent = exercise;
        block.appendChild(heading);
        const columns = document.createElement("div");
        columns.className = "set-header";
        columns.setAttribute("aria-hidden", "true");
        columns.innerHTML = "<span>Set</span><span>Weight</span><span>Reps</span>";
        block.appendChild(columns);
        for (let i = 1; i <= setsPerExercise; i++) {
            block.appendChild(createSetRow(exercise, i));
        }
        container.appendChild(block);
    });
}

function createSetRow(exercise, setNumber) {
    const row = document.createElement("div");
    row.className = "set-row";
    const number = document.createElement("span");
    number.className = "set-number";
    number.textContent = setNumber;
    row.appendChild(number);
    ["weight", "reps"].forEach(metric => {
        const input = document.createElement("input");
        input.type = "number";
        input.min = "0";
        input.step = metric === "weight" ? "any" : "1";
        input.inputMode = metric === "weight" ? "decimal" : "numeric";
        input.id = `${exercise}-${metric}-${setNumber}`;
        input.setAttribute("aria-label", `${exercise}, set ${setNumber}, ${metric}`);
        row.appendChild(input);
    });
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

async function logEntireWorkout() {
    if (loggingWorkout) return;
    const plan = document.getElementById("logPlanSelect").value;
    if (!plan) return;
    const date = localDate();
    let loggedSets = 0;
    const pendingLogs = [];
    const loggedInputs = [];

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
                    id: crypto.randomUUID(),
                    date,
                    plan,
                    exercise,
                    set: setNumber,
                    weight,
                    reps
                };
                pendingLogs.push(log);
                loggedInputs.push(weightEl, repsEl);
                loggedSets++;
            }

            setNumber++;
        }
    });

    const status = document.getElementById("workoutStatus");
    if (!loggedSets) {
        status.textContent = "Enter both weight and reps for at least one set.";
        return;
    }
    const saveButton = document.getElementById("logWorkoutButton");
    saveButton.disabled = true;
    loggingWorkout = true;
    try {
        await changeData(draft => { draft.workoutLogs.push(...pendingLogs); });
        loggedInputs.forEach(input => input.value = "");
        status.textContent = `Workout saved. ${loggedSets} ${loggedSets === 1 ? "set" : "sets"} recorded.`;
    } catch (error) {
        status.textContent = "Unable to save the workout. Your entries are still here; please try again.";
        console.error(error);
    } finally {
        loggingWorkout = false;
        saveButton.disabled = false;
    }
}

// ---------- Workout History ----------
function updateDateSelector() {
    const dateSelect = document.getElementById("historyDateSelect");

    const uniqueDates = [...new Set(workoutLogs.map(log => log.date))].sort().reverse();

    dateSelect.innerHTML = "";
    uniqueDates.forEach(date => {
        const opt = document.createElement("option");
        opt.value = date;
        opt.textContent = formatDate(date);
        dateSelect.appendChild(opt);
    });

    if (uniqueDates.length > 0) dateSelect.value = uniqueDates[0];

    document.getElementById("historyTitle").textContent = uniqueDates.length ? `Workout for ${formatDate(dateSelect.value)}` : "";
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
    } else if (view === "plan") {
        dateControls.style.display = "none";
        planControls.style.display = "block";

        dateTable.style.display = "none";
        planTable.style.display = "table";

        renderWorkoutTableByPlan();
    } else {
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
    document.getElementById("historyTitle").textContent = selectedDate ? `Workout for ${formatDate(selectedDate)}` : "";

    document.getElementById("historyEmpty").hidden = Boolean(selectedDate);
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
        planRow.innerHTML = `<td colspan="5"><strong>${plan}</strong></td>`;
        tbody.appendChild(planRow);

        for (const exercise in grouped[plan]) {
            const exRow = document.createElement("tr");
            exRow.innerHTML = `<td colspan="5"><em>${exercise}</em></td>`;
            tbody.appendChild(exRow);

            grouped[plan][exercise].sort((a, b) => a.set - b.set).forEach(log => {
                const row = document.createElement("tr");
                row.setAttribute("data-id", log.id);
                row.innerHTML = `
                    <td contenteditable="true">${log.date}</td>
                    <td>${log.set}</td>
                    <td contenteditable="true">${log.weight}</td>
                    <td contenteditable="true">${log.reps}</td>
                    <td>
                    <button class="action-btn" aria-label="Save set" title="Save set" onclick="updateLog(this.closest('tr').dataset.id)"><i class="material-icons" aria-hidden="true">save</i></button>
                    <button class="action-btn button-danger" aria-label="Delete set" title="Delete set" onclick="deleteLog(this.closest('tr').dataset.id)"><i class="material-icons" aria-hidden="true">delete</i></button>
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
    document.getElementById("historyTitle").textContent = plan ? `Workout Plan - ${plan}` : "";
    document.getElementById("historyEmpty").hidden = workoutLogs.some(log => log.plan === plan);
    if (!plan) return;

    // Filter logs for selected plan
    const logs = workoutLogs
        .filter(l => l.plan === plan)
        .sort((a, b) => b.date.localeCompare(a.date));

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
        dateRow.innerHTML = `<td colspan="5"><strong>${date}</strong></td>`;
        tbody.appendChild(dateRow);

        /* ---------- PLAN ROW ---------- */
        const planRow = document.createElement("tr");
        planRow.innerHTML = `<td colspan="5"><em>${plan}</em></td>`;
        tbody.appendChild(planRow);

        for (const exercise in grouped[date]) {
            /* ---------- EXERCISE ROW ---------- */
            const exerciseRow = document.createElement("tr");
            exerciseRow.innerHTML = `<td colspan="5">${exercise}</td>`;
            tbody.appendChild(exerciseRow);

            grouped[date][exercise]
                .sort((a, b) => a.set - b.set)
                .forEach(log => {
                    const row = document.createElement("tr");
                    row.setAttribute("data-id", log.id);
                    row.innerHTML = `
                        <td contenteditable="true">${log.date}</td>
                        <td>${log.set}</td>
                        <td contenteditable="true">${log.weight}</td>
                        <td contenteditable="true">${log.reps}</td>
                        <td>
                        <button class="action-btn" aria-label="Save set" title="Save set" onclick="updateLog(this.closest('tr').dataset.id)"><i class="material-icons" aria-hidden="true">save</i></button>
                        <button class="action-btn button-danger" aria-label="Delete set" title="Delete set" onclick="deleteLog(this.closest('tr').dataset.id)"><i class="material-icons" aria-hidden="true">delete</i></button>
                        </td>
                    `;
                    tbody.appendChild(row);
                });
        }
    }
}

async function updateLog(id) {
    const tableId = document.getElementById("historyViewSelect").value === "plan"
        ? "workoutTableByPlan" : "workoutTableByDate";
    const row = [...document.querySelectorAll(`#${tableId} tr[data-id]`)]
        .find(element => element.dataset.id === String(id));
    if (!row) return;
    const cells = row.querySelectorAll("td");
    try {
        const date = normalizeDate(cells[0].textContent);
        const weight = cells[2].textContent.trim();
        const reps = cells[3].textContent.trim();
        await changeData(draft => {
            const log = draft.workoutLogs.find(log => String(log.id) === String(id));
            if (!log) throw new Error("This set no longer exists. Reload history.");
            Object.assign(log, { date, weight, reps });
        });
        updateDateSelector();
        toggleHistoryView();
    } catch (error) {
        showError(error);
    }
}

async function deleteLog(id) {
    try {
        await changeData(draft => {
            draft.workoutLogs = draft.workoutLogs.filter(log => String(log.id) !== String(id));
        });
        updateDateSelector();
        toggleHistoryView();
    } catch (error) {
        showError(error);
    }
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

    if (!plans[plan]) {
        updateSetSelect();
        return;
    }

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

    [...sets].sort((a, b) => a - b).forEach(s => {
        const opt = document.createElement("option");
        opt.value = s;
        opt.textContent = `Set ${s}`;
        select.appendChild(opt);
    });

    const opt = document.createElement("option");
    opt.value = "All";
    opt.textContent = `All Sets`;
    select.appendChild(opt);

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
    } else if (metric === "reps") {
        label.textContent = "Weight:";
        input.placeholder = "Exact weight";
    } else {
        label.textContent = "N/A";
        input.placeholder = "N/A";
    }

    renderGraph();
}

function renderGraph() {
    const plan = document.getElementById("graphPlanSelect").value;
    const exercise = document.getElementById("graphExerciseSelect").value;
    const setValue = document.getElementById("graphSetSelect").value;
    const metric = document.getElementById("graphMetricSelect").value;
    const filterValue = Number(document.getElementById("metricFilterInput").value || "0");

    const showAllSets = setValue === "All";

    // Base filter (plan + exercise only)
    const baseLogs = workoutLogs.filter(l =>
        l.plan === plan &&
        l.exercise === exercise &&
        (
            metric === "weight"
                ? parseInt(l.reps, 10) >= filterValue
                : Number(l.weight) === filterValue
        )
    );

    const datasets = [];

    if (!showAllSets) {
        // SINGLE SET
        const set = parseInt(setValue, 10);

        const filtered = baseLogs
            .filter(l => l.set === set)
            .sort((a, b) => a.date.localeCompare(b.date));

        datasets.push({
            label: metric === "weight" ? "Weight" : "Reps",
            data: filtered.map(l => ({
                x: l.date,
                y: metric === "weight"
                    ? parseFloat(l.weight)
                    : parseInt(l.reps, 10)
            })),
            fill: false,
            tension: 0.2
        });

    } else {
        // ALL SETS MODE
        const logsBySet = {};

        baseLogs.forEach(log => {
            if (!logsBySet[log.set]) {
                logsBySet[log.set] = [];
            }
            logsBySet[log.set].push(log);
        });

        Object.keys(logsBySet)
            .sort((a, b) => a - b)
            .forEach(setNum => {
                const logs = logsBySet[setNum]
                    .sort((a, b) => a.date.localeCompare(b.date));

                datasets.push({
                    label: `Set ${setNum}`,
                    data: logs.map(l => ({
                        x: l.date,
                        y: metric === "weight"
                            ? parseFloat(l.weight)
                            : parseInt(l.reps, 10)
                    })),
                    fill: false,
                    tension: 0.2
                });
        });
    }

    // Describe the selected metric and filters.
    const yLabel = metric === "weight" ? "Weight" : "Reps";
    const title =
        metric === "weight"
            ? `${plan} — ${exercise} — Set ${setValue} — Min Reps ${filterValue}`
            : `${plan} — ${exercise} — Set ${setValue} — Weight ${filterValue}`;

    const chartColors = ["#51d6b4", "#82b7ff", "#e9b971", "#c7a6ff", "#ff9eae"];
    datasets.forEach((dataset, index) => {
        dataset.borderColor = chartColors[index % chartColors.length];
        dataset.backgroundColor = dataset.borderColor;
        dataset.pointRadius = 4;
        dataset.borderWidth = 2;
    });
    const hasData = datasets.some(dataset => dataset.data.length > 0);
    document.getElementById("graphEmpty").hidden = hasData;
    document.getElementById("trendChart").setAttribute("aria-label", `${title}. ${hasData ? "Workout progress over time." : "No matching sets."}`);

    const config = {
        type: "line",
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            color: "#b2bec7",
            plugins: {
                title: {
                    display: true,
                    text: plan && exercise ? title : "Workout progress",
                    color: "#f2f5f7"
                },
                legend: { display: showAllSets }
            },
            scales: {
                x: {
                    type: "category",
                    ticks: { color: "#b2bec7" },
                    grid: { color: "#303b44" },
                    title: { display: true, text: "Date", color: "#b2bec7" }
                },
                y: {
                    ticks: { color: "#b2bec7" },
                    grid: { color: "#303b44" },
                    title: { display: true, text: yLabel, color: "#b2bec7" },
                    beginAtZero: true
                }
            }
        }
    };

    if (chart) chart.destroy();
    chart = new Chart(document.getElementById("trendChart"), config);
}

// ---------- Developer Tab ----------
function refreshDevTab() {
    document.getElementById("rawData").textContent = JSON.stringify(plans, null, 2);
}

// ---------- Initialization and error feedback ----------
function showError(error) {
    console.error(error);
    alert(`The operation could not be completed: ${error?.message || error || "Unknown error"}`);
}

async function initializePage(render) {
    const controls = document.querySelectorAll("main button, main input, main select");
    controls.forEach(control => { control.disabled = true; });
    try {
        await openDB();
        await loadData();
        controls.forEach(control => { control.disabled = false; });
        render();
    } catch (error) {
        // Do not allow edits when loading failed; avoid overwriting unread records.
        controls.forEach(control => { control.disabled = true; });
        showError(error);
    }
}

async function init() {
    await initializePage(updatePlanSelectors);
}

async function initHistoryTab() {
    await initializePage(() => {
        updateHistoryPlanSelector();
        updateDateSelector();
        renderWorkoutTable();
    });
}

async function initDeveloperTab() {
    await initializePage(refreshDevTab);
}

async function initGraphs() {
    await initializePage(() => {
        populatePlanSelect();
        toggleGraphMetric();
    });
}
