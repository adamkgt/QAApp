/* =========================================================
   QA Test Management – pełny app.js (Firebase compat + toasty)
   ========================================================= */

// ------------------- Inicjalizacja Firebase (compat) -------------------
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let testCases = [];
let sortKey = "";
let sortAsc = true;

// ------------------- Elementy DOM -------------------
const testForm = document.getElementById("testForm");
const statusFilter = document.getElementById("statusFilter");
const priorityFilter = document.getElementById("priorityFilter");
const searchQuery = document.getElementById("searchQuery");

// ------------------- Toast (z animacją, bez Bootstrap.Toast) -------------------
/*
  WYMAGANY markup w HTML:
  <div class="position-fixed top-0 end-0 p-3" id="toastRoot" style="z-index:1100">
    <div id="appToast" class="toast align-items-center border-0" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="d-flex">
        <div class="toast-body" id="toastMessage"></div>
        <button type="button" class="btn-close me-2 m-auto" id="toastCloseBtn" aria-label="Close"></button>
      </div>
    </div>
  </div>

  Jeśli w Twoim HTML nie ma #toastRoot – ten kod sobie poradzi (fallback),
  ale najlepiej dodaj id="toastRoot" kontenerowi z pozycjonowaniem.
*/

(function hardenToastRoot() {
  const root = document.getElementById("toastRoot") || document.querySelector(".position-fixed.top-0.end-0.p-3");
  if (root) {
    root.id = root.id || "toastRoot";
    // klikowalny toast, tło nie przechwytuje klików
    root.style.pointerEvents = "none";
  }
  const toastEl = document.getElementById("appToast");
  if (toastEl) toastEl.style.pointerEvents = "auto";
})();

let _toastHideTimer = null;
let _toastAnimating = false;

function _clearToastTimers() {
  if (_toastHideTimer) {
    clearTimeout(_toastHideTimer);
    _toastHideTimer = null;
  }
}

function _forceReflow(el) {
  void el.offsetWidth; // reset animacji CSS
}

function hideToast() {
  const toastEl = document.getElementById("appToast");
  if (!toastEl || _toastAnimating) return;

  _clearToastTimers();
  // usuń klasy wejściowe, dodaj wyjście
  toastEl.classList.remove("toast-slide-in");
  _forceReflow(toastEl);
  toastEl.classList.add("toast-slide-out");
  _toastAnimating = true;

  const onEnd = () => {
    toastEl.classList.remove("toast-slide-out", "toast-success", "toast-danger", "toast-warning");
    _toastAnimating = false;
    toastEl.removeEventListener("animationend", onEnd);
  };
  toastEl.addEventListener("animationend", onEnd);
}

function showToast(message, type = "success", duration = 3000) {
  const toastEl = document.getElementById("appToast");
  const toastMsg = document.getElementById("toastMessage");
  const closeBtn = document.getElementById("toastCloseBtn") || toastEl.querySelector(".btn-close");

  if (!toastEl || !toastMsg) return;

  // reset
  _clearToastTimers();
  toastEl.classList.remove("toast-slide-in", "toast-slide-out", "toast-success", "toast-danger", "toast-warning", "text-bg-success", "text-bg-danger", "text-bg-warning", "fade", "show", "showing");
  toastEl.classList.add("toast", "toast-slide"); // klasa bazowa dla animacji

  // typ (spójny z Twoim CSS)
  const validType = ["success", "danger", "warning"].includes(type) ? type : "success";
  toastEl.classList.add(`toast-${validType}`);

  // treść
  toastMsg.textContent = message;

  // reflow + animacja wejścia
  _forceReflow(toastEl);
  toastEl.classList.add("toast-slide-in");

  // obsługa zamykania
  if (closeBtn && !closeBtn._wired) {
    closeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      hideToast();
    });
    closeBtn._wired = true;
  }

  // autoukrywanie
  if (duration > 0) {
    _toastHideTimer = setTimeout(hideToast, duration);
  }
}

