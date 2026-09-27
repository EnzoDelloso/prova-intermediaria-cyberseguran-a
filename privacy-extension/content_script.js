(function () {
  const script = document.createElement("script");
  script.src = browser.runtime.getURL("inject.js");
  script.onload = function () {
    this.remove();
  };
  (document.head || document.documentElement).appendChild(script);

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.__privacyExtSource !== "inject") return;
    try {
      browser.runtime.sendMessage({ type: data.type, detail: data.detail });
    } catch (e) {
    }
  });
})();
