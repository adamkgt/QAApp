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
        loadUserTestCases();  // <- tylko przypadki aktualnego użytkownika
        renderUserPanel();    // Panel użytkownika
    }
});

// ------------------- Wylogowanie -------------------
function setupLogout() {
    const btn = document.getElementById("logoutBtn");
    if (btn) {
        btn.addEventListener("click", () => {
            auth.signOut().then(() => window.location.href = "index.html");
        });
    }
}
setupLogout();

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

// ------------------- Reset form -------------------
function resetForm() {
    if (!testForm) return;
    testForm.reset();
    document.getElementById('editIndex').value = '';
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

let statusChart, trendChart;

function renderTable() {
    const tbody = document.querySelector('#testTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const data = applyFilters(testCases);
    if (sortKey) {
        data.sort((a,b) => {
            const va = a[sortKey] || '', vb = b[sortKey] || '';
            if (va < vb) return sortAsc ? -1 : 1;
            if (va > vb) return sortAsc ? 1 : -1;
            return 0;
        });
    }

    data.forEach((tc, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${tc.id}</td>
            <td>${tc.name}</td>
            <td>${tc.desc}</td>
            <td>${formatList(tc.steps)}</td>
            <td>${formatList(tc.expected)}</td>
            <td>${tc.status || ''}</td>
            <td>${tc.notes}</td>
            <td>${tc.priority || ''}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="editTestCase(${idx})">Edytuj</button>
                <button class="btn btn-sm btn-danger" onclick="deleteTestCase(${idx})">Usuń</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    updateStats();
    updateCharts();
}

function formatList(text) {
    if (!text) return '';
    const lines = text.split('\n').filter(l => l.trim());
    return '<ol><li>' + lines.join('</li><li>') + '</li></ol>';
}

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

function updateStats() {
    const { pass, fail, unknown } = countStats();
    const total = testCases.length || 1;
    document.getElementById('barPass').style.width = (pass/total*100)+'%';
    document.getElementById('barFail').style.width = (fail/total*100)+'%';
    document.getElementById('barUnknown').style.width = (unknown/total*100)+'%';
    document.getElementById('statsSummary').textContent = `Pass: ${pass}, Fail: ${fail}, Brak statusu: ${unknown}`;
    document.getElementById('statsSummaryFiltered').textContent = `Wyświetlane: ${applyFilters(testCases).length}`;
}

function snapshotTrend() {
    trendData.push({ time: new Date().toLocaleTimeString(), total: testCases.length });
    if (trendData.length>20) trendData.shift();
}

function updateCharts() {
    const { pass, fail, unknown } = countStats();

    if (!statusChart && document.getElementById('statusChart')) {
        statusChart = new Chart(document.getElementById('statusChart'), {
            type: 'doughnut',
            data: { labels: ['Pass','Fail','Brak'], datasets: [{ data:[pass,fail,unknown], backgroundColor:['#4caf50','#f44336','#9e9e9e'] }] }
        });
    } else if (statusChart) {
        statusChart.data.datasets[0].data = [pass,fail,unknown];
        statusChart.update();
    }

    if (!trendChart && document.getElementById('trendChart')) {
        trendChart = new Chart(document.getElementById('trendChart'), {
            type: 'line',
            data: { labels: trendData.map(d=>d.time), datasets:[{ label:'Łączna liczba testów', data: trendData.map(d=>d.total), borderColor:'#007bff', fill:false }] },
            options: { responsive:true, maintainAspectRatio:false }
        });
    } else if (trendChart) {
        trendChart.data.labels = trendData.map(d=>d.time);
        trendChart.data.datasets[0].data = trendData.map(d=>d.total);
        trendChart.update();
    }
}

// ------------------- Import / Export CSV / PDF -------------------
function importFromCSV() {
    const file = document.getElementById('csvFile')?.files[0];
    if (!file) return alert("Wybierz plik CSV");
    const reader = new FileReader();
    reader.onload = e => {
        const lines = e.target.result.split('\n').filter(l=>l.trim());
        const arr = lines.slice(1).map(l=>{
            const [id,name,desc,steps,expected,status,notes,priority] = l.split(',');
            return { id,name,desc,steps,expected,status,notes,priority,createdAt: firebase.firestore.FieldValue.serverTimestamp() };
        });
        arr.forEach(tc => db.collection("testCases").add(tc));
    };
    reader.readAsText(file);
}

function exportToCSV() {
    let csv = "ID testu,Nazwa testu,Opis,Kroki,Oczekiwany rezultat,Status,Uwagi,Priorytet\n";
    testCases.forEach(tc => {
        const steps = `"${tc.steps.replace(/"/g,'""')}"`;
        const expected = `"${tc.expected.replace(/"/g,'""')}"`;
        csv += [tc.id,tc.name,tc.desc,steps,expected,tc.status,tc.notes,tc.priority].join(',')+'\n';
    });
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'testcases.csv';
    a.click();
}

function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFont("helvetica","normal"); // poprawa polskich znaków
    doc.autoTable({
        head: [['ID','Nazwa','Opis','Kroki','Oczekiwany','Status','Uwagi','Priorytet']],
        body: testCases.map(tc => [
            tc.id, tc.name, tc.desc, tc.steps.replace(/\n/g,'\n• '), tc.expected.replace(/\n/g,'\n• '), tc.status, tc.notes, tc.priority
        ]),
        styles: { cellPadding:2, fontSize:10 }
    });
    doc.save('testcases.pdf');
}

// ------------------- Inicjalizacja -------------------
document.addEventListener('DOMContentLoaded', () => {
    if (testForm) {
        snapshotTrend();
        renderTable();
    }
});