// ------------------- Funkcja użytkownika (panel) -------------------
function renderUserPanel() {
  const userPanelEmail = document.getElementById("userEmail");
  const userAvatar = document.getElementById("userAvatar");
  const changeAvatarBtn = document.getElementById("changeAvatarBtn");
  const avatarPreviewContainer = document.getElementById("avatarPreviewContainer");
  const avatarPreview = document.getElementById("avatarPreview");
  const saveAvatarBtn = document.getElementById("saveAvatarBtn");
  const cancelAvatarBtn = document.getElementById("cancelAvatarBtn");

  if (!currentUser || !userPanelEmail || !userAvatar) return;

  // ukryj zanim wczytasz
  userAvatar.style.opacity = 0;
  userPanelEmail.style.opacity = 0;

  // localStorage
  const savedEmail = localStorage.getItem("userEmail");
  const savedAvatar = localStorage.getItem("userAvatar");
  if (savedEmail) userPanelEmail.textContent = savedEmail;
  if (savedAvatar) userAvatar.src = savedAvatar;

  // Firestore profil
  db.collection("Users")
    .doc(currentUser.uid)
    .get()
    .then((doc) => {
      if (doc.exists) {
        const data = doc.data();
        if (data.avatar) {
          userAvatar.src = data.avatar;
          localStorage.setItem("userAvatar", data.avatar);
        } else {
          userAvatar.src = "img/default-avatar.png";
        }
        if (currentUser.email) {
          userPanelEmail.textContent = currentUser.email;
          localStorage.setItem("userEmail", currentUser.email);
        }
      } else {
        userAvatar.src = "img/default-avatar.png";
        userPanelEmail.textContent = currentUser.email || "";
        db.collection("Users").doc(currentUser.uid).set({ avatar: "img/default-avatar.png" });
        localStorage.setItem("userAvatar", "img/default-avatar.png");
        localStorage.setItem("userEmail", currentUser.email || "");
      }
    })
    .catch((err) => {
      console.error("Błąd pobierania awatara:", err);
      userAvatar.src = "img/default-avatar.png";
      userPanelEmail.textContent = currentUser.email || "";
    })
    .finally(() => {
      userAvatar.style.opacity = 1;
      userPanelEmail.style.opacity = 1;
    });

  // Zmiana hasła
  const editBtn = document.getElementById("editProfileBtn");
  if (editBtn && !editBtn._wired) {
    editBtn.addEventListener("click", () => {
      const newPassword = prompt("Podaj nowe hasło:");
      if (newPassword) {
        currentUser
          .updatePassword(newPassword)
          .then(() => showToast("Hasło zmienione!", "success"))
          .catch((err) => showToast("Błąd: " + err.message, "danger"));
      }
    });
    editBtn._wired = true;
  }

  // Wylogowanie
  const logoutBtn = document.getElementById("logoutBtnPanel");
  if (logoutBtn && !logoutBtn._wired) {
    logoutBtn.addEventListener("click", () => {
      auth.signOut().then(() => {
        localStorage.removeItem("userEmail");
        localStorage.removeItem("userAvatar");
        window.location.href = "index.html";
      });
    });
    logoutBtn._wired = true;
  }

  // Zmiana awatara
  let selectedFile = null;

  if (changeAvatarBtn && !changeAvatarBtn._wired) {
    changeAvatarBtn.addEventListener("click", () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.click();

      input.onchange = () => {
        selectedFile = input.files[0];
        if (!selectedFile) return;

        const reader = new FileReader();
        reader.onload = (e) => {
          avatarPreview.src = e.target.result;
          avatarPreviewContainer.classList.remove("d-none");
        };
        reader.readAsDataURL(selectedFile);
      };
    });
    changeAvatarBtn._wired = true;
  }

  if (cancelAvatarBtn && !cancelAvatarBtn._wired) {
    cancelAvatarBtn.addEventListener("click", () => {
      avatarPreviewContainer.classList.add("d-none");
      avatarPreview.src = "";
      selectedFile = null;
    });
    cancelAvatarBtn._wired = true;
  }

  if (saveAvatarBtn && !saveAvatarBtn._wired) {
    saveAvatarBtn.addEventListener("click", () => {
      if (!selectedFile) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = 64;
          canvas.height = 64;
          const ctx = canvas.getContext("2d");
          const size = Math.min(img.width, img.height);
          ctx.drawImage(
            img,
            (img.width - size) / 2,
            (img.height - size) / 2,
            size,
            size,
            0,
            0,
            64,
            64
          );

          const dataURL = canvas.toDataURL("image/png");
          document.getElementById("userAvatar").src = dataURL;
          avatarPreviewContainer.classList.add("d-none");
          selectedFile = null;

          db.collection("Users").doc(currentUser.uid).set({ avatar: dataURL }, { merge: true });
          localStorage.setItem("userAvatar", dataURL);

          showToast("Awatar został zmieniony!", "success");
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(selectedFile);
    });
    saveAvatarBtn._wired = true;
  }
}

