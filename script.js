const headerCta = document.querySelector('.header-cta');
if (headerCta) headerCta.remove();

const primaryExplore = document.querySelector('.hero-actions .button-primary');
if (primaryExplore) primaryExplore.innerHTML = '开始探索 <span aria-hidden="true">↗</span>';

const menuToggle = document.getElementById('menuToggle');
const mainNav = document.getElementById('mainNav');

if (menuToggle && mainNav) {
  menuToggle.addEventListener('click', () => {
    const open = mainNav.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? '关闭导航' : '打开导航');
  });

  mainNav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      mainNav.classList.remove('open');
      menuToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

document.querySelectorAll('.tag').forEach((tag) => {
  tag.addEventListener('click', () => {
    document.querySelectorAll('.tag').forEach((item) => item.classList.remove('active'));
    tag.classList.add('active');
  });
});

const visual = document.querySelector('.hero-visual');
const map = document.querySelector('.atlas-map');

if (visual && map && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  visual.addEventListener('pointermove', (event) => {
    const rect = visual.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    map.style.transform = `translate(calc(-50% + ${x * 8}px), calc(-48% + ${y * 8}px))`;
  });

  visual.addEventListener('pointerleave', () => {
    map.style.transform = 'translate(-50%, -48%)';
  });
}
