// ------------------- Inicjalizacja Firebase -------------------
const auth = firebase.auth();
const db = firebase.firestore();
let currentUser = null;
let testCases = [];

function showToast(message, type = 'success', duration = 3000) {
    let toastRoot = document.getElementById('toastRoot');
    if (!toastRoot) {
        toastRoot = document.createElement('div');
        toastRoot.id = 'toastRoot';
        document.body.appendChild(toastRoot);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
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

    // przycisk zamykania
    toast.querySelector('.btn-close').addEventListener('click', () => hideToast(toast));

    // animacja wjazdu
    requestAnimationFrame(() => { toast.classList.add('show'); });

    // po duration toast zaczyna wyjeżdżać
    setTimeout(() => hideToast(toast), duration);

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
                ctx.drawImage(img, (img.width-size)/2, (img.height-size)/2, size, size, 0,0,64,64);
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
}

function resetForm() {
    document.getElementById('testForm').reset();
    document.getElementById('editIndex').value = '';
}

function deleteTestCase(i) {
    if (!confirm('Usunąć ten test?')) return;
    testCases.splice(i,1);
    localStorage.setItem('testCases', JSON.stringify(testCases));
    renderTable();
    showToast('Test usunięty!', 'warning');
}

function deleteAllTestCases() {
    if (!confirm('Usunąć wszystkie testy?')) return;
    testCases = [];
    localStorage.setItem('testCases', JSON.stringify(testCases));
    renderTable();
    showToast('Wszystkie testy usunięte!', 'warning');
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
    tbody.innerHTML = '';
    const statusFilter = document.getElementById('statusFilter')?.value || 'all';
    const priorityFilter = document.getElementById('priorityFilter')?.value || 'all';
    const searchQuery = document.getElementById('searchQuery')?.value.toLowerCase() || '';

    testCases.forEach((t,i)=>{
        if ((statusFilter !== 'all' && t.status !== statusFilter) ||
            (priorityFilter !== 'all' && t.priority !== priorityFilter)) return;
        if (!t.title.toLowerCase().includes(searchQuery)) return;

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

// ------------------- Import / Export CSV / PDF -------------------
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
        showToast('CSV zaimportowane!', 'success');
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
    showToast('CSV wyeksportowane!', 'success');
}

function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text('Test Cases', 10, 10);
    doc.autoTable({ head: [['Tytuł','Opis','Kroki','Oczekiwany','Status','Uwagi','Priorytet']],
                    body: testCases.map(t=>[t.title,t.desc,t.steps,t.expected,t.status,t.notes,t.priority]) });
    doc.save('testCases.pdf');
    showToast('PDF wyeksportowane!', 'success');
}

// ------------------- Init -------------------
document.addEventListener('DOMContentLoaded',()=>{
    document.getElementById('testForm')?.addEventListener('submit', e=>{ e.preventDefault(); saveTestCase(); });
    document.getElementById('statusFilter')?.addEventListener('change', renderTable);
    document.getElementById('priorityFilter')?.addEventListener('change', renderTable);
    document.getElementById('searchQuery')?.addEventListener('input', renderTable);
    document.getElementById('importCSVBtn')?.addEventListener('click', importFromCSV);
});
