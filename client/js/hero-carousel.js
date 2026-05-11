document.addEventListener("DOMContentLoaded", () => {
  const slider = document.querySelector('.photo-slider');
  if (!slider) return;

  const imgs = Array.from(slider.querySelectorAll('.photo-track img'));
  if (imgs.length === 0) return;

  // JS kontrollü moda geçir (CSS animasyonunu devre dışı bırakmak için)
  slider.classList.add('js-controlled');

  imgs.forEach((img) => {
    img.style.opacity = '0';
    img.style.transition = 'opacity 600ms ease';
    img.setAttribute('aria-hidden', 'true');
  });

  let current = 0;
  const show = (index) => {
    imgs.forEach((img, i) => {
      if (i === index) {
        img.style.opacity = '1';
        img.setAttribute('aria-hidden', 'false');
      } else {
        img.style.opacity = '0';
        img.setAttribute('aria-hidden', 'true');
      }
    });
  };

  show(0);

  let intervalMs = 3500;
  let intervalId = setInterval(() => {
    current = (current + 1) % imgs.length;
    show(current);
  }, intervalMs);

  // Pause on hover / focus for accessibility
  const pause = () => {
    clearInterval(intervalId);
  };

  const resume = () => {
    clearInterval(intervalId);
    intervalId = setInterval(() => {
      current = (current + 1) % imgs.length;
      show(current);
    }, intervalMs);
  };

  slider.addEventListener('mouseenter', pause);
  slider.addEventListener('mouseleave', resume);
  slider.addEventListener('focusin', pause);
  slider.addEventListener('focusout', resume);
});