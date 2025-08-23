// ------------------- Inicjalizacja Firebase -------------------
const auth = firebase.auth();
const db = firebase.firestore();
let currentUser = null;
let testCases = [];
let sortKey = '';
let sortAsc = true;
let trendData = [];

// ------------------- Elementy DOM -------------------
const testForm = document.getElementById("testForm");

// ------------------- Panel użytkownika -------------------
function renderUserPanel() {
    const header = document.querySelector(".header-container");
    if (!header) return;
    
    const panel = document.createElement("div");
    panel.id = "userPanel";
    panel.classList.add("d-flex", "align-items-center", "gap-2", "ms-auto");
    panel.innerHTML = `
        <span>${currentUser.email}</span>
        <button id="editProfileBtn" class="btn btn-sm btn-outline-secondary">Zmień hasło</button>
        <button id="logoutBtn" class="btn btn-sm btn-outline-danger">Wyloguj</button>
    `;
    header.appendChild(panel);

    // Wylogowanie
    document.getElementById("logoutBtn").addEventListener("click", () => {
        auth.signOut().then(() => window.location.href = "index.html");
    });

    // Zmiana hasła
    document.getElementById("editProfileBtn").addEventListener("click", () => {
        const newPass = prompt("Podaj nowe hasło:");
        if (newPass) {
            currentUser.updatePassword(newPass)
                .then(() => alert("Hasło zmienione"))
                .catch(err => alert("Błąd: " + err.message));
        }
    });
}

// ------------------- Logowanie / Ochrona strony -------------------
auth.onAuthStateChanged(user => {
    if (!user) {
        window.location.href = "index.html";
    } else {
        currentUser = user;
        renderUserPanel();
        loadUserTestCases();
    }
});

// ------------------- CRUD Firebase dla użytkownika -------------------
function loadUserTestCases() {
    db.collection("testCases")
      .where("owner", "==", currentUser.uid)
      .orderBy("createdAt", "asc")
      .onSnapshot(snapshot => {
          testCases = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          renderTable();
          snapshotTrend();
          updateStats();
          updateCharts();
      });
}

function saveTestCase() {
    const idField = document.getElementById('editIndex').value;
    const data = {
        title: document.getElementById('testName').value,
        desc: document.getElementById('testDesc').value,
        steps: document.getElementById('testSteps').value,
        expected: document.getElementById('expectedResult').value,
        status: document.getElementById('testStatus').value,
        notes: document.getElementById('testNotes').value,
        priority: document.getElementById('testPriority').value,
        owner: currentUser.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        history: []
    };

    if (!idField) {
        db.collection("testCases").add(data);
    } else {
        db.collection("testCases").doc(idField).update(data);
    }

    resetForm();
}

function editTestCase(idx) {
    const tc = testCases[idx];
    document.getElementById('editIndex').value = tc.id;
    document.getElementById('testName').value = tc.title;
    document.getElementById('testDesc').value = tc.desc;
    document.getElementById('testSteps').value = tc.steps;
    document.getElementById('expectedResult').value = tc.expected;
    document.getElementById('testStatus').value = tc.status;
    document.getElementById('testNotes').value = tc.notes;
    document.getElementById('testPriority').value = tc.priority;
}

function deleteTestCase(idx) {
    if (!confirm('Na pewno usunąć ten test?')) return;
    db.collection("testCases").doc(testCases[idx].id).delete();
}

function setCritical(idx) {
    const tc = testCases[idx];
    const newHistory = [...tc.history, `Ustawiono priorytet Krytyczny: ${new Date().toLocaleString()}`];
    db.collection("testCases").doc(tc.id).update({
        priority: "Krytyczny",
        history: newHistory
    });
}

function showHistory(idx) {
    const tc = testCases[idx];
    document.getElementById('historyContent').textContent = tc.history.join('\n');
    new bootstrap.Modal(document.getElementById('historyModal')).show();
}

// ------------------- Formularz i reset -------------------
function resetForm() {
    if (!testForm) return;
    testForm.reset();
    document.getElementById('editIndex').value = '';
}

// ------------------- Filtry, sortowanie i statystyki -------------------
function sortBy(key) {
    if (sortKey === key) sortAsc = !sortAsc;
    else { sortKey = key; sortAsc = true; sortKey = key; }
    renderTable();
}

function clearFilters() {
    document.getElementById('statusFilter').value = 'all';
    document.getElementById('priorityFilter').value = 'all';
    document.getElementById('searchQuery').value = '';
    renderTable();
}

