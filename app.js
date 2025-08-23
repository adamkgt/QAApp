// ------------------- Inicjalizacja Firebase -------------------
const auth = firebase.auth();
const db = firebase.firestore();
let currentUser = null;
let testCases = [];
let sortKey = '';
let sortAsc = true;
let statusChart = null;
let unsubscribeTestCases = null;

// ------------------- Elementy DOM -------------------
const testForm = document.getElementById("testForm");
const statusFilter = document.getElementById("statusFilter");
const priorityFilter = document.getElementById("priorityFilter");
const searchQuery = document.getElementById("searchQuery");

// ------------------- Panel użytkownika -------------------
function renderUserPanel() {
    const userPanel = document.getElementById('userPanel');
    if (!userPanel || !currentUser) return;

    userPanel.innerHTML = `
        <span class="fw-bold">${currentUser.email}</span>
        <button id="editProfileBtn" class="btn btn-sm btn-outline-secondary">Zmień hasło</button>
        <button id="logoutBtnPanel" class="btn btn-sm btn-outline-danger">Wyloguj</button>
    `;

    document.getElementById('editProfileBtn').addEventListener('click', () => {
        const newPassword = prompt('Podaj nowe hasło:');
        if (newPassword) {
            currentUser.updatePassword(newPassword)
                .then(() => alert('Hasło zmienione!'))
                .catch(err => alert('Błąd: ' + err.message));
        }
    });

    document.getElementById('logoutBtnPanel').addEventListener('click', () => {
        auth.signOut().then(() => window.location.href = 'index.html');
    });
}

// ------------------- Ochrona strony i ładowanie danych -------------------
auth.onAuthStateChanged(user => {
    if (!user) {
        window.location.href = "index.html";
    } else if (!currentUser) {
        currentUser = user;
        renderUserPanel();
        loadTestCases();
    }
});

// ------------------- Ładowanie przypadków testowych -------------------
function loadTestCases() {
    db.collection('Users')
      .doc(currentUser.uid)
      .collection('testCases')
      .onSnapshot(snapshot => {
          testCases = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          renderTable();
      }, err => console.error(err));
}


// ------------------- CRUD -------------------
function saveTestCase() {
    const index = document.getElementById('editIndex').value;
    const testName = document.getElementById('testName').value; // użyjemy jako ID dokumentu

    const data = {
        name: testName,
        desc: document.getElementById('testDesc').value,
        steps: document.getElementById('testSteps').value,
        expected: document.getElementById('expectedResult').value,
        status: document.getElementById('testStatus').value,
        notes: document.getElementById('testNotes').value,
        priority: document.getElementById('testPriority').value,
        history: [`${index === '' ? 'Utworzono' : 'Edytowano'}: ${new Date().toLocaleString()}`]
    };

    const userDocRef = db.collection('Users').doc(currentUser.uid);
    const testCaseDocRef = userDocRef.collection('testCases').doc(testName);

    testCaseDocRef.set(data, { merge: true }) // merge: true pozwala aktualizować bez nadpisywania całego dokumentu
        .then(() => resetForm())
        .catch(err => alert('Błąd zapisu: ' + err.message));
}


function editTestCase(id) {
    const tc = testCases.find(tc => tc.id === id);
    if (!tc) return;
    document.getElementById('editIndex').value = tc.id;
    document.getElementById('testName').value = tc.name;
    document.getElementById('testDesc').value = tc.desc;
    document.getElementById('testSteps').value = tc.steps;
    document.getElementById('expectedResult').value = tc.expected;
    document.getElementById('testStatus').value = tc.status;
    document.getElementById('testNotes').value = tc.notes;
    document.getElementById('testPriority').value = tc.priority;
}

function deleteTestCase(id) {
    if (!confirm('Na pewno usunąć ten test?')) return;
    db.collection('testCases').doc(id).delete();
}

function deleteAllTestCases() {
    if (!confirm('Na pewno usunąć wszystkie testy?')) return;
    testCases.forEach(tc => db.collection('testCases').doc(tc.id).delete());
}

