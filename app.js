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
const logoutBtn = document.getElementById("logoutBtn");

// ------------------- Ochrona strony i logowanie -------------------
auth.onAuthStateChanged(user => {
    if (!user) {
        window.location.href = "index.html";
    } else {
        currentUser = user;
        loadTestCases();
    }
});

if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        auth.signOut().then(() => window.location.href = "index.html");
    });
}

// ------------------- CRUD: wczytywanie -------------------
function loadTestCases() {
    if (!currentUser) return;
    db.collection('users')
      .doc(currentUser.uid)
      .collection('testCases')
      .orderBy('timestamp', 'desc')
      .get()
      .then(snapshot => {
          testCases = snapshot.docs.map(doc => doc.data());
          renderTable();
          snapshotTrend();
      })
      .catch(err => console.error(err));
}

// ------------------- CRUD: dodawanie/edycja -------------------
function saveTestCase() {
    if (!currentUser) return;

    const id = document.getElementById("testId").value;
    const name = document.getElementById("testName").value;
    const desc = document.getElementById("testDesc").value;
    const steps = document.getElementById("testSteps").value;
    const expected = document.getElementById("expectedResult").value;
    const status = document.getElementById("testStatus").value;
    const notes = document.getElementById("testNotes").value;
    const priority = document.getElementById("testPriority").value;
    const editIndex = document.getElementById("editIndex").value;

    const docRef = db.collection('users').doc(currentUser.uid).collection('testCases').doc(id);

    let history = [];
    if (editIndex !== "") {
        history = testCases[editIndex].history || [];
        history.push(`Edytowano: ${new Date().toLocaleString()}`);
    } else {
        history.push(`Utworzono: ${new Date().toLocaleString()}`);
    }

    docRef.set({ id, name, desc, steps, expected, status, notes, priority, history, timestamp: firebase.firestore.FieldValue.serverTimestamp() })
        .then(() => {
            resetForm();
            loadTestCases();
        })
        .catch(err => console.error(err));
}

// ------------------- Reset formularza -------------------
function resetForm() {
    if (!testForm) return;
    testForm.reset();
    document.getElementById('editIndex').value = '';
}

// ------------------- CRUD: edycja i usuwanie -------------------
function editTestCase(idx) {
    const tc = testCases[idx];
    document.getElementById("editIndex").value = idx;
    document.getElementById("testId").value = tc.id;
    document.getElementById("testName").value = tc.name;
    document.getElementById("testDesc").value = tc.desc;
    document.getElementById("testSteps").value = tc.steps;
    document.getElementById("expectedResult").value = tc.expected;
    document.getElementById("testStatus").value = tc.status;
    document.getElementById("testNotes").value = tc.notes;
    document.getElementById("testPriority").value = tc.priority;
}

function deleteTestCase(idx) {
    if (!currentUser || !confirm('Na pewno usunąć ten test?')) return;

    const id = testCases[idx].id;
    db.collection('users').doc(currentUser.uid).collection('testCases').doc(id)
      .delete()
      .then(() => loadTestCases())
      .catch(err => console.error(err));
}

function deleteAllTestCases() {
    if (!currentUser || !confirm('Na pewno usunąć wszystkie testy?')) return;

    db.collection('users').doc(currentUser.uid).collection('testCases')
      .get()
      .then(snapshot => {
          const batch = db.batch();
          snapshot.docs.forEach(doc => batch.delete(doc.ref));
          return batch.commit();
      })
      .then(() => loadTestCases())
      .catch(err => console.error(err));
}

// ------------------- Priorytet Krytyczny -------------------
function setCritical(idx) {
    if (!currentUser) return;

    const tc = testCases[idx];
    tc.priority = 'Krytyczny';
    tc.history.push(`Ustawiono priorytet Krytyczny: ${new Date().toLocaleString()}`);

    db.collection('users').doc(currentUser.uid).collection('testCases').doc(tc.id)
      .set(tc)
      .then(() => loadTestCases())
      .catch(err => console.error(err));
}

// ------------------- Historia zmian -------------------
function showHistory(idx) {
    const tc = testCases[idx];
    document.getElementById('historyContent').textContent = tc.history.join('\n');
    new bootstrap.Modal(document.getElementById('historyModal')).show();
}

// ------------------- Filtry i sortowanie -------------------
function applyFilters(data) {
    const status = document.getElementById('statusFilter')?.value || 'all';
    const priority = document.getElementById('priorityFilter')?.value || 'all';
    const query = document.getElementById('searchQuery')?.value.toLowerCase() || '';

    return data.filter(tc => {
        if (status !== 'all' && tc.status !== status) return false;
        if (priority !== 'all' && tc.priority !== priority) return false;
        if (query && ![tc.id, tc.name, tc.desc].some(f => f.toLowerCase().includes(query))) return false;
        return true;
    });
}

function sortBy(key) {
    if (sortKey === key) sortAsc = !sortAsc;
    else { sortKey = key; sortAsc = true; }
    renderTable();
}

function clearFilters() {
    if (document.getElementById('statusFilter')) document.getElementById('statusFilter').value = 'all';
    if (document.getElementById('priorityFilter')) document.getElementById('priorityFilter').value = 'all';
    if (document.getElementById('searchQuery')) document.getElementById('searchQuery').value = '';
    renderTable();
}

