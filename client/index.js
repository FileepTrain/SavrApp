if (typeof globalThis !== "undefined" && typeof window !== "undefined") {
  const g = globalThis;
  if (!g.expo) {
    g.expo = {};
  }
  if (!g.expo.modules) {
    g.expo.modules = {};
  }
  if (!g.expo.EventEmitter) {
    g.expo.EventEmitter = class {
      addListener() {
        return { remove() {} };
      }
      removeAllListeners() {}
      removeSubscription() {}
      emit() {}
    };
  }
  if (!g.expo.NativeModule) {
    g.expo.NativeModule = class extends g.expo.EventEmitter {};
  }
  if (!g.expo.SharedObject) {
    g.expo.SharedObject = class extends g.expo.EventEmitter {};
  }
  if (!g.expo.SharedRef) {
    g.expo.SharedRef = class extends g.expo.SharedObject {};
  }
}

require("expo-router/entry");
