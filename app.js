// ------------------- Inicjalizacja Firebase -------------------
const auth = firebase.auth();
const db = firebase.firestore();
let currentUser = null;
let testCases = [];
let importCount = 0;
let exportCount = 0;
let statusChartInstance = null;

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
        loadTestCasesFromFirebase();
    }
});

// ------------------- CRUD -------------------
async function saveTestCase() {
    if (!currentUser) return showToast('Brak zalogowanego użytkownika!', 'danger');

    const t = {
        userId: currentUser.uid,
        testID: document.getElementById('testID').value || Date.now().toString(),
        title: document.getElementById('testName').value || '',
        desc: document.getElementById('testDesc').value || '',
        steps: document.getElementById('testSteps').value || '',
        expected: document.getElementById('expectedResult').value || '',
        status: document.getElementById('testStatus').value || '',
        notes: document.getElementById('testNotes').value || '',
        priority: document.getElementById('testPriority').value || '',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        await db.collection('testCases').doc(t.testID).set(t);
        showToast('Test zapisany w Firebase!', 'success');
        resetForm();
    } catch (err) {
        console.error(err);
        showToast('Błąd zapisu w Firebase: ' + err.message, 'danger');
    }
}

function resetForm() {
    document.getElementById('testForm').reset();
    document.getElementById('editIndex').value = '';
}

function editTestCase(docId) {
    db.collection('testCases').doc(docId).get().then(doc => {
        if (!doc.exists) return;
        const t = doc.data();
        document.getElementById('testID').value = t.testID;
        document.getElementById('testName').value = t.title;
        document.getElementById('testDesc').value = t.desc;
        document.getElementById('testSteps').value = t.steps;
        document.getElementById('expectedResult').value = t.expected;
        document.getElementById('testStatus').value = t.status;
        document.getElementById('testNotes').value = t.notes;
        document.getElementById('testPriority').value = t.priority;
    });
}

async function deleteTestCase(docId) {
    if (!confirm('Usunąć ten test?')) return;
    try {
        await db.collection('testCases').doc(docId).delete();
        showToast('Test usunięty!', 'warning');
    } catch (err) {
        console.error(err);
        showToast('Błąd przy usuwaniu: ' + err.message, 'danger');
    }
}

async function deleteAllTestCases() {
    if (!confirm('Usunąć wszystkie testy?')) return;
    const snapshot = await db.collection('testCases').where('userId', '==', currentUser.uid).get();
    const batch = db.batch();
    snapshot.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    showToast('Wszystkie testy usunięte!', 'warning');
}

// ------------------- Pobieranie z Firebase -------------------
function loadTestCasesFromFirebase() {
    db.collection('testCases')
      .where('userId', '==', currentUser.uid)
      .orderBy('createdAt', 'desc')
      .onSnapshot(snapshot => {
          testCases = [];
          const tbody = document.querySelector('#testTable tbody');
          tbody.innerHTML = '';
          snapshot.forEach(doc => {
              const t = doc.data();
              t.id = doc.id;
              testCases.push(t);
              const tr = document.createElement('tr');
              tr.innerHTML = `
                <td><input type="checkbox" class="selectTest" data-id="${doc.id}" /></td>
                <td>${t.testID}</td>
                <td>${t.title}</td>
                <td>${t.desc}</td>
                <td>${t.steps}</td>
                <td>${t.expected}</td>
                <td>${t.status}</td>
                <td>${t.notes}</td>
                <td>${t.priority}</td>
                <td>
                  <button class="btn btn-sm btn-warning" onclick="editTestCase('${doc.id}')">Edytuj</button>
                  <button class="btn btn-sm btn-danger" onclick="deleteTestCase('${doc.id}')">Usuń</button>
                </td>
              `;
              tbody.appendChild(tr);
          });
          updateStats();
      });
}

// ------------------- Statystyki -------------------
function updateStats() {
    const counts = { Pass:0, Fail:0, unknown:0 };
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
            datasets: [{ data:[counts.Pass, counts.Fail, counts.unknown], backgroundColor:['#4caf50','#f44336','#9e9e9e'] }]
        },
        options: { responsive:true, plugins:{legend:{position:'bottom'}} }
    });
}

