const form = document.querySelector("#loginForm");
const message = document.querySelector("#formMessage");

function setMessage(text, type) {
  message.textContent = text;
  message.className = `form-message ${type ? `is-${type}` : ""}`.trim();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const submitButton = form.querySelector('input[type="submit"]');
  submitButton.disabled = true;
  setMessage("Giriş kontrol ediliyor...", "");

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        studentId: form.elements.studentId.value.trim(),
        password: form.elements.password.value,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(data.message || "Giriş yapılamadı.", "error");
      return;
    }

    const studentId = form.elements.studentId.value.trim();
    setMessage(data.message || "Giriş başarılı.", "success");
    localStorage.setItem("studentId", studentId);
    document.cookie = `studentId=${encodeURIComponent(
      studentId,
    )}; path=/; max-age=604800; SameSite=Lax`;
    window.location.replace("https://library.zeuleg.dev/index.html");
  } catch {
    setMessage("Sunucuya bağlanılamadı. Lütfen tekrar deneyin.", "error");
  } finally {
    submitButton.disabled = false;
  }
});
