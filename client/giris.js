const loginForm = document.getElementById("loginForm");
const messageBox = document.getElementById("formMessage");

function showMessage(text, type) {
    messageBox.textContent = text;
    messageBox.className = "form-message " + type;
}

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(loginForm);
    const payload = {
        studentId: String(formData.get("studentId") || "").trim(),
        password: String(formData.get("password") || "")
    };

    showMessage("Bilgiler kontrol ediliyor...", "info");

    try {
        const response = await fetch("/api/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (!response.ok) {
            showMessage(result.message || "Giris basarisiz.", "error");
            return;
        }

        showMessage(result.message || "Giris basarili.", "success");

        // Gercek projede kullanici paneline/rezervasyon ekranina yonlendirilir.
        setTimeout(() => {
            window.location.href = "index.html";
        }, 800);
    } catch (error) {
        showMessage("Sunucuya ulasilamadi. Lutfen tekrar dene.", "error");
    }
});
