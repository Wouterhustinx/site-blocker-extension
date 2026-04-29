const STORAGE_KEY = 'blockedDomains';

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

function render(domains) {
  list.innerHTML = '';
  if (domains.length === 0) {
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;

  for (const domain of domains) {
    const li = document.createElement('li');

    const span = document.createElement('span');
    span.textContent = domain;
    li.appendChild(span);

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
  const domains = await getDomains();
  render(domains);
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
  render(domains);
  input.value = '';
}

async function removeDomain(domain) {
  const domains = await getDomains();
  const next = domains.filter((d) => d !== domain);
  await setDomains(next);
  render(next);
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  addDomain(input.value);
});

document.addEventListener('DOMContentLoaded', refresh);
