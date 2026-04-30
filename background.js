const DOMAINS_KEY = 'blockedDomains';
const PENDING_KEY = 'pendingRemovals';
const RULE_ID_OFFSET = 1;
const ALARM_NAME = 'processExpiredRemovals';

function todayInAmsterdam() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

function buildRule(domain, id) {
  const blockedPageUrl = chrome.runtime.getURL(
    `blocked.html?domain=${encodeURIComponent(domain)}`
  );
  const escaped = domain.replace(/\./g, '\\.');

  return {
    id,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: { url: blockedPageUrl }
    },
    condition: {
      regexFilter: `^https?://([^/?#]+\\.)?${escaped}([/?#]|$)`,
      resourceTypes: ['main_frame']
    }
  };
}

async function syncRules(domains) {
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existingRules.map((rule) => rule.id);

  const addRules = domains.map((domain, index) =>
    buildRule(domain, index + RULE_ID_OFFSET)
  );

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules
  });
}

async function processExpiredRemovals() {
  const result = await chrome.storage.sync.get([DOMAINS_KEY, PENDING_KEY]);
  const domains = Array.isArray(result[DOMAINS_KEY]) ? result[DOMAINS_KEY] : [];
  const pending =
    result[PENDING_KEY] && typeof result[PENDING_KEY] === 'object'
      ? result[PENDING_KEY]
      : {};

  const today = todayInAmsterdam();
  const newPending = {};
  let newDomains = [...domains];
  let changed = false;

  for (const [domain, date] of Object.entries(pending)) {
    if (date <= today) {
      const idx = newDomains.indexOf(domain);
      if (idx >= 0) {
        newDomains.splice(idx, 1);
      }
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

  return newDomains;
}

async function loadAndSync() {
  const domains = await processExpiredRemovals();
  await syncRules(domains);
}

function setupAlarm() {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 30 });
}

chrome.runtime.onInstalled.addListener(() => {
  setupAlarm();
  loadAndSync();
});

chrome.runtime.onStartup.addListener(() => {
  setupAlarm();
  loadAndSync();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    loadAndSync();
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;
  if (changes[DOMAINS_KEY] || changes[PENDING_KEY]) {
    loadAndSync();
  }
});

loadAndSync().catch((err) => console.error('[SiteBlocker] sync failed', err));
