document.addEventListener("DOMContentLoaded", () => {
  const slider = document.querySelector('.photo-slider');
  if (!slider) return;

  const track = slider.querySelector('.photo-track');
  if (!track) return;

  let imgs = Array.from(track.querySelectorAll('img'));
  if (imgs.length === 0) return;

  // JS kontrollü moda geçir (CSS animasyonlarını devre dışı bırakmak için)
  slider.classList.add('js-controlled', 'scroll');

  // Track'i yatay kaydırma için düzenle: img'leri flex ile yan yana koy
  track.style.display = 'flex';
  track.style.flexWrap = 'nowrap';
  track.style.alignItems = 'stretch';

  imgs.forEach((img) => {
    img.style.width = '100%';
    img.style.flex = '0 0 100%';
    img.style.objectFit = 'cover';
  });

  // İçeriği kopyalayarak kesintisiz döngü oluştur
  const clones = imgs.map((img) => img.cloneNode(true));
  clones.forEach((c) => track.appendChild(c));

  // Yeniden hesaplama fonksiyonu
  let singleWidth = null;
  function recalc() {
    // Tek set genişliği = toplam / 2
    singleWidth = track.scrollWidth / 2;
  }

  recalc();
  window.addEventListener('resize', recalc);

  // Animasyon kontrolü: requestAnimationFrame ile sabit hızda sola kaydır
  let start = null;
  const speed = 40; // px per second
  let paused = false;
  let offset = 0;

  function step(ts) {
    if (!start) start = ts;
    const dt = ts - start;
    start = ts;

    if (!paused) {
      offset += (speed * dt) / 1000;
      if (singleWidth && offset >= singleWidth) {
        offset = offset - singleWidth;
      }
      track.style.transform = `translateX(-${offset}px)`;
    }

    requestAnimationFrame(step);
  }

  requestAnimationFrame(step);

  const pause = () => (paused = true);
  const resume = () => (paused = false);

  slider.addEventListener('mouseenter', pause);
  slider.addEventListener('mouseleave', resume);
  slider.addEventListener('focusin', pause);
  slider.addEventListener('focusout', resume);
});