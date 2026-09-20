document.querySelectorAll('.language-switch').forEach(link => {
  const target = new URL(link.href);
  target.search = window.location.search;
  target.hash = window.location.hash;
  link.href = target.href;
});
