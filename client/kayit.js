const registerForm = document.getElementById("registerForm");
const messageBox = document.getElementById("formMessage");

function showMessage(text, type) {
    messageBox.textContent = text;
    messageBox.className = "form-message " + type;
}

registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(registerForm);
    const payload = {
        tcId: String(formData.get("tcId") || "").trim(),
        studentId: String(formData.get("studentId") || "").trim(),
        password: String(formData.get("password") || "")
    };

    showMessage("Kayıt oluşturuluyor...", "info");

    try {
        const response = await fetch("/api/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (!response.ok) {
            showMessage(result.message || "Kayıt başarısız.", "error");
            return;
        }

        showMessage(result.message || "Kayıt başarılı.", "success");

        setTimeout(() => {
            window.location.href = "giris.html";
        }, 900);
    } catch {
        showMessage("Sunucuya ulaşılamadı. Lütfen tekrar dene.", "error");
    }
});
