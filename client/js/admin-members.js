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

  // Üyeleri yükle
  loadMembers();

  // Arama özelliği
  const searchBar = document.querySelector(".search-bar input");
  if (searchBar) {
    searchBar.addEventListener("keyup", filterMembers);
  }
});

let allMembers = [];

async function loadMembers() {
  try {
    const response = await fetch("/api/admin/members");
    const data = await response.json();

    if (response.ok) {
      allMembers = data.members;
      renderMembersTable(data.members);
    }
  } catch (error) {
    console.error("Üyeleri yükleme hatası:", error);
  }
}

function renderMembersTable(members) {
  const tbody = document.querySelector("table tbody");
  if (!tbody) return;

  tbody.innerHTML = members
    .map(
      (member) => `
    <tr>
      <td>${member.student_id}</td>
      <td>Kullanıcı #${member.id.substring(0, 8)}</td>
      <td>-</td>
      <td>-</td>
      <td><span class="status status-aktif">Aktif</span></td>
      <td><button class="btn btn-edit" onclick="viewMemberProfile('${member.id}')">Profil</button></td>
    </tr>
  `,
    )
    .join("");
}

function filterMembers() {
  const searchTerm = document.querySelector(".search-bar input").value.toLowerCase();
  const filtered = allMembers.filter((m) => m.student_id.toLowerCase().includes(searchTerm));
  renderMembersTable(filtered);
}

function viewMemberProfile(memberId) {
  alert("Üye Detayları:\nID: " + memberId);
}
