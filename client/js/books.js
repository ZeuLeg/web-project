// Global kitap verileri
let kitaplar = {};
let tumKitaplar = [];

document.addEventListener("DOMContentLoaded", function () {
  // Sayfayı yükle
  kitaplarıYukle();
});

async function kitaplarıYukle() {
  try {
    const response = await fetch("/api/books");
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setKitapMesaji(data.message || "Kitaplar yüklenemedi.", "error");
      return;
    }

    tumKitaplar = data.books || [];

    // Kitap listesini dinamik oluştur
    renderKitapListesi(tumKitaplar);

    // Kategorileri dinamik oluştur
    renderKategoriler();

    // Kontrol dinleyicilerini ekle
    setupEventListeners();

    // Başlangıçta tüm kitapları göster
    araKitaplar();
  } catch (error) {
    console.error("Kitapları yükleme hatası:", error);
    setKitapMesaji("Kitaplar yüklenemedi. Lütfen sayfayı yenileyin.", "error");
  }
}

function renderKitapListesi(kitapListesi) {
  const kitapKapsayici = document.querySelector(".kitap-listesi");
  if (!kitapKapsayici) return;

  // Önceki kitapları temizle
  kitapKapsayici.innerHTML = "";

  kitapListesi.forEach((book) => {
    const statusClass = book.status === "uygun" ? "uygun" : "dolu";
    const statusText = book.status === "uygun" ? "Rafta" : "Ödünç Alınmış";

    const kart = document.createElement("div");
    kart.className = "kitap-kart";
    kart.innerHTML = `
      <div class="kitap-kapak">📖</div>
      <div class="kitap-detay">
        <h4>${escapeHtml(book.title)}</h4>
        <p class="yazar">${escapeHtml(book.author)}</p>
        <span class="etiket ${statusClass}">${statusText}</span>
      </div>
    `;

    kitapKapsayici.appendChild(kart);

    // Kitap bilgisini sakla
    kitaplar[book.title] = {
      kategori: book.category,
      durum: book.status === "uygun" ? "uygun" : "dolu",
      id: book.id,
    };
  });

  // Checkbox'ları ekle
  checkboxEkle();
}

function renderKategoriler() {
  const filtreAlani = document.querySelector(".filtre-alani");
  if (!filtreAlani) return;

  const kategorilerDiv = filtreAlani.querySelector(".filtre-grubu:first-of-type");
  if (!kategorilerDiv) return;

  // Kategorileri topla
  const kategorilerSet = new Set(tumKitaplar.map((k) => k.category));
  const kategoriler = Array.from(kategorilerSet).sort();

  const labelDonustur = (cat) => {
    const maps = {
      yazilim: "Yazılım & Algoritma",
      siber: "Siber Güvenlik",
      donanim: "Bilgisayar Donanımı",
      edebiyat: "Roman & Edebiyat",
    };
    return maps[cat] || cat;
  };

  // Mevcut checkbox'ları temizle ve yenisini oluştur
  const kategorilabelar = kategorilerDiv.querySelectorAll("label");
  kategorilabelar.forEach((label) => {
    if (label.querySelector("input[name='kategori']")) {
      label.remove();
    }
  });

  kategoriler.forEach((cat) => {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = "kategori";
    input.value = cat;

    label.appendChild(input);
    label.appendChild(document.createTextNode(" " + labelDonustur(cat)));
    kategorilerDiv.appendChild(label);
  });
}

function setupEventListeners() {
  // Arama butonuna tıklama olayı
  const aramaButonu = document.querySelector(".arama-buton");
  if (aramaButonu) {
    aramaButonu.addEventListener("click", araKitaplar);
  }

  // Enter tuşuyla da arama yap
  const aramaInput = document.querySelector(".arama-input");
  if (aramaInput) {
    aramaInput.addEventListener("keypress", function (e) {
      if (e.key === "Enter") {
        araKitaplar();
      }
    });
  }

  // Filtre butonuna tıklama olayı
  const filtreButonu = document.querySelector(".filtre-uygula");
  if (filtreButonu) {
    filtreButonu.addEventListener("click", araKitaplar);
  }

  // Checkbox change event'ini dinle
  document.addEventListener("change", function (e) {
    if (e.target.classList.contains("kitap-checkbox")) {
      const secilenCheckbox = document.querySelectorAll(".kitap-checkbox:checked");

      if (secilenCheckbox.length > 3) {
        e.target.checked = false;
        setKitapMesaji("En fazla 3 kitap seçebilirsin.", "error");
      }

      secimSayisiniGuncelle();
    }
  });

  // Kitap Al butonuna tıklama olayı
  const kitapAlBtn = document.querySelector(".kitap-al-btn");
  if (kitapAlBtn) {
    kitapAlBtn.addEventListener("click", kitapAl);
  }
}

function escapeHtml(text) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

function setKitapMesaji(text, type = "") {
  const message = document.getElementById("kitapMesaji");
  if (!message) return;

  message.textContent = text;
  message.style.color =
    type === "error"
      ? "#ffb3b3"
      : type === "success"
        ? "#8df0bd"
        : "#d7e2ee";
}

