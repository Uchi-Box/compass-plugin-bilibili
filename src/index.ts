import md5 from 'md5'
import type {
  DataSourcePlugin,
  DataSourceSearchResult,
  PluginContext,
  PluginInstance,
  PluginManifest,
  SearchOptions,
  StreamInfo,
  TrackMetadata,
  TrackReference
} from './compass-plugin'

const manifest: PluginManifest = {
  id: 'com.compass.bilibili',
  name: 'Bilibili 音乐',
  version: '0.2.0',
  description: '搜索和播放 Bilibili 上的音乐视频',
  author: 'Compass Music Team',
  platforms: ['all'],
  main: 'dist/index.js',
  brandColor: '#d33682',
  capabilities: {
    dataSource: true
  }
}

// ============================================================================
// Types
// ============================================================================

interface BilibiliSettings {
  searchLimit: number
  preferHighQuality: boolean
}

interface SearchResultItem {
  bvid: string
  mid: number
  author: string
  title: string
  pic: string
  duration: string
}

interface VideoInfo {
  bvid: string
  title: string
  pic: string
  owner: { name: string; mid: number }
  duration: number
  pages: Array<{ cid: number; part: string; duration: number }>
}

interface AudioStream {
  baseUrl?: string
  base_url?: string
  bandwidth: number
}

// Bilibili API Client - Uses context.fetch (Chromium net.fetch) when available
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const REFERER = 'https://www.bilibili.com'

// This will be set when the plugin activates
let platformFetch: (url: string, options?: RequestInit) => Promise<Response> =
  globalThis.fetch

/**
 * Fetch helper with proper Bilibili headers.
 */
async function biliFetch(url: string, options?: RequestInit): Promise<Response> {
  return platformFetch(url, {
    ...options,
    headers: {
      'User-Agent': UA,
      Referer: REFERER,
      ...options?.headers
    }
  })
}

async function biliFetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const resp = await biliFetch(url, options)
  return resp.json() as Promise<T>
}

// ============================================================================
// WBI Signer - Bilibili's anti-crawler signature
// Reference: https://github.com/SocialSisterYi/bilibili-API-collect
// ============================================================================

class WbiSigner {
  private imgKey = ''
  private subKey = ''

  private static readonly MIXIN_TABLE = [
    46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
    33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
    61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
    36, 20, 34, 44, 52
  ]

  get isReady(): boolean {
    return this.imgKey.length > 0 && this.subKey.length > 0
  }

  async refresh(): Promise<boolean> {
    try {
      const resp = await biliFetch(
        'https://api.bilibili.com/x/web-interface/nav'
      )
      const json = (await resp.json()) as {
        code: number
        data?: { wbi_img?: { img_url: string; sub_url: string } }
      }

      if (json.code !== 0 || !json.data?.wbi_img) return false

      this.imgKey = this.extractKey(json.data.wbi_img.img_url)
      this.subKey = this.extractKey(json.data.wbi_img.sub_url)
      return true
    } catch {
      return false
    }
  }

  sign(params: Record<string, string | number>): string {
    const mixinKey = this.getMixinKey()
    const timestamp = Math.floor(Date.now() / 1000)
    const allParams: Record<string, string | number> = {
      ...params,
      wts: timestamp
    }

    const sortedQuery = Object.keys(allParams)
      .sort()
      .map(k => {
        const value = allParams[k]
        return `${encodeURIComponent(k)}=${encodeURIComponent(this.sanitize(value ?? ''))}`
      })
      .join('&')

    return `${sortedQuery}&w_rid=${md5(sortedQuery + mixinKey)}`
  }

  private extractKey(url: string): string {
    const filename = url.substring(url.lastIndexOf('/') + 1)
    return filename.split('.')[0] ?? ''
  }

  private getMixinKey(): string {
    const raw = this.imgKey + this.subKey
    return WbiSigner.MIXIN_TABLE.map(i => raw[i])
      .join('')
      .slice(0, 32)
  }

