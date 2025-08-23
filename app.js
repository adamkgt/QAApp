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
const userPanelContainer = document.getElementById("userPanel");

// ------------------- Funkcje Firestore -------------------
async function loadTestCases() {
    if (!currentUser) return;
    const snapshot = await db.collection('testCases')
        .where('userId', '==', currentUser.uid)
        .orderBy('createdAt', 'desc')
        .get();
    testCases = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    snapshotTrend();
    renderTable();
}

async function saveTestCaseToFirebase(tc) {
    if (!currentUser) return;
    if (tc.id) {
        await db.collection('testCases').doc(tc.id).set(tc);
    } else {
        const docRef = await db.collection('testCases').add(tc);
        tc.id = docRef.id;
    }
}

// ------------------- Panel użytkownika -------------------
function renderUserPanel() {
    if (!currentUser || !userPanelContainer) return;
    userPanelContainer.innerHTML = `
        <div class="d-flex align-items-center gap-2">
            <span>${currentUser.email}</span>
            <button id="editProfileBtn" class="btn btn-sm btn-outline-secondary">Edytuj hasło</button>
            <button id="logoutBtn" class="btn btn-sm btn-outline-danger">Wyloguj</button>
        </div>
    `;
    document.getElementById("editProfileBtn").addEventListener("click", editPassword);
    document.getElementById("logoutBtn").addEventListener("click", () => auth.signOut());
}

function editPassword() {
    const newPassword = prompt("Podaj nowe hasło:");
    if (newPassword) {
        currentUser.updatePassword(newPassword)
            .then(() => alert("Hasło zmienione pomyślnie"))
            .catch(err => alert("Błąd: " + err.message));
    }
}

// ------------------- Auth -------------------
auth.onAuthStateChanged(async user => {
    if (!user) {
        window.location.href = "index.html";
    } else {
        currentUser = user;
        await loadTestCases();
        renderUserPanel();
    }
});

// ------------------- CRUD -------------------
async function saveTestCase() {
    if (!testForm) return;

    const index = document.getElementById('editIndex').value;
    let tc = {
        id: index ? testCases[index].id : null,
        userId: currentUser.uid,
        title: document.getElementById('testName').value,
        description: document.getElementById('testDesc').value,
        steps: document.getElementById('testSteps').value,
        expected: document.getElementById('expectedResult').value,
        status: document.getElementById('testStatus').value,
        notes: document.getElementById('testNotes').value,
        priority: document.getElementById('testPriority').value,
        history: [],
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (index !== '') {
        const old = testCases[index];
        tc.history = old.history || [];
        tc.history.push(`Edytowano: ${new Date().toLocaleString()}`);
        testCases[index] = tc;
    } else {
        tc.history.push(`Utworzono: ${new Date().toLocaleString()}`);
        testCases.unshift(tc);
    }

    await saveTestCaseToFirebase(tc);
    resetForm();
    snapshotTrend();
    renderTable();
}

function resetForm() {
    if (!testForm) return;
    testForm.reset();
    document.getElementById('editIndex').value = '';
}

function editTestCase(idx) {
    const tc = testCases[idx];
    document.getElementById('editIndex').value = idx;
    document.getElementById('testName').value = tc.title;
    document.getElementById('testDesc').value = tc.description;
    document.getElementById('testSteps').value = tc.steps;
    document.getElementById('expectedResult').value = tc.expected;
    document.getElementById('testStatus').value = tc.status;
    document.getElementById('testNotes').value = tc.notes;
    document.getElementById('testPriority').value = tc.priority;
}

async function deleteTestCase(idx) {
    if (!confirm('Na pewno usunąć ten test?')) return;
    const tc = testCases[idx];
    await db.collection('testCases').doc(tc.id).delete();
    testCases.splice(idx, 1);
    renderTable();
    snapshotTrend();
}

// ------------------- Sortowanie i filtry -------------------
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
        if (query && ![tc.title, tc.description].some(f => f.toLowerCase().includes(query))) return false;
        return true;
    });
}

// ------------------- Tabela -------------------
function renderTable() {
    let data = applyFilters(testCases);

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
            <td>${tc.description}</td>
            <td>${tc.steps}</td>
            <td>${tc.expected}</td>
            <td>${tc.status}</td>
            <td>${tc.notes}</td>
            <td>${tc.priority}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="editTestCase(${idx})">Edytuj</button>
                <button class="btn btn-sm btn-danger" onclick="deleteTestCase(${idx})">Usuń</button>
            </td>`;
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
    document.getElementById('barPass').style.width = (pass / total * 100) + '%';
    document.getElementById('barFail').style.width = (fail / total * 100) + '%';
    document.getElementById('barUnknown').style.width = (unknown / total * 100) + '%';
    document.getElementById('statsSummary').textContent = `Pass: ${pass}, Fail: ${fail}, Brak statusu: ${unknown}`;
}

// ------------------- Trend -------------------
function snapshotTrend() {
    trendData.push({ time: new Date().toLocaleTimeString(), total: testCases.length });
    if (trendData.length > 20) trendData.shift();
}

let statusChart, trendChart;
function updateCharts() {
    const { pass, fail, unknown } = countStats();

    if (!statusChart && document.getElementById('statusChart')) {
        statusChart = new Chart(document.getElementById('statusChart'), {
            type: 'doughnut',
            data: { labels: ['Pass', 'Fail', 'Brak'], datasets: [{ data: [pass, fail, unknown], backgroundColor: ['#4caf50', '#f44336', '#9e9e9e'] }] }
        });
    } else if (statusChart) {
        statusChart.data.datasets[0].data = [pass, fail, unknown];
        statusChart.update();
    }

    if (!trendChart && document.getElementById('trendChart')) {
        trendChart = new Chart(document.getElementById('trendChart'), {
            type: 'line',
            data: { labels: trendData.map(d => d.time), datasets: [{ label: 'Łączna liczba testów', data: trendData.map(d => d.total), borderColor: '#007bff', fill: false }] },
            options: { responsive: true, maintainAspectRatio: false }
        });
    } else if (trendChart) {
        trendChart.data.labels = trendData.map(d => d.time);
        trendChart.data.datasets[0].data = trendData.map(d => d.total);
        trendChart.update();
    }
}

// ------------------- Import / Export -------------------
function importFromCSV() { /* analogicznie do poprzedniego kodu */ }
function exportToCSV() { /* analogicznie do poprzedniego kodu */ }
function exportToPDF() { /* analogicznie do poprzedniego kodu */ }

// ------------------- Init -------------------
document.addEventListener('DOMContentLoaded', () => {
    if (testForm) {
        snapshotTrend();
        renderTable();
    }
});
