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

// ------------------- Toasty -------------------
function showToast(message, type = 'success') {
    const toastEl = document.getElementById('appToast');
    const toastMessage = document.getElementById('toastMessage');
    toastMessage.textContent = message;

    toastEl.className = `toast align-items-center text-bg-${type} border-0`;
    const toast = new bootstrap.Toast(toastEl);
    toast.show();
}

// ------------------- Funkcja użytkownika -------------------
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

    const savedEmail = localStorage.getItem('userEmail');
    const savedAvatar = localStorage.getItem('userAvatar');

    if (savedEmail) userPanelEmail.textContent = savedEmail;
    if (savedAvatar) userAvatar.src = savedAvatar;

    db.collection('Users').doc(currentUser.uid).get()
        .then(doc => {
            if (doc.exists) {
                const data = doc.data();
                if (data.avatar) { userAvatar.src = data.avatar; localStorage.setItem('userAvatar', data.avatar); }
                if (currentUser.email) { userPanelEmail.textContent = currentUser.email; localStorage.setItem('userEmail', currentUser.email); }
            } else {
                userAvatar.src = 'img/default-avatar.png';
                userPanelEmail.textContent = currentUser.email || '';
                db.collection('Users').doc(currentUser.uid).set({ avatar: 'img/default-avatar.png' });
                localStorage.setItem('userAvatar', 'img/default-avatar.png');
                localStorage.setItem('userEmail', currentUser.email || '');
            }
        })
        .catch(err => {
            console.error('Błąd pobierania awatara:', err);
            userAvatar.src = 'img/default-avatar.png';
            userPanelEmail.textContent = currentUser.email || '';
        })
        .finally(() => {
            userAvatar.style.opacity = 1;
            userPanelEmail.style.opacity = 1;
        });

    // Zmiana hasła
    const editBtn = document.getElementById('editProfileBtn');
    if (editBtn) {
        editBtn.addEventListener('click', () => {
            const newPassword = prompt('Podaj nowe hasło:');
            if (newPassword) {
                currentUser.updatePassword(newPassword)
                    .then(() => showToast('Hasło zmienione!', 'success'))
                    .catch(err => showToast('Błąd: ' + err.message, 'danger'));
            }
        });
    }

    // Wylogowanie
    const logoutBtn = document.getElementById('logoutBtnPanel');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            auth.signOut().then(() => {
                localStorage.removeItem('userEmail');
                localStorage.removeItem('userAvatar');
                window.location.href = 'index.html';
            });
        });
    }

    // Zmiana awatara
    let selectedFile = null;
    if (changeAvatarBtn) {
        changeAvatarBtn.addEventListener('click', () => {
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
    }

    if (cancelAvatarBtn) {
        cancelAvatarBtn.addEventListener('click', () => {
            avatarPreviewContainer.classList.add('d-none');
            avatarPreview.src = '';
            selectedFile = null;
        });
    }

    if (saveAvatarBtn) {
        saveAvatarBtn.addEventListener('click', () => {
            if (!selectedFile) return;
            const reader = new FileReader();
            reader.onload = e => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = 64;
                    canvas.height = 64;
                    const ctx = canvas.getContext('2d');
                    const size = Math.min(img.width, img.height);
                    ctx.drawImage(img, (img.width - size) / 2, (img.height - size) / 2, size, size, 0, 0, 64, 64);

                    const dataURL = canvas.toDataURL('image/png');
                    userAvatar.src = dataURL;
                    avatarPreviewContainer.classList.add('d-none');
                    selectedFile = null;

                    db.collection('Users').doc(currentUser.uid).set({ avatar: dataURL }, { merge: true });
                    localStorage.setItem('userAvatar', dataURL);

                    showToast('Awatar został zmieniony!', 'success');
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(selectedFile);
        });
    }
}

// ------------------- Ochrona strony i ładowanie danych -------------------
auth.onAuthStateChanged(user => {
    if (!user) window.location.href = "index.html";
    else {
        currentUser = user;
        renderUserPanel();
        loadTestCases();
    }
});

// ------------------- CRUD -------------------
function loadTestCases() {
    db.collection('Users').doc(currentUser.uid).collection('testCases')
      .onSnapshot(snapshot => {
          testCases = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          renderTable();
      }, err => console.error(err));
}

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
        testCasesRef.doc(data.name).set(data)
            .then(() => { resetForm(); showToast('Test dodany!', 'success'); })
            .catch(err => showToast('Błąd zapisu: ' + err.message, 'danger'));
    } else {
        testCasesRef.doc(index).update(data)
            .then(() => { resetForm(); showToast('Test edytowany!', 'success'); })
            .catch(err => showToast('Błąd zapisu: ' + err.message, 'danger'));
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
    db.collection('Users').doc(currentUser.uid).collection('testCases').doc(id).delete()
        .then(() => showToast('Test został usunięty!', 'success'))
        .catch(err => showToast('Błąd: ' + err.message, 'danger'));
}

