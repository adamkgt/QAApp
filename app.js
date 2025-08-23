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
const userPanel = document.getElementById("userPanel");

// ------------------- Ochrona strony i pobieranie danych -------------------
auth.onAuthStateChanged(user => {
    if (!user) {
        window.location.href = "index.html";
    } else {
        currentUser = user;
        renderUserPanel();
        loadTestCases();
    }
});

// ------------------- Funkcja wczytująca testy -------------------
function loadTestCases() {
    if (!currentUser) return;

    db.collection('testCases')
      .where('owner', '==', currentUser.uid) // tylko własne testy
      //.orderBy('createdAt', 'desc') // odblokuj po utworzeniu indeksu w Firestore
      .onSnapshot(snapshot => {
          testCases = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          renderTable();
      }, err => {
          console.error("Błąd Firestore:", err);
          alert("Nie udało się pobrać testów: " + err.message);
      });
}


// ------------------- Render panelu użytkownika -------------------
function renderUserPanel() {
    if (!userPanel) return;
    userPanel.innerHTML = `
        <span class="me-2">${currentUser.email}</span>
        <button id="editProfileBtn" class="btn btn-sm btn-outline-secondary">Zmień hasło</button>
        <button id="logoutBtn" class="btn btn-sm btn-outline-danger">Wyloguj</button>
    `;

    document.getElementById("logoutBtn").addEventListener("click", () => {
        auth.signOut().then(() => window.location.href = "index.html");
    });

    document.getElementById("editProfileBtn").addEventListener("click", () => {
        const newPass = prompt("Podaj nowe hasło:");
        if (newPass) {
            currentUser.updatePassword(newPass)
                .then(() => alert("Hasło zmienione"))
                .catch(err => alert("Błąd: " + err.message));
        }
    });
}

// ------------------- Funkcje CRUD -------------------
function loadTestCases() {
    db.collection("testCases")
      .where("owner", "==", currentUser.uid)
      .onSnapshot(snapshot => {
        testCases = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderTable();
        snapshotTrend();
      }, err => console.error("Firestore error:", err));
}

function saveTestCase() {
    const index = document.getElementById('editIndex').value;
    const data = {
        title: document.getElementById('testName').value,
        description: document.getElementById('testDesc').value,
        steps: document.getElementById('testSteps').value,
        expected: document.getElementById('expectedResult').value,
        status: document.getElementById('testStatus').value,
        notes: document.getElementById('testNotes').value,
        priority: document.getElementById('testPriority').value,
        owner: currentUser.uid,
        history: firebase.firestore.FieldValue.arrayUnion(`Edytowano: ${new Date().toLocaleString()}`)
    };

    if (index === '') {
        data.history = [`Utworzono: ${new Date().toLocaleString()}`];
        db.collection("testCases").add(data);
    } else {
        const docId = testCases[index].id;
        db.collection("testCases").doc(docId).update(data);
    }
    testForm.reset();
}

// ------------------- Edycja, usuwanie, historia, priorytet -------------------
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

function deleteTestCase(idx) {
    if (!confirm('Na pewno usunąć ten test?')) return;
    const docId = testCases[idx].id;
    db.collection("testCases").doc(docId).delete();
}

function setCritical(idx) {
    const docId = testCases[idx].id;
    db.collection("testCases").doc(docId).update({
        priority: 'Krytyczny',
        history: firebase.firestore.FieldValue.arrayUnion(`Ustawiono priorytet Krytyczny: ${new Date().toLocaleString()}`)
    });
}

function showHistory(idx) {
    const tc = testCases[idx];
    alert(tc.history.join('\n'));
}

// ------------------- Filtry, sortowanie, statystyki -------------------
function sortBy(key) {
    if (sortKey === key) sortAsc = !sortAsc;
    else { sortKey = key; sortAsc = true; sortKey = key; }
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

function renderTable() {
    let data = applyFilters(testCases);

    if (sortKey) {
        data.sort((a, b) => {
            const va = a[sortKey] || '', vb = b[sortKey] || '';
            return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
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
            <td>${tc.status || ''}</td>
            <td>${tc.notes}</td>
            <td>${tc.priority || ''}</td>
            <td>
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

    document.getElementById('statsSummary').textContent = `Pass: ${pass}, Fail: ${fail}, Brak: ${unknown}`;
}

// ------------------- Wykresy -------------------
let statusChart, trendChart;
function snapshotTrend() {
    trendData.push({ time: new Date().toLocaleTimeString(), total: testCases.length });
    if (trendData.length > 20) trendData.shift();
    updateCharts();
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
            data: { labels: trendData.map(d => d.time), datasets: [{ label: 'Łączna liczba testów', data: trendData.map(d => d.total), borderColor: '#007bff', fill: false }] }
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
        lines.slice(1).forEach(line => {
            const [title, description] = line.split(',');
            db.collection("testCases").add({ title, description, owner: currentUser.uid, history: [`Zaimportowano: ${new Date().toLocaleString()}`] });
        });
    };
    reader.readAsText(file);
}

function exportToCSV() {
    let csv = "Tytuł,Opis\n";
    testCases.forEach(tc => {
        csv += `"${tc.title.replace(/"/g,'""')}","${tc.description.replace(/"/g,'""')}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'testcases.csv';
    a.click();
}

function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.autoTable({
        head: [['Tytuł', 'Opis', 'Status', 'Priorytet']],
        body: testCases.map(tc => [tc.title, tc.description, tc.status || '', tc.priority || '']),
        styles: { cellPadding: 3, font: "helvetica" }
    });
    doc.save('testcases.pdf');
}

// ------------------- Init -------------------
if (testForm) {
    testForm.addEventListener("submit", e => { e.preventDefault(); saveTestCase(); });
}
