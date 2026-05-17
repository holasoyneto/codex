/* CODEX module loader — Phase 0.2
 * Loads JSON study modules (lexicons, cross-refs, commentaries, ...) with
 * IndexedDB caching. Pure browser JS, no deps. Also exports for Node/CLI.
 */
(function () {
  "use strict";

  var DB_NAME = "codex-modules";
  var STORE = "modules";
  var DB_VERSION = 1;
  var VALID_TYPES = [
    "lexicon", "concordance", "cross-reference", "commentary",
    "reading-plan", "timeline", "map-overlay", "dictionary",
    "parsha", "cantillation"
  ];

  // ---------- IndexedDB tiny promise wrapper ----------
  function openDB() {
    return new Promise(function (resolve, reject) {
      if (typeof indexedDB === "undefined") {
        return reject(new Error("indexedDB unavailable"));
      }
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "meta.id" });
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function idbTx(mode, fn) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, mode);
        var store = tx.objectStore(STORE);
        var result;
        Promise.resolve(fn(store)).then(function (r) { result = r; }, reject);
        tx.oncomplete = function () { resolve(result); };
        tx.onerror = function () { reject(tx.error); };
        tx.onabort = function () { reject(tx.error); };
      });
    });
  }

  function idbReq(req) {
    return new Promise(function (resolve, reject) {
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function cacheGet(id)   { return idbTx("readonly",  function (s) { return idbReq(s.get(id)); }); }
  function cachePut(mod)  { return idbTx("readwrite", function (s) { return idbReq(s.put(mod)); }); }
  function cacheDel(id)   { return idbTx("readwrite", function (s) { return idbReq(s.delete(id)); }); }
  function cacheAll()     { return idbTx("readonly",  function (s) { return idbReq(s.getAll()); }); }

  // ---------- Validation ----------
  function validate(mod) {
    if (!mod || typeof mod !== "object") throw new Error("invalid module: not an object");
    var m = mod.meta;
    if (!m || typeof m !== "object") throw new Error("invalid module: missing meta");
    if (!m.id || typeof m.id !== "string") throw new Error("invalid module: meta.id missing");
    if (!m.version || typeof m.version !== "string") throw new Error("invalid module: meta.version missing");
    if (VALID_TYPES.indexOf(m.type) === -1) throw new Error("invalid module: meta.type '" + m.type + "' not recognized");
    return mod;
  }

  // ---------- Fetch ----------
  function fetchJson(url) {
    return fetch(url, { credentials: "same-origin" }).then(function (r) {
      if (!r.ok) throw new Error("fetch failed " + r.status + " for " + url);
      return r.json();
    });
  }

  function defaultUrl(id) { return "data/modules/" + id + ".json"; }

  // ---------- Core loaders ----------
  function loadFromUrl(url, expectedId, source) {
    return fetchJson(url).then(function (mod) {
      validate(mod);
      if (expectedId && mod.meta.id !== expectedId) {
        throw new Error("invalid module: meta.id '" + mod.meta.id + "' != expected '" + expectedId + "'");
      }
      mod.meta.installedAt = Date.now();
      return cachePut(mod).then(function () {
        console.log("[modules] loaded " + mod.meta.id + " v" + mod.meta.version + " from " + source);
        return mod;
      });
    });
  }

  function loadModule(id) {
    if (!id) return Promise.reject(new Error("loadModule: id required"));
    var url = defaultUrl(id);
    return cacheGet(id).then(function (cached) {
      if (!cached) return loadFromUrl(url, id, "network");
      // Revalidate version against network; on any network error, use cache.
      return fetchJson(url).then(function (fresh) {
        try { validate(fresh); } catch (e) { return cached; }
        if (fresh.meta.id !== id) return cached;
        if (fresh.meta.version !== cached.meta.version) {
          fresh.meta.installedAt = Date.now();
          return cachePut(fresh).then(function () {
            console.log("[modules] loaded " + id + " v" + fresh.meta.version + " from network");
            return fresh;
          });
        }
        console.log("[modules] loaded " + id + " v" + cached.meta.version + " from cache");
        return cached;
      }, function () {
        console.log("[modules] loaded " + id + " v" + cached.meta.version + " from cache");
        return cached;
      });
    });
  }

  function loadModuleFromUrl(url, expectedId) {
    if (!url) return Promise.reject(new Error("loadModuleFromUrl: url required"));
    if (!expectedId) return Promise.reject(new Error("loadModuleFromUrl: expectedId required"));
    return cacheGet(expectedId).then(function (cached) {
      return fetchJson(url).then(function (fresh) {
        validate(fresh);
        if (fresh.meta.id !== expectedId) {
          throw new Error("invalid module: meta.id '" + fresh.meta.id + "' != expected '" + expectedId + "'");
        }
        if (cached && cached.meta.version === fresh.meta.version) {
          console.log("[modules] loaded " + expectedId + " v" + cached.meta.version + " from cache");
          return cached;
        }
        fresh.meta.installedAt = Date.now();
        return cachePut(fresh).then(function () {
          console.log("[modules] loaded " + expectedId + " v" + fresh.meta.version + " from network");
          return fresh;
        });
      }, function (err) {
        if (cached) {
          console.log("[modules] loaded " + expectedId + " v" + cached.meta.version + " from cache");
          return cached;
        }
        throw err;
      });
    });
  }

  function listModules() {
    return cacheAll().then(function (all) {
      return (all || []).map(function (m) {
        return {
          id: m.meta.id,
          type: m.meta.type,
          version: m.meta.version,
          name: m.meta.name,
          lang: m.meta.lang,
          installedAt: m.meta.installedAt || null
        };
      });
    });
  }

  function removeModule(id) {
    if (!id) return Promise.reject(new Error("removeModule: id required"));
    return cacheDel(id);
  }

  function hasModule(id) {
    if (!id) return Promise.resolve(false);
    return cacheGet(id).then(function (m) { return !!m; }, function () { return false; });
  }

  var API = {
    loadModule: loadModule,
    loadModuleFromUrl: loadModuleFromUrl,
    listModules: listModules,
    removeModule: removeModule,
    hasModule: hasModule,
    VALID_TYPES: VALID_TYPES.slice()
  };

  if (typeof window !== "undefined") window.CODEX_MODULES = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})();
