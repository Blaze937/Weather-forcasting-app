document.getElementById("login-form").addEventListener("submit", function(e) {
  e.preventDefault();

  const userId = document.getElementById("userid").value;
  const password = document.getElementById("password").value;
  const errorMsg = document.getElementById("login-error");

  // Demo: simple static login check
  if (userId === "admin" && password === "1234") {
    localStorage.setItem("isLoggedIn", "true");
    window.location.href = "index.html"; // Redirect to weather app
  } else {
    errorMsg.style.display = "block";
  }
});
