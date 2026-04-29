const COUNTS_KEY = 'blockCounts';

function todayKey() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function incrementCount(domain) {
  const today = todayKey();
  const result = await chrome.storage.local.get(COUNTS_KEY);
  let data = result[COUNTS_KEY];

  if (!data || data.date !== today) {
    data = { date: today, counts: {} };
  }

  data.counts[domain] = (data.counts[domain] || 0) + 1;
  await chrome.storage.local.set({ [COUNTS_KEY]: data });
  return data.counts[domain];
}

async function init() {
  const params = new URLSearchParams(window.location.search);
  const domain = params.get('domain');

  if (domain) {
    document.getElementById('domain').textContent = domain;
    const count = await incrementCount(domain);
    document.getElementById('count').textContent = count;
    document.getElementById('count-noun').textContent =
      count === 1 ? 'time' : 'times';
    document.getElementById('count-text').hidden = false;
  }

  document.getElementById('back-btn').addEventListener('click', () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.close();
    }
  });
}

init();
