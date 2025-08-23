// app.js
document.addEventListener("DOMContentLoaded", () => {
  // 🔹 Wylogowanie
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      auth.signOut().then(() => {
        window.location.href = "index.html";
      });
    });
  }

  // ===============================
  // 🔹 Funkcje CRUD
  // ===============================
  let testCases = [];
  let sortColumn = null;
  let sortDirection = 1;

  // Zapisz przypadek
  window.saveTestCase = function () {
    const id = document.getElementById("testId").value.trim();
    const name = document.getElementById("testName").value.trim();
    const desc = document.getElementById("testDesc").value.trim();
    const steps = document.getElementById("testSteps").value.trim();
    const result = document.getElementById("expectedResult").value.trim();
    const status = document.getElementById("testStatus").value;
    const notes = document.getElementById("testNotes").value.trim();
    const priority = document.getElementById("testPriority").value;

    if (!id || !name) {
      alert("Podaj ID i nazwę testu!");
      return;
    }

    testCases.push({ id, name, desc, steps, result, status, notes, priority });
    renderTable();
    resetForm();
  };

  // Reset formularza
  window.resetForm = function () {
    document.getElementById("testForm").reset();
  };

  // Render tabeli
  window.renderTable = function () {
    const tbody = document.querySelector("#testTable tbody");
    tbody.innerHTML = "";

    const statusFilter = document.getElementById("statusFilter").value;
    const priorityFilter = document.getElementById("priorityFilter").value;
    const searchQuery = document.getElementById("searchQuery").value.toLowerCase();

    let filtered = testCases.filter(tc => {
      let statusMatch = statusFilter === "all" || tc.status === statusFilter;
      let priorityMatch = priorityFilter === "all" || tc.priority === priorityFilter;
      let searchMatch =
        tc.id.toLowerCase().includes(searchQuery) ||
        tc.name.toLowerCase().includes(searchQuery) ||
        tc.desc.toLowerCase().includes(searchQuery);
      return statusMatch && priorityMatch && searchMatch;
    });

    filtered.forEach(tc => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${tc.id}</td>
        <td>${tc.name}</td>
        <td>${tc.desc}</td>
        <td>${tc.steps}</td>
        <td>${tc.result}</td>
        <td>${tc.status}</td>
        <td>${tc.notes}</td>
        <td>${tc.priority}</td>
        <td>
          <button class="btn btn-sm btn-warning" onclick="editTestCase('${tc.id}')">Edytuj</button>
          <button class="btn btn-sm btn-danger" onclick="deleteTestCase('${tc.id}')">Usuń</button>
        </td>
      `;
      tbody.appendChild(row);
    });
  };

  // Usuń wszystkie
  window.deleteAllTestCases = function () {
    if (confirm("Na pewno usunąć wszystkie testy?")) {
      testCases = [];
      renderTable();
    }
  };

  // Import CSV
  window.importFromCSV = function () {
    const fileInput = document.getElementById("csvFile");
    const file = fileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const rows = e.target.result.split("\n").map(r => r.split(","));
      rows.forEach(row => {
        if (row.length >= 2) {
          testCases.push({
            id: row[0],
            name: row[1],
            desc: row[2] || "",
            steps: row[3] || "",
            result: row[4] || "",
            status: row[5] || "",
            notes: row[6] || "",
            priority: row[7] || ""
          });
        }
      });
      renderTable();
    };
    reader.readAsText(file);
  };

  // Eksport CSV
  window.exportToCSV = function () {
    let csv = "ID,Nazwa,Opis,Kroki,Oczekiwany rezultat,Status,Uwagi,Priorytet\n";
    testCases.forEach(tc => {
      csv += `${tc.id},${tc.name},${tc.desc},${tc.steps},${tc.result},${tc.status},${tc.notes},${tc.priority}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "testcases.csv";
    link.click();
  };

  // Eksport PDF
  window.exportToPDF = function () {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.text("Przypadki testowe", 10, 10);
    const tableData = testCases.map(tc => [
      tc.id, tc.name, tc.desc, tc.steps, tc.result, tc.status, tc.notes, tc.priority
    ]);

    doc.autoTable({
      head: [["ID", "Nazwa", "Opis", "Kroki", "Oczekiwany rezultat", "Status", "Uwagi", "Priorytet"]],
      body: tableData,
    });

    doc.save("testcases.pdf");
  };
});
