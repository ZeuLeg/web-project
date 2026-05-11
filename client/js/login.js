const form = document.querySelector("#loginForm");
const message = document.querySelector("#formMessage");

async function redirectIfAuthenticated() {
  try {
    const response = await fetch("/api/auth/me", { credentials: 'include' });

    if (!response.ok) {
      return;
    }

    const data = await response.json().catch(() => ({}));
    const redirectTo = data.redirectTo || "/index.html";

    window.location.replace(redirectTo);
  } catch {
    return;
  }
}

redirectIfAuthenticated();

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
      credentials: 'include',
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

    // Ek güvenlik: sunucunun cookie'yi okuyabildiğini doğrulayıp
    // ona göre yönlendir (bazı tarayıcı/ortamlarda cookie hemen görünmeyebilir).
    try {
      const meResp = await fetch("/api/auth/me", { credentials: 'include' });
      if (meResp.ok) {
        const meData = await meResp.json().catch(() => ({}));
        window.location.replace(meData.redirectTo || data.redirectTo || "/index.html");
      } else {
        window.location.replace(data.redirectTo || "/index.html");
      }
    } catch (e) {
      window.location.replace(data.redirectTo || "/index.html");
    }
  } catch {
    setMessage("Sunucuya bağlanılamadı. Lütfen tekrar deneyin.", "error");
  } finally {
    submitButton.disabled = false;
  }
});
