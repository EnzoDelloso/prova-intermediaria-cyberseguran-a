
const tabData = {};


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
    blockedRequests: []
  };
}

function getTab(tabId) {
  return tabData[tabId];
}


browser.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId === 0) {
    tabData[details.tabId] = initTabData(details.url);
  }
});


browser.webRequest.onBeforeRequest.addListener(
  (details) => {
    const tab = getTab(details.tabId);
    if (!tab) return;

    const reqHost = hostnameOf(details.url);
    const reqDomain = baseDomain(reqHost);
    const isThirdParty = reqDomain !== tab.mainDomain;

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
          if (value.length < 8) continue;
          const match = tab.cookieValueIndex.find(
            (c) => c.value === value && c.domain !== reqDomain
          );
          if (match) {
            tab.cookieSync.push({
              param: key,
              value,
              originDomain: match.domain,
              destinationDomain: reqDomain,
              url: details.url
            });
          }
        }
      } catch (e) {
      }
    }

    if (typeof CustomBlocklist !== "undefined" && CustomBlocklist.has(reqDomain)) {
      tab.blockedRequests.push(details.url);
      return { cancel: true };
    }
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);

browser.webRequest.onBeforeRedirect.addListener(
  (details) => {
    const tab = getTab(details.tabId);
    if (!tab) return;
    const fromDomain = baseDomain(hostnameOf(details.url));
    const toDomain = baseDomain(hostnameOf(details.redirectUrl));
    if (fromDomain && toDomain && fromDomain !== toDomain) {
      tab.bounceTracking.push({
        from: fromDomain,
        to: toDomain,
        url: details.url,
        redirectUrl: details.redirectUrl,
        statusCode: details.statusCode
      });
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
        const raw = h.value;
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

        if (cookieValue && cookieValue.length >= 8) {
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
      tab.hijackIndicators.push({
        type: "global_object_override",
        detail: msg.detail
      });
      break;

    case "polling_thirdparty":
      tab.hijackIndicators.push({
        type: "polling_persistente_terceiro",
        domain: msg.detail.domain,
        intervalMs: msg.detail.intervalMs,
        detail: "setInterval curto disparando requisições repetidas a um domínio de terceiro (padrão de C2 / hook)"
      });
      break;
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