function resetForm() {
    if (!testForm) return;
    testForm.reset();
    document.getElementById('editIndex').value = '';
}

// ------------------- Filtry i sortowanie -------------------
function clearFilters() {
    statusFilter.value = 'all';
    priorityFilter.value = 'all';
    searchQuery.value = '';
    renderTable();
}

function applyFilters(data) {
    const status = statusFilter.value;
    const priority = priorityFilter.value;
    const query = searchQuery.value.toLowerCase();
    return data.filter(tc => {
        if (status !== 'all' && tc.status !== status) return false;
        if (priority !== 'all' && tc.priority !== priority) return false;
        if (query && ![tc.name, tc.desc, tc.steps, tc.expected].some(f => f.toLowerCase().includes(query))) return false;
        return true;
    });
}

function sortBy(key) {
    if (sortKey === key) sortAsc = !sortAsc;
    else { sortKey = key; sortAsc = true; }
    renderTable();
}

// ------------------- Renderowanie tabeli, statystyki, wykresy -------------------
function renderTable() {
    let data = applyFilters([...testCases]);

    if (sortKey) {
        data.sort((a, b) => {
            const va = a[sortKey] || '', vb = b[sortKey] || '';
            return (va < vb ? -1 : va > vb ? 1 : 0) * (sortAsc ? 1 : -1);
        });
    }

    const tbody = document.querySelector('#testTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    data.forEach(tc => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${tc.name}</td>
            <td>${tc.desc}</td>
            <td>${tc.steps}</td>
            <td>${tc.expected}</td>
            <td>${tc.status}</td>
            <td>${tc.notes}</td>
            <td>${tc.priority}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="editTestCase('${tc.id}')">Edytuj</button>
                <button class="btn btn-sm btn-danger" onclick="deleteTestCase('${tc.id}')">Usuń</button>
            </td>
        `;
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
    document.getElementById('barPass').style.width = (pass / total * 100) + '%';
    document.getElementById('barFail').style.width = (fail / total * 100) + '%';
    document.getElementById('barUnknown').style.width = (unknown / total * 100) + '%';
}

function updateCharts() {
    const { pass, fail, unknown } = countStats();
    const ctx = document.getElementById('statusChart');
    if (!ctx) return;

    if (!statusChart) {
        statusChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Pass', 'Fail', 'Brak'],
                datasets: [{
                    data: [pass, fail, unknown],
                    backgroundColor: ['#4caf50', '#f44336', '#9e9e9e']
                }]
            }
        });
    } else {
        statusChart.data.datasets[0].data = [pass, fail, unknown];
        statusChart.update();
    }
}

// ------------------- Import / Export -------------------
function exportToCSV() {
    let csv = "Nazwa,Opis,Kroki,Oczekiwany,Status,Uwagi,Priorytet\n";
    testCases.forEach(tc => {
        csv += `"${tc.name.replace(/"/g,'""')}","${tc.desc.replace(/"/g,'""')}","${tc.steps.replace(/"/g,'""')}","${tc.expected.replace(/"/g,'""')}","${tc.status}","${tc.notes}","${tc.priority}"\n`;
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
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.autoTable({
        head: [['Nazwa', 'Opis', 'Kroki', 'Oczekiwany', 'Status', 'Uwagi', 'Priorytet']],
        body: testCases.map(tc => [tc.name, tc.desc, tc.steps, tc.expected, tc.status, tc.notes, tc.priority]),
        styles: { cellPadding: 2, fontSize: 10 }
    });
    doc.save('testcases.pdf');
}

// ------------------- Inicjalizacja -------------------
document.addEventListener('DOMContentLoaded', () => {
    if (testForm) testForm.addEventListener('submit', e => { e.preventDefault(); saveTestCase(); });
    if (statusFilter) statusFilter.addEventListener('change', renderTable);
    if (priorityFilter) priorityFilter.addEventListener('change', renderTable);
    if (searchQuery) searchQuery.addEventListener('input', renderTable);
});
