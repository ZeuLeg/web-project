async function fetchBooksAndRender() {
  const track = document.getElementById("announceTrack");
  if (!track) return;

  try {
    const res = await fetch("/api/books");
    if (!res.ok) return;
    const data = await res.json().catch(() => ({}));
    const books = Array.isArray(data.books) ? data.books : [];

    // Temizle
    track.innerHTML = "";

    // Eğer az kayıt varsa, kopyalayarak kaydırma efekti daha düzgün olur
    const items = books.map((b) => {
      const div = document.createElement("div");
      div.className = "announcement-vertical-item";
      div.textContent = `${b.title} — ${b.author}`;
      return div;
    });

    // En az 6 öğe yoksa, döngü için kopya ekle
    items.forEach((i) => track.appendChild(i));
    if (items.length > 0 && items.length < 6) {
      // kopyala
      items.forEach((i) => track.appendChild(i.cloneNode(true)));
    }
  } catch (e) {
    // Sessiz hata, frontend olduğu için kullanıcıya küçük bir fallback bırakıyoruz
    console.error("Duyurular alınamadı", e);
  }
}

// İlk yükleme
fetchBooksAndRender();

// Periyodik güncelleme (ör: 20 saniye)
setInterval(fetchBooksAndRender, 20000);
