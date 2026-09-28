const tabData = {};
const navigationChains = {};

const TRACKING_QUERY_PARAM = /^(?:utm_.+|fbclid|gclid|dclid|msclkid|mc_eid|igshid|yclid|ttclid|twclid|click_?id|campaign_?id|affiliate_?id|aff_?id|tracking_?id|user_?id|visitor_?id|session_?id)$/i;

function hostnameOf(url) {
  try {
    return new URL(url).hostname;
  } catch (e) {
    return null;
  }
}

function baseDomain(hostname) {
  if (!hostname) return hostname;
  const parts = hostname.split(".");
  if (parts.length <= 2) return hostname;
  const knownSecondLevel = ["com.br", "co.uk", "com.au", "edu.br", "gov.br", "org.br", "net.br"];
  const lastTwo = parts.slice(-2).join(".");
  if (knownSecondLevel.includes(lastTwo) && parts.length >= 3) {
    return parts.slice(-3).join(".");
  }
  return lastTwo;
}

function hostMatchesBlockEntry(host, entry) {
  if (!host || !entry) return false;
  return host === entry || host.endsWith("." + entry);
}

function isHostBlocked(host) {
  if (typeof CustomBlocklist === "undefined") return false;
  for (const entry of CustomBlocklist.domains) {
    if (hostMatchesBlockEntry(host, entry)) return true;
  }
  return false;
}

function initTabData(url) {
  return {
    mainUrl: url,
    mainDomain: baseDomain(hostnameOf(url)),
    thirdPartyDomains: new Set(),
    requests: [],
    cookies: {
      first: { session: 0, persistent: 0 },
      third: { session: 0, persistent: 0 }
    },
    cookieDetails: [],
    storage: { localStorage: 0, sessionStorage: 0, indexedDB: 0 },
    canvasFingerprint: false,
    canvasEvents: [],
    bounceTracking: [],
    cookieSync: [],
    hijackIndicators: [],
    cookieValueIndex: [],
    blockedRequests: [],
    networkCallIndex: {},
    pendingRedirectUrl: null
  };
}

function getTab(tabId) {
  return tabData[tabId];
}

function addUniqueBounce(tab, event) {
  const duplicate = tab.bounceTracking.some(
    (item) => item.from === event.from && item.to === event.to && item.via === event.via
  );
  if (!duplicate) tab.bounceTracking.push(event);
}

function restoreNavigationDetections(tabId, tab) {
  const chain = navigationChains[tabId];
  if (!chain) return;

  for (const event of chain.queryEvents || []) {
    const duplicate = tab.cookieSync.some(
      (item) => item.type === event.type && item.param === event.param && item.url === event.url
    );
    if (!duplicate) tab.cookieSync.push(event);
  }

  for (const event of chain.bounceEvents || []) {
    addUniqueBounce(tab, event);
  }
}

function trackTopLevelNavigation(details, tab) {
  if (details.type !== "main_frame") return;
  const domain = baseDomain(hostnameOf(details.url));
  if (!domain) return;

  const now = Date.now();
  let chain = navigationChains[details.tabId];
  if (!chain || now - chain.updatedAt > 300000) {
    chain = { domains: [], urls: [], queryEvents: [], bounceEvents: [], updatedAt: now };
  }
  if (!chain.queryEvents) chain.queryEvents = [];
  if (!chain.bounceEvents) chain.bounceEvents = [];

  const lastDomain = chain.domains[chain.domains.length - 1];
  if (domain !== lastDomain) {
    chain.domains.push(domain);
    chain.urls.push(details.url);
    if (chain.domains.length > 6) {
      chain.domains.shift();
      chain.urls.shift();
    }
  }
  chain.updatedAt = now;
  navigationChains[details.tabId] = chain;

  restoreNavigationDetections(details.tabId, tab);

  if (chain.domains.length >= 3) {
    const n = chain.domains.length;
    const from = chain.domains[n - 3];
    const via = chain.domains[n - 2];
    const to = chain.domains[n - 1];
    if (from !== via && via !== to) {
      const event = {
        from,
        via,
        to,
        url: chain.urls[n - 2],
        redirectUrl: chain.urls[n - 1],
        tipo: "cadeia de navegação entre sites"
      };
      addUniqueBounce(tab, event);
      const stored = chain.bounceEvents.some(
        (item) => item.from === event.from && item.via === event.via && item.to === event.to
      );
      if (!stored) chain.bounceEvents.push(event);
    }
  }
}

