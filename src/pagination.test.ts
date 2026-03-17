import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BilibiliDataSourcePlugin } from './index'

const mockFetch = vi.fn()

describe('BilibiliDataSourcePlugin pagination', () => {
  const mockContext = {
    manifest: { id: 'test', name: 'Test' },
    fetch: mockFetch,
    getSetting: vi.fn(),
    setSetting: vi.fn(),
    registerProtocol: vi.fn(),
    log: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/nav')) {
        return {
          ok: true,
          json: async () => ({
            code: 0,
            data: {
              wbi_img: {
                img_url:
                  'https://i0.hdslb.com/bfs/wbi/7cd084941338484aae1ad9425b84077c.png',
                sub_url:
                  'https://i0.hdslb.com/bfs/wbi/4932caff0ff746eab6f01bf08b70ac45.png'
              }
            }
          })
        }
      }

      if (url.includes('/finger/spi')) {
        return {
          ok: true,
          json: async () => ({
            code: 0,
            data: { b_3: 'test-buvid3', b_4: 'test-buvid4' }
          })
        }
      }

      if (url.includes('/wbi/search/type')) {
        return {
          ok: true,
          json: async () => ({
            code: 0,
            data: {
              result: [
                {
                  bvid: 'BV-page-3',
                  author: '测试UP主',
                  title: '分页结果',
                  pic: '//example.com/pic.jpg',
                  duration: '3:30'
                }
              ]
            }
          })
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    })
  })

  it('maps offset and limit to the expected Bilibili page number', async () => {
    const plugin = new BilibiliDataSourcePlugin()
    await plugin.activate(mockContext as never)
    mockFetch.mockClear()

    const results = await plugin.search('周杰伦', { limit: 10, offset: 20 })

    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      id: 'BV-page-3',
      title: '分页结果',
      artist: '测试UP主',
      duration: 210,
      source: 'com.compass.bilibili'
    })

    const searchCall = mockFetch.mock.calls.find(([url]) =>
      String(url).includes('/wbi/search/type')
    )

    expect(searchCall).toBeTruthy()

    const searchUrl = new URL(String(searchCall?.[0]))
    expect(searchUrl.searchParams.get('page')).toBe('3')
    expect(searchUrl.searchParams.get('keyword')).toBe('周杰伦 音乐')
  })
})