// ------------------- Renderowanie tabeli -------------------
function formatList(text) {
    if (!text) return '';
    const lines = text.split('\n').filter(l => l.trim());
    return '<ol><li>' + lines.join('</li><li>') + '</li></ol>';
}

function renderTable() {
    const tbody = document.querySelector('#testTable tbody');
    if (!tbody) return;

    let data = applyFilters(testCases);
    if (sortKey) {
        data.sort((a, b) => {
            const va = a[sortKey] || '';
            const vb = b[sortKey] || '';
            if (va < vb) return sortAsc ? -1 : 1;
            if (va > vb) return sortAsc ? 1 : -1;
            return 0;
        });
    }

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
              ${tc.status === 'Pass' ? '<span class="badge bg-success">Pass</span>' : ''}
              ${tc.status === 'Fail' ? '<span class="badge bg-danger">Fail</span>' : ''}
              ${!tc.status ? '<span class="badge bg-secondary">Brak</span>' : ''}
            </td>
            <td>${tc.notes}</td>
            <td>${tc.priority || ''}</td>
            <td class="nowrap">
              <button class="btn btn-sm btn-primary" onclick="editTestCase(${idx})"><i class="bi bi-pencil"></i></button>
              <button class="btn btn-sm btn-danger" onclick="deleteTestCase(${idx})"><i class="bi bi-trash"></i></button>
              <button class="btn btn-sm btn-warning" onclick="setCritical(${idx})"><i class="bi bi-exclamation-triangle"></i></button>
              <button class="btn btn-sm btn-info" onclick="showHistory(${idx})"><i class="bi bi-clock-history"></i></button>
            </td>`;
        tbody.appendChild(tr);
    });

    updateStats();
    updateCharts();
}

// ------------------- Statystyki i wykresy -------------------
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

    if (document.getElementById('statsSummary')) {
        document.getElementById('statsSummary').textContent = `Pass: ${pass}, Fail: ${fail}, Brak statusu: ${unknown}`;
    }
    if (document.getElementById('statsSummaryFiltered')) {
        document.getElementById('statsSummaryFiltered').textContent = `Wyświetlane: ${applyFilters(testCases).length}`;
    }
}

let statusChart, trendChart;
function snapshotTrend() {
    trendData.push({ time: new Date().toLocaleTimeString(), total: testCases.length });
    if (trendData.length > 20) trendData.shift();
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
function importFromCSV() {
    const file = document.getElementById('csvFile')?.files[0];
    if (!file) return alert('Wybierz plik CSV');
    const reader = new FileReader();
    reader.onload = e => {
        const lines = e.target.result.split('\n').filter(l => l.trim());
        const arr = lines.slice(1).map(l => {
            const [id, name, desc, steps, expected, status, notes, priority] = l.split(',');
            return { id, name, desc, steps, expected, status, notes, priority, history: [`Zaimportowano: ${new Date().toLocaleString()}`], timestamp: firebase.firestore.FieldValue.serverTimestamp() };
        });
        const batch = db.batch();
        arr.forEach(tc => {
            const docRef = db.collection('users').doc(currentUser.uid).collection('testCases').doc(tc.id);
            batch.set(docRef, tc);
        });
        batch.commit().then(() => loadTestCases());
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

    // Nagłówki tabeli
    const head = [['ID', 'Nazwa', 'Opis', 'Kroki', 'Oczekiwany', 'Status', 'Uwagi', 'Priorytet']];

    // Body z wrapowaniem i polskimi znakami
    const body = testCases.map(tc => [
        tc.id,
        tc.name,
        tc.desc,
        tc.steps ? tc.steps.split('\n').map(line => '• ' + line).join('\n') : '',
        tc.expected ? tc.expected.split('\n').map(line => '• ' + line).join('\n') : '',
        tc.status,
        tc.notes,
        tc.priority
    ]);

    doc.setFont("times", ""); // Times obsługuje polskie znaki
    doc.setFontSize(10);

    // Dynamiczna szerokość kolumn
    const pageWidth = doc.internal.pageSize.getWidth() - 20; // margines 10 po obu stronach
    const colWidths = [15, 25, 30, 35, 35, 15, 20, 15]; // przybliżone wymiary kolumn
    const totalWidth = colWidths.reduce((a, b) => a + b, 0);
    const scale = pageWidth / totalWidth;
    const scaledColWidths = colWidths.map(w => w * scale);

    doc.autoTable({
        head: head,
        body: body,
        styles: {
            cellPadding: 2,
            font: "times",
            fontSize: 10,
            overflow: 'linebreak',
            valign: 'top' // automatyczna wysokość wiersza
        },
        headStyles: { fillColor: [41, 128, 185], halign: 'center', textColor: 255 },
        columnStyles: scaledColWidths.reduce((acc, w, i) => { acc[i] = { cellWidth: w }; return acc; }, {}),
        margin: { top: 20, left: 10, right: 10 },
    });

    doc.save('testcases.pdf');
}


// ------------------- Init -------------------
document.addEventListener('DOMContentLoaded', () => {
    if (testForm) {
        loadTestCases();
    }
});
