// Inicjalizacja Firebase
firebase.initializeApp(firebaseConfig);

// TYLKO RAZ deklarujemy auth i db
const auth = firebase.auth();
const db = firebase.firestore();
let currentUser = null;

// ------------------- Elementy DOM -------------------
const loginForm = document.getElementById("loginForm");
const logoutBtn = document.getElementById("logoutBtn");
const testForm = document.getElementById("testForm");

// ------------------- Logowanie (index.html) -------------------
if (loginForm) {
    loginForm.addEventListener("submit", e => {
        e.preventDefault();
        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;

        auth.signInWithEmailAndPassword(email, password)
            .then(() => window.location.href = "app.html")
            .catch(err => {
                document.getElementById("errorMsg").textContent = "Błąd: " + err.message;
            });
    });
}

// ------------------- Ochrona strony i wylogowanie (app.html) -------------------
if (testForm || logoutBtn) {
    auth.onAuthStateChanged(user => {
        if (!user) {
            window.location.href = "index.html";
        } else {
            currentUser = user;
            renderTable();
        }
    });

    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            auth.signOut().then(() => window.location.href = "index.html");
        });
    }
}

// ------------------- CRUD lokalny (localStorage) -------------------
let testCases = [];
let sortKey = '';
let sortAsc = true;
let trendData = [];

function getAllTestCases() { return JSON.parse(localStorage.getItem('testCases') || '[]'); }
function setAllTestCases(data) { localStorage.setItem('testCases', JSON.stringify(data)); }
function resetForm() {
    if (!testForm) return;
    testForm.reset();
    document.getElementById('editIndex').value = '';
}

function formatList(text) {
    if (!text) return '';
    const lines = text.split('\n').filter(l => l.trim());
    return '<ol><li>' + lines.join('</li><li>') + '</li></ol>';
}

// ------------------- CRUD funkcje -------------------
function saveTestCase() {
    let index = document.getElementById('editIndex').value;
    let testCase = {
        id: document.getElementById('testId').value,
        name: document.getElementById('testName').value,
        desc: document.getElementById('testDesc').value,
        steps: document.getElementById('testSteps').value,
        expected: document.getElementById('expectedResult').value,
        status: document.getElementById('testStatus').value,
        notes: document.getElementById('testNotes').value,
        priority: document.getElementById('testPriority').value,
        history: []
    };
    testCases = getAllTestCases();
    if (index === '') {
        testCase.history.push(`Utworzono: ${new Date().toLocaleString()}`);
        testCases.push(testCase);
    } else {
        let old = { ...testCases[index] };
        testCase.history = old.history || [];
        testCase.history.push(`Edytowano: ${new Date().toLocaleString()}`);
        testCases[index] = testCase;
    }
    setAllTestCases(testCases);
    resetForm();
    snapshotTrend();
    renderTable();
}

function editTestCase(idx) {
    testCases = getAllTestCases();
    const tc = testCases[idx];
    document.getElementById('editIndex').value = idx;
    document.getElementById('testId').value = tc.id;
    document.getElementById('testName').value = tc.name;
    document.getElementById('testDesc').value = tc.desc;
    document.getElementById('testSteps').value = tc.steps;
    document.getElementById('expectedResult').value = tc.expected;
    document.getElementById('testStatus').value = tc.status;
    document.getElementById('testNotes').value = tc.notes;
    document.getElementById('testPriority').value = tc.priority;
}

function deleteTestCase(idx) {
    if (!confirm('Na pewno usunąć ten test?')) return;
    testCases = getAllTestCases();
    testCases.splice(idx, 1);
    setAllTestCases(testCases);
    renderTable();
    snapshotTrend();
}

function deleteAllTestCases() {
    if (!confirm('Na pewno usunąć wszystkie testy?')) return;
    testCases = [];
    setAllTestCases(testCases);
    trendData = [];
    renderTable();
    updateCharts();
}

function setCritical(idx) {
    testCases = getAllTestCases();
    const tc = testCases[idx];
    tc.priority = 'Krytyczny';
    tc.history.push(`Ustawiono priorytet Krytyczny: ${new Date().toLocaleString()}`);
    testCases[idx] = tc;
    setAllTestCases(testCases);
    renderTable();
}

