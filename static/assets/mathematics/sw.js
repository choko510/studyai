importScripts("/assets/mathematics/bundle.js?v=9-30-2024"),
  importScripts("/assets/mathematics/config.js?v=9-30-2024");
class UVServiceWorker extends EventEmitter {
  constructor(e = __uv$config) {
    super(),
      e.bare || (e.bare = "/ca/"),
      (this.addresses =
        "string" == typeof e.bare
          ? [new URL(e.bare, location)]
          : e.bare.map(e => new URL(e, location))),
      (this.headers = {
        csp: [
          "cross-origin-embedder-policy",
          "cross-origin-opener-policy",
          "cross-origin-resource-policy",
          "content-security-policy",
          "content-security-policy-report-only",
          "expect-ct",
          "feature-policy",
          "origin-isolation",
          "strict-transport-security",
          "upgrade-insecure-requests",
          "x-content-type-options",
          "x-download-options",
          "x-frame-options",
          "x-permitted-cross-domain-policies",
          "x-powered-by",
          "x-xss-protection",
        ],
        forward: ["accept-encoding", "connection", "content-length", "accept-language"],
      }),
      (this.method = { empty: ["GET", "HEAD"] }),
      (this.statusCode = { empty: [204, 304] }),
      (this.config = e),
      (this.userAgent = this.getValidUserAgent()),
      (this.browser = Ultraviolet.Bowser.getParser(
        this.userAgent,
      ).getBrowserName()),
      "Firefox" === this.browser &&
        (this.headers.forward.push("user-agent"),
        this.headers.forward.push("content-type"));
  }
  getValidUserAgent() {
    const defaultUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";
    
    try {
      // self.navigator 及び self.navigator.userAgent の存在を確認
      if (typeof self === 'undefined' || !self.navigator || typeof self.navigator.userAgent === 'undefined') {
        return defaultUserAgent;
      }

      const currentUserAgent = self.navigator.userAgent;
      
      // ユーザーエージェントが存在しない、空、または無効な形式の場合
      if (!currentUserAgent ||
          currentUserAgent.trim() === "" ||
          currentUserAgent.length < 10 || // 極端に短いUAも無効とみなす
          !this.isValidUserAgent(currentUserAgent)) {
        return defaultUserAgent;
      }
      
      return currentUserAgent;
    } catch (error) {
      // 念のためエラーハンドリング
      return defaultUserAgent;
    }
  }
  
  isValidUserAgent(userAgent) {
    // 基本的なユーザーエージェントの形式をチェック
    const userAgentPattern = /Mozilla\/[\d\.]+ \([^)]+\)/;
    const hasBasicStructure = userAgentPattern.test(userAgent);
    
    // 一般的なブラウザ名が含まれているかチェック
    const commonBrowsers = ['Chrome', 'Firefox', 'Safari', 'Edge', 'Opera'];
    const hasKnownBrowser = commonBrowsers.some(browser => userAgent.includes(browser));
    