function deleteAllTestCases() {
    if (!confirm('Na pewno usunąć wszystkie testy?')) return;
    const testCasesRef = db.collection('Users').doc(currentUser.uid).collection('testCases');
    const batch = db.batch();
    testCases.forEach(tc => batch.delete(testCasesRef.doc(tc.id)));
    batch.commit()
        .then(() => showToast('Wszystkie testy zostały usunięte!', 'success'))
        .catch(err => showToast('Błąd: ' + err.message, 'danger'));
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

// ------------------- Renderowanie tabeli i statystyk -------------------
let statusChart;
function renderTable() {
    let data = applyFilters([...testCases]);
    if (sortKey) data.sort((a,b) => (a[sortKey]||'').localeCompare(b[sortKey]||'') * (sortAsc ? 1 : -1));

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
    testCases.forEach(tc => { if(tc.status==='Pass') pass++; else if(tc.status==='Fail') fail++; else unknown++; });
    return { pass, fail, unknown };
}

function updateStats() {
    const { pass, fail, unknown } = countStats();
    const total = testCases.length || 1;
    document.getElementById('barPass').style.width = (pass/total*100)+'%';
    document.getElementById('barFail').style.width = (fail/total*100)+'%';
    document.getElementById('barUnknown').style.width = (unknown/total*100)+'%';
}

function updateCharts() {
    const { pass, fail, unknown } = countStats();
    if (!statusChart && document.getElementById('statusChart')) {
        statusChart = new Chart(document.getElementById('statusChart'), {
            type: 'doughnut',
            data: { labels: ['Pass','Fail','Brak'], datasets:[{data:[pass,fail,unknown], backgroundColor:['#4caf50','#f44336','#9e9e9e']}]}
        });
    } else if (statusChart) {
        statusChart.data.datasets[0].data = [pass,fail,unknown];
        statusChart.update();
    }
}

// ------------------- Import / Export -------------------
function importFromCSV() {
    const file = document.getElementById('csvFile').files[0];
    if(!file) { showToast('Wybierz plik CSV!', 'warning'); return; }
    const reader = new FileReader();
    reader.onload = function(e){
        const lines = e.target.result.split('\n').filter(l=>l.trim()!=='');
        lines.shift();
        lines.forEach(line=>{
            const [name, desc, steps, expected, status, notes, priority] = line.split(',');
            if(!name) return;
            const data = {name:name.replace(/"/g,'').trim(), desc:desc.replace(/"/g,'').trim(), steps:steps.replace(/"/g,'').trim(), expected:expected.replace(/"/g,'').trim(), status:status.replace(/"/g,'').trim(), notes:notes.replace(/"/g,'').trim(), priority:priority.replace(/"/g,'').trim(), history:[`Import: ${new Date().toLocaleString()}`]};
            db.collection('Users').doc(currentUser.uid).collection('testCases').doc(data.name).set(data).catch(err=>console.error(err));
        });
        loadTestCases();
        showToast('Import zakończony!', 'success');
    };
    reader.readAsText(file);
}

function exportToCSV() {
    if(testCases.length===0){ showToast('Brak testów do eksportu!', 'warning'); return; }
    let csv="Nazwa,Opis,Kroki,Oczekiwany,Status,Uwagi,Priorytet\n";
    testCases.forEach(tc=>{
        csv+=`"${tc.name.replace(/"/g,'""')}","${tc.desc.replace(/"/g,'""')}","${tc.steps.replace(/"/g,'""')}","${tc.expected.replace(/"/g,'""')}","${tc.status}","${tc.notes}","${tc.priority}"\n`;
    });
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href=url;
    a.download='testcases.csv';
    a.click();
    showToast('Eksport CSV zakończony!', 'success');
}

function exportToPDF() {
    if(testCases.length===0){ showToast('Brak testów do eksportu!', 'warning'); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFont("helvetica","normal");
    doc.setFontSize(10);
    doc.autoTable({
        head:[['Nazwa','Opis','Kroki','Oczekiwany','Status','Uwagi','Priorytet']],
        body:testCases.map(tc=>[tc.name,tc.desc,tc.steps,tc.expected,tc.status,tc.notes,tc.priority]),
        styles:{cellPadding:2,fontSize:10}
    });
    doc.save('testcases.pdf');
    showToast('Eksport PDF zakończony!', 'success');
}

// ------------------- Init -------------------
document.addEventListener('DOMContentLoaded', ()=>{
    if(testForm) testForm.addEventListener('submit', e=>{ e.preventDefault(); saveTestCase(); });
    if(statusFilter && priorityFilter && searchQuery){
        statusFilter.addEventListener('change', renderTable);
        priorityFilter.addEventListener('change', renderTable);
        searchQuery.addEventListener('input', renderTable);
    }

    const csvFileInput = document.getElementById('csvFile');
    const importBtn = document.getElementById('importCSVBtn');
    if(importBtn && csvFileInput){
        importBtn.addEventListener('click', ()=>{
            importFromCSV();
        });
    }
});
