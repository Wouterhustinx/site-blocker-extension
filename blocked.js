const params = new URLSearchParams(window.location.search);
const domain = params.get('domain');
if (domain) {
  document.getElementById('domain').textContent = domain;
}

document.getElementById('back-btn').addEventListener('click', () => {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    window.close();
  }
});
