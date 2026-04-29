const DOMAINS_KEY = 'blockedDomains';
const PENDING_KEY = 'pendingRemovals';
const COUNTS_KEY = 'blockCounts';

const form = document.getElementById('add-form');
const input = document.getElementById('domain-input');
const list = document.getElementById('blocked-list');
const emptyState = document.getElementById('empty-state');
const errorEl = document.getElementById('error');

function todayInAmsterdam() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

function tomorrowInAmsterdam() {
  const today = todayInAmsterdam();
  const [y, m, d] = today.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const yyyy = next.getUTCFullYear();
  const mm = String(next.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(next.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function todayLocalKey() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

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
  const result = await chrome.storage.sync.get(DOMAINS_KEY);
  return Array.isArray(result[DOMAINS_KEY]) ? result[DOMAINS_KEY] : [];
}

async function getPending() {
  const result = await chrome.storage.sync.get(PENDING_KEY);
  return result[PENDING_KEY] && typeof result[PENDING_KEY] === 'object'
    ? result[PENDING_KEY]
    : {};
}

async function getTodayCounts() {
  const result = await chrome.storage.local.get(COUNTS_KEY);
  const data = result[COUNTS_KEY];
  if (!data || data.date !== todayLocalKey()) return {};
  return data.counts || {};
}

async function processExpiredRemovals() {
  const [domains, pending] = await Promise.all([getDomains(), getPending()]);
  const today = todayInAmsterdam();
  const newPending = {};
  const newDomains = [...domains];
  let changed = false;

  for (const [domain, date] of Object.entries(pending)) {
    if (date <= today) {
      const idx = newDomains.indexOf(domain);
      if (idx >= 0) newDomains.splice(idx, 1);
      changed = true;
    } else {
      newPending[domain] = date;
    }
  }

  if (changed) {
    await chrome.storage.sync.set({
      [DOMAINS_KEY]: newDomains,
      [PENDING_KEY]: newPending
    });
  }
  return { domains: newDomains, pending: newPending };
}

function render({ domains, pending, counts }) {
  list.innerHTML = '';
  if (domains.length === 0) {
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;

  for (const domain of domains) {
    const li = document.createElement('li');
    const isPending = !!pending[domain];
    if (isPending) li.classList.add('pending');

    const info = document.createElement('div');
    info.className = 'info';

    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = domain;
    info.appendChild(name);

    const meta = document.createElement('span');
    meta.className = 'count';
    if (isPending) {
      meta.textContent = `Removes tomorrow (${pending[domain]} AMS)`;
    } else {
      const count = counts[domain] || 0;
      meta.textContent =
        count === 0
          ? '0 today'
          : `${count} ${count === 1 ? 'try' : 'tries'} today`;
    }
    info.appendChild(meta);
    li.appendChild(info);

    const btn = document.createElement('button');
    btn.className = 'remove-btn';
    if (isPending) {
      btn.textContent = 'Undo';
      btn.title = `Cancel removal of ${domain}`;
      btn.addEventListener('click', () => cancelRemoval(domain));
    } else {
      btn.textContent = '×';
      btn.title = `Remove ${domain}`;
      btn.addEventListener('click', () => scheduleRemoval(domain));
    }
    li.appendChild(btn);

    list.appendChild(li);
  }
}

async function refresh() {
  const { domains, pending } = await processExpiredRemovals();
  const counts = await getTodayCounts();
  render({ domains, pending, counts });
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

  const [domains, pending] = await Promise.all([getDomains(), getPending()]);

  if (domains.includes(domain)) {
    if (pending[domain]) {
      delete pending[domain];
      await chrome.storage.sync.set({ [PENDING_KEY]: pending });
      await refresh();
      input.value = '';
      return;
    }
    showError('That domain is already blocked.');
    return;
  }

  domains.push(domain);
  domains.sort();
  await chrome.storage.sync.set({ [DOMAINS_KEY]: domains });
  await refresh();
  input.value = '';
}

async function scheduleRemoval(domain) {
  const pending = await getPending();
  pending[domain] = tomorrowInAmsterdam();
  await chrome.storage.sync.set({ [PENDING_KEY]: pending });
  await refresh();
}

async function cancelRemoval(domain) {
  const pending = await getPending();
  delete pending[domain];
  await chrome.storage.sync.set({ [PENDING_KEY]: pending });
  await refresh();
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  addDomain(input.value);
});

document.addEventListener('DOMContentLoaded', refresh);