// ------------------- Ochrona strony i ładowanie danych -------------------
auth.onAuthStateChanged((user) => {
  if (!user) {
    window.location.href = "index.html";
  } else {
    currentUser = user;
    renderUserPanel();
    loadTestCases();
  }
});

// ------------------- CRUD -------------------
function loadTestCases() {
  db.collection("Users")
    .doc(currentUser.uid)
    .collection("testCases")
    .onSnapshot(
      (snapshot) => {
        testCases = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        renderTable();
      },
      (err) => console.error(err)
    );
}

function saveTestCase() {
  const index = document.getElementById("editIndex").value;
  const data = {
    name: document.getElementById("testName").value,
    desc: document.getElementById("testDesc").value,
    steps: document.getElementById("testSteps").value,
    expected: document.getElementById("expectedResult").value,
    status: document.getElementById("testStatus").value,
    notes: document.getElementById("testNotes").value,
    priority: document.getElementById("testPriority").value,
    history: [`${index === "" ? "Utworzono" : "Edytowano"}: ${new Date().toLocaleString()}`],
  };

  const testCasesRef = db.collection("Users").doc(currentUser.uid).collection("testCases");

  if (!data.name || !data.name.trim()) {
    showToast("Podaj tytuł testu.", "warning");
    return;
  }

  if (index === "") {
    // doc ID = nazwa (jak u Ciebie wcześniej)
    testCasesRef
      .doc(data.name)
      .set(data)
      .then(() => {
        resetForm();
        showToast("Test dodany!", "success");
      })
      .catch((err) => showToast("Błąd zapisu: " + err.message, "danger"));
  } else {
    testCasesRef
      .doc(index)
      .update(data)
      .then(() => {
        resetForm();
        showToast("Test zaktualizowany!", "success");
      })
      .catch((err) => showToast("Błąd zapisu: " + err.message, "danger"));
  }
}

function editTestCase(id) {
  const tc = testCases.find((tc) => tc.id === id);
  if (!tc) return;
  document.getElementById("editIndex").value = tc.id;
  document.getElementById("testName").value = tc.name;
  document.getElementById("testDesc").value = tc.desc;
  document.getElementById("testSteps").value = tc.steps;
  document.getElementById("expectedResult").value = tc.expected;
  document.getElementById("testStatus").value = tc.status;
  document.getElementById("testNotes").value = tc.notes;
  document.getElementById("testPriority").value = tc.priority;
}

function deleteTestCase(id) {
  if (!confirm("Na pewno usunąć ten test?")) return;
  db.collection("Users")
    .doc(currentUser.uid)
    .collection("testCases")
    .doc(id)
    .delete()
    .then(() => showToast("Test usunięty!", "success"))
    .catch((err) => showToast("Błąd usuwania: " + err.message, "danger"));
}

function deleteAllTestCases() {
  if (!confirm("Na pewno usunąć wszystkie testy?")) return;
  const testCasesRef = db.collection("Users").doc(currentUser.uid).collection("testCases");
  const batch = db.batch();
  testCases.forEach((tc) => {
    const docRef = testCasesRef.doc(tc.id);
    batch.delete(docRef);
  });
  batch
    .commit()
    .then(() => showToast("Wszystkie testy usunięte!", "success"))
    .catch((err) => showToast("Błąd usuwania: " + err.message, "danger"));
}

function resetForm() {
  if (!testForm) return;
  testForm.reset();
  document.getElementById("editIndex").value = "";
}