function applyFilters(data) {
    const status = document.getElementById('statusFilter').value;
    const priority = document.getElementById('priorityFilter').value;
    const query = document.getElementById('searchQuery').value.toLowerCase();
    return data.filter(tc => {
        if (status !== 'all' && tc.status !== status) return false;
        if (priority !== 'all' && tc.priority !== priority) return false;
        if (query && ![tc.title, tc.desc].some(f => f.toLowerCase().includes(query))) return false;
        return true;
    });
}

function renderTable() {
    const data = applyFilters(testCases);
    if (sortKey) {
        data.sort((a, b) => {
            const va = a[sortKey] || '', vb = b[sortKey] || '';
            if (va < vb) return sortAsc ? -1 : 1;
            if (va > vb) return sortAsc ? 1 : -1;
            return 0;
        });
    }

    const tbody = document.querySelector('#testTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    data.forEach((tc, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${tc.title}</td>
            <td>${tc.desc}</td>
            <td>${tc.steps}</td>
            <td>${tc.expected}</td>
            <td>${tc.status || ''}</td>
            <td>${tc.notes}</td>
            <td>${tc.priority || ''}</td>
            <td class="nowrap">
                <button class="btn btn-sm btn-primary" onclick="editTestCase(${idx})">Edytuj</button>
                <button class="btn btn-sm btn-danger" onclick="deleteTestCase(${idx})">Usuń</button>
                <button class="btn btn-sm btn-warning" onclick="setCritical(${idx})">Krytyczny</button>
                <button class="btn btn-sm btn-info" onclick="showHistory(${idx})">Historia</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    updateStats();
    updateCharts();
}

// ------------------- Statystyki -------------------
function countStats() {
    let pass = 0, fail = 0, unknown = 0;
    testCases.forEach(tc => {
        if (tc.status === 'Pass') pass++;
        else if (tc.status === 'Fail') fail++;
        else unknown++;
    });
    return { pass, fail, unknown };
}

function updateStats() {
    const { pass, fail, unknown } = countStats();
    const total = testCases.length || 1;
    const barPass = document.getElementById('barPass');
    const barFail = document.getElementById('barFail');
    const barUnknown = document.getElementById('barUnknown');
    if (barPass) barPass.style.width = (pass/total*100)+'%';
    if (barFail) barFail.style.width = (fail/total*100)+'%';
    if (barUnknown) barUnknown.style.width = (unknown/total*100)+'%';
}

// ------------------- Trend wykres -------------------
let trendChart;
function snapshotTrend() {
    trendData.push({ time: new Date().toLocaleTimeString(), total: testCases.length });
    if (trendData.length > 20) trendData.shift();
    updateCharts();
}

function updateCharts() {
    const ctxTrend = document.getElementById('trendChart');
    if (!ctxTrend) return;
    if (!trendChart) {
        trendChart = new Chart(ctxTrend, {
            type: 'line',
            data: { labels: trendData.map(d=>d.time), datasets: [{ label:'Łączna liczba testów', data: trendData.map(d=>d.total), borderColor:'#007bff', fill:false }]},
            options:{ responsive:true, maintainAspectRatio:false }
        });
    } else {
        trendChart.data.labels = trendData.map(d=>d.time);
        trendChart.data.datasets[0].data = trendData.map(d=>d.total);
        trendChart.update();
    }
}

// ------------------- Import / Export -------------------
function importFromCSV() {
    const file = document.getElementById('csvFile')?.files[0];
    if (!file) return alert('Wybierz plik CSV');
    const reader = new FileReader();
    reader.onload = e => {
        const lines = e.target.result.split('\n').filter(l => l.trim());
        lines.slice(1).forEach(line => {
            const [title, desc, steps, expected, status, notes, priority] = line.split(',');
            db.collection("testCases").add({ title, desc, steps, expected, status, notes, priority, owner: currentUser.uid, createdAt: firebase.firestore.FieldValue.serverTimestamp(), history: [] });
        });
    };
    reader.readAsText(file);
}

function exportToCSV() {
    let csv = "Tytuł,Opis,Kroki,Oczekiwany,Status,Uwagi,Priorytet\n";
    testCases.forEach(tc => {
        csv += `"${tc.title}","${tc.desc}","${tc.steps}","${tc.expected}","${tc.status}","${tc.notes}","${tc.priority}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'testcases.csv';
    a.click();
}
