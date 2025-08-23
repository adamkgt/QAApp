// ------------------- Inicjalizacja Firebase -------------------
const auth = firebase.auth();
const db = firebase.firestore();
let currentUser = null;
let testCases = [];
let sortKey = '';
let sortAsc = true;

// ------------------- Elementy DOM -------------------
const testForm = document.getElementById("testForm");
const statusFilter = document.getElementById("statusFilter");
const priorityFilter = document.getElementById("priorityFilter");
const searchQuery = document.getElementById("searchQuery");

// ------------------- Funkcje użytkownika -------------------
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
    } else {
        currentUser = user;
        renderUserPanel();
        loadTestCases();
    }
});

function loadTestCases() {
    db.collection('Users').doc(currentUser.uid).collection('testCases')
      .onSnapshot(snapshot => {
          testCases = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          renderTable();
      }, err => console.error(err));
}

// ------------------- CRUD -------------------
function saveTestCase() {
    const index = document.getElementById('editIndex').value;
    const data = {
        name: document.getElementById('testName').value,
        desc: document.getElementById('testDesc').value,
        steps: document.getElementById('testSteps').value,
        expected: document.getElementById('expectedResult').value,
        status: document.getElementById('testStatus').value,
        notes: document.getElementById('testNotes').value,
        priority: document.getElementById('testPriority').value,
        history: [`${index === '' ? 'Utworzono' : 'Edytowano'}: ${new Date().toLocaleString()}`]
    };

    const testCasesRef = db.collection('Users').doc(currentUser.uid).collection('testCases');

    if (index === '') {
        // Tworzenie dokumentu o nazwie tytułu testu
        testCasesRef.doc(data.name).set(data)
            .then(() => resetForm())
            .catch(err => alert('Błąd zapisu: ' + err.message));
    } else {
        testCasesRef.doc(index).update(data)
            .then(() => resetForm())
            .catch(err => alert('Błąd zapisu: ' + err.message));
    }
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
    db.collection('Users').doc(currentUser.uid).collection('testCases').doc(id).delete();
}

function deleteAllTestCases() {
    if (!confirm('Na pewno usunąć wszystkie testy?')) return;
    const testCasesRef = db.collection('Users').doc(currentUser.uid).collection('testCases');
    testCases.forEach(tc => testCasesRef.doc(tc.id).delete());
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
let statusChart;

function renderTable() {
    let data = applyFilters([...testCases]);

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

    document.getElementById('barPass').style.width = (pass / total * 100) + '%';
    document.getElementById('barFail').style.width = (fail / total * 100) + '%';
    document.getElementById('barUnknown').style.width = (unknown / total * 100) + '%';
}

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
}

// ------------------- Import / Export -------------------
function importFromCSV() {
    const file = document.getElementById('csvFile').files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        const lines = text.split('\n').filter(l => l.trim() !== '');
        lines.shift(); // pomija nagłówek

        lines.forEach(line => {
            const [name, desc, steps, expected, status, notes, priority] = line.split(',');
            if (!name) return;

            const data = {
                name: name.replace(/"/g,'').trim(),
                desc: desc.replace(/"/g,'').trim(),
                steps: steps.replace(/"/g,'').trim(),
                expected: expected.replace(/"/g,'').trim(),
                status: status.replace(/"/g,'').trim(),
                notes: notes.replace(/"/g,'').trim(),
                priority: priority.replace(/"/g,'').trim(),
                history: [`Import: ${new Date().toLocaleString()}`]
            };

            db.collection('Users')
              .doc(currentUser.uid)
              .collection('testCases')
              .doc(data.name)
              .set(data)
              .catch(err => console.error('Błąd importu:', err));
        });

        loadTestCases();
        alert('Import zakończony!');
    };

    reader.readAsText(file);
}




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
        body: testCases.map(tc => [
            tc.name, tc.desc, tc.steps, tc.expected, tc.status, tc.notes, tc.priority
        ]),
        styles: { cellPadding: 2, fontSize: 10 }
    });
    doc.save('testcases.pdf');
}

// ------------------- Init -------------------
document.addEventListener('DOMContentLoaded', () => {
    // Formularz zapisu testów
    if (testForm) {
        testForm.addEventListener('submit', e => {
            e.preventDefault();
            saveTestCase();
        });
    }

    // Filtry
    if (statusFilter && priorityFilter && searchQuery) {
        statusFilter.addEventListener('change', renderTable);
        priorityFilter.addEventListener('change', renderTable);
        searchQuery.addEventListener('input', renderTable);
    }

    // Import CSV
    const csvInput = document.getElementById('csvFile');
    if (csvInput) {
        csvInput.addEventListener('change', importFromCSV);
    }
});

