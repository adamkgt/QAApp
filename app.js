// ------------------- Inicjalizacja Firebase -------------------
const auth = firebase.auth();
const db = firebase.firestore();
let currentUser = null;
let testCases = [];
let statusChartInstance = null;

// ------------------- Toast -------------------
function showToast(message, type = 'success', duration = 3000) {
    let toastRoot = document.getElementById('toastRoot');
    if (!toastRoot) {
        toastRoot = document.createElement('div');
        toastRoot.id = 'toastRoot';
        toastRoot.className = 'position-fixed top-0 end-0 p-3';
        toastRoot.style.zIndex = 1100;
        document.body.appendChild(toastRoot);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-slide toast-${type}`;
    toast.setAttribute('role','alert');
    toast.setAttribute('aria-live','assertive');
    toast.setAttribute('aria-atomic','true');
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">${message}</div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto"></button>
        </div>
    `;
    toastRoot.appendChild(toast);

    const closeBtn = toast.querySelector('.btn-close');
    closeBtn.addEventListener('click', () => hideToast(toast));

    // Animacja wjazdu
    requestAnimationFrame(() => { toast.classList.add('show'); });

    setTimeout(() => { hideToast(toast); }, duration);

    function hideToast(toastEl){
        toastEl.classList.remove('show');
        toastEl.classList.add('hide');
        toastEl.addEventListener('transitionend', () => toastEl.remove(), { once:true });
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
        if(newPassword){
            currentUser.updatePassword(newPassword)
                .then(()=>showToast('Hasło zmienione!','success'))
                .catch(err=>showToast('Błąd: '+err.message,'danger'));
        }
    });

    document.getElementById('logoutBtnPanel')?.addEventListener('click',()=>{
        auth.signOut().then(()=>{
            localStorage.removeItem('userEmail');
            localStorage.removeItem('userAvatar');
            window.location.href = 'index.html';
        });
    });

    let selectedFile = null;
    changeAvatarBtn?.addEventListener('click',()=>{
        const input = document.createElement('input');
        input.type='file';
        input.accept='image/*';
        input.click();
        input.onchange=()=>{
            selectedFile = input.files[0];
            if(!selectedFile) return;
            const reader = new FileReader();
            reader.onload=e=>{
                avatarPreview.src = e.target.result;
                avatarPreviewContainer.classList.remove('d-none');
            };
            reader.readAsDataURL(selectedFile);
        };
    });

    cancelAvatarBtn?.addEventListener('click',()=>{
        avatarPreviewContainer.classList.add('d-none');
        avatarPreview.src='';
        selectedFile=null;
    });

    saveAvatarBtn?.addEventListener('click',()=>{
        if(!selectedFile) return;
        const reader = new FileReader();
        reader.onload=e=>{
            const img = new Image();
            img.onload=()=>{
                const canvas=document.createElement('canvas');
                canvas.width=64; canvas.height=64;
                const ctx = canvas.getContext('2d');
                const size = Math.min(img.width,img.height);
                ctx.drawImage(img,(img.width-size)/2,(img.height-size)/2,size,size,0,0,64,64);
                const dataURL = canvas.toDataURL('image/png');
                userAvatar.src = dataURL;
                avatarPreviewContainer.classList.add('d-none');
                selectedFile=null;
                db.collection('Users').doc(currentUser.uid).set({avatar:dataURL},{merge:true});
                showToast('Awatar został zmieniony!','success');
            };
            img.src=e.target.result;
        };
        reader.readAsDataURL(selectedFile);
    });
}

// ------------------- Auth i ładowanie danych -------------------
auth.onAuthStateChanged(user=>{
    if(!user) window.location.href='index.html';
    else{
        currentUser=user;
        renderUserPanel();
        loadTestCases();
    }
});

// ------------------- CRUD -------------------
function loadTestCases(){
    const data = localStorage.getItem('testCases');
    testCases = data ? JSON.parse(data) : [];
    renderTable();
    updateStats();
}

function saveTestCase(){
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
    if(index) testCases[index]=t;
    else testCases.push(t);
    localStorage.setItem('testCases',JSON.stringify(testCases));
    resetForm();
    renderTable();
    updateStats();
    showToast('Test zapisany!','success');
}

function resetForm(){
    document.getElementById('testForm').reset();
    document.getElementById('editIndex').value='';
}

function deleteTestCase(i){
    if(!confirm('Usunąć ten test?')) return;
    testCases.splice(i,1);
    localStorage.setItem('testCases',JSON.stringify(testCases));
    renderTable();
    updateStats();
    showToast('Test usunięty!','warning');
}

function deleteAllTestCases(){
    if(!confirm('Usunąć wszystkie testy?')) return;
    testCases=[];
    localStorage.setItem('testCases',JSON.stringify(testCases));
    renderTable();
    updateStats();
    showToast('Wszystkie testy usunięte!','warning');
}

