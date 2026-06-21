// Polyfill para Map.prototype.getOrInsert / getOrInsertComputed y WeakMap equivalents.
// Requerido por pdfjs-dist v5 en Safari iOS / macOS < 18.4 donde estos métodos
// (propuesta TC39 stage 3) aún no están implementados nativamente.

type AnyMap = Map<unknown, unknown> | WeakMap<object, unknown>;

function install(proto: AnyMap) {
  const p = proto as unknown as {
    getOrInsert?: (k: unknown, v: unknown) => unknown;
    getOrInsertComputed?: (k: unknown, fn: (k: unknown) => unknown) => unknown;
    get: (k: unknown) => unknown;
    has: (k: unknown) => boolean;
    set: (k: unknown, v: unknown) => unknown;
  };
  if (typeof p.getOrInsert !== "function") {
    p.getOrInsert = function (key: unknown, value: unknown) {
      if (this.has(key)) return this.get(key);
      this.set(key, value);
      return value;
    };
  }
  if (typeof p.getOrInsertComputed !== "function") {
    p.getOrInsertComputed = function (key: unknown, callback: (k: unknown) => unknown) {
      if (this.has(key)) return this.get(key);
      const value = callback(key);
      this.set(key, value);
      return value;
    };
  }
}

let installed = false;
export function ensurePdfJsPolyfills() {
  if (installed) return;
  installed = true;
  try {
    install(Map.prototype as unknown as AnyMap);
    install(WeakMap.prototype as unknown as AnyMap);
  } catch {
    // ignore
  }
}
