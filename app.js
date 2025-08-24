// ------------------- Inicjalizacja Firebase -------------------
const auth = firebase.auth();
const db = firebase.firestore();
let currentUser = null;
let testCases = [];
let sortKey = '';
let sortAsc = true;

// Liczniki importów/eksportów
let importCount = 0;
let exportCount = 0;

// ------------------- Toast -------------------
function showToast(message, type = 'success', duration = 3000) {
    let toastRoot = document.getElementById('toastRoot');
    if (!toastRoot) {
        toastRoot = document.createElement('div');
        toastRoot.id = 'toastRoot';
        toastRoot.style.position = 'fixed';
        toastRoot.style.top = '0';
        toastRoot.style.right = '0';
        toastRoot.style.padding = '1rem';
        toastRoot.style.zIndex = 1100;
        document.body.appendChild(toastRoot);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-slide toast-${type}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">${message}</div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto"></button>
        </div>
    `;

    toastRoot.appendChild(toast);

    const closeBtn = toast.querySelector('.btn-close');
    closeBtn.addEventListener('click', () => hideToast(toast));

    requestAnimationFrame(() => { toast.classList.add('show'); });

    setTimeout(() => { hideToast(toast); }, duration);

    function hideToast(toastEl) {
        toastEl.classList.remove('show');
        toastEl.classList.add('hide');
        toastEl.addEventListener('transitionend', () => toastEl.remove(), { once: true });
    }
}

// ------------------- Panel użytkownika -------------------
function renderUserPanel() {
    const userPanelEmail = document.getElementById('userEmail');
    const userAvatar = document.getElementById('userAvatar');
    const changeAvatarBtn = document.getElementById('changeAvatarBtn');
    const avatarPreviewContainer = document.getElementById('avatarPreviewContainer');
    const avatarPreview = document.getElementById('avatarPreview');
    const saveAvatarBtn = document.getElementById('saveAvatarBtn');
    const cancelAvatarBtn = document.getElementById('cancelAvatarBtn');

    if (!currentUser || !userPanelEmail || !userAvatar) return;

    userAvatar.style.opacity = 0;
    userPanelEmail.style.opacity = 0;

    db.collection('Users').doc(currentUser.uid).get()
        .then(doc => {
            if (doc.exists) {
                const data = doc.data();
                if (data.avatar) userAvatar.src = data.avatar;
                if (currentUser.email) userPanelEmail.textContent = currentUser.email;
            } else {
                userAvatar.src = 'img/default-avatar.png';
                userPanelEmail.textContent = currentUser.email || '';
                db.collection('Users').doc(currentUser.uid).set({ avatar: 'img/default-avatar.png' });
            }
        })
        .finally(() => {
            userAvatar.style.opacity = 1;
            userPanelEmail.style.opacity = 1;
        });

    document.getElementById('editProfileBtn')?.addEventListener('click', () => {
        const newPassword = prompt('Podaj nowe hasło:');
        if (newPassword) {
            currentUser.updatePassword(newPassword)
                .then(() => showToast('Hasło zmienione!', 'success'))
                .catch(err => showToast('Błąd: ' + err.message, 'danger'));
        }
    });

    document.getElementById('logoutBtnPanel')?.addEventListener('click', () => {
        auth.signOut().then(() => {
            localStorage.removeItem('userEmail');
            localStorage.removeItem('userAvatar');
            window.location.href = 'index.html';
        });
    });

    let selectedFile = null;
    changeAvatarBtn?.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.click();
        input.onchange = () => {
            selectedFile = input.files[0];
            if (!selectedFile) return;
            const reader = new FileReader();
            reader.onload = e => {
                avatarPreview.src = e.target.result;
                avatarPreviewContainer.classList.remove('d-none');
            };
            reader.readAsDataURL(selectedFile);
        };
    });

    cancelAvatarBtn?.addEventListener('click', () => {
        avatarPreviewContainer.classList.add('d-none');
        avatarPreview.src = '';
        selectedFile = null;
    });

    saveAvatarBtn?.addEventListener('click', () => {
        if (!selectedFile) return;
        const reader = new FileReader();
        reader.onload = e => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = 64; canvas.height = 64;
                const ctx = canvas.getContext('2d');
                const size = Math.min(img.width, img.height);
                ctx.drawImage(img, (img.width - size)/2, (img.height - size)/2, size, size, 0, 0, 64, 64);
                const dataURL = canvas.toDataURL('image/png');
                userAvatar.src = dataURL;
                avatarPreviewContainer.classList.add('d-none');
                selectedFile = null;
                db.collection('Users').doc(currentUser.uid).set({ avatar: dataURL }, { merge: true });
                showToast('Awatar został zmieniony!', 'success');
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(selectedFile);
    });
}

// ------------------- Auth i ładowanie danych -------------------
auth.onAuthStateChanged(user => {
    if (!user) window.location.href = 'index.html';
    else {
        currentUser = user;
        renderUserPanel();
        loadTestCases();
    }
});

// ------------------- CRUD -------------------
function loadTestCases() {
    const data = localStorage.getItem('testCases');
    testCases = data ? JSON.parse(data) : [];
    renderTable();
    updateStats();
}

function saveTestCase() {
    const index = document.getElementById('editIndex').value;
    const t = {
        title: document.getElementById('testName').value,
        desc: document.getElementById('testDesc').value,
        steps: document.getElementById('testSteps').value,
        expected: document.getElementById('expectedResult').value,
        status: document.getElementById('testStatus').value,
        notes: document.getElementById('testNotes').value,
        priority: document.getElementById('testPriority').value
    };
    if (index) testCases[index] = t;
    else testCases.push(t);
    localStorage.setItem('testCases', JSON.stringify(testCases));
    resetForm();
    renderTable();
    showToast('Test zapisany!', 'success');
    updateStats();
}

function resetForm() {
    document.getElementById('testForm').reset();
    document.getElementById('editIndex').value = '';
}

function clearFilters() {
    const statusFilter = document.getElementById('statusFilter');
    const priorityFilter = document.getElementById('priorityFilter');
    const searchQuery = document.getElementById('searchQuery');

    if (statusFilter) statusFilter.value = 'all';
    if (priorityFilter) priorityFilter.value = 'all';
    if (searchQuery) searchQuery.value = '';

    renderTable();
}

function deleteTestCase(i) {
    if (!confirm('Usunąć ten test?')) return;
    testCases.splice(i,1);
    localStorage.setItem('testCases', JSON.stringify(testCases));
    renderTable();
    showToast('Test usunięty!', 'warning');
    updateStats();
}

function deleteAllTestCases() {
    if (!confirm('Usunąć wszystkie testy?')) return;
    testCases = [];
    localStorage.setItem('testCases', JSON.stringify(testCases));
    renderTable();
    showToast('Wszystkie testy usunięte!', 'warning');
    updateStats();
}

function editTestCase(i) {
    const t = testCases[i];
    document.getElementById('testName').value = t.title;
    document.getElementById('testDesc').value = t.desc;
    document.getElementById('testSteps').value = t.steps;
    document.getElementById('expectedResult').value = t.expected;
    document.getElementById('testStatus').value = t.status;
    document.getElementById('testNotes').value = t.notes;
    document.getElementById('testPriority').value = t.priority;
    document.getElementById('editIndex').value = i;
}

// ------------------- Render i Filtry -------------------
function renderTable() {
    const tbody = document.querySelector('#testTable tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    const statusFilter = document.getElementById('statusFilter')?.value || 'all';
    const priorityFilter = document.getElementById('priorityFilter')?.value || 'all';
    const searchQuery = document.getElementById('searchQuery')?.value.toLowerCase() || '';

    testCases.forEach((t,i)=>{
        if(statusFilter !== 'all' && ((t.status || 'unknown') !== statusFilter)) return;
        if(priorityFilter !== 'all' && (t.priority || '') !== priorityFilter) return;
        if(searchQuery && ![t.title, t.desc, t.steps, t.expected, t.notes].some(s=>s.toLowerCase().includes(searchQuery))) return;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${t.title}</td>
            <td>${t.desc}</td>
            <td>${t.steps}</td>
            <td>${t.expected}</td>
            <td><span class="${t.status==='Pass'?'pass-badge':t.status==='Fail'?'fail-badge':'unknown-badge'}">${t.status||'Brak'}</span></td>
            <td>${t.notes}</td>
            <td>${t.priority}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="editTestCase(${i})">Edytuj</button>
                <button class="btn btn-sm btn-danger" onclick="deleteTestCase(${i})">Usuń</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ------------------- Statystyki -------------------
let statusChartInstance = null;
function updateStats() {
    const importCountEl = document.getElementById('importCount');
    const exportCountEl = document.getElementById('exportCount');

    if(importCountEl) importCountEl.textContent = importCount.toString();
    if(exportCountEl) exportCountEl.textContent = exportCount.toString();

    const counts = {Pass:0, Fail:0, unknown:0};
    testCases.forEach(t => {
        if(t.status==='Pass') counts.Pass++;
        else if(t.status==='Fail') counts.Fail++;
        else counts.unknown++;
    });

    const ctx = document.getElementById('statusChart')?.getContext('2d');
    if(!ctx) return;

    if(statusChartInstance) statusChartInstance.destroy();
    statusChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Pass','Fail','Brak'],
            datasets: [{
                data: [counts.Pass, counts.Fail, counts.unknown],
                backgroundColor: ['#4caf50','#f44336','#9e9e9e']
            }]
        },
        options: { responsive:true, plugins:{legend:{position:'bottom'}} }
    });
}

// ------------------- Import / Export CSV -------------------
function importFromCSV() {
    const file = document.getElementById('csvFile').files[0];
    if (!file) return showToast('Wybierz plik CSV', 'warning');
    const reader = new FileReader();
    reader.onload = e => {
        const lines = e.target.result.split('\n');
        lines.forEach(line=>{
            const [title,desc,steps,expected,status,notes,priority] = line.split(',');
            if(title) testCases.push({title,desc,steps,expected,status,notes,priority});
        });
        localStorage.setItem('testCases', JSON.stringify(testCases));
        renderTable();
        importCount++;
        showToast('CSV zaimportowane!', 'success');
        updateStats();
    };
    reader.readAsText(file);
}

function exportToCSV() {
    let csv = 'Tytuł,Opis,Kroki,Oczekiwany,Status,Uwagi,Priorytet\n';
    testCases.forEach(t=>{
        csv+=`${t.title},${t.desc},${t.steps},${t.expected},${t.status},${t.notes},${t.priority}\n`;
    });
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = 'testCases.csv';
    a.click();
    exportCount++;
    showToast('CSV wyeksportowane!', 'success');
    updateStats();
}

function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text('Test Cases', 10, 10);
    doc.autoTable({ head: [['Tytuł','Opis','Kroki','Oczekiwany','Status','Uwagi','Priorytet']], body: testCases.map(t=>[t.title,t.desc,t.steps,t.expected,t.status,t.notes,t.priority]) });
    doc.save('testCases.pdf');
    exportCount++;
    showToast('PDF wyeksportowane!', 'success');
    updateStats();
}

// ------------------- Init -------------------
document.addEventListener('DOMContentLoaded',()=>{
    document.getElementById('testForm')?.addEventListener('submit', e=>{ e.preventDefault(); saveTestCase(); });
    document.getElementById('statusFilter')?.addEventListener('change', renderTable);
    document.getElementById('priorityFilter')?.addEventListener('change', renderTable);
    document.getElementById('searchQuery')?.addEventListener('input', renderTable);
    document.getElementById('importCSVBtn')?.addEventListener('click', importFromCSV);
    
});
