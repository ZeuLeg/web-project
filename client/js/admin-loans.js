let allLoans = [];

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
        const response = await fetch("/api/logout", { method: "POST" });
        if (response.ok) {
          window.location.href = "/pages/login.html";
        }
      } catch (error) {
        console.error("Çıkış hatası:", error);
      }
    });
  }

  // Ödünç işlemlerini yükle
  loadLoans();

  // Arama özelliği
  const searchBar = document.querySelector(".search-bar input");
  if (searchBar) {
    searchBar.addEventListener("keyup", filterLoans);
  }
});

async function loadLoans() {
  try {
    const response = await fetch("/api/admin/loans");
    const data = await response.json();

    if (response.ok) {
      allLoans = data.loans;
      renderLoansTable(data.loans);
    }
  } catch (error) {
    console.error("Ödünç işlemlerini yükleme hatası:", error);
  }
}

function renderLoansTable(loans) {
  const tbody = document.querySelector("table tbody");
  if (!tbody) return;

  tbody.innerHTML = loans
    .map((loan) => {
      const statusClass = loan.is_overdue ? "status-gecikmis" : loan.status === "active" ? "status-oduncte" : "status-rafta";
      const statusText = loan.is_overdue ? "Gecikmiş!" : loan.status === "active" ? "Süresi Var" : loan.status === "returned" ? "İade Edildi" : "İptal";

      return `
    <tr>
      <td>${loan.id.substring(0, 8)}</td>
      <td>${loan.title}</td>
      <td>${loan.student_id}</td>
      <td>${formatDate(loan.borrowed_at)}</td>
      <td>${loan.returned_at ? formatDate(loan.returned_at) : "-"}</td>
      <td><span class="status ${statusClass}">${statusText}</span></td>
      <td>
        ${loan.status === "active"
          ? `<button class="btn btn-edit" onclick="returnBook('${loan.id}')">İade Al</button>`
          : ""
        }
      </td>
    </tr>
  `;
    })
    .join("");
}

function formatDate(dateString) {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("tr-TR");
}

function filterLoans() {
  const searchTerm = document.querySelector(".search-bar input").value.toLowerCase();
  const filtered = allLoans.filter(
    (loan) =>
      loan.id.toLowerCase().includes(searchTerm) ||
      loan.title.toLowerCase().includes(searchTerm) ||
      loan.student_id.toLowerCase().includes(searchTerm),
  );
  renderLoansTable(filtered);
}

window.returnBook = async function (loanId) {
  try {
    const response = await fetch(`/api/admin/loans/${loanId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "returned" }),
    });
    const data = await response.json();

    if (response.ok) {
      alert("Kitap başarıyla iade alındı!");
      loadLoans();
    } else {
      alert("Hata: " + data.message);
    }
  } catch (error) {
    alert("İade işlemi hatası: " + error.message);
  }
}
