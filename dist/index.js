import { createHash } from 'node:crypto';

// src/index.ts
var manifest = {
  id: "com.compass.bilibili",
  name: "Bilibili \u97F3\u4E50",
  version: "0.2.0",
  description: "\u641C\u7D22\u548C\u64AD\u653E Bilibili \u4E0A\u7684\u97F3\u4E50\u89C6\u9891",
  author: "Compass Music Team",
  platforms: ["all"],
  main: "dist/index.js",
  brandColor: "#d33682",
  capabilities: {
    dataSource: true
  }
};
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
  async refresh() {
    try {
      const resp = await biliFetch(
        "https://api.bilibili.com/x/web-interface/nav"
      );
      const json = await resp.json();
      if (json.code !== 0 || !json.data?.wbi_img) return false;
      this.imgKey = this.extractKey(json.data.wbi_img.img_url);
      this.subKey = this.extractKey(json.data.wbi_img.sub_url);
      return true;
    } catch {
      return false;
    }
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
    return `${sortedQuery}&w_rid=${createHash("md5").update(sortedQuery + mixinKey).digest("hex")}`;
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
  id = manifest.id;
  name = manifest.name;
  context;
  settings = {
    searchLimit: 20,
    preferHighQuality: true
  };
  wbi = new WbiSigner();
  buvid = "";
  async activate(context) {
    this.context = context;
    this.settings = {
      searchLimit: context.getSetting("searchLimit") ?? 20,
      preferHighQuality: context.getSetting("preferHighQuality") ?? true
    };
    if (context.fetch) {
      platformFetch = context.fetch;
    }
    await Promise.all([this.initWbi(), this.initBuvid()]);
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
      url: `bilibili-audio://${encodeURIComponent(audioUrl)}`,
      format: "m4a"
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
    if (await this.wbi.refresh()) {
      this.context?.log("info", "WBI signer initialized");
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
          Range: req.headers["Range"] ?? "bytes=0-"
        }
      });
      return { data: resp, statusCode: resp.status };
    });
  }
  // --------------------------------------------------------------------------
  // Private: Search
  // --------------------------------------------------------------------------
  async searchWithWbi(keyword, page) {
    if (!this.wbi.isReady) await this.wbi.refresh();
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
    const url = await this.getAudioUrlWithWbi(bvid, cid) ?? await this.getAudioUrlLegacy(bvid, cid);
    if (!url) throw new Error("No audio stream available");
    return url;
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
    return `bilibili-img://${encodeURIComponent(fullUrl)}`;
  }
  parseDuration(duration) {
    if (!duration) return 0;
    const parts = duration.split(":").map(Number);
    if (parts.length === 2) return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
    if (parts.length === 3)
      return (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0);
    return 0;
  }
};
var plugin = new BilibiliDataSourcePlugin();
var index_default = plugin;

export { BilibiliDataSourcePlugin, index_default as default, plugin as instance, manifest };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map