// ------------------- Usuń zaznaczone -------------------
async function deleteSelectedTestCases() {
    const selected = Array.from(document.querySelectorAll('.selectTest:checked'));
    if (selected.length === 0) return showToast('Nie zaznaczono testów!', 'warning');
    if (!confirm(`Usunąć ${selected.length} zaznaczone testy?`)) return;

    const batch = db.batch();
    selected.forEach(cb => {
        const docId = cb.dataset.id;
        const docRef = db.collection('testCases').doc(docId);
        batch.delete(docRef);
    });

    try {
        await batch.commit();
        showToast(`${selected.length} test(y) usunięty(e)!`, 'warning');
    } catch (err) {
        console.error(err);
        showToast('Błąd przy usuwaniu: ' + err.message, 'danger');
    }
}

// ------------------- Import CSV -------------------
function importFromCSV() {
    const fileInput = document.getElementById('csvFile');
    const file = fileInput.files[0];
    if (!file) return showToast('Wybierz plik CSV do importu.', 'warning');
    if (!file.name.toLowerCase().endsWith('.csv')) {
        fileInput.value = '';
        return showToast('Nieprawidłowy typ pliku. Wybierz plik CSV.', 'danger');
    }

    const reader = new FileReader();
    reader.onload = async e => {
        const lines = e.target.result.split('\n');
        let addedCount = 0;
        const batch = db.batch();

        lines.forEach(line => {
            const [title, desc, steps, expected, status, notes, priority] = line.split(',');
            if (!title) return;
            const testID = Date.now().toString() + Math.floor(Math.random()*1000);
            const docRef = db.collection('testCases').doc(testID);
            batch.set(docRef, {
                userId: currentUser.uid,
                testID,
                title, desc, steps, expected, status, notes, priority,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            addedCount++;
        });

        try {
            await batch.commit();
            showToast(`Zaimportowano ${addedCount} testów do Firebase.`, 'success');
            fileInput.value = '';
        } catch (err) {
            console.error(err);
            showToast('Błąd importu CSV: ' + err.message, 'danger');
        }
    };
    reader.readAsText(file);
}

// ------------------- Eksport CSV / PDF -------------------
async function exportToCSV() {
    try {
        const snapshot = await db.collection('testCases')
            .where('userId','==',currentUser.uid)
            .get();
        let csv = 'Tytuł,Opis,Kroki,Oczekiwany,Status,Uwagi,Priorytet\n';
        snapshot.forEach(doc => {
            const t = doc.data();
            csv += `${t.title},${t.desc},${t.steps},${t.expected},${t.status},${t.notes},${t.priority}\n`;
        });
        const a = document.createElement('a');
        a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
        a.download = 'testCases.csv';
        a.click();
        exportCount++;
        showToast('CSV wyeksportowane!', 'success');
    } catch (err) {
        console.error(err);
        showToast('Błąd eksportu CSV: ' + err.message, 'danger');
    }
}

async function exportToPDF() {
    try {
        const snapshot = await db.collection('testCases')
            .where('userId','==',currentUser.uid)
            .get();
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.text('Test Cases', 10, 10);
        const body = snapshot.docs.map(d => {
            const t = d.data();
            return [t.title,t.desc,t.steps,t.expected,t.status,t.notes,t.priority];
        });
        doc.autoTable({ head: [['Tytuł','Opis','Kroki','Oczekiwany','Status','Uwagi','Priorytet']], body });
        doc.save('testCases.pdf');
        exportCount++;
        showToast('PDF wyeksportowane!', 'success');
    } catch (err) {
        console.error(err);
        showToast('Błąd eksportu PDF: ' + err.message, 'danger');
    }
}


// ------------------- Init -------------------
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('testForm')?.addEventListener('submit', e => { e.preventDefault(); saveTestCase(); });
    document.getElementById('importCSVBtn')?.addEventListener('click', importFromCSV);
    document.getElementById('clearCSVFile')?.addEventListener('click', clearCSVFile);

    // Zaznacz / odznacz wszystkie checkboxy
    document.getElementById('selectAll')?.addEventListener('change', function() {
        const checked = this.checked;
        document.querySelectorAll('.selectTest').forEach(cb => cb.checked = checked);
    });
});