// ------------------- Filtry i sortowanie -------------------
function clearFilters() {
  if (statusFilter) statusFilter.value = "all";
  if (priorityFilter) priorityFilter.value = "all";
  if (searchQuery) searchQuery.value = "";
  renderTable();
}

function applyFilters(data) {
  const status = statusFilter ? statusFilter.value : "all";
  const priority = priorityFilter ? priorityFilter.value : "all";
  const query = (searchQuery ? searchQuery.value : "").toLowerCase();

  return data.filter((tc) => {
    if (status !== "all" && (tc.status || "") !== status) return false;
    if (priority !== "all" && (tc.priority || "") !== priority) return false;
    if (
      query &&
      ![tc.name, tc.desc, tc.steps, tc.expected]
        .map((f) => (f || "").toLowerCase())
        .some((f) => f.includes(query))
    )
      return false;
    return true;
  });
}

function sortBy(key) {
  if (sortKey === key) sortAsc = !sortAsc;
  else {
    sortKey = key;
    sortAsc = true;
  }
  renderTable();
}

// ------------------- Renderowanie tabeli i statystyk -------------------
let statusChart;

function renderTable() {
  let data = applyFilters([...testCases]);
  if (sortKey)
    data.sort(
      (a, b) => (a[sortKey] || "").localeCompare(b[sortKey] || "") * (sortAsc ? 1 : -1)
    );

  const tbody = document.querySelector("#testTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  data.forEach((tc) => {
    const tr = document.createElement("tr");

    // ładne badge dla statusu (pod Twój CSS)
    let statusHTML = "";
    if (tc.status === "Pass") {
      statusHTML = `<span class="pass-badge"><i class="bi bi-check2-circle"></i> Pass</span>`;
    } else if (tc.status === "Fail") {
      statusHTML = `<span class="fail-badge"><i class="bi bi-x-octagon"></i> Fail</span>`;
    } else {
      statusHTML = `<span class="unknown-badge"><i class="bi bi-question-circle"></i> Brak</span>`;
    }

    tr.innerHTML = `
      <td>${tc.name || ""}</td>
      <td>${tc.desc || ""}</td>
      <td>${tc.steps || ""}</td>
      <td>${tc.expected || ""}</td>
      <td class="nowrap">${statusHTML}</td>
      <td>${tc.notes || ""}</td>
      <td>${tc.priority || ""}</td>
      <td class="nowrap">
        <button class="btn btn-sm btn-primary me-1" data-id="${tc.id}" data-action="edit">
          <i class="bi bi-pencil-square"></i> Edytuj
        </button>
        <button class="btn btn-sm btn-danger" data-id="${tc.id}" data-action="delete">
          <i class="bi bi-trash"></i> Usuń
        </button>
      </td>
    `;

    // delegacja zdarzeń
    tr.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const id = btn.getAttribute("data-id");
      const action = btn.getAttribute("data-action");
      if (action === "edit") editTestCase(id);
      if (action === "delete") deleteTestCase(id);
    });

    tbody.appendChild(tr);
  });

  updateStats();
  updateCharts();
}

function countStats() {
  let pass = 0,
    fail = 0,
    unknown = 0;
  testCases.forEach((tc) => {
    if (tc.status === "Pass") pass++;
    else if (tc.status === "Fail") fail++;
    else unknown++;
  });
  return { pass, fail, unknown };
}

function updateStats() {
  const { pass, fail, unknown } = countStats();
  const total = testCases.length || 1;

  const barPass = document.getElementById("barPass");
  const barFail = document.getElementById("barFail");
  const barUnknown = document.getElementById("barUnknown");
  const summary = document.getElementById("statsSummary");

  if (barPass) barPass.style.width = (pass / total) * 100 + "%";
  if (barFail) barFail.style.width = (fail / total) * 100 + "%";
  if (barUnknown) barUnknown.style.width = (unknown / total) * 100 + "%";

  if (summary) {
    summary.textContent = `Pass: ${pass} • Fail: ${fail} • Brak: ${unknown} • Razem: ${total}`;
  }
}