    return hasBasicStructure || hasKnownBrowser;
  }
  
  async fetch({ request: e }) {
    if (!e.url.startsWith(location.origin + (this.config.prefix || "/service/")))
      return fetch(e);
    try {
      const t = new Ultraviolet(this.config);
      "function" == typeof this.config.construct &&
        this.config.construct(t, "service");
      const r = await t.cookie.db();
      (t.meta.origin = location.origin),
        (t.meta.base = t.meta.url = new URL(t.sourceUrl(e.url)));
      const n = new RequestContext(
        e,
        this,
        t,
        this.method.empty.includes(e.method.toUpperCase()) ? null : await e.blob(),
      );
      if (
        ("blob:" === t.meta.url.protocol &&
          ((n.blob = !0), (n.base = n.url = new URL(n.url.pathname))),
        e.referrer && e.referrer.startsWith(location.origin))
      ) {
        const r = new URL(t.sourceUrl(e.referrer));
        (n.headers.origin ||
          (t.meta.url.origin !== r.origin && "cors" === e.mode)) &&
          (n.headers.origin = r.origin),
          (n.headers.referer = r.href);
      }
      const s = (await t.cookie.getCookies(r)) || [],
        i = t.cookie.serialize(s, t.meta, !1);
      "Firefox" === this.browser &&
        "iframe" !== e.destination &&
        "document" !== e.destination &&
        n.forward.shift(),
        i && (n.headers.cookie = i),
        (n.headers.Host = n.url.host);
      
      // User-Agentヘッダーを強制的に設定
      n.headers["user-agent"] = this.userAgent;

      // Accept-Languageヘッダーが空の場合はデフォルト値を設定
      if (!n.headers["accept-language"] || n.headers["accept-language"].trim() === "") {
        n.headers["accept-language"] = "ja,en-US;q=0.9,en;q=0.8";
      }
      const o = new HookEvent(n, null, null);
      if ((this.emit("request", o), o.intercepted)) return o.returnValue;
      const a = await fetch(n.send);
      if (500 === a.status) return Promise.reject("");
      const c = new ResponseContext(n, a, this),
        u = new HookEvent(c, null, null);
      if ((this.emit("beforemod", u), u.intercepted)) return u.returnValue;
      for (const e of this.headers.csp) c.headers[e] && delete c.headers[e];
      if (
        (c.headers.location &&
          (c.headers.location = t.rewriteUrl(c.headers.location)),
        c.headers["set-cookie"] &&
          (Promise.resolve(
            t.cookie.setCookies(c.headers["set-cookie"], r, t.meta),
          ).then(() => {
            self.clients.matchAll().then(function (e) {
              e.forEach(function (e) {
                e.postMessage({ msg: "updateCookies", url: t.meta.url.href });
              });
            });
          }),
          delete c.headers["set-cookie"]),
        c.body)
      )
        switch (e.destination) {
          case "script":
            case "worker":
            if (t.meta.url.href.includes('loilonote.app')) {
              c.body = `import '${__uv$config.bundle}';\nimport '${__uv$config.config}';\nimport '${__uv$config.handler}';\n`;
            } else {
              c.body = `if (!self.__uv && self.importScripts) importScripts('${__uv$config.bundle}', '${__uv$config.config}', '${__uv$config.handler}');\n`;
            }
            c.body += t.js.rewrite(await a.text());
            break;
          case "style":
            c.body = t.rewriteCSS(await a.text());
            break;
          case "iframe":
          case "document":
            isHtml(t.meta.url, c.headers["content-type"] || "") &&
              (c.body = t.rewriteHtml(await a.text(), {
                document: !0,
                injectHead: t.createHtmlInject(
                  this.config.handler,
                  this.config.bundle,
                  this.config.config,
                  t.cookie.serialize(s, t.meta, !0),
                  e.referrer,
                ),
              }));
        }

      if (c.headers) { // c.headersが存在することを確認
        const cspHeadersToRemove = [
            "content-security-policy",
            "content-security-policy-report-only",
            "x-content-security-policy",
            "x-webkit-csp"
        ];
        for (const headerName of cspHeadersToRemove) {
            if (c.headers[headerName.toLowerCase()]) {
                delete c.headers[headerName.toLowerCase()];
            }
        }
      }
      
      return (
        "text/event-stream" === n.headers.accept &&
          (c.headers["content-type"] = "text/event-stream"),
        this.emit("response", u),
        u.intercepted
          ? u.returnValue
          : new Response(c.body, {
              headers: c.headers,
              status: c.status || 200,
              statusText: c.statusText || 'OK',
            })
      );
    } catch (e) {
      return new Response(e.toString(), { status: 500 });
    }
  }
  getBarerResponse(e) {
    const t = {},
      r = JSON.parse(e.headers.get("x-bare-headers"));
    for (const e in r) t[e.toLowerCase()] = r[e];
    return {
      headers: t,
      status: +e.headers.get("x-bare-status"),
      statusText: e.headers.get("x-bare-status-text"),
      body: this.statusCode.empty.includes(+e.headers.get("x-bare-status"))
        ? null
        : e.body,
    };
  }
  get address() {
    return this.addresses[Math.floor(Math.random() * this.addresses.length)];
  }
  static Ultraviolet = Ultraviolet;
}
self.UVServiceWorker = UVServiceWorker;
class ResponseContext {
  constructor(e, t, r) {
    const {
      headers: n,
      status: s,
      statusText: i,
      body: o,
    } = e.blob
      ? {
          status: t.status,
          statusText: t.statusText,
          headers: Object.fromEntries([...t.headers.entries()]),
          body: t.body,
        }
      : r.getBarerResponse(t);
    (this.request = e),
      (this.raw = t),
      (this.ultraviolet = e.ultraviolet),
      (this.headers = n),
      (this.status = s || 200),
      (this.statusText = i || 'OK'),
      (this.body = o);
  }
  get url() {
    return this.request.url;
  }
  get base() {
    return this.request.base;
  }
  set base(e) {
    this.request.base = e;
  }
}
class RequestContext {
  constructor(e, t, r, n = null) {
    (this.ultraviolet = r),
      (this.request = e),
      (this.headers = Object.fromEntries([...e.headers.entries()])),
      (this.method = e.method),
      (this.forward = [...t.headers.forward]),
      (this.address = t.address),
      (this.body = n || null),
      (this.redirect = e.redirect),
      (this.credentials = "omit"),
      (this.mode = "cors" === e.mode ? e.mode : "same-origin"),
      (this.blob = !1);
  }
  get send() {
    return new Request(
      this.blob
        ? "blob:" + location.origin + this.url.pathname
        : this.address.href + "v1/",
      {
        method: this.method,
        headers: {
          "x-bare-protocol": this.url.protocol,
          "x-bare-host": this.url.hostname,
          "x-bare-path": this.url.pathname + this.url.search,
          "x-bare-port":
            this.url.port || ("https:" === this.url.protocol ? "443" : "80"),
          "x-bare-headers": JSON.stringify(this.headers),
          "x-bare-forward-headers": JSON.stringify(this.forward),
          userKey: userKey,
        },
        redirect: this.redirect,
        credentials: this.credentials,
        mode: location.origin !== this.address.origin ? "cors" : this.mode,
        body: this.body,
      },
    );
  }
  get url() {
    return this.ultraviolet.meta.url;
  }
  set url(e) {
    this.ultraviolet.meta.url = e;
  }
  get base() {
    return this.ultraviolet.meta.base;
  }
  set base(e) {
    this.ultraviolet.meta.base = e;
  }
}
function isHtml(e, t = "") {
  return (
    "text/html" ===
    (Ultraviolet.mime.contentType(t || e.pathname) || "text/html").split(";")[0]
  );
}
class HookEvent {
  #e;
  #t;
  constructor(e = {}, t = null, r = null) {
    (this.#e = !1),
      (this.#t = null),
      (this.data = e),
      (this.target = t),
      (this.that = r);
  }
  get intercepted() {
    return this.#e;
  }
  get returnValue() {
    return this.#t;
  }
  respondWith(e) {
    (this.#t = e), (this.#e = !0);
  }
}
var ReflectOwnKeys,
  R = "object" == typeof Reflect ? Reflect : null,
  ReflectApply =
    R && "function" == typeof R.apply
      ? R.apply
      : function (e, t, r) {
          return Function.prototype.apply.call(e, t, r);
        };
function ProcessEmitWarning(e) {
  console && console.warn && console.warn(e);
}
ReflectOwnKeys =
  R && "function" == typeof R.ownKeys
    ? R.ownKeys
    : Object.getOwnPropertySymbols
      ? function (e) {
          return Object.getOwnPropertyNames(e).concat(
            Object.getOwnPropertySymbols(e),
          );
        }
      : function (e) {
          return Object.getOwnPropertyNames(e);
        };
var NumberIsNaN =
  Number.isNaN ||
  function (e) {
    return e != e;
  };
function EventEmitter() {
  EventEmitter.init.call(this);
}
(EventEmitter.EventEmitter = EventEmitter),
  (EventEmitter.prototype._events = void 0),
  (EventEmitter.prototype._eventsCount = 0),
  (EventEmitter.prototype._maxListeners = void 0);
var defaultMaxListeners = 10;
function checkListener(e) {
  if ("function" != typeof e)
    throw new TypeError(
      'The "listener" argument must be of type Function. Received type ' + typeof e,
    );
}
function _getMaxListeners(e) {
  return void 0 === e._maxListeners
    ? EventEmitter.defaultMaxListeners
    : e._maxListeners;
}
function _addListener(e, t, r, n) {
  var s, i, o;
  if (
    (checkListener(r),
    void 0 === (i = e._events)
      ? ((i = e._events = Object.create(null)), (e._eventsCount = 0))
      : (void 0 !== i.newListener &&
          (e.emit("newListener", t, r.listener ? r.listener : r), (i = e._events)),
        (o = i[t])),
    void 0 === o)
  )
    (o = i[t] = r), ++e._eventsCount;
  else if (
    ("function" == typeof o
      ? (o = i[t] = n ? [r, o] : [o, r])
      : n
        ? o.unshift(r)
        : o.push(r),
    (s = _getMaxListeners(e)) > 0 && o.length > s && !o.warned)
  ) {
    o.warned = !0;
    var a = new Error(
      "Possible EventEmitter memory leak detected. " +
        o.length +
        " " +
        String(t) +
        " listeners added. Use emitter.setMaxListeners() to increase limit",
    );
    (a.name = "MaxListenersExceededWarning"),
      (a.emitter = e),
      (a.type = t),
      (a.count = o.length),
      ProcessEmitWarning(a);
  }
  return e;
}
function onceWrapper() {
  if (!this.fired)
    return (
      this.target.removeListener(this.type, this.wrapFn),
      (this.fired = !0),
      0 === arguments.length
        ? this.listener.call(this.target)
        : this.listener.apply(this.target, arguments)
    );
}
function _onceWrap(e, t, r) {
  var n = { fired: !1, wrapFn: void 0, target: e, type: t, listener: r },
    s = onceWrapper.bind(n);
  return (s.listener = r), (n.wrapFn = s), s;
}
function _listeners(e, t, r) {
  var n = e._events;
  if (void 0 === n) return [];
  var s = n[t];
  return void 0 === s
    ? []
    : "function" == typeof s
      ? r
        ? [s.listener || s]
        : [s]
      : r
        ? unwrapListeners(s)
        : arrayClone(s, s.length);
}
function listenerCount(e) {
  var t = this._events;
  if (void 0 !== t) {
    var r = t[e];
    if ("function" == typeof r) return 1;
    if (void 0 !== r) return r.length;
  }
  return 0;
}
function arrayClone(e, t) {
  for (var r = new Array(t), n = 0; n < t; ++n) r[n] = e[n];
  return r;
}
function spliceOne(e, t) {
  for (; t + 1 < e.length; t++) e[t] = e[t + 1];
  e.pop();
}
function unwrapListeners(e) {
  for (var t = new Array(e.length), r = 0; r < t.length; ++r)
    t[r] = e[r].listener || e[r];
  return t;
}
function once(e, t) {
  return new Promise(function (r, n) {
    function s(r) {
      e.removeListener(t, i), n(r);
    }
    function i() {
      "function" == typeof e.removeListener && e.removeListener("error", s),
        r([].slice.call(arguments));
    }
    eventTargetAgnosticAddListener(e, t, i, { once: !0 }),
      "error" !== t && addErrorHandlerIfEventEmitter(e, s, { once: !0 });
  });
}
function addErrorHandlerIfEventEmitter(e, t, r) {
  "function" == typeof e.on && eventTargetAgnosticAddListener(e, "error", t, r);
}
function eventTargetAgnosticAddListener(e, t, r, n) {
  if ("function" == typeof e.on) n.once ? e.once(t, r) : e.on(t, r);
  else {
    if ("function" != typeof e.addEventListener)
      throw new TypeError(
        'The "emitter" argument must be of type EventEmitter. Received type ' +
          typeof e,
      );
    e.addEventListener(t, function s(i) {
      n.once && e.removeEventListener(t, s), r(i);
    });
  }
}
Object.defineProperty(EventEmitter, "defaultMaxListeners", {
  enumerable: !0,
  get: function () {
    return defaultMaxListeners;
  },
  set: function (e) {
    if ("number" != typeof e || e < 0 || NumberIsNaN(e))
      throw new RangeError(
        'The value of "defaultMaxListeners" is out of range. It must be a non-negative number. Received ' +
          e +
          ".",
      );
    defaultMaxListeners = e;
  },
}),
  (EventEmitter.init = function () {
    (void 0 !== this._events &&
      this._events !== Object.getPrototypeOf(this)._events) ||
      ((this._events = Object.create(null)), (this._eventsCount = 0)),
      (this._maxListeners = this._maxListeners || void 0);
  }),
  (EventEmitter.prototype.setMaxListeners = function (e) {
    if ("number" != typeof e || e < 0 || NumberIsNaN(e))
      throw new RangeError(
        'The value of "n" is out of range. It must be a non-negative number. Received ' +
          e +
          ".",
      );
    return (this._maxListeners = e), this;
  }),
  (EventEmitter.prototype.getMaxListeners = function () {
    return _getMaxListeners(this);
  }),
  (EventEmitter.prototype.emit = function (e) {
    for (var t = [], r = 1; r < arguments.length; r++) t.push(arguments[r]);
    var n = "error" === e,
      s = this._events;
    if (void 0 !== s) n = n && void 0 === s.error;
    else if (!n) return !1;
    if (n) {
      var i;
      if ((t.length > 0 && (i = t[0]), i instanceof Error)) throw i;
      var o = new Error("Unhandled error." + (i ? " (" + i.message + ")" : ""));
      throw ((o.context = i), o);
    }
    var a = s[e];
    if (void 0 === a) return !1;
    if ("function" == typeof a) ReflectApply(a, this, t);
    else {
      var c = a.length,
        u = arrayClone(a, c);
      for (r = 0; r < c; ++r) ReflectApply(u[r], this, t);
    }
    return !0;
  }),
  (EventEmitter.prototype.addListener = function (e, t) {
    return _addListener(this, e, t, !1);
  }),
  (EventEmitter.prototype.on = EventEmitter.prototype.addListener),
  (EventEmitter.prototype.prependListener = function (e, t) {
    return _addListener(this, e, t, !0);
  }),
  (EventEmitter.prototype.once = function (e, t) {
    return checkListener(t), this.on(e, _onceWrap(this, e, t)), this;
  }),
  (EventEmitter.prototype.prependOnceListener = function (e, t) {
    return checkListener(t), this.prependListener(e, _onceWrap(this, e, t)), this;
  }),
  (EventEmitter.prototype.removeListener = function (e, t) {
    var r, n, s, i, o;
    if ((checkListener(t), void 0 === (n = this._events))) return this;
    if (void 0 === (r = n[e])) return this;
    if (r === t || r.listener === t)
      0 == --this._eventsCount
        ? (this._events = Object.create(null))
        : (delete n[e],
          n.removeListener && this.emit("removeListener", e, r.listener || t));
    else if ("function" != typeof r) {
      for (s = -1, i = r.length - 1; i >= 0; i--)
        if (r[i] === t || r[i].listener === t) {
          (o = r[i].listener), (s = i);
          break;
        }
      if (s < 0) return this;
      0 === s ? r.shift() : spliceOne(r, s),
        1 === r.length && (n[e] = r[0]),
        void 0 !== n.removeListener && this.emit("removeListener", e, o || t);
    }
    return this;
  }),
  (EventEmitter.prototype.off = EventEmitter.prototype.removeListener),
  (EventEmitter.prototype.removeAllListeners = function (e) {
    var t, r, n;
    if (void 0 === (r = this._events)) return this;
    if (void 0 === r.removeListener)
      return (
        0 === arguments.length
          ? ((this._events = Object.create(null)), (this._eventsCount = 0))
          : void 0 !== r[e] &&
            (0 == --this._eventsCount
              ? (this._events = Object.create(null))
              : delete r[e]),
        this
      );
    if (0 === arguments.length) {
      var s,
        i = Object.keys(r);
      for (n = 0; n < i.length; ++n)
        "removeListener" !== (s = i[n]) && this.removeAllListeners(s);
      return (
        this.removeAllListeners("removeListener"),
        (this._events = Object.create(null)),
        (this._eventsCount = 0),
        this
      );
    }
    if ("function" == typeof (t = r[e])) this.removeListener(e, t);
    else if (void 0 !== t)
      for (n = t.length - 1; n >= 0; n--) this.removeListener(e, t[n]);
    return this;
  }),
  (EventEmitter.prototype.listeners = function (e) {
    return _listeners(this, e, !0);
  }),
  (EventEmitter.prototype.rawListeners = function (e) {
    return _listeners(this, e, !1);
  }),
  (EventEmitter.listenerCount = function (e, t) {
    return "function" == typeof e.listenerCount
      ? e.listenerCount(t)
      : listenerCount.call(e, t);
  }),
  (EventEmitter.prototype.listenerCount = listenerCount),
  (EventEmitter.prototype.eventNames = function () {
    return this._eventsCount > 0 ? ReflectOwnKeys(this._events) : [];
  });
