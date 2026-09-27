function scoreClass(score) {
  if (score >= 70) return "good";
  if (score >= 40) return "medium";
  return "bad";
}

function renderReport(report) {
  if (report.empty) {
    document.getElementById("mainDomain").textContent = "Sem dados para esta aba. Recarregue a página.";
    return;
  }

  document.getElementById("mainDomain").textContent = report.mainDomain;

  const scoreBox = document.getElementById("scoreBox");
  scoreBox.className = "score-box " + scoreClass(report.score);
  document.getElementById("scoreNum").textContent = report.score;

  document.getElementById("tpCount").textContent = report.thirdPartyDomains.length;
  const tpList = document.getElementById("tpList");
  tpList.innerHTML = "";
  report.thirdPartyDomains.forEach((d) => {
    const li = document.createElement("li");
    li.textContent = d;
    tpList.appendChild(li);
  });

  document.getElementById("c1").textContent =
    `${report.cookies.first.session} / ${report.cookies.first.persistent}`;
  document.getElementById("c3").textContent =
    `${report.cookies.third.session} / ${report.cookies.third.persistent}`;

  document.getElementById("ls").textContent = report.storage.localStorage;
  document.getElementById("ss").textContent = report.storage.sessionStorage;
  document.getElementById("idb").textContent = report.storage.indexedDB;

  setFlag("canvasFlag", report.canvasFingerprint);
  setFlag("bounceFlag", report.bounceTracking.length > 0, report.bounceTracking.length);
  setFlag("syncFlag", report.cookieSync.length > 0, report.cookieSync.length);
  setFlag("hijackFlag", report.hijackIndicators.length > 0, report.hijackIndicators.length);
}

function setFlag(elId, isOn, count) {
  const el = document.getElementById(elId);
  el.className = isOn ? "flag-on" : "flag-off";
  el.textContent = isOn ? `Sim${count ? " (" + count + ")" : ""}` : "Não";
}

function loadBlocklist() {
  browser.runtime.sendMessage({ type: "get_blocklist" }).then((resp) => {
    const container = document.getElementById("blockChips");
    container.innerHTML = "";
    resp.domains.forEach((d) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = d;
      const btn = document.createElement("button");
      btn.textContent = "×";
      btn.onclick = () => {
        browser.runtime.sendMessage({ type: "remove_from_blocklist", domain: d }).then(loadBlocklist);
      };
      chip.appendChild(btn);
      container.appendChild(chip);
    });
  });
}

document.getElementById("blockAddBtn").addEventListener("click", () => {
  const input = document.getElementById("blockInput");
  const domain = input.value.trim();
  if (!domain) return;
  browser.runtime.sendMessage({ type: "add_to_blocklist", domain }).then(() => {
    input.value = "";
    loadBlocklist();
  });
});

browser.runtime.sendMessage({ type: "get_report" }).then(renderReport);
loadBlocklist();