  private sanitize(value: string | number): string {
    return String(value).replace(/[!'()*]/g, '')
  }
}

// ============================================================================
// Plugin Implementation
// ============================================================================

class BilibiliDataSourcePlugin implements DataSourcePlugin, PluginInstance {
  readonly id = manifest.id
  readonly name = manifest.name

  private context?: PluginContext
  private settings: BilibiliSettings = {
    searchLimit: 20,
    preferHighQuality: true
  }
  private wbi = new WbiSigner()
  private buvid = ''

  async activate(context: PluginContext): Promise<void> {
    this.context = context
    this.settings = {
      searchLimit: context.getSetting<number>('searchLimit') ?? 20,
      preferHighQuality:
        context.getSetting<boolean>('preferHighQuality') ?? true
    }

    // Use platform fetch (Chromium net.fetch) if available for better compatibility
    if (context.fetch) {
      platformFetch = context.fetch
    }

    await Promise.all([this.initWbi(), this.initBuvid()])
    this.registerProtocols(context)

    context.log('info', 'Bilibili data source plugin activated')
  }

  async deactivate(): Promise<void> {
    this.context?.log('info', 'Bilibili data source plugin deactivated')
  }

  async search(
    query: string,
    options?: SearchOptions
  ): Promise<DataSourceSearchResult[]> {
    const limit = options?.limit ?? this.settings.searchLimit
    const offset = options?.offset ?? 0
    const page = Math.floor(offset / limit) + 1
    const keyword = `${query} 音乐`

    try {
      const results =
        (await this.searchWithWbi(keyword, page)) ??
        (await this.searchLegacy(encodeURIComponent(keyword), page))
      return results.slice(0, limit).map(item => this.toSearchResult(item))
    } catch (error) {
      this.context?.log('error', 'Search failed:', error)
      return []
    }
  }

  async resolveStream(track: TrackReference): Promise<StreamInfo> {
    const bvid = track.source?.externalId || track.id
    if (!bvid) throw new Error('Missing bvid')

    const video = await this.getVideoInfo(bvid)
    const cid = video.pages[0]?.cid
    if (!cid) throw new Error('No playable content')

    const audioUrl = await this.getAudioUrl(bvid, cid)
    return {
      url: `bilibili-audio://${encodeURIComponent(audioUrl)}`,
      format: 'm4a'
    }
  }

  async getMetadata(track: TrackReference): Promise<TrackMetadata> {
    try {
      const video = await this.getVideoInfo(track.source.externalId)
      return {
        title: this.cleanHtml(video.title),
        artist: video.owner.name,
        coverUrl: this.wrapImageUrl(video.pic),
        duration: video.duration
      }
    } catch (error) {
      this.context?.log('error', 'Failed to get metadata:', error)
      return {}
    }
  }

  // --------------------------------------------------------------------------
  // Private: Initialization
  // --------------------------------------------------------------------------

  private async initWbi(): Promise<void> {
    if (await this.wbi.refresh()) {
      this.context?.log('info', 'WBI signer initialized')
    }
  }

  private async initBuvid(): Promise<void> {
    try {
      const { code, data } = await biliFetchJson<{
        code: number
        data: { b_3: string; b_4: string }
      }>('https://api.bilibili.com/x/frontend/finger/spi')
      if (code === 0) {
        this.buvid = `buvid3=${data.b_3};buvid4=${data.b_4}`
        this.context?.log('info', 'Buvid initialized')
      }
    } catch {
      // Non-critical, continue without buvid
    }
  }

  private registerProtocols(context: PluginContext): void {
    context.registerProtocol?.('bilibili-img', async req => {
      const resp = await biliFetch(req.url, {
        headers: { Accept: 'image/*,*/*;q=0.8' }
      })
      return { data: resp, statusCode: resp.status }
    })

    context.registerProtocol?.('bilibili-audio', async req => {
      const resp = await biliFetch(req.url, {
        headers: {
          'Accept-Encoding': 'identity;q=1, *;q=0',
          Range: req.headers['Range'] ?? 'bytes=0-'
        }
      })
      return { data: resp, statusCode: resp.status }
    })
  }

  // --------------------------------------------------------------------------
  // Private: Search
  // --------------------------------------------------------------------------

  private async searchWithWbi(
    keyword: string,
    page: number
  ): Promise<SearchResultItem[] | null> {
    if (!this.wbi.isReady) await this.wbi.refresh()
    if (!this.wbi.isReady) return null

    const baseUrl = 'https://api.bilibili.com/x/web-interface/wbi/search/type'
    const params = { search_type: 'video', keyword, page, tids: 3 }
    const url = `${baseUrl}?${this.wbi.sign(params)}`

    const { code, data } = await biliFetchJson<{
      code: number
      data?: { result?: SearchResultItem[] }
    }>(url, { headers: { Cookie: this.buvid }, credentials: 'omit' })

    return code === 0 ? (data?.result ?? []) : null
  }

  private async searchLegacy(
    keyword: string,
    page: number
  ): Promise<SearchResultItem[]> {
    const url = `https://api.bilibili.com/x/web-interface/search/type?search_type=video&keyword=${keyword}&page=${page}&tids=3`
    const { code, data } = await biliFetchJson<{
      code: number
      data?: { result?: SearchResultItem[] }
    }>(url, { headers: { Cookie: this.buvid } })
    return code === 0 ? (data?.result ?? []) : []
  }

  // --------------------------------------------------------------------------
  // Private: Video & Audio
  // --------------------------------------------------------------------------

  private async getVideoInfo(bvid: string): Promise<VideoInfo> {
    const { code, message, data } = await biliFetchJson<{
      code: number
      message: string
      data: VideoInfo
    }>(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`, {
      headers: { Cookie: this.buvid }
    })
    if (code !== 0) throw new Error(`Video info failed: ${message}`)
    return data
  }

  private async getAudioUrl(bvid: string, cid: number): Promise<string> {
    // Try WBI-signed endpoint first
    const url =
      (await this.getAudioUrlWithWbi(bvid, cid)) ??
      (await this.getAudioUrlLegacy(bvid, cid))
    if (!url) throw new Error('No audio stream available')
    return url
  }

  private async getAudioUrlWithWbi(
    bvid: string,
    cid: number
  ): Promise<string | null> {
    if (!this.wbi.isReady) return null

    const baseUrl = 'https://api.bilibili.com/x/player/wbi/playurl'
    const params = {
      bvid,
      cid,
      qn: 127,
      fnval: 4048,
      fourk: 1
    }
    const url = `${baseUrl}?${this.wbi.sign(params)}`

    const { code, data } = await biliFetchJson<{
      code: number
      data?: {
        dash?: {
          audio?: AudioStream[]
          flac?: { audio?: AudioStream[] }
          dolby?: { audio?: AudioStream[] }
        }
        durl?: Array<{ url: string }>
      }
    }>(url, { headers: { Cookie: this.buvid }, credentials: 'omit' })

    return code === 0 ? this.extractBestAudio(data) : null
  }

  private async getAudioUrlLegacy(
    bvid: string,
    cid: number
  ): Promise<string | null> {
    const url = `https://api.bilibili.com/x/player/playurl?bvid=${bvid}&cid=${cid}&qn=127&fnval=4048&fourk=1`
    const { code, data } = await biliFetchJson<{
      code: number
      data?: { dash?: { audio?: AudioStream[] }; durl?: Array<{ url: string }> }
    }>(url, { headers: { Cookie: this.buvid } })
    return code === 0 ? this.extractBestAudio(data) : null
  }

  private extractBestAudio(data?: {
    dash?: {
      audio?: AudioStream[]
      flac?: { audio?: AudioStream[] }
      dolby?: { audio?: AudioStream[] }
    }
    durl?: Array<{ url: string }>
  }): string | null {
    if (!data) return null

    // Fallback to durl (older videos)
    if (data.durl?.[0]?.url) return data.durl[0].url

    const dash = data.dash
    if (!dash) return null

    const pickBest = (streams?: AudioStream[]): string | null => {
      if (!streams?.length) return null
      const best = streams.reduce((a, b) => (b.bandwidth > a.bandwidth ? b : a))
      return best.baseUrl ?? best.base_url ?? null
    }

    // Priority: FLAC > Dolby > Regular (if preferHighQuality)
    if (this.settings.preferHighQuality) {
      return (
        pickBest(dash.flac?.audio) ??
        pickBest(dash.dolby?.audio) ??
        pickBest(dash.audio)
      )
    }
    return pickBest(dash.audio)
  }

  // --------------------------------------------------------------------------
  // Private: Utilities
  // --------------------------------------------------------------------------

  private toSearchResult(item: SearchResultItem): DataSourceSearchResult {
    return {
      id: item.bvid,
      title: this.cleanHtml(item.title),
      artist: item.author,
      album: 'Bilibili',
      duration: this.parseDuration(item.duration),
      coverUrl: this.wrapImageUrl(item.pic),
      source: this.id
    }
  }

  private cleanHtml(text: string): string {
    return text
      .replace(/<\/?em[^>]*>/g, '')
      .replace(/<[^>]*>/g, '')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim()
  }

  private wrapImageUrl(url: string): string {
    const fullUrl = url.startsWith('//') ? `https:${url}` : url
    return `bilibili-img://${encodeURIComponent(fullUrl)}`
  }

  private parseDuration(duration: string): number {
    if (!duration) return 0
    const parts = duration.split(':').map(Number)
    if (parts.length === 2) return (parts[0] ?? 0) * 60 + (parts[1] ?? 0)
    if (parts.length === 3)
      return (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0)
    return 0
  }
}

const plugin = new BilibiliDataSourcePlugin()
export { manifest, plugin as instance, BilibiliDataSourcePlugin }
export default plugin
