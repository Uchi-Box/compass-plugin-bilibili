import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BilibiliDataSourcePlugin } from '../src/index'
import type { PluginContext } from '@uchi-box/compass-plugin-sdk'

const mockFetch = vi.fn()
global.fetch = mockFetch

// Standard mock responses
const mockNav = {
  code: 0,
  data: {
    wbi_img: {
      img_url:
        'https://i0.hdslb.com/bfs/wbi/7cd084941338484aae1ad9425b84077c.png',
      sub_url:
        'https://i0.hdslb.com/bfs/wbi/4932caff0ff746eab6f01bf08b70ac45.png'
    }
  }
}

const mockBuvid = {
  code: 0,
  data: { b_3: 'test-buvid3', b_4: 'test-buvid4' }
}

describe('BilibiliDataSourcePlugin', () => {
  let plugin: BilibiliDataSourcePlugin
  const mockGetSetting = vi.fn()
  const mockSetSetting = vi.fn()
  const mockLog = vi.fn()
  const mockContext: PluginContext = {
    manifest: {
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      platforms: ['all'],
      main: 'dist/index.js',
      capabilities: { dataSource: true }
    },
    getDatabase: vi.fn(() => {
      throw new Error('not needed in test')
    }),
    generateId: vi.fn((prefix: string) => `${prefix}-1`),
    getSetting: mockGetSetting,
    setSetting: mockSetSetting,
    log: mockLog,
    fetch: mockFetch,
    registerProtocol: vi.fn()
  }

  const setupFetch = (handlers: Record<string, () => unknown>) => {
    mockFetch.mockImplementation((url: string) => {
      for (const [pattern, handler] of Object.entries(handlers)) {
        if (url.includes(pattern)) {
          const data = handler()
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(data),
            clone: () => ({ json: () => Promise.resolve(data) })
          })
        }
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ code: 0, data: {} }),
        clone: () => ({ json: () => Promise.resolve({ code: 0 }) })
      })
    })
  }

  beforeEach(() => {
    plugin = new BilibiliDataSourcePlugin()
    vi.clearAllMocks()
    setupFetch({
      '/nav': () => mockNav,
      '/finger/spi': () => mockBuvid
    })
  })

  afterEach(() => vi.resetAllMocks())

  describe('activation', () => {
    it('initializes WBI signer and buvid', async () => {
      await plugin.activate(mockContext)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/nav'),
        expect.anything()
      )
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/finger/spi'),
        expect.anything()
      )
      expect(mockContext.log).toHaveBeenCalledWith(
        'info',
        'Bilibili data source plugin activated'
      )
    })
  })

  describe('search', () => {
    beforeEach(async () => {
      await plugin.activate(mockContext)
      vi.clearAllMocks()
    })

    it('returns formatted search results', async () => {
      setupFetch({
        '/finger/spi': () => mockBuvid,
        '/search': () => ({
          code: 0,
          data: {
            result: [
              {
                bvid: 'BV1234567890',
                author: 'Artist',
                title: 'Song Title',
                pic: '//example.com/pic.jpg',
                duration: '3:45'
              }
            ]
          }
        })
      })

      const results = await plugin.search('test')

      expect(results).toHaveLength(1)
      expect(results[0]).toMatchObject({
        id: 'BV1234567890',
        title: 'Song Title',
        artist: 'Artist',
        duration: 225,
        source: 'com.compass.bilibili'
      })
    })

    it('appends 音乐 to search query', async () => {
      setupFetch({
        '/finger/spi': () => mockBuvid,
        '/search': () => ({ code: 0, data: { result: [] } })
      })

      await plugin.search('周杰伦')

      const searchCall = mockFetch.mock.calls.find((c: unknown[]) =>
        String(c[0]).includes('search')
      )
      const searchUrl = decodeURIComponent(String(searchCall?.[0]))
      expect(searchUrl).toContain('周杰伦')
      expect(searchUrl).toContain('音乐')
    })

    it('handles empty results', async () => {
      setupFetch({
        '/finger/spi': () => mockBuvid,
        '/search': () => ({ code: 0, data: { result: [] } })
      })

      const results = await plugin.search('nonexistent')
      expect(results).toEqual([])
    })

    it('handles API errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      const results = await plugin.search('test')
      expect(results).toEqual([])
    })
  })

  describe('parseDuration', () => {
    beforeEach(async () => {
      await plugin.activate(mockContext)
      vi.clearAllMocks()
    })

    it.each([
      ['3:45', 225],
      ['1:23:45', 5025],
      ['0:30', 30],
      ['', 0]
    ])('parses %s as %d seconds', async (duration, expected) => {
      setupFetch({
        '/finger/spi': () => mockBuvid,
        '/search': () => ({
          code: 0,
          data: {
            result: [
              { bvid: 'BV1', title: 'Test', author: 'Test', duration, pic: '' }
            ]
          }
        })
      })

      const results = await plugin.search('test')
      expect(results[0]?.duration).toBe(expected)
    })
  })

  describe('cleanHtml', () => {
    beforeEach(async () => {
      await plugin.activate(mockContext)
      vi.clearAllMocks()
    })

    it('removes highlight tags from search results', async () => {
      setupFetch({
        '/finger/spi': () => mockBuvid,
        '/search': () => ({
          code: 0,
          data: {
            result: [
              {
                bvid: 'BV1',
                title: '<em class="keyword">周杰伦</em> - 稻香',
                author: 'Test',
                duration: '3:00',
                pic: ''
              }
            ]
          }
        })
      })

      const results = await plugin.search('周杰伦')
      expect(results[0]?.title).toBe('周杰伦 - 稻香')
    })
  })

  describe('resolveStream', () => {
    beforeEach(async () => {
      await plugin.activate(mockContext)
      vi.clearAllMocks()
    })

    it('returns audio stream URL with DASH format', async () => {
      setupFetch({
        '/finger/spi': () => mockBuvid,
        '/nav': () => mockNav,
        '/view': () => ({
          code: 0,
          data: {
            bvid: 'BV1test123',
            title: 'Test Video',
            pic: '//example.com/pic.jpg',
            owner: { name: 'Author', mid: 123 },
            duration: 180,
            pages: [{ cid: 456789, part: 'Part 1', duration: 180 }]
          }
        }),
        '/playurl': () => ({
          code: 0,
          data: {
            dash: {
              audio: [
                {
                  baseUrl: 'https://audio.bilibili.com/test-audio.m4s',
                  bandwidth: 128000
                }
              ]
            }
          }
        })
      })

      const track = {
        id: 'BV1test123',
        source: { plugin: 'com.compass.bilibili', externalId: 'BV1test123' }
      }

      const stream = await plugin.resolveStream(track)

      expect(stream.url).toContain('bilibili-audio://')
      expect(stream.url).toContain('test-audio.m4s')
      expect(stream.format).toBe('m4a')
    })

    it('falls back to durl format for older videos', async () => {
      setupFetch({
        '/finger/spi': () => mockBuvid,
        '/nav': () => mockNav,
        '/view': () => ({
          code: 0,
          data: {
            bvid: 'BV1old123',
            title: 'Old Video',
            pic: '//example.com/pic.jpg',
            owner: { name: 'Author', mid: 123 },
            duration: 120,
            pages: [{ cid: 111222, part: 'Part 1', duration: 120 }]
          }
        }),
        '/playurl': () => ({
          code: 0,
          data: {
            durl: [{ url: 'https://cdn.bilibili.com/old-video.flv' }]
          }
        })
      })

      const track = {
        id: 'BV1old123',
        source: { plugin: 'com.compass.bilibili', externalId: 'BV1old123' }
      }

      const stream = await plugin.resolveStream(track)

      expect(stream.url).toContain('bilibili-audio://')
      expect(stream.url).toContain('old-video.flv')
    })

    it('throws error when video not found', async () => {
      setupFetch({
        '/finger/spi': () => mockBuvid,
        '/nav': () => mockNav,
        '/view': () => ({
          code: -404,
          message: 'Video not found'
        })
      })

      const track = {
        id: 'BVnotfound',
        source: { plugin: 'com.compass.bilibili', externalId: 'BVnotfound' }
      }

      await expect(plugin.resolveStream(track)).rejects.toThrow(
        'Video info failed'
      )
    })

    it('throws error when no audio available', async () => {
      setupFetch({
        '/finger/spi': () => mockBuvid,
        '/nav': () => mockNav,
        '/view': () => ({
          code: 0,
          data: {
            bvid: 'BV1noaudio',
            title: 'No Audio',
            pic: '',
            owner: { name: 'Test', mid: 1 },
            duration: 60,
            pages: [{ cid: 999, part: 'Part 1', duration: 60 }]
          }
        }),
        '/playurl': () => ({
          code: 0,
          data: { dash: { audio: [] } }
        })
      })

      const track = {
        id: 'BV1noaudio',
        source: { plugin: 'com.compass.bilibili', externalId: 'BV1noaudio' }
      }

      await expect(plugin.resolveStream(track)).rejects.toThrow(
        'No audio stream available'
      )
    })

    it('prefers FLAC audio when available and preferHighQuality is true', async () => {
      setupFetch({
        '/finger/spi': () => mockBuvid,
        '/nav': () => mockNav,
        '/view': () => ({
          code: 0,
          data: {
            bvid: 'BV1flac',
            title: 'FLAC Video',
            pic: '',
            owner: { name: 'Test', mid: 1 },
            duration: 300,
            pages: [{ cid: 888, part: 'Part 1', duration: 300 }]
          }
        }),
        '/playurl': () => ({
          code: 0,
          data: {
            dash: {
              audio: [
                { baseUrl: 'https://cdn/regular.m4s', bandwidth: 128000 }
              ],
              flac: {
                audio: [{ baseUrl: 'https://cdn/flac.m4s', bandwidth: 900000 }]
              }
            }
          }
        })
      })

      const track = {
        id: 'BV1flac',
        source: { plugin: 'com.compass.bilibili', externalId: 'BV1flac' }
      }

      const stream = await plugin.resolveStream(track)

      expect(stream.url).toContain('flac.m4s')
    })
  })
})
