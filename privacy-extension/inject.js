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

  ["localStorage", "sessionStorage"].forEach((storeName) => {
    try {
      const store = window[storeName];
      const origSetItem = store.setItem.bind(store);
      store.setItem = function (key, value) {
        emit("storage_write", { store: storeName, key });
        return origSetItem(key, value);
      };
    } catch (e) {
    }
  });

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
      emit("websocket_open", { url });
      return protocols !== undefined
        ? new OrigWebSocket(url, protocols)
        : new OrigWebSocket(url);
    };
    WrappedWebSocket.prototype = OrigWebSocket.prototype;
    WrappedWebSocket.CONNECTING = OrigWebSocket.CONNECTING;
    WrappedWebSocket.OPEN = OrigWebSocket.OPEN;
    WrappedWebSocket.CLOSING = OrigWebSocket.CLOSING;
    WrappedWebSocket.CLOSED = OrigWebSocket.CLOSED;
    window.WebSocket = WrappedWebSocket;
  } catch (e) {}

  try {
    const origSetInterval = window.setInterval;
    window.setInterval = function (fn, interval, ...rest) {
      if (typeof interval === "number" && interval > 0 && interval <= 2000) {
        emit("polling_thirdparty", { intervalMs: interval, domain: location.hostname });
      }
      return origSetInterval(fn, interval, ...rest);
    };
  } catch (e) {}

  try {
    const criticalRefs = {
      fetch: window.fetch,
      XMLHttpRequest: window.XMLHttpRequest,
      cookieDescriptor: Object.getOwnPropertyDescriptor(Document.prototype, "cookie")
    };
    setTimeout(() => {
      if (window.fetch !== criticalRefs.fetch) {
        emit("global_tampering", { objeto: "window.fetch" });
      }
      if (window.XMLHttpRequest !== criticalRefs.XMLHttpRequest) {
        emit("global_tampering", { objeto: "window.XMLHttpRequest" });
      }
      const currentCookieDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, "cookie");
      if (
        criticalRefs.cookieDescriptor &&
        currentCookieDescriptor &&
        criticalRefs.cookieDescriptor.set !== currentCookieDescriptor.set
      ) {
        emit("global_tampering", { objeto: "document.cookie (setter)" });
      }
    }, 3000);
  } catch (e) {}
})();
