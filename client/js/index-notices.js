async function renderHomeAnnouncements() {
  const container = document.getElementById("homeAnnouncements");
  if (!container) return;

  try {
    const res = await fetch("/api/books");
    if (!res.ok) return;
    const data = await res.json().catch(() => ({}));
    const books = Array.isArray(data.books) ? data.books : [];

    // Eğer kitap yoksa, bırak
    if (books.length === 0) return;

    // Sadece ilk 6 göster
    const slice = books.slice(0, 6);

    // Temizle ve ekle (link olarak notice sayfasına yönlendirir)
    container.innerHTML = "";
    slice.forEach((b) => {
      const a = document.createElement("a");
      a.href = "./pages/notice.html";
      a.className = "me-2";
      a.textContent = `${b.title} — ${b.author}`;
      container.appendChild(a);
    });

    // Eğer daha fazla kitap varsa, sonuna kısaca sayı göster
    if (books.length > slice.length) {
      const more = document.createElement("span");
      more.style.opacity = "0.85";
      more.textContent = `+${books.length - slice.length} daha`;
      container.appendChild(more);
    }
  } catch (e) {
    console.error("Ana sayfa duyuruları yüklenemedi", e);
  }
}

renderHomeAnnouncements();
setInterval(renderHomeAnnouncements, 30000);
