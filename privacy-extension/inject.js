(function () {
  function emit(type, detail) {
    window.postMessage({ __privacyExtSource: "inject", type, detail }, "*");
  }

  try {
    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function (...args) {
      emit("canvas_fingerprint", { method: "toDataURL", args: args[0] || null });
      return origToDataURL.apply(this, args);
    };

    const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData = function (...args) {
      emit("canvas_fingerprint", { method: "getImageData" });
      return origGetImageData.apply(this, args);
    };

    const origToBlob = HTMLCanvasElement.prototype.toBlob;
    if (origToBlob) {
      HTMLCanvasElement.prototype.toBlob = function (...args) {
        emit("canvas_fingerprint", { method: "toBlob" });
        return origToBlob.apply(this, args);
      };
    }
  } catch (e) {}

  try {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      let store = "unknown";
      try {
        if (this === window.localStorage) store = "localStorage";
        else if (this === window.sessionStorage) store = "sessionStorage";
      } catch (e) {}
      if (store !== "unknown") {
        emit("storage_write", {
          store,
          key: String(key),
          origin: location.origin
        });
      }
      return originalSetItem.call(this, key, value);
    };
  } catch (e) {}

  try {
    const cookieDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, "cookie");
    if (cookieDescriptor && cookieDescriptor.configurable) {
      Object.defineProperty(document, "cookie", {
        get: cookieDescriptor.get,
        set: function (val) {
          const nameValue = val.split(";")[0];
          const eqIdx = nameValue.indexOf("=");
          if (eqIdx > 0) {
            const name = nameValue.slice(0, eqIdx).trim();
            const value = nameValue.slice(eqIdx + 1);
            const persistent = /(?:^|;)\s*(?:expires|max-age)\s*=/i.test(val);
            emit("cookie_write_js", {
              name,
              value,
              persistent,
              domain: location.hostname
            });
          }
          return cookieDescriptor.set.call(document, val);
        },
        configurable: true
      });
    }
  } catch (e) {}

  try {
    const origOpen = indexedDB.open.bind(indexedDB);
    indexedDB.open = function (...args) {
      emit("indexeddb_open", { name: args[0] });
      return origOpen(...args);
    };
  } catch (e) {}

  try {
    const OrigWebSocket = window.WebSocket;
    const WrappedWebSocket = function (url, protocols) {
      const socket = protocols !== undefined
        ? new OrigWebSocket(url, protocols)
        : new OrigWebSocket(url);
      socket.addEventListener("open", () => {
        emit("websocket_open", { url: String(url) });
      }, { once: true });
      return socket;
    };
    WrappedWebSocket.prototype = OrigWebSocket.prototype;
    WrappedWebSocket.CONNECTING = OrigWebSocket.CONNECTING;
    WrappedWebSocket.OPEN = OrigWebSocket.OPEN;
    WrappedWebSocket.CLOSING = OrigWebSocket.CLOSING;
    WrappedWebSocket.CLOSED = OrigWebSocket.CLOSED;
    window.WebSocket = WrappedWebSocket;
  } catch (e) {}

  try {
    const originalFetch = window.fetch;
    window.fetch = function (input, init) {
      try {
        const rawUrl = typeof input === "string" ? input : input.url;
        emit("network_call", {
          method: "fetch",
          url: new URL(rawUrl, location.href).href
        });
      } catch (e) {}
      return originalFetch.apply(this, arguments);
    };
  } catch (e) {}

  try {
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) {
      try {
        emit("network_call", {
          method: "xhr",
          url: new URL(url, location.href).href
        });
      } catch (e) {}
      return originalOpen.apply(this, arguments);
    };
  } catch (e) {}

  try {
    const criticalRefs = {
      fetch: window.fetch,
      XMLHttpRequest: window.XMLHttpRequest,
      xhrOpen: XMLHttpRequest.prototype.open,
      arrayPush: Array.prototype.push,
      jsonStringify: JSON.stringify,
      functionCall: Function.prototype.call,
      functionApply: Function.prototype.apply,
      appendChild: Element.prototype.appendChild,
      cookieDescriptor: Object.getOwnPropertyDescriptor(Document.prototype, "cookie")
    };

    function checkTampering() {
      if (window.fetch !== criticalRefs.fetch) emit("global_tampering", { objeto: "window.fetch" });
      if (window.XMLHttpRequest !== criticalRefs.XMLHttpRequest) emit("global_tampering", { objeto: "window.XMLHttpRequest" });
      if (XMLHttpRequest.prototype.open !== criticalRefs.xhrOpen) emit("global_tampering", { objeto: "XMLHttpRequest.prototype.open" });
      if (Array.prototype.push !== criticalRefs.arrayPush) emit("global_tampering", { objeto: "Array.prototype.push" });
      if (JSON.stringify !== criticalRefs.jsonStringify) emit("global_tampering", { objeto: "JSON.stringify" });
      if (Function.prototype.call !== criticalRefs.functionCall) emit("global_tampering", { objeto: "Function.prototype.call" });
      if (Function.prototype.apply !== criticalRefs.functionApply) emit("global_tampering", { objeto: "Function.prototype.apply" });
      if (Element.prototype.appendChild !== criticalRefs.appendChild) emit("global_tampering", { objeto: "Element.prototype.appendChild" });
      const currentCookieDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, "cookie");
      if (
        criticalRefs.cookieDescriptor &&
        currentCookieDescriptor &&
        criticalRefs.cookieDescriptor.set !== currentCookieDescriptor.set
      ) {
        emit("global_tampering", { objeto: "document.cookie (setter)" });
      }
    }

    [500, 3000, 8000].forEach((delay) => setTimeout(checkTampering, delay));
  } catch (e) {}
})();
