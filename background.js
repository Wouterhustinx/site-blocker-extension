const STORAGE_KEY = 'blockedDomains';
const RULE_ID_OFFSET = 1;

function buildRule(domain, id) {
  const blockedPageUrl = chrome.runtime.getURL(
    `blocked.html?domain=${encodeURIComponent(domain)}`
  );

  return {
    id,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: { url: blockedPageUrl }
    },
    condition: {
      requestDomains: [domain],
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

async function loadAndSync() {
  const result = await chrome.storage.sync.get(STORAGE_KEY);
  const domains = Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
  await syncRules(domains);
}

chrome.runtime.onInstalled.addListener(() => {
  loadAndSync();
});

chrome.runtime.onStartup.addListener(() => {
  loadAndSync();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes[STORAGE_KEY]) {
    const domains = Array.isArray(changes[STORAGE_KEY].newValue)
      ? changes[STORAGE_KEY].newValue
      : [];
    syncRules(domains);
  }
});
