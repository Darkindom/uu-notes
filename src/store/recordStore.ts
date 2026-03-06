/**
 * 全局 Record 数据存储
 * 
 * 目的：避免多个页面重复请求相同的 record 数据
 * 策略：
 * 1. 内存缓存 + localStorage 持久化
 * 2. 按 babyId + date 存储数据
 * 3. 自动过期机制（5分钟）
 * 4. 订阅机制，数据更新时通知所有订阅者
 */

import Taro from '@tarojs/taro'
import type { Record as ApiRecord } from '../utils/api'

interface RecordCache {
  data: ApiRecord[]
  timestamp: number
  babyId: number
  date: string
}

interface Subscriber {
  id: string
  callback: (records: ApiRecord[]) => void
}

class RecordStore {
  private cache: Map<string, RecordCache> = new Map()
  private subscribers: Map<string, Subscriber[]> = new Map()
  private CACHE_DURATION = 5 * 60 * 1000 // 5分钟缓存

  /**
   * 生成缓存 key
   */
  private getCacheKey(babyId: number, date: string): string {
    return `${babyId}_${date}`
  }

  /**
   * 检查缓存是否有效
   */
  private isCacheValid(cache: RecordCache): boolean {
    return Date.now() - cache.timestamp < this.CACHE_DURATION
  }

  /**
   * 获取缓存的记录
   */
  getRecords(babyId: number, date: string): ApiRecord[] | null {
    const key = this.getCacheKey(babyId, date)
    const cache = this.cache.get(key)

    if (cache && this.isCacheValid(cache)) {
      console.log(`[RecordStore] 命中缓存: ${key}`)
      return cache.data
    }

    console.log(`[RecordStore] 缓存未命中: ${key}`)
    return null
  }

  /**
   * 设置记录缓存
   */
  setRecords(babyId: number, date: string, records: ApiRecord[]): void {
    const key = this.getCacheKey(babyId, date)
    const cache: RecordCache = {
      data: records,
      timestamp: Date.now(),
      babyId,
      date,
    }

    this.cache.set(key, cache)
    console.log(`[RecordStore] 缓存已更新: ${key}, 记录数: ${records.length}`)

    // 通知订阅者
    this.notifySubscribers(key, records)

    // 持久化到 localStorage（可选，防止小程序被销毁）
    this.persistToStorage(key, cache)
  }

  /**
   * 清除指定日期的缓存
   */
  clearRecords(babyId: number, date: string): void {
    const key = this.getCacheKey(babyId, date)
    this.cache.delete(key)
    console.log(`[RecordStore] 缓存已清除: ${key}`)

    try {
      Taro.removeStorageSync(`record_store_${key}`)
    } catch (error) {
      console.error('清除持久化缓存失败:', error)
    }
  }

  /**
   * 清除某个宝宝的所有缓存
   */
  clearBabyRecords(babyId: number): void {
    const keysToDelete: string[] = []

    this.cache.forEach((cache, key) => {
      if (cache.babyId === babyId) {
        keysToDelete.push(key)
      }
    })

    keysToDelete.forEach((key) => {
      this.cache.delete(key)
      try {
        Taro.removeStorageSync(`record_store_${key}`)
      } catch (error) {
        console.error('清除持久化缓存失败:', error)
      }
    })

    console.log(`[RecordStore] 已清除宝宝 ${babyId} 的所有缓存`)
  }

  /**
   * 清除所有缓存
   */
  clearAll(): void {
    this.cache.clear()
    console.log('[RecordStore] 已清除所有缓存')

    try {
      const storageInfo = Taro.getStorageInfoSync()
      const keysToRemove = storageInfo.keys.filter((key) => key.startsWith('record_store_'))
      keysToRemove.forEach((key) => {
        Taro.removeStorageSync(key)
      })
    } catch (error) {
      console.error('清除所有持久化缓存失败:', error)
    }
  }

  /**
   * 持久化缓存到 localStorage
   */
  private persistToStorage(key: string, cache: RecordCache): void {
    try {
      Taro.setStorageSync(`record_store_${key}`, cache)
    } catch (error) {
      console.error('持久化缓存失败:', error)
    }
  }

  /**
   * 从 localStorage 恢复缓存
   */
  private restoreFromStorage(key: string): RecordCache | null {
    try {
      const cache: RecordCache | undefined = Taro.getStorageSync(`record_store_${key}`)
      if (cache && this.isCacheValid(cache)) {
        return cache
      }
    } catch (error) {
      console.error('恢复缓存失败:', error)
    }
    return null
  }

