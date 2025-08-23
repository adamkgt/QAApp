// Upewnij się, że config.js ładuje firebaseConfig, auth i db

// 🔹 Sprawdzanie zalogowania
auth.onAuthStateChanged(user => {
  if (user) {
    console.log("Zalogowany jako:", user.email);
    loadTestCases(user.uid);
  } else {
    window.location.href = "index.html";
  }
});

// 🔹 Zapisz przypadek testowy
async function saveTestCase() {
  const user = auth.currentUser;
  if (!user) return;

  const testId = document.getElementById("testId").value;
  const testName = document.getElementById("testName").value;
  const testDesc = document.getElementById("testDesc").value;
  const testSteps = document.getElementById("testSteps").value;
  const expectedResult = document.getElementById("expectedResult").value;
  const testStatus = document.getElementById("testStatus").value || "unknown";
  const testNotes = document.getElementById("testNotes").value;
  const testPriority = document.getElementById("testPriority").value || "Brak";

  await db.collection("users").doc(user.uid).collection("testCases").doc(testId).set({
    id: testId,
    name: testName,
    desc: testDesc,
    steps: testSteps,
    expected: expectedResult,
    status: testStatus,
    notes: testNotes,
    priority: testPriority,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  });

  resetForm();
  loadTestCases(user.uid);
}

// 🔹 Wczytaj przypadki testowe
async function loadTestCases(uid) {
  const snapshot = await db.collection("users").doc(uid).collection("testCases").orderBy("timestamp", "desc").get();
  const cases = [];
  snapshot.forEach(doc => cases.push(doc.data()));
  renderTable(cases);
}

// 🔹 Usuń wszystkie przypadki
async function deleteAllTestCases() {
  const user = auth.currentUser;
  if (!user) return;

  const snapshot = await db.collection("users").doc(user.uid).collection("testCases").get();
  const batch = db.batch();
  snapshot.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
  loadTestCases(user.uid);
}

// 🔹 Renderuj tabelę
function renderTable(testCases = []) {
  const tbody = document.querySelector("#testTable tbody");
  tbody.innerHTML = "";

  testCases.forEach(tc => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${tc.id}</td>
      <td>${tc.name}</td>
      <td>${tc.desc || ""}</td>
      <td>${tc.steps || ""}</td>
      <td>${tc.expected || ""}</td>
      <td>${tc.status}</td>
      <td>${tc.notes || ""}</td>
      <td>${tc.priority}</td>
      <td>
        <button class="btn btn-sm btn-danger" onclick="deleteTestCase('${tc.id}')">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

// 🔹 Usuń jeden przypadek
async function deleteTestCase(id) {
  const user = auth.currentUser;
  if (!user) return;

  await db.collection("users").doc(user.uid).collection("testCases").doc(id).delete();
  loadTestCases(user.uid);
}

// 🔹 Reset formularza
function resetForm() {
  document.getElementById("testForm").reset();
}

// 🔹 Wylogowanie
document.getElementById("logoutBtn").addEventListener("click", () => {
  auth.signOut().then(() => {
    window.location.href = "index.html";
  });
});

// 🔹 Podpięcie funkcji pod window (żeby działały onclick w HTML)
window.saveTestCase = saveTestCase;
window.resetForm = resetForm;
window.deleteAllTestCases = deleteAllTestCases;
window.renderTable = renderTable;
window.deleteTestCase = deleteTestCase;
