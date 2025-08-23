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
const userPanel = document.getElementById("userPanel");
const testCasesList = document.getElementById("testCasesList");
const statusFilter = document.getElementById("statusFilter");
const priorityFilter = document.getElementById("priorityFilter");
const searchQuery = document.getElementById("searchQuery");
const passwordForm = document.getElementById("passwordForm");
const passwordMsg = document.getElementById("passwordMsg");

// ------------------- Ochrona strony i panel użytkownika -------------------
auth.onAuthStateChanged(user => {
    if (!user) {
        window.location.href = "index.html";
    } else {
        currentUser = user;
        renderUserPanel();
        loadTestCases();
    }
});

// ------------------- Panel użytkownika -------------------
function renderUserPanel() {
    if (!currentUser) return;
    userPanel.innerHTML = `
        <span>${currentUser.email}</span>
        <button id="editProfileBtn" class="btn btn-sm btn-outline-secondary">Edytuj profil</button>
        <button id="logoutBtn" class="btn btn-sm btn-outline-danger">Wyloguj</button>
    `;
    document.getElementById("logoutBtn").addEventListener("click", () => {
        auth.signOut().then(() => window.location.href = "index.html");
    });
}

// ------------------- Zmiana hasła -------------------
if (passwordForm) {
    passwordForm.addEventListener("submit", e => {
        e.preventDefault();
        const newPassword = document.getElementById("newPassword").value;
        currentUser.updatePassword(newPassword)
            .then(() => {
                passwordMsg.textContent = "Hasło zmienione pomyślnie!";
                passwordMsg.className = "text-success mt-2 text-center";
                passwordForm.reset();
            })
            .catch(err => {
                passwordMsg.textContent = "Błąd: " + err.message;
                passwordMsg.className = "text-danger mt-2 text-center";
            });
    });
}

// ------------------- CRUD lokalny -------------------
function loadTestCases() {
    testCases = JSON.parse(localStorage.getItem("testCases") || "[]");
    renderTable();
}

if (testForm) {
    testForm.addEventListener("submit", e => {
        e.preventDefault();
        saveTestCase();
    });
}

function saveTestCase() {
    const title = document.getElementById("testTitle").value.trim();
    const desc = document.getElementById("testDescription").value.trim();
    const editIndex = document.getElementById("editIndex")?.value;

    if (!title) return;

    const testCase = {
        id: Date.now(),
        title,
        desc,
        status: '',
        priority: '',
        notes: '',
        history: [`${editIndex ? 'Edytowano' : 'Utworzono'}: ${new Date().toLocaleString()}`]
    };

    if (editIndex !== '' && editIndex !== undefined) {
        testCases[editIndex] = testCase;
        document.getElementById("editIndex").value = '';
    } else {
        testCases.push(testCase);
    }

    localStorage.setItem("testCases", JSON.stringify(testCases));
    testForm.reset();
    renderTable();
}

// ------------------- Renderowanie tabeli -------------------
function renderTable() {
    if (!testCasesList) return;
    let filtered = applyFilters(testCases);

    if (sortKey) {
        filtered.sort((a, b) => {
            const va = a[sortKey] || '';
            const vb = b[sortKey] || '';
            if (va < vb) return sortAsc ? -1 : 1;
            if (va > vb) return sortAsc ? 1 : -1;
            return 0;
        });
    }

    testCasesList.innerHTML = '';
    filtered.forEach((tc, idx) => {
        const div = document.createElement("div");
        div.className = "list-group-item d-flex justify-content-between align-items-start flex-column flex-md-row";
        div.innerHTML = `
            <div class="ms-2 me-auto">
              <div class="fw-bold">${tc.title}</div>
              ${tc.desc}
            </div>
            <div class="mt-2 mt-md-0 d-flex gap-1">
              <button class="btn btn-sm btn-primary" onclick="editTestCase(${idx})">Edytuj</button>
              <button class="btn btn-sm btn-danger" onclick="deleteTestCase(${idx})">Usuń</button>
              <button class="btn btn-sm btn-warning" onclick="setCritical(${idx})">Krytyczny</button>
              <button class="btn btn-sm btn-info" onclick="showHistory(${idx})">Historia</button>
            </div>
        `;
        testCasesList.appendChild(div);
    });

    updateStats();
    updateCharts();
}