function updateCharts() {
  const ctx = document.getElementById("statusChart");
  if (!ctx) return;
  const { pass, fail, unknown } = countStats();

  if (!statusChart) {
    statusChart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["Pass", "Fail", "Brak"],
        datasets: [
          { data: [pass, fail, unknown], backgroundColor: ["#4caf50", "#f44336", "#9e9e9e"] },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
      },
    });
  } else {
    statusChart.data.datasets[0].data = [pass, fail, unknown];
    statusChart.update();
  }
}

// ------------------- Import / Export -------------------
function importFromCSV() {
  const file = document.getElementById("csvFile").files[0];
  if (!file) {
    showToast("Wybierz plik CSV!", "warning");
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    const lines = e.target.result
      .split(/\r?\n/)
      .filter((l) => l.trim() !== "");
    if (lines.length <= 1) {
      showToast("Plik CSV jest pusty.", "warning");
      return;
    }
    lines.shift(); // nagłówek

    const testCasesRef = db.collection("Users").doc(currentUser.uid).collection("testCases");

    lines.forEach((line) => {
      const parts = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
      const [name, desc, steps, expected, status, notes, priority] = parts.map((p) =>
        (p || "").replace(/^"|"$/g, "").replace(/""/g, '"').trim()
      );
      if (!name) return;

      const data = {
        name,
        desc: desc || "",
        steps: steps || "",
        expected: expected || "",
        status: status || "",
        notes: notes || "",
        priority: priority || "",
        history: [`Import: ${new Date().toLocaleString()}`],
      };

      testCasesRef.doc(name).set(data).catch((err) => console.error(err));
    });

    showToast("Import zakończony!", "success");
  };
  reader.readAsText(file);
}

function exportToCSV() {
  let csv = "Nazwa,Opis,Kroki,Oczekiwany,Status,Uwagi,Priorytet\n";
  testCases.forEach((tc) => {
    const esc = (v) => `"${String(v || "").replace(/"/g, '""')}"`;
    csv += `${esc(tc.name)},${esc(tc.desc)},${esc(tc.steps)},${esc(tc.expected)},${esc(tc.status)},${esc(tc.notes)},${esc(tc.priority)}\n`;
  });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "testcases.csv";
  a.click();
  URL.revokeObjectURL(url);
  showToast("Eksport CSV zakończony!", "success");
}

function exportToPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.autoTable({
    head: [["Nazwa", "Opis", "Kroki", "Oczekiwany", "Status", "Uwagi", "Priorytet"]],
    body: testCases.map((tc) => [
      tc.name,
      tc.desc,
      tc.steps,
      tc.expected,
      tc.status,
      tc.notes,
      tc.priority,
    ]),
    styles: { cellPadding: 2, fontSize: 10 },
  });
  doc.save("testcases.pdf");
  showToast("Eksport PDF zakończony!", "success");
}

// ------------------- Init & nasłuchiwanie -------------------
document.addEventListener("DOMContentLoaded", () => {
  // formularz
  if (testForm) {
    testForm.addEventListener("submit", (e) => {
      e.preventDefault();
      saveTestCase();
    });
  }

  // filtry
  statusFilter?.addEventListener("change", renderTable);
  priorityFilter?.addEventListener("change", renderTable);
  searchQuery?.addEventListener("input", renderTable);

  // import
  const importBtn = document.getElementById("importCSVBtn");
  const csvFileInput = document.getElementById("csvFile");
  if (importBtn && csvFileInput && !importBtn._wired) {
    importBtn.addEventListener("click", (e) => {
      e.preventDefault();
      importFromCSV();
    });
    importBtn._wired = true;
  }

  // przycisk zamykania toastu (fallback gdy nie ma #toastCloseBtn)
  const toastEl = document.getElementById("appToast");
  const maybeClose = toastEl?.querySelector(".btn-close");
  if (maybeClose && !maybeClose._wired) {
    maybeClose.addEventListener("click", (e) => {
      e.preventDefault();
      hideToast();
    });
    maybeClose._wired = true;
  }
});

// ====== API do użycia w HTML (onclick itp.) ======
window.clearFilters = clearFilters;
window.deleteTestCase = deleteTestCase;
window.deleteAllTestCases = deleteAllTestCases;
window.resetForm = resetForm;
window.exportToCSV = exportToCSV;
window.exportToPDF = exportToPDF;
window.editTestCase = editTestCase;