  /**
   * 订阅某个日期的数据变化
   */
  subscribe(
    babyId: number,
    date: string,
    callback: (records: ApiRecord[]) => void
  ): () => void {
    const key = this.getCacheKey(babyId, date)
    const subscriberId = `${key}_${Date.now()}_${Math.random()}`

    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, [])
    }

    this.subscribers.get(key)!.push({ id: subscriberId, callback })
    console.log(`[RecordStore] 新订阅: ${key}`)

    // 返回取消订阅的函数
    return () => {
      const subs = this.subscribers.get(key)
      if (subs) {
        const index = subs.findIndex((s) => s.id === subscriberId)
        if (index > -1) {
          subs.splice(index, 1)
          console.log(`[RecordStore] 取消订阅: ${key}`)
        }
      }
    }
  }

  /**
   * 通知订阅者
   */
  private notifySubscribers(key: string, records: ApiRecord[]): void {
    const subs = this.subscribers.get(key)
    if (subs && subs.length > 0) {
      console.log(`[RecordStore] 通知 ${subs.length} 个订阅者: ${key}`)
      subs.forEach((sub) => {
        try {
          sub.callback(records)
        } catch (error) {
          console.error('通知订阅者失败:', error)
        }
      })
    }
  }

  /**
   * 乐观更新：添加记录
   */
  optimisticallyAddRecord(babyId: number, date: string, record: ApiRecord): void {
    const key = this.getCacheKey(babyId, date)
    const cache = this.cache.get(key)

    if (cache) {
      const updatedRecords = [record, ...cache.data]
      this.setRecords(babyId, date, updatedRecords)
    }
  }

  /**
   * 乐观更新：更新记录
   */
  optimisticallyUpdateRecord(
    babyId: number,
    date: string,
    recordId: number,
    updatedFields: Partial<ApiRecord>
  ): void {
    const key = this.getCacheKey(babyId, date)
    const cache = this.cache.get(key)

    if (cache) {
      const updatedRecords = cache.data.map((r) =>
        r.id === recordId ? { ...r, ...updatedFields } : r
      )
      this.setRecords(babyId, date, updatedRecords)
    }
  }

  /**
   * 乐观更新：删除记录
   */
  optimisticallyDeleteRecord(babyId: number, date: string, recordId: number): void {
    const key = this.getCacheKey(babyId, date)
    const cache = this.cache.get(key)

    if (cache) {
      const updatedRecords = cache.data.filter((r) => r.id !== recordId)
      this.setRecords(babyId, date, updatedRecords)
    }
  }

  /**
   * 获取最近的记录（从今天往前找）
   */
  getRecentRecordsByCategory(
    babyId: number,
    category: string,
    limit: number = 5
  ): ApiRecord[] | null {
    // 从今天开始往前找最多7天
    const today = new Date()
    const records: ApiRecord[] = []

    for (let i = 0; i < 7; i++) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = this.formatDate(date)

      const cachedRecords = this.getRecords(babyId, dateStr)
      if (cachedRecords) {
        const categoryRecords = cachedRecords.filter((r) => r.category === category)
        records.push(...categoryRecords)

        if (records.length >= limit) {
          break
        }
      } else {
        // 如果某一天没有缓存，就返回 null，让调用者去请求
        return null
      }
    }

    // 按时间降序排序，取前 limit 条
    return records.sort((a, b) => b.startTime - a.startTime).slice(0, limit)
  }

  /**
   * 格式化日期为 YYYY-MM-DD
   */
  private formatDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate()
    ).padStart(2, '0')}`
  }

  /**
   * 初始化时从 localStorage 恢复缓存（可选）
   */
  init(): void {
    try {
      const storageInfo = Taro.getStorageInfoSync()
      const recordStoreKeys = storageInfo.keys.filter((key) => key.startsWith('record_store_'))

      recordStoreKeys.forEach((storageKey) => {
        const key = storageKey.replace('record_store_', '')
        const cache = this.restoreFromStorage(key)
        if (cache) {
          this.cache.set(key, cache)
          console.log(`[RecordStore] 恢复缓存: ${key}`)
        }
      })
    } catch (error) {
      console.error('[RecordStore] 初始化失败:', error)
    }
  }
}

// 单例模式
export const recordStore = new RecordStore()

// 可选：应用启动时初始化
// recordStore.init()