// ------------------- Filtry -------------------
function applyFilters(data) {
    const status = statusFilter?.value || 'all';
    const priority = priorityFilter?.value || 'all';
    const query = searchQuery?.value.toLowerCase() || '';

    return data.filter(tc => {
        if (status !== 'all' && tc.status !== status) return false;
        if (priority !== 'all' && tc.priority !== priority) return false;
        if (query && ![tc.title, tc.desc].some(f => f.toLowerCase().includes(query))) return false;
        return true;
    });
}

function clearFilters() {
    if (statusFilter) statusFilter.value = 'all';
    if (priorityFilter) priorityFilter.value = 'all';
    if (searchQuery) searchQuery.value = '';
    renderTable();
}

// ------------------- Funkcje CRUD -------------------
function editTestCase(idx) {
    const tc = testCases[idx];
    document.getElementById("testTitle").value = tc.title;
    document.getElementById("testDescription").value = tc.desc;
    document.getElementById("editIndex").value = idx;
}

function deleteTestCase(idx) {
    if (!confirm("Na pewno usunąć ten test?")) return;
    testCases.splice(idx, 1);
    localStorage.setItem("testCases", JSON.stringify(testCases));
    renderTable();
}

function setCritical(idx) {
    const tc = testCases[idx];
    tc.priority = 'Krytyczny';
    tc.history.push(`Ustawiono priorytet Krytyczny: ${new Date().toLocaleString()}`);
    localStorage.setItem("testCases", JSON.stringify(testCases));
    renderTable();
}

function showHistory(idx) {
    const tc = testCases[idx];
    alert(tc.history.join("\n"));
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
    if (barPass) barPass.style.width = (pass / total * 100) + '%';
    if (barFail) barFail.style.width = (fail / total * 100) + '%';
    if (barUnknown) barUnknown.style.width = (unknown / total * 100) + '%';
}

// ------------------- Wykresy -------------------
let statusChart, trendChart;
function updateCharts() {
    const { pass, fail, unknown } = countStats();
    trendData.push({ time: new Date().toLocaleTimeString(), total: testCases.length });
    if (trendData.length > 20) trendData.shift();

    // Status Chart
    if (!statusChart && document.getElementById('statusChart')) {
        statusChart = new Chart(document.getElementById('statusChart'), {
            type: 'doughnut',
            data: { labels: ['Pass','Fail','Brak'], datasets: [{ data: [pass,fail,unknown], backgroundColor: ['#4caf50','#f44336','#9e9e9e'] }] }
        });
    } else if (statusChart) {
        statusChart.data.datasets[0].data = [pass,fail,unknown];
        statusChart.update();
    }

    // Trend Chart
    if (!trendChart && document.getElementById('trendChart')) {
        trendChart = new Chart(document.getElementById('trendChart'), {
            type: 'line',
            data: { labels: trendData.map(d=>d.time), datasets:[{ label:'Łączna liczba testów', data: trendData.map(d=>d.total), borderColor:'#007bff', fill:false }]},
            options:{ responsive:true, maintainAspectRatio:false }
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
    if (!file) return alert('Wybierz plik CSV');
    const reader = new FileReader();
    reader.onload = e => {
        const lines = e.target.result.split('\n').filter(l=>l.trim());
        const arr = lines.slice(1).map(l=>{
            const [title, desc] = l.split(',');
            return { title, desc, status:'', priority:'', notes:'', history:[`Zaimportowano: ${new Date().toLocaleString()}`] };
        });
        testCases = arr;
        localStorage.setItem("testCases", JSON.stringify(testCases));
        renderTable();
    };
    reader.readAsText(file);
}

function exportToCSV() {
    let csv = "Tytuł,Opis\n";
    testCases.forEach(tc=>{
        const title = `"${tc.title.replace(/"/g,'""')}"`;
        const desc = `"${tc.desc.replace(/"/g,'""')}"`;
        csv += `${title},${desc}\n`;
    });
    const blob = new Blob([csv],{type:"text/csv;charset=utf-8;"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "testcases.csv";
    a.click();
}

function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFont("helvetica","normal"); // polskie znaki
    const body = testCases.map(tc=>[tc.title,tc.desc]);
    doc.autoTable({
        head:[["Tytuł","Opis"]],
        body,
        styles:{ font:"helvetica", fontSize:10, cellPadding:2 }
    });
    doc.save("testcases.pdf");
}
