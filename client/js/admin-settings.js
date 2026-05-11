document.addEventListener("DOMContentLoaded", function () {
  const sidebars = document.querySelectorAll(".sidebar a");
  const current = decodeURIComponent(location.pathname.split("/").pop() || "");

  sidebars.forEach((a) => {
    const href = a.getAttribute("href")?.split("/").pop() || "";
    if (!href) return;
    if (href === current) {
      a.parentElement.classList.add("active");
    } else {
      a.parentElement.classList.remove("active");
    }
  });

  // Logout
  const logoutBtn = document.querySelector(".logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        const response = await fetch("/api/logout", { method: "POST", credentials: 'include' });
        if (response.ok) {
          window.location.href = "/pages/login.html";
        }
      } catch (error) {
        console.error("Çıkış hatası:", error);
      }
    });
  }

  // Ayarları kaydet
  const saveBtn = document.querySelector(".btn-save");
  if (saveBtn) {
    saveBtn.addEventListener("click", saveSettings);
  }

  // LocalStorage'dan ayarları yükle
  loadSettings();
});

function loadSettings() {
  const inputs = document.querySelectorAll(".form-group input");
  inputs.forEach((input, index) => {
    const key = ["libraryName", "maxLoanDays", "lateFeePerDay"][index];
    const saved = localStorage.getItem(`setting_${key}`);
    if (saved) {
      input.value = saved;
    }
  });
}

function saveSettings() {
  const inputs = document.querySelectorAll(".form-group input");
  const keys = ["libraryName", "maxLoanDays", "lateFeePerDay"];

  inputs.forEach((input, index) => {
    localStorage.setItem(`setting_${keys[index]}`, input.value);
  });

  alert("Ayarlar başarıyla kaydedildi!");
}
