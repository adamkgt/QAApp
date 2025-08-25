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
        toastRoot.style.top = '1rem';
        toastRoot.style.right = '1rem';
        toastRoot.style.zIndex = 1100;
        document.body.appendChild(toastRoot);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-slide toast-${type}`;
    toast.style.minWidth = '250px';
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">${message}</div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto"></button>
        </div>
    `;
    toastRoot.appendChild(toast);

    const closeBtn = toast.querySelector('.btn-close');
    closeBtn.addEventListener('click', () => hideToast(toast));

    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => hideToast(toast), duration);

    function hideToast(el) {
        el.classList.remove('show');
        el.classList.add('hide');
        el.addEventListener('transitionend', () => el.remove(), { once: true });
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


// ------------------- Load Test Cases -------------------
function loadTestCases() {
    if (!currentUser) return;

    db.collection('TestCases')
      .where('uid', '==', currentUser.uid)
      .orderBy('timestamp', 'desc')
      .get()
      .then(snapshot => {
          testCases = snapshot.docs.map(doc => doc.data());

          // Zapisz też w localStorage dla offline
          localStorage.setItem('testCases', JSON.stringify(testCases));

          renderTable();
          updateStats();
      })
      .catch(err => {
          console.error('Błąd wczytywania testów z Firebase:', err);
          // fallback na localStorage
          const data = localStorage.getItem('testCases');
          testCases = data ? JSON.parse(data) : [];
          renderTable();
          updateStats();
      });
}


// ------------------- Save Test Case -------------------
function saveTestCase() {
    const index = document.getElementById('editIndex').value;
    const id = document.getElementById('testID').value || Date.now().toString();

    const t = {
        id: id,
        title: document.getElementById('testName').value,
        desc: document.getElementById('testDesc').value,
        steps: document.getElementById('testSteps').value,
        expected: document.getElementById('expectedResult').value,
        status: document.getElementById('testStatus').value,
        notes: document.getElementById('testNotes').value,
        priority: document.getElementById('testPriority').value,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if(index) {
        // Edycja istniejącego test case
        const old = testCases[index];
        const changes = [];
        for(const key of ['title','desc','steps','expected','status','notes','priority']) {
            if(old[key] !== t[key]) changes.push(key);
        }
        t.history = old.history || [];
        if(changes.length > 0) {
            t.history.push({ date: new Date(), changes });
        }
        t.createdAt = old.createdAt || firebase.firestore.FieldValue.serverTimestamp();
        testCases[index] = t;
    } else {
        // Nowy test case
        t.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        t.history = [];
        testCases.push(t);
    }

    // Zapis lokalny
    localStorage.setItem('testCases', JSON.stringify(testCases));

    // Zapis do Firebase
    db.collection('TestCases').doc(t.id).set(t)
      .then(() => showToast('Test zapisany w Firebase!', 'success'))
      .catch(err => showToast('Błąd Firebase: ' + err.message, 'danger'));

    resetForm();
    renderTable();
    updateStats();
}

function resetForm() {
    document.getElementById('testForm').reset();
    document.getElementById('editIndex').value = '';
    document.getElementById('testID').value = '';
}

function clearFilters() {
    document.getElementById('statusFilter').value = 'all';
    document.getElementById('priorityFilter').value = 'all';
    document.getElementById('searchQuery').value = '';
    renderTable();
}

function deleteTestCase(i) {
    if (!confirm('Usunąć ten test?')) return;

    const t = testCases[i];
    db.collection('TestCases').doc(t.id).delete().catch(err => console.error(err));
    testCases.splice(i,1);
    localStorage.setItem('testCases', JSON.stringify(testCases));
    renderTable();
    showToast('Test usunięty!', 'warning');
    updateStats();
}

function deleteAllTestCases() {
    if (!confirm('Usunąć wszystkie testy?')) return;
    testCases.forEach(t => db.collection('TestCases').doc(t.id).delete().catch(err=>console.error(err)));
    testCases = [];
    localStorage.setItem('testCases', JSON.stringify(testCases));
    renderTable();
    showToast('Wszystkie testy usunięte!', 'warning');
    updateStats();
}

function editTestCase(i) {
    const t = testCases[i];
    document.getElementById('testID').value = t.id;
    document.getElementById('testName').value = t.title;
    document.getElementById('testDesc').value = t.desc;
    document.getElementById('testSteps').value = t.steps;
    document.getElementById('expectedResult').value = t.expected;
    document.getElementById('testStatus').value = t.status;
    document.getElementById('testNotes').value = t.notes;
    document.getElementById('testPriority').value = t.priority;
    document.getElementById('editIndex').value = i;
}

// ------------------- Render tabeli -------------------
function renderTable() {
    const tbody = document.querySelector('#testTable tbody');
    if(!tbody) return;
    tbody.innerHTML = '';

    const statusFilter = document.getElementById('statusFilter')?.value || 'all';
    const priorityFilter = document.getElementById('priorityFilter')?.value || 'all';
    const searchQuery = document.getElementById('searchQuery')?.value.toLowerCase() || '';

    testCases.forEach((t, i) => {
        if(statusFilter !== 'all' && ((t.status || 'unknown') !== statusFilter)) return;
        if(priorityFilter !== 'all' && (t.priority || '') !== priorityFilter) return;
        if(searchQuery && ![t.title, t.desc, t.steps, t.expected, t.notes].some(s=>s.toLowerCase().includes(searchQuery))) return;

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><input type="checkbox" class="selectTest" data-index="${i}" /></td>
          <td>${t.id || ''}</td>
          <td>${t.title}</td>
          <td>${t.desc}</td>
          <td>${t.steps}</td>
          <td>${t.expected}</td>
          <td><span class="${t.status==='Pass'?'pass-badge':t.status==='Fail'?'fail-badge':'unknown-badge'}">${t.status||'Brak'}</span></td>
          <td>${t.notes}</td>
          <td>${t.priority}</td>
          <td>
            <button class="btn btn-sm btn-primary" onclick="editTestCase(${i})">Edytuj</button>
            <button class="btn btn-sm btn-info" onclick="showHistory(${i})">
              <i class="bi bi-clock-history"></i>
            </button>
          </td>
        `;
        tbody.appendChild(tr);
    });
}

// ------------------- Historia test case -------------------
function showHistory(index) {
    const t = testCases[index];
    if(!t || !t.history || t.history.length === 0) {
        return showToast('Brak historii zmian dla tego testu', 'info');
    }

    let msg = '<ul>';
    t.history.forEach(h => {
        const date = new Date(h.date).toLocaleString();
        msg += `<li>${date}: zmieniono pola [${h.changes.join(', ')}]</li>`;
    });
    msg += '</ul>';

    // Można użyć toast lub modal - tu prosty toast z HTML
    const toastRoot = document.getElementById('toastRoot');
    const toast = document.createElement('div');
    toast.className = 'toast toast-slide toast-info';
    toast.style.minWidth = '300px';
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">${msg}</div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto"></button>
        </div>
    `;
    toastRoot.appendChild(toast);

    const closeBtn = toast.querySelector('.btn-close');
    closeBtn.addEventListener('click', () => toast.remove());

    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => toast.remove(), 7000);
}

function deleteSelectedTestCases() {
    const selectedIndexes = Array.from(document.querySelectorAll('.selectTest:checked'))
                                .map(cb => parseInt(cb.dataset.index))
                                .sort((a,b) => b-a);

    if(selectedIndexes.length === 0) return showToast('Nie zaznaczono testów!', 'warning');
    if(!confirm(`Usunąć ${selectedIndexes.length} zaznaczone testy?`)) return;

    selectedIndexes.forEach(i => {
        const t = testCases[i];
        db.collection('TestCases').doc(t.id).delete().catch(err => console.error(err));
        testCases.splice(i,1);
    });

    localStorage.setItem('testCases', JSON.stringify(testCases));
    renderTable();
    updateStats();
    showToast(`${selectedIndexes.length} test(y) usunięty(e)!`, 'warning');
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

// ------------------- Import / Export CSV / PDF -------------------
function clearCSVFile() {
    const fileInput = document.getElementById('csvFile');
    if (!fileInput) return;
    fileInput.value = '';
    showToast('Pole pliku zostało wyczyszczone.', 'warning');
}

function importFromCSV() {
    const fileInput = document.getElementById('csvFile');
    const file = fileInput.files[0];
    if (!file) {
        showToast('Wybierz plik CSV do importu.', 'warning');
        return;
    }
    if (!file.name.toLowerCase().endsWith('.csv')) {
        showToast('Nieprawidłowy typ pliku. Wybierz plik CSV.', 'danger');
        fileInput.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = e => {
        const lines = e.target.result.split('\n');
        let addedCount = 0;
        lines.forEach(line => {
            const [title, desc, steps, expected, status, notes, priority] = line.split(',');
            if(title){
                const t = { id: Date.now().toString(), uid: currentUser.uid, title, desc, steps, expected, status, notes, priority };
                testCases.push(t);
                db.collection('TestCases').doc(t.id).set(t).catch(err => console.error(err));
                addedCount++;
            }
        });
        if (addedCount>0){
            localStorage.setItem('testCases', JSON.stringify(testCases));
            renderTable();
            importCount++;
            showToast(`Zaimportowano ${addedCount} testów z CSV.`, 'success');
            updateStats();
        } else showToast('Plik CSV jest pusty lub niepoprawny.', 'warning');
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
document.addEventListener('DOMContentLoaded', ()=>{
    document.getElementById('testForm')?.addEventListener('submit', e=>{ e.preventDefault(); saveTestCase(); });
    document.getElementById('statusFilter')?.addEventListener('change', renderTable);
    document.getElementById('priorityFilter')?.addEventListener('change', renderTable);
    document.getElementById('searchQuery')?.addEventListener('input', renderTable);
    document.getElementById('importCSVBtn')?.addEventListener('click', importFromCSV);
    document.getElementById('clearCSVFile')?.addEventListener('click', clearCSVFile);

    document.getElementById('selectAll')?.addEventListener('change', function() {
        const checked = this.checked;
        document.querySelectorAll('.selectTest').forEach(cb => cb.checked = checked);
    });
});