function detectTrackingQueryParameters(tab, details, reqDomain) {
  try {
    const url = new URL(details.url);
    for (const [key, value] of url.searchParams.entries()) {
      if (!TRACKING_QUERY_PARAM.test(key) || !value) continue;
      const duplicate = tab.cookieSync.some(
        (item) => item.type === "tracking_query_parameter" &&
          item.param === key && item.url === details.url
      );
      if (!duplicate) {
        const event = {
          type: "tracking_query_parameter",
          param: key,
          value,
          destinationDomain: reqDomain,
          url: details.url
        };
        tab.cookieSync.push(event);
        const chain = navigationChains[details.tabId];
        if (chain) chain.queryEvents.push(event);
      }
    }
  } catch (e) {}
}

browser.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId === 0) {
    const current = getTab(details.tabId);
    const isKnownRedirect =
      current &&
      current.pendingRedirectUrl &&
      current.pendingRedirectUrl === details.url;

    if (isKnownRedirect) {
      current.pendingRedirectUrl = null;
    } else {
      tabData[details.tabId] = initTabData(details.url);
    }
  }
});

browser.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId !== 0) return;
  const tab = getTab(details.tabId);
  if (!tab) return;
  restoreNavigationDetections(details.tabId, tab);
  tab.lastCommittedUrl = details.url;
});