function editTestCase(i){
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
function renderTable(){
    const tbody = document.querySelector('#testTable tbody');
    tbody.innerHTML='';
    const statusFilter = document.getElementById('statusFilter')?.value;
    const priorityFilter = document.getElementById('priorityFilter')?.value;
    const searchQuery = document.getElementById('searchQuery')?.value.toLowerCase();

    testCases.forEach((t,i)=>{
        if(statusFilter && statusFilter!=='all' && (statusFilter==='unknown'? t.status:'') !== statusFilter && statusFilter!=='unknown') return;
        if(priorityFilter && priorityFilter!=='all' && t.priority !== priorityFilter) return;
        if(searchQuery && !Object.values(t).some(v=>v?.toLowerCase().includes(searchQuery))) return;

        const tr = document.createElement('tr');
        tr.innerHTML=`
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

// ------------------- Statystyki i wykres -------------------
function updateStats(){
    const total = testCases.length;
    const pass = testCases.filter(t=>t.status==='Pass').length;
    const fail = testCases.filter(t=>t.status==='Fail').length;
    const unknown = testCases.filter(t=>!t.status || (t.status!=='Pass' && t.status!=='Fail')).length;

    const barPass = document.getElementById('barPass');
    const barFail = document.getElementById('barFail');
    const barUnknown = document.getElementById('barUnknown');
    const statsSummary = document.getElementById('statsSummary');

    if(total===0){
        barPass.style.width='0%';
        barFail.style.width='0%';
        barUnknown.style.width='0%';
        statsSummary.textContent='Brak danych';
        return;
    }

    barPass.style.width=((pass/total)*100)+'%';
    barFail.style.width=((fail/total)*100)+'%';
    barUnknown.style.width=((unknown/total)*100)+'%';
    statsSummary.textContent=`Pass: ${pass}, Fail: ${fail}, Brak statusu: ${unknown}`;

    if(statusChartInstance){
        statusChartInstance.data.datasets[0].data=[pass,fail,unknown];
        statusChartInstance.update();
    }else{
        const ctx = document.getElementById('statusChart').getContext('2d');
        statusChartInstance = new Chart(ctx,{
            type:'doughnut',
            data:{
                labels:['Pass','Fail','Brak statusu'],
                datasets:[{
                    data:[pass,fail,unknown],
                    backgroundColor:['#4caf50','#f44336','#9e9e9e']
                }]
            },
            options:{responsive:true,plugins:{legend:{position:'bottom'}}}
        });
    }
}

// ------------------- Import / Export CSV -------------------
function importFromCSV(){
    const file = document.getElementById('csvFile').files[0];
    if(!file) return showToast('Wybierz plik CSV','warning');
    const reader = new FileReader();
    reader.onload=e=>{
        const lines = e.target.result.split('\n');
        lines.forEach(line=>{
            const [title,desc,steps,expected,status,notes,priority]=line.split(',');
            if(title) testCases.push({title,desc,steps,expected,status,notes,priority});
        });
        localStorage.setItem('testCases',JSON.stringify(testCases));
        renderTable();
        updateStats();
        showToast('CSV zaimportowane!','success');
    };
    reader.readAsText(file);
}

function exportToCSV(){
    let csv='Tytuł,Opis,Kroki,Oczekiwany,Status,Uwagi,Priorytet\n';
    testCases.forEach(t=>{
        csv+=`${t.title},${t.desc},${t.steps},${t.expected},${t.status},${t.notes},${t.priority}\n`;
    });
    const a=document.createElement('a');
    a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
    a.download='testCases.csv';
    a.click();
    showToast('CSV wyeksportowane!','success');
}

function exportToPDF(){
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text('Test Cases',10,10);
    doc.autoTable({
        head:[['Tytuł','Opis','Kroki','Oczekiwany','Status','Uwagi','Priorytet']],
        body:testCases.map(t=>[t.title,t.desc,t.steps,t.expected,t.status,t.notes,t.priority])
    });
    doc.save('testCases.pdf');
    showToast('PDF wyeksportowane!','success');
}

// ------------------- Init -------------------
document.addEventListener('DOMContentLoaded',()=>{
    document.getElementById('testForm')?.addEventListener('submit',e=>{e.preventDefault();saveTestCase();});
    document.getElementById('statusFilter')?.addEventListener('change',renderTable);
    document.getElementById('priorityFilter')?.addEventListener('change',renderTable);
    document.getElementById('searchQuery')?.addEventListener('input',renderTable);
    document.getElementById('importCSVBtn')?.addEventListener('click',importFromCSV);
    document.getElementById('exportCSVBtn')?.addEventListener('click',exportToCSV);
    document.getElementById('exportPDFBtn')?.addEventListener('click',exportToPDF);
});
