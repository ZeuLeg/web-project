let allBooks = [];

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

  // Kitapları yükle
  loadBooks();

  // Yeni kitap ekle butonunu ekle
  const addBtn = document.querySelector(".btn-add");
  if (addBtn) {
    addBtn.addEventListener("click", showAddBookForm);
  }

  // Metin kutusu ve Select menülerini dinlemeye al
  const searchInput = document.querySelector(".search-bar input");
  const selects = document.querySelectorAll(".filters select");

  if (searchInput) searchInput.addEventListener("keyup", window.applyFilters);
  selects.forEach(select => select.addEventListener("change", window.applyFilters));

});

async function loadBooks() {
  try {
    const response = await fetch("/api/admin/books");
    const data = await response.json();

    if (response.ok) {
      allBooks = data.books;
      renderBooksTable(data.books);
    }
  } catch (error) {
    console.error("Kitapları yükleme hatası:", error);
  }
}

function renderBooksTable(books) {
  const tbody = document.querySelector("table tbody");
  if (!tbody) return;

  tbody.innerHTML = books
    .map(
      (book) => `
    <tr>
      <td>${book.id}</td>
      <td>${book.title}</td>
      <td>${book.author}</td>
      <td><span class="status status-${book.status === "Rafta" ? "rafta" : "oduncte"}">${book.status}</span></td>
      <td>
        <button class="btn btn-edit" onclick="editBook(${book.id})">Düzenle</button>
        <button class="btn btn-delete" onclick="deleteBook(${book.id})">Sil</button>
      </td>
    </tr>
  `,
    )
    .join("");
}

function showAddBookForm() {
  const title = prompt("Kitap adı:");
  if (!title) return;

  const author = prompt("Yazar:");
  if (!author) return;

  const category = prompt("Kategori (edebiyat/yazilim/siber/donanim):");
  if (!category) return;

  addBook(title, author, category);
}

async function addBook(title, author, category) {
  try {
    const response = await fetch("/api/admin/books", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, author, category }),
    });
    const data = await response.json();

    if (response.ok) {
      alert("Kitap başarıyla eklendi!");
      loadBooks();
    } else {
      alert("Hata: " + data.message);
    }
  } catch (error) {
    alert("Kitap ekleme hatası: " + error.message);
  }
}

window.editBook = async function (bookId) {
  const book = allBooks.find((b) => b.id === bookId);
  if (!book) return;

  const title = prompt("Kitap adı:", book.title);
  if (!title) return;

  const author = prompt("Yazar:", book.author);
  if (!author) return;

  const category = prompt("Kategori:", book.category);
  if (!category) return;

  updateBook(bookId, title, author, category);
}

async function updateBook(bookId, title, author, category) {
  try {
    const response = await fetch(`/api/admin/books/${bookId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, author, category }),
    });
    const data = await response.json();

    if (response.ok) {
      alert("Kitap başarıyla güncellendi!");
      loadBooks();
    } else {
      alert("Hata: " + data.message);
    }
  } catch (error) {
    alert("Kitap güncelleme hatası: " + error.message);
  }
}

window.deleteBook = async function (bookId) {
  if (!confirm("Bu kitabı silmek istediğinize emin misiniz?")) return;

  try {
    const response = await fetch(`/api/admin/books/${bookId}`, {
      method: "DELETE",
    });
    const data = await response.json();

    if (response.ok) {
      alert("Kitap başarıyla silindi!");
      loadBooks();
    } else {
      alert("Hata: " + data.message);
    }
  } catch (error) {
    alert("Kitap silme hatası: " + error.message);
  }
}

window.applyFilters = function () {
  const searchInput = document.querySelector(".search-bar input");
  const selects = document.querySelectorAll(".filters select");

  const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";
  const categoryFilter = selects[0] ? selects[0].value : "Tüm Kategoriler";
  const statusFilter = selects[1] ? selects[1].value : "Tüm Durumlar";

  const filtered = allBooks.filter((book) => {
    // 1. Metin Araması
    const matchText = (book.title && book.title.toLowerCase().includes(searchTerm)) ||
      (book.author && book.author.toLowerCase().includes(searchTerm));

    // 2. Kategori Filtresi
    const matchCategory = categoryFilter === "Tüm Kategoriler" ||
      (book.category && book.category.toLowerCase() === categoryFilter.toLowerCase());

    // 3. Durum Filtresi (Backend 'Rafta' veya 'Ödünçte' döndürüyor)
    const matchStatus = statusFilter === "Tüm Durumlar" || book.status === statusFilter;

    return matchText && matchCategory && matchStatus;
  });

  renderBooksTable(filtered);
}