function showHistory(idx) {
    testCases = getAllTestCases();
    const tc = testCases[idx];
    document.getElementById('historyContent').textContent = tc.history.join('\n');
    new bootstrap.Modal(document.getElementById('historyModal')).show();
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
        if (query && ![tc.id, tc.name, tc.desc].some(f => f.toLowerCase().includes(query))) return false;
        return true;
    });
}

function renderTable() {
    testCases = getAllTestCases();
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
        <td>${tc.id}</td>
        <td>${tc.name}</td>
        <td>${tc.desc}</td>
        <td>${formatList(tc.steps)}</td>
        <td>${formatList(tc.expected)}</td>
        <td>
          ${tc.status === 'Pass' ? '<span class="badge pass-badge" title="Test zaliczony">Pass</span>' : ''}
          ${tc.status === 'Fail' ? '<span class="badge fail-badge" title="Test niezaliczony">Fail</span>' : ''}
          ${!tc.status ? '<span class="badge unknown-badge">Brak</span>' : ''}
        </td>
        <td>${tc.notes}</td>
        <td>${tc.priority || ''}</td>
        <td class="nowrap">
          <button class="btn btn-sm btn-primary" title="Edytuj" onclick="editTestCase(${idx})"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-danger" title="Usuń" onclick="deleteTestCase(${idx})"><i class="bi bi-trash"></i></button>
          <button class="btn btn-sm btn-warning" title="Krytyczny" onclick="setCritical(${idx})"><i class="bi bi-exclamation-triangle"></i></button>
          <button class="btn btn-sm btn-info" title="Historia" onclick="showHistory(${idx})"><i class="bi bi-clock-history"></i></button>
        </td>`;
        tbody.appendChild(tr);
    });

    updateStats();
    updateCharts();
}

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
    if (barPass) barPass.style.width = (pass / total * 100) + '%';
    if (barFail) barFail.style.width = (fail / total * 100) + '%';
    if (barUnknown) barUnknown.style.width = (unknown / total * 100) + '%';

    const statsSummary = document.getElementById('statsSummary');
    const statsSummaryFiltered = document.getElementById('statsSummaryFiltered');
    if (statsSummary) statsSummary.textContent = `Pass: ${pass}, Fail: ${fail}, Brak statusu: ${unknown}`;
    if (statsSummaryFiltered) statsSummaryFiltered.textContent = `Wyświetlane: ${applyFilters(testCases).length}`;
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

function snapshotTrend() {
    trendData.push({ time: new Date().toLocaleTimeString(), total: testCases.length });
    if (trendData.length > 20) trendData.shift();
}

// ------------------- Import / Export -------------------
function importFromCSV() {
    const file = document.getElementById('csvFile')?.files[0];
    if (!file) return alert('Wybierz plik CSV');
    const reader = new FileReader();
    reader.onload = e => {
        const lines = e.target.result.split('\n').filter(l => l.trim());
        const arr = lines.slice(1).map(l => {
            const [id, name, desc, steps, expected, status, notes, priority] = l.split(',');
            return { id, name, desc, steps, expected, status, notes, priority, history: [`Zaimportowano: ${new Date().toLocaleString()}`] };
        });
        testCases = arr;
        setAllTestCases(testCases);
        snapshotTrend();
        renderTable();
    };
    reader.readAsText(file);
}

function exportToCSV() {
    let csv = "ID testu,Nazwa testu,Opis,Kroki,Oczekiwany rezultat,Status,Uwagi,Priorytet\n";
    testCases.forEach(tc => {
        const steps = `"${tc.steps.replace(/"/g, '""')}"`;
        const expected = `"${tc.expected.replace(/"/g, '""')}"`;
        csv += [tc.id, tc.name, tc.desc, steps, expected, tc.status, tc.notes, tc.priority].join(',') + '\n';
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'testcases.csv';
    a.click();
}

function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.autoTable({
        head: [['ID', 'Nazwa', 'Opis', 'Kroki', 'Oczekiwany', 'Status', 'Uwagi', 'Priorytet']],
        body: testCases.map(tc => [
            tc.id, tc.name, tc.desc,
            tc.steps.replace(/\n/g, '\n• '),
            tc.expected.replace(/\n/g, '\n• '),
            tc.status, tc.notes, tc.priority
        ]),
        styles: { cellPadding: 2, fontSize: 10 }
    });
    doc.save('testcases.pdf');
}

// ------------------- Init -------------------
document.addEventListener('DOMContentLoaded', () => {
    if (testForm) {
        testCases = getAllTestCases();
        snapshotTrend();
        renderTable();
    }
});

