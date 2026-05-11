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

  // Dashboard verisini yükle
  loadDashboardData();
});

async function loadDashboardData() {
  try {
    const response = await fetch("/api/admin/dashboard", { credentials: 'include' });
    const data = await response.json();

    if (response.ok) {
      document.querySelectorAll(".card")[0].querySelector("p").textContent = data.totalBooks;
      document.querySelectorAll(".card")[1].querySelector("p").textContent = data.totalUsers;
      document.querySelectorAll(".card")[2].querySelector("p").textContent = data.activeLoans;
      document.querySelectorAll(".card")[3].querySelector("p").textContent = data.overdueLoans;
    }
  } catch (error) {
    console.error("Dashboard verisi yükleme hatası:", error);
  }
}
