// src/index.ts
function md5(input) {
  const bytes = new TextEncoder().encode(input);
  function cmn(q, a, b, x, s, t) {
    a = a + q + x + t | 0;
    return (a << s | a >>> 32 - s) + b | 0;
  }
  const ff = (a, b, c, d, x, s, t) => cmn(b & c | ~b & d, a, b, x, s, t);
  const gg = (a, b, c, d, x, s, t) => cmn(b & d | c & ~d, a, b, x, s, t);
  const hh = (a, b, c, d, x, s, t) => cmn(b ^ c ^ d, a, b, x, s, t);
  const ii = (a, b, c, d, x, s, t) => cmn(c ^ (b | ~d), a, b, x, s, t);
  const bitLen = bytes.length * 8;
  const padLen = bytes.length % 64 < 56 ? 56 - bytes.length % 64 : 120 - bytes.length % 64;
  const padded = new Uint8Array(bytes.length + padLen + 8);
  padded.set(bytes);
  padded[bytes.length] = 128;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, bitLen >>> 0, true);
  view.setUint32(padded.length - 4, Math.floor(bitLen / 4294967296), true);
  let a0 = 1732584193;
  let b0 = 4023233417;
  let c0 = 2562383102;
  let d0 = 271733878;
  for (let i = 0; i < padded.length; i += 64) {
    const w = new Int32Array(16);
    for (let j = 0; j < 16; j++) w[j] = view.getInt32(i + j * 4, true);
    let a = a0, b = b0, c = c0, d = d0;
    a = ff(a, b, c, d, w[0], 7, -680876936);
    d = ff(d, a, b, c, w[1], 12, -389564586);
    c = ff(c, d, a, b, w[2], 17, 606105819);
    b = ff(b, c, d, a, w[3], 22, -1044525330);
    a = ff(a, b, c, d, w[4], 7, -176418897);
    d = ff(d, a, b, c, w[5], 12, 1200080426);
    c = ff(c, d, a, b, w[6], 17, -1473231341);
    b = ff(b, c, d, a, w[7], 22, -45705983);
    a = ff(a, b, c, d, w[8], 7, 1770035416);
    d = ff(d, a, b, c, w[9], 12, -1958414417);
    c = ff(c, d, a, b, w[10], 17, -42063);
    b = ff(b, c, d, a, w[11], 22, -1990404162);
    a = ff(a, b, c, d, w[12], 7, 1804603682);
    d = ff(d, a, b, c, w[13], 12, -40341101);
    c = ff(c, d, a, b, w[14], 17, -1502002290);
    b = ff(b, c, d, a, w[15], 22, 1236535329);
    a = gg(a, b, c, d, w[1], 5, -165796510);
    d = gg(d, a, b, c, w[6], 9, -1069501632);
    c = gg(c, d, a, b, w[11], 14, 643717713);
    b = gg(b, c, d, a, w[0], 20, -373897302);
    a = gg(a, b, c, d, w[5], 5, -701558691);
    d = gg(d, a, b, c, w[10], 9, 38016083);
    c = gg(c, d, a, b, w[15], 14, -660478335);
    b = gg(b, c, d, a, w[4], 20, -405537848);
    a = gg(a, b, c, d, w[9], 5, 568446438);
    d = gg(d, a, b, c, w[14], 9, -1019803690);
    c = gg(c, d, a, b, w[3], 14, -187363961);
    b = gg(b, c, d, a, w[8], 20, 1163531501);
    a = gg(a, b, c, d, w[13], 5, -1444681467);
    d = gg(d, a, b, c, w[2], 9, -51403784);
    c = gg(c, d, a, b, w[7], 14, 1735328473);
    b = gg(b, c, d, a, w[12], 20, -1926607734);
    a = hh(a, b, c, d, w[5], 4, -378558);
    d = hh(d, a, b, c, w[8], 11, -2022574463);
    c = hh(c, d, a, b, w[11], 16, 1839030562);
    b = hh(b, c, d, a, w[14], 23, -35309556);
    a = hh(a, b, c, d, w[1], 4, -1530992060);
    d = hh(d, a, b, c, w[4], 11, 1272893353);
    c = hh(c, d, a, b, w[7], 16, -155497632);
    b = hh(b, c, d, a, w[10], 23, -1094730640);
    a = hh(a, b, c, d, w[13], 4, 681279174);
    d = hh(d, a, b, c, w[0], 11, -358537222);
    c = hh(c, d, a, b, w[3], 16, -722521979);
    b = hh(b, c, d, a, w[6], 23, 76029189);
    a = hh(a, b, c, d, w[9], 4, -640364487);
    d = hh(d, a, b, c, w[12], 11, -421815835);
    c = hh(c, d, a, b, w[15], 16, 530742520);
    b = hh(b, c, d, a, w[2], 23, -995338651);
    a = ii(a, b, c, d, w[0], 6, -198630844);
    d = ii(d, a, b, c, w[7], 10, 1126891415);
    c = ii(c, d, a, b, w[14], 15, -1416354905);
    b = ii(b, c, d, a, w[5], 21, -57434055);
    a = ii(a, b, c, d, w[12], 6, 1700485571);
    d = ii(d, a, b, c, w[3], 10, -1894986606);
    c = ii(c, d, a, b, w[10], 15, -1051523);
    b = ii(b, c, d, a, w[1], 21, -2054922799);
    a = ii(a, b, c, d, w[8], 6, 1873313359);
    d = ii(d, a, b, c, w[15], 10, -30611744);
    c = ii(c, d, a, b, w[6], 15, -1560198380);
    b = ii(b, c, d, a, w[13], 21, 1309151649);
    a = ii(a, b, c, d, w[4], 6, -145523070);
    d = ii(d, a, b, c, w[11], 10, -1120210379);
    c = ii(c, d, a, b, w[2], 15, 718787259);
    b = ii(b, c, d, a, w[9], 21, -343485551);
    a0 = a0 + a | 0;
    b0 = b0 + b | 0;
    c0 = c0 + c | 0;
    d0 = d0 + d | 0;
  }
  const hex = (n) => {
    const bytes2 = [n >>> 0 & 255, n >>> 8 & 255, n >>> 16 & 255, n >>> 24 & 255];
    return bytes2.map((b) => b.toString(16).padStart(2, "0")).join("");
  };
  return hex(a0) + hex(b0) + hex(c0) + hex(d0);
}
var PLUGIN_ID = "compass-plugin-bilibili";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
var REFERER = "https://www.bilibili.com";
var platformFetch = globalThis.fetch;
async function biliFetch(url, options) {
  return platformFetch(url, {
    ...options,
    headers: {
      "User-Agent": UA,
      Referer: REFERER,
      ...options?.headers
    }
  });
}
async function biliFetchJson(url, options) {
  const resp = await biliFetch(url, options);
  const contentType = resp.headers.get("content-type") ?? "";
  if (!resp.ok || !contentType.includes("json")) {
    const text = await resp.text().catch(() => "(unreadable)");
    throw new Error(`API error: ${resp.status} ${contentType} \u2014 ${text.slice(0, 200)}`);
  }
  return resp.json();
}
var WbiSigner = class _WbiSigner {
  imgKey = "";
  subKey = "";
  static MIXIN_TABLE = [
    46,
    47,
    18,
    2,
    53,
    8,
    23,
    32,
    15,
    50,
    10,
    31,
    58,
    3,
    45,
    35,
    27,
    43,
    5,
    49,
    33,
    9,
    42,
    19,
    29,
    28,
    14,
    39,
    12,
    38,
    41,
    13,
    37,
    48,
    7,
    16,
    24,
    55,
    40,
    61,
    26,
    17,
    0,
    1,
    60,
    51,
    30,
    4,
    22,
    25,
    54,
    21,
    56,
    59,
    6,
    63,
    57,
    62,
    11,
    36,
    20,
    34,
    44,
    52
  ];
  get isReady() {
    return this.imgKey.length > 0 && this.subKey.length > 0;
  }
  async refresh(cookie) {
    const resp = await biliFetch("https://api.bilibili.com/x/web-interface/nav", {
      headers: cookie ? { Cookie: cookie } : void 0
    });
    const contentType = resp.headers.get("content-type") ?? "";
    if (!contentType.includes("json")) {
      const text = await resp.text().catch(() => "");
      throw new Error(`nav API returned ${resp.status} ${contentType}: ${text.slice(0, 120)}`);
    }
    const json = await resp.json();
    if (json.code !== 0 || !json.data?.wbi_img) return false;
    this.imgKey = this.extractKey(json.data.wbi_img.img_url);
    this.subKey = this.extractKey(json.data.wbi_img.sub_url);
    return true;
  }
  sign(params) {
    const mixinKey = this.getMixinKey();
    const timestamp = Math.floor(Date.now() / 1e3);
    const allParams = {
      ...params,
      wts: timestamp
    };
    const sortedQuery = Object.keys(allParams).sort().map((k) => {
      const value = allParams[k];
      return `${encodeURIComponent(k)}=${encodeURIComponent(this.sanitize(value ?? ""))}`;
    }).join("&");
    return `${sortedQuery}&w_rid=${md5(sortedQuery + mixinKey)}`;
  }
  extractKey(url) {
    const filename = url.substring(url.lastIndexOf("/") + 1);
    return filename.split(".")[0] ?? "";
  }
  getMixinKey() {
    const raw = this.imgKey + this.subKey;
    return _WbiSigner.MIXIN_TABLE.map((i) => raw[i]).join("").slice(0, 32);
  }
  sanitize(value) {
    return String(value).replace(/[!'()*]/g, "");
  }
};
var BilibiliDataSourcePlugin = class {
  id = PLUGIN_ID;
  name = "Bilibili \u97F3\u4E50";
  context;
  platform = "desktop";
  settings = {
    searchLimit: 20,
    preferHighQuality: true
  };
  wbi = new WbiSigner();
  buvid = "";
  async activate(context) {
    this.context = context;
    this.platform = context.platform;
    this.settings = {
      searchLimit: context.config.get("searchLimit") ?? 20,
      preferHighQuality: context.config.get("preferHighQuality") ?? true
    };
    if (context.fetch) {
      platformFetch = context.fetch;
    }
    await this.initBuvid();
    await this.initWbi();
    this.registerProtocols(context);
    context.log("info", "Bilibili data source plugin activated");
  }
  async deactivate() {
    this.context?.log("info", "Bilibili data source plugin deactivated");
  }
  async search(query, options) {
    const limit = options?.limit ?? this.settings.searchLimit;
    const offset = options?.offset ?? 0;
    const page = Math.floor(offset / limit) + 1;
    const keyword = `${query} \u97F3\u4E50`;
    try {
      const results = await this.searchWithWbi(keyword, page) ?? await this.searchLegacy(encodeURIComponent(keyword), page);
      return results.slice(0, limit).map((item) => this.toSearchResult(item));
    } catch (error) {
      this.context?.log("error", "Search failed:", error);
      return [];
    }
  }
  async resolveStream(track) {
    const bvid = track.source?.externalId || track.id;
    if (!bvid) throw new Error("Missing bvid");
    const video = await this.getVideoInfo(bvid);
    const cid = video.pages[0]?.cid;
    if (!cid) throw new Error("No playable content");
    const audioUrl = await this.getAudioUrl(bvid, cid);
    return {
      url: audioUrl,
      format: "m4a",
      headers: {
        "User-Agent": UA,
        Referer: REFERER
      }
    };
  }
  async getMetadata(track) {
    try {
      const video = await this.getVideoInfo(track.source.externalId);
      return {
        title: this.cleanHtml(video.title),
        artist: video.owner.name,
        coverUrl: this.wrapImageUrl(video.pic),
        duration: video.duration
      };
    } catch (error) {
      this.context?.log("error", "Failed to get metadata:", error);
      return {};
    }
  }
  // --------------------------------------------------------------------------
  // Private: Initialization
  // --------------------------------------------------------------------------
  async initWbi() {
    try {
      if (await this.wbi.refresh(this.buvid || void 0)) {
        this.context?.log("info", "WBI signer initialized");
      } else {
        this.context?.log("warn", "WBI signer failed to initialize (will use legacy API)");
      }
    } catch (err) {
      this.context?.log("warn", "WBI init error:", err?.message ?? String(err));
    }
  }
  async initBuvid() {
    try {
      const { code, data } = await biliFetchJson("https://api.bilibili.com/x/frontend/finger/spi");
      if (code === 0) {
        this.buvid = `buvid3=${data.b_3};buvid4=${data.b_4}`;
        this.context?.log("info", "Buvid initialized");
      }
    } catch {
    }
  }
  registerProtocols(context) {
    context.registerProtocol?.("bilibili-img", async (req) => {
      const resp = await biliFetch(req.url, {
        headers: { Accept: "image/*,*/*;q=0.8" }
      });
      return { data: resp, statusCode: resp.status };
    });
    context.registerProtocol?.("bilibili-audio", async (req) => {
      const resp = await biliFetch(req.url, {
        headers: {
          "Accept-Encoding": "identity;q=1, *;q=0",
          Range: req.headers.Range ?? "bytes=0-"
        }
      });
      return { data: resp, statusCode: resp.status };
    });
  }
  // --------------------------------------------------------------------------
  // Private: Search
  // --------------------------------------------------------------------------
  async searchWithWbi(keyword, page) {
    if (!this.wbi.isReady) await this.wbi.refresh(this.buvid || void 0);
    if (!this.wbi.isReady) return null;
    const baseUrl = "https://api.bilibili.com/x/web-interface/wbi/search/type";
    const params = { search_type: "video", keyword, page, tids: 3 };
    const url = `${baseUrl}?${this.wbi.sign(params)}`;
    const { code, data } = await biliFetchJson(url, { headers: { Cookie: this.buvid }, credentials: "omit" });
    return code === 0 ? data?.result ?? [] : null;
  }
  async searchLegacy(keyword, page) {
    const url = `https://api.bilibili.com/x/web-interface/search/type?search_type=video&keyword=${keyword}&page=${page}&tids=3`;
    const { code, data } = await biliFetchJson(url, { headers: { Cookie: this.buvid } });
    return code === 0 ? data?.result ?? [] : [];
  }
  // --------------------------------------------------------------------------
  // Private: Video & Audio
  // --------------------------------------------------------------------------
  async getVideoInfo(bvid) {
    const { code, message, data } = await biliFetchJson(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`, {
      headers: { Cookie: this.buvid }
    });
    if (code !== 0) throw new Error(`Video info failed: ${message}`);
    return data;
  }
  async getAudioUrl(bvid, cid) {
    if (this.platform === "mobile") {
      const durlUrl = await this.getAudioUrlDurl(bvid, cid);
      if (durlUrl) return durlUrl;
    }
    const url = await this.getAudioUrlWithWbi(bvid, cid) ?? await this.getAudioUrlLegacy(bvid, cid);
    if (!url) throw new Error("No audio stream available");
    return url;
  }
  /** Get non-DASH audio URL (durl format) — returns .flv/.mp4 that AVPlayer can handle */
  async getAudioUrlDurl(bvid, cid) {
    const url = `https://api.bilibili.com/x/player/playurl?bvid=${bvid}&cid=${cid}&qn=64&fnval=0&fourk=0`;
    const { code, data } = await biliFetchJson(url, { headers: { Cookie: this.buvid } });
    if (code !== 0 || !data?.durl?.[0]?.url) return null;
    return data.durl[0].url;
  }
  async getAudioUrlWithWbi(bvid, cid) {
    if (!this.wbi.isReady) return null;
    const baseUrl = "https://api.bilibili.com/x/player/wbi/playurl";
    const params = {
      bvid,
      cid,
      qn: 127,
      fnval: 4048,
      fourk: 1
    };
    const url = `${baseUrl}?${this.wbi.sign(params)}`;
    const { code, data } = await biliFetchJson(url, { headers: { Cookie: this.buvid }, credentials: "omit" });
    return code === 0 ? this.extractBestAudio(data) : null;
  }
  async getAudioUrlLegacy(bvid, cid) {
    const url = `https://api.bilibili.com/x/player/playurl?bvid=${bvid}&cid=${cid}&qn=127&fnval=4048&fourk=1`;
    const { code, data } = await biliFetchJson(url, { headers: { Cookie: this.buvid } });
    return code === 0 ? this.extractBestAudio(data) : null;
  }
  extractBestAudio(data) {
    if (!data) return null;
    if (data.durl?.[0]?.url) return data.durl[0].url;
    const dash = data.dash;
    if (!dash) return null;
    const pickBest = (streams) => {
      if (!streams?.length) return null;
      const best = streams.reduce((a, b) => b.bandwidth > a.bandwidth ? b : a);
      return best.baseUrl ?? best.base_url ?? null;
    };
    if (this.settings.preferHighQuality) {
      return pickBest(dash.flac?.audio) ?? pickBest(dash.dolby?.audio) ?? pickBest(dash.audio);
    }
    return pickBest(dash.audio);
  }
  // --------------------------------------------------------------------------
  // Private: Utilities
  // --------------------------------------------------------------------------
  toSearchResult(item) {
    return {
      id: item.bvid,
      title: this.cleanHtml(item.title),
      artist: item.author,
      album: "Bilibili",
      duration: this.parseDuration(item.duration),
      coverUrl: this.wrapImageUrl(item.pic),
      source: this.id
    };
  }
  cleanHtml(text) {
    return text.replace(/<\/?em[^>]*>/g, "").replace(/<[^>]*>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
  }
  wrapImageUrl(url) {
    const fullUrl = url.startsWith("//") ? `https:${url}` : url;
    if (typeof globalThis.window !== "undefined" && "electronAPI" in globalThis.window) {
      const headers = JSON.stringify({ "User-Agent": UA, Referer: REFERER });
      return `compass-audio://stream?url=${encodeURIComponent(fullUrl)}&h=${encodeURIComponent(headers)}`;
    }
    return fullUrl;
  }
  parseDuration(duration) {
    if (!duration) return 0;
    const parts = duration.split(":").map(Number);
    if (parts.length === 2) return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
    if (parts.length === 3) return (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0);
    return 0;
  }
};
var plugin = new BilibiliDataSourcePlugin();
var index_default = plugin;

export { BilibiliDataSourcePlugin, index_default as default };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map