browser.webRequest.onBeforeRequest.addListener(
  (details) => {
    const reqHost = hostnameOf(details.url);
    if (isHostBlocked(reqHost)) {
      const blockedTab = getTab(details.tabId);
      if (blockedTab) blockedTab.blockedRequests.push(details.url);
      return { cancel: true };
    }

    const tab = getTab(details.tabId);
    if (!tab) return;

    const reqDomain = baseDomain(reqHost);
    const isThirdParty = Boolean(reqDomain && reqDomain !== tab.mainDomain);

    trackTopLevelNavigation(details, tab);
    detectTrackingQueryParameters(tab, details, reqDomain);

    if (isThirdParty) {
      tab.thirdPartyDomains.add(reqDomain);
    }

    tab.requests.push({
      url: details.url,
      domain: reqDomain,
      thirdParty: isThirdParty,
      type: details.type,
      timeStamp: details.timeStamp
    });

    if (isThirdParty) {
      try {
        const u = new URL(details.url);
        for (const [key, value] of u.searchParams.entries()) {
          if (value.length < 4) continue;
          const match = tab.cookieValueIndex.find(
            (c) => c.value === value && c.domain !== reqDomain
          );
          const alreadyRecorded = tab.cookieSync.some(
            (item) => item.param === key && item.url === details.url
          );
          if (match && !alreadyRecorded) {
            tab.cookieSync.push({
              param: key,
              value,
              originDomain: match.domain,
              destinationDomain: reqDomain,
              url: details.url
            });
          }
        }
      } catch (e) {}
    }

  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);

browser.webRequest.onBeforeRedirect.addListener(
  (details) => {
    const tab = getTab(details.tabId);
    if (!tab || details.type !== "main_frame") return;
    const fromDomain = baseDomain(hostnameOf(details.url));
    const toDomain = baseDomain(hostnameOf(details.redirectUrl));
    if (fromDomain && toDomain && fromDomain !== toDomain) {
      tab.pendingRedirectUrl = details.redirectUrl;
    }
  },
  { urls: ["<all_urls>"] }
);

browser.webRequest.onHeadersReceived.addListener(
  (details) => {
    const tab = getTab(details.tabId);
    if (!tab || !details.responseHeaders) return;

    const reqDomain = baseDomain(hostnameOf(details.url));
    const isThirdParty = reqDomain !== tab.mainDomain;

    details.responseHeaders
      .filter((h) => h.name.toLowerCase() === "set-cookie")
      .forEach((h) => {
        const raw = h.value || "";
        const isPersistent = /(expires=|max-age=)/i.test(raw);
        const bucket = isThirdParty ? tab.cookies.third : tab.cookies.first;
        if (isPersistent) bucket.persistent++;
        else bucket.session++;

        const nameValue = raw.split(";")[0];
        const eqIdx = nameValue.indexOf("=");
        const cookieName = eqIdx >= 0 ? nameValue.slice(0, eqIdx) : nameValue;
        const cookieValue = eqIdx >= 0 ? nameValue.slice(eqIdx + 1) : "";

        tab.cookieDetails.push({
          name: cookieName,
          domain: reqDomain,
          thirdParty: isThirdParty,
          persistent: isPersistent
        });

        if (cookieValue && cookieValue.length >= 4) {
          tab.cookieValueIndex.push({ value: cookieValue, domain: reqDomain, ts: Date.now() });
        }
      });
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);

browser.runtime.onMessage.addListener((msg, sender) => {
  if (!sender.tab) return;
  const tab = getTab(sender.tab.id);
  if (!tab) return;

  switch (msg.type) {
    case "canvas_fingerprint":
      tab.canvasFingerprint = true;
      tab.canvasEvents.push(msg.detail);
      break;

    case "storage_write":
      if (msg.detail.store === "localStorage") tab.storage.localStorage++;
      else if (msg.detail.store === "sessionStorage") tab.storage.sessionStorage++;
      break;

    case "indexeddb_open":
      tab.storage.indexedDB++;
      break;

    case "cookie_write_js": {
      const domain = baseDomain(msg.detail.domain);
      const isThirdParty = domain !== tab.mainDomain;
      const bucket = isThirdParty ? tab.cookies.third : tab.cookies.first;
      const persistent = Boolean(msg.detail.persistent);
      if (persistent) bucket.persistent++;
      else bucket.session++;
      tab.cookieDetails.push({
        name: msg.detail.name || "(via JS)",
        domain,
        thirdParty: isThirdParty,
        persistent
      });
      if (msg.detail.value && msg.detail.value.length >= 4) {
        tab.cookieValueIndex.push({ value: msg.detail.value, domain, ts: Date.now() });
      }
      break;
    }

    case "websocket_open": {
      const wsDomain = baseDomain(hostnameOf(msg.detail.url));
      if (wsDomain && wsDomain !== tab.mainDomain) {
        tab.hijackIndicators.push({
          type: "websocket_terceiro",
          domain: wsDomain,
          detail: "WebSocket persistente aberto para domínio de terceiro após o carregamento da página"
        });
      }
      break;
    }

    case "global_tampering":
      if (!tab.hijackIndicators.some(
        (item) => item.type === "global_object_override" &&
          item.detail && item.detail.objeto === msg.detail.objeto
      )) {
        tab.hijackIndicators.push({
          type: "global_object_override",
          detail: msg.detail
        });
      }
      break;

    case "network_call": {
      const destination = baseDomain(hostnameOf(msg.detail.url));
      if (!destination || destination === tab.mainDomain) break;

      const key = msg.detail.method + "|" + msg.detail.url.split("?")[0];
      const now = Date.now();
      const previous = (tab.networkCallIndex[key] || []).filter((ts) => now - ts <= 15000);
      previous.push(now);
      tab.networkCallIndex[key] = previous;

      const repeatedOverTime = previous.length >= 3 && now - previous[0] >= 1000;
      const alreadyReported = tab.hijackIndicators.some(
        (item) => item.type === "polling_persistente_terceiro" && item.key === key
      );
      if (repeatedOverTime && !alreadyReported) {
        tab.hijackIndicators.push({
          type: "polling_persistente_terceiro",
          key,
          domain: destination,
          detail: "A mesma chamada de rede para terceiro ocorreu ao menos 3 vezes durante mais de 1 segundo"
        });
      }
      break;
    }
  }
});

function computeScore(tab) {
  let score = 100;
  score -= tab.thirdPartyDomains.size * 3;
  score -= tab.cookies.third.session * 1;
  score -= tab.cookies.third.persistent * 4;
  score -= tab.canvasFingerprint ? 15 : 0;
  score -= tab.bounceTracking.length * 5;
  score -= tab.cookieSync.length * 8;
  score -= tab.storage.indexedDB * 2;
  score -= tab.hijackIndicators.length * 10;
  return Math.max(0, Math.min(100, Math.round(score)));
}

browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "get_report") {
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      const tab = tabs[0];
      const data = getTab(tab.id);
      if (!data) {
        sendResponse({ empty: true });
        return;
      }
      sendResponse({
        mainDomain: data.mainDomain,
        thirdPartyDomains: Array.from(data.thirdPartyDomains),
        totalRequests: data.requests.length,
        cookies: data.cookies,
        cookieDetails: data.cookieDetails,
        storage: data.storage,
        canvasFingerprint: data.canvasFingerprint,
        canvasEvents: data.canvasEvents,
        bounceTracking: data.bounceTracking,
        cookieSync: data.cookieSync,
        hijackIndicators: data.hijackIndicators,
        blockedRequests: data.blockedRequests,
        score: computeScore(data)
      });
    });
    return true;
  }

  if (msg.type === "add_to_blocklist") {
    CustomBlocklist.add(msg.domain).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (msg.type === "remove_from_blocklist") {
    CustomBlocklist.remove(msg.domain).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (msg.type === "get_blocklist") {
    sendResponse({ domains: Array.from(CustomBlocklist.domains) });
  }
});

browser.tabs.onRemoved.addListener((tabId) => {
  delete tabData[tabId];
  delete navigationChains[tabId];
});