function secimSayisiniGuncelle() {
  const secilenCheckbox = document.querySelectorAll(".kitap-checkbox:checked");
  const sayiElement = document.getElementById("secim-sayisi");
  if (sayiElement) {
    sayiElement.textContent = secilenCheckbox.length;
  }
}

function araKitaplar() {
  const aramaMetni = document.querySelector(".arama-input")?.value.toLowerCase().trim() || "";
  const kategoriler = Array.from(document.querySelectorAll('input[name="kategori"]:checked')).map((el) => el.value);
  const durum = document.querySelector('input[name="durum"]:checked')?.value || "hepsi";
  const kartlar = document.querySelectorAll(".kitap-kart");

  kartlar.forEach((kart) => {
    const baslikEl = kart.querySelector("h4");
    const baslik = baslikEl?.textContent.trim() || "";
    const yazarEl = kart.querySelector(".yazar");
    const yazar = yazarEl?.textContent.trim() || "";

    const kitapBilgi = kitaplar[baslik];
    if (!kitapBilgi) return;

    const kitapDurum = kitapBilgi.durum;
    const kitapKategori = kitapBilgi.kategori;

    const aramaUygun = aramaMetni === "" || baslik.toLowerCase().includes(aramaMetni) || yazar.toLowerCase().includes(aramaMetni);
    const durumUygun = durum === "hepsi" || durum === kitapDurum;
    const kategoriUygun = kategoriler.length === 0 || kategoriler.includes(kitapKategori);

    if (aramaUygun && durumUygun && kategoriUygun) {
      kart.style.display = "flex";
    } else {
      kart.style.display = "none";
    }
  });
}

function checkboxEkle() {
  const kitapKartlari = document.querySelectorAll(".kitap-kart");

  kitapKartlari.forEach((kart) => {
    if (kart.querySelector(".kitap-checkbox")) return;

    const kitapAdi = kart.querySelector("h4")?.textContent.trim() || "";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "kitap-checkbox";
    checkbox.dataset.bookName = kitapAdi;
    checkbox.dataset.bookId = kitaplar[kitapAdi]?.id || "";
    checkbox.style.cssText = "margin-right: 10px; cursor: pointer; width: 18px; height: 18px;";

    // Ödünçte olan kitapları disable et
    if (kitaplar[kitapAdi]?.durum === "dolu") {
      checkbox.disabled = true;
    }

    kart.insertBefore(checkbox, kart.firstChild);

    kart.addEventListener("click", (event) => {
      if (event.target === checkbox || event.target.closest("button") || checkbox.disabled) {
        return;
      }

      const secilenCheckbox = document.querySelectorAll(".kitap-checkbox:checked");

      if (!checkbox.checked && secilenCheckbox.length >= 3) {
        setKitapMesaji("En fazla 3 kitap seçebilirsin.", "error");
        return;
      }

      checkbox.checked = !checkbox.checked;
      secimSayisiniGuncelle();
    });
  });
}

function getSavedStudentId() {
  const storedStudentId = localStorage.getItem("studentId");

  if (storedStudentId) {
    return storedStudentId;
  }

  const cookieStudentId = document.cookie.split("; ").find((cookie) => cookie.startsWith("studentId="));

  return cookieStudentId ? decodeURIComponent(cookieStudentId.split("=").slice(1).join("=")) : "";
}

async function kitapAl() {
  const studentId = getSavedStudentId();
  const secilenler = Array.from(document.querySelectorAll(".kitap-checkbox:checked"));
  const bookIds = secilenler.map((checkbox) => Number(checkbox.dataset.bookId)).filter(Boolean);
  const bookTitles = secilenler.map((checkbox) => checkbox.dataset.bookName);

  if (!studentId) {
    setKitapMesaji("Kitap almak için önce giriş yapmalısın.", "error");
    return;
  }

  if (secilenler.length === 0) {
    setKitapMesaji("Lütfen en az bir kitap seçin.", "error");
    return;
  }

  if (secilenler.length > 3) {
    setKitapMesaji("En fazla 3 kitap seçebilirsin.", "error");
    return;
  }

  const button = document.querySelector(".kitap-al-btn");
  button.disabled = true;
  button.textContent = "Kaydediliyor...";
  setKitapMesaji("Kitaplar kaydediliyor...");

  try {
    const response = await fetch("/api/book-loans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, bookIds, bookTitles }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setKitapMesaji(data.message || "Kitaplar kaydedilemedi.", "error");
      button.disabled = false;
      button.textContent = "Kitap Al";
      return;
    }

    setKitapMesaji(data.message || "Kitaplar başarıyla ödünç alındı.", "success");
    secilenler.forEach((checkbox) => {
      checkbox.checked = false;
    });

    // Kitap durumlarını güncelle
    await kitaplarıYukle();
    button.disabled = false;
    button.textContent = "Kitap Al";
  } catch (error) {
    setKitapMesaji("Sunucuya bağlanılamadı. Lütfen tekrar deneyin.", "error");
    button.disabled = false;
    button.textContent = "Kitap Al";
  }
}
