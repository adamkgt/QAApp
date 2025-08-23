// auth.js
document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  const errorMsg = document.getElementById("errorMsg");

  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = document.getElementById("email").value;
      const password = document.getElementById("password").value;

      auth.signInWithEmailAndPassword(email, password)
        .then(() => {
          window.location.href = "app.html";
        })
        .catch((error) => {
          errorMsg.textContent = "Błąd: " + error.message;
        });
    });
  }
});
