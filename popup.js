const STORAGE_KEY = 'blockedDomains';
const COUNTS_KEY = 'blockCounts';

function todayKey() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function getTodayCounts() {
  const result = await chrome.storage.local.get(COUNTS_KEY);
  const data = result[COUNTS_KEY];
  if (!data || data.date !== todayKey()) return {};
  return data.counts || {};
}

const form = document.getElementById('add-form');
const input = document.getElementById('domain-input');
const list = document.getElementById('blocked-list');
const emptyState = document.getElementById('empty-state');
const errorEl = document.getElementById('error');

function normalizeDomain(value) {
  let domain = value.trim().toLowerCase();
  domain = domain.replace(/^https?:\/\//, '');
  domain = domain.replace(/^www\./, '');
  domain = domain.split('/')[0];
  return domain;
}

function isValidDomain(domain) {
  return /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(domain);
}

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = false;
}

function clearError() {
  errorEl.textContent = '';
  errorEl.hidden = true;
}

async function getDomains() {
  const result = await chrome.storage.sync.get(STORAGE_KEY);
  return Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
}

async function setDomains(domains) {
  await chrome.storage.sync.set({ [STORAGE_KEY]: domains });
}

function render(domains, counts) {
  list.innerHTML = '';
  if (domains.length === 0) {
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;

  for (const domain of domains) {
    const li = document.createElement('li');

    const info = document.createElement('div');
    info.className = 'info';

    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = domain;
    info.appendChild(name);

    const count = counts[domain] || 0;
    const countEl = document.createElement('span');
    countEl.className = 'count';
    countEl.textContent =
      count === 0 ? '0 today' : `${count} ${count === 1 ? 'try' : 'tries'} today`;
    info.appendChild(countEl);

    li.appendChild(info);

    const btn = document.createElement('button');
    btn.className = 'remove-btn';
    btn.textContent = '×';
    btn.title = `Remove ${domain}`;
    btn.addEventListener('click', () => removeDomain(domain));
    li.appendChild(btn);

    list.appendChild(li);
  }
}

async function refresh() {
  const [domains, counts] = await Promise.all([getDomains(), getTodayCounts()]);
  render(domains, counts);
}

async function addDomain(rawValue) {
  clearError();
  const domain = normalizeDomain(rawValue);

  if (!domain) {
    showError('Please enter a domain.');
    return;
  }
  if (!isValidDomain(domain)) {
    showError('Please enter a valid domain (e.g. reddit.com).');
    return;
  }

  const domains = await getDomains();
  if (domains.includes(domain)) {
    showError('That domain is already blocked.');
    return;
  }

  domains.push(domain);
  domains.sort();
  await setDomains(domains);
  await refresh();
  input.value = '';
}

async function removeDomain(domain) {
  const domains = await getDomains();
  const next = domains.filter((d) => d !== domain);
  await setDomains(next);
  await refresh();
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  addDomain(input.value);
});

document.addEventListener('DOMContentLoaded', refresh);
