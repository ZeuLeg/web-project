const form = document.querySelector("#registerForm");
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
  setMessage("Kayıt oluşturuluyor...", "");

  try {
    const response = await fetch("/api/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tcId: form.elements.tcId.value.trim(),
        studentId: form.elements.studentId.value.trim(),
        password: form.elements.password.value,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(data.message || "Kayıt oluşturulamadı.", "error");
      return;
    }

    setMessage(data.message || "Kayıt başarılı.", "success");
    window.setTimeout(() => {
      window.location.href = "../pages/login.html";
    }, 900);
  } catch (error) {
    setMessage("Sunucuya bağlanılamadı. Lütfen tekrar deneyin.", "error");
  } finally {
    submitButton.disabled = false;
  }
});
