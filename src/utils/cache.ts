import Taro from '@tarojs/taro'
import type { Baby, User, Record as ApiRecord } from './api'

const CACHE_KEY = 'index_baby_name'
const CACHE_TIMESTAMP_KEY = 'index_baby_name_timestamp'

export function clearIndexCache() {
  try {
    Taro.removeStorageSync(CACHE_KEY)
    Taro.removeStorageSync(CACHE_TIMESTAMP_KEY)
  } catch (error) {
    console.error('清除缓存失败:', error)
  }
}

export function getIndexCache(): { name: string; timestamp: number } | null {
  try {
    const name = Taro.getStorageSync(CACHE_KEY)
    const timestamp = Taro.getStorageSync(CACHE_TIMESTAMP_KEY)
    if (name && timestamp) {
      return { name, timestamp }
    }
  } catch (error) {
    console.error('获取缓存失败:', error)
  }
  return null
}

export function setIndexCache(name: string) {
  try {
    Taro.setStorageSync(CACHE_KEY, name)
    Taro.setStorageSync(CACHE_TIMESTAMP_KEY, Date.now())
  } catch (error) {
    console.error('设置缓存失败:', error)
  }
}

// ============ 新增：统一缓存管理 ============

interface CacheEntry<T> {
  data: T
  timestamp: number
}

const CACHE_KEYS = {
  CURRENT_USER: 'cache_current_user',
  BABIES: 'cache_babies',
  RECORDS: 'cache_records_', // 需要拼接 babyId_date_category
}

// ============ /current 用户缓存 ============

export function getCachedCurrentUser(): User | null {
  try {
    const cache: CacheEntry<User> | undefined = Taro.getStorageSync(CACHE_KEYS.CURRENT_USER)
    if (cache && cache.data) {
      return cache.data
    }
  } catch (error) {
    console.error('获取用户缓存失败:', error)
  }
  return null
}

export function setCachedCurrentUser(user: User) {
  try {
    const cache: CacheEntry<User> = {
      data: user,
      timestamp: Date.now(),
    }
    Taro.setStorageSync(CACHE_KEYS.CURRENT_USER, cache)
  } catch (error) {
    console.error('设置用户缓存失败:', error)
  }
}

export function clearCachedCurrentUser() {
  try {
    Taro.removeStorageSync(CACHE_KEYS.CURRENT_USER)
  } catch (error) {
    console.error('清除用户缓存失败:', error)
  }
}

// ============ /babies 宝宝列表缓存 ============

export function getCachedBabies(): Baby[] | null {
  try {
    const cache: CacheEntry<Baby[]> | undefined = Taro.getStorageSync(CACHE_KEYS.BABIES)
    if (cache && cache.data) {
      return cache.data
    }
  } catch (error) {
    console.error('获取宝宝列表缓存失败:', error)
  }
  return null
}

export function setCachedBabies(babies: Baby[]) {
  try {
    const cache: CacheEntry<Baby[]> = {
      data: babies,
      timestamp: Date.now(),
    }
    Taro.setStorageSync(CACHE_KEYS.BABIES, cache)
  } catch (error) {
    console.error('设置宝宝列表缓存失败:', error)
  }
}

export function clearCachedBabies() {
  try {
    Taro.removeStorageSync(CACHE_KEYS.BABIES)
  } catch (error) {
    console.error('清除宝宝列表缓存失败:', error)
  }
}

// ============ /records 记录列表缓存 ============

function getRecordsCacheKey(babyId: number, date: string, category: string = ''): string {
  return `${CACHE_KEYS.RECORDS}${babyId}_${date}_${category}`
}

export function getCachedRecords(
  babyId: number,
  date: string,
  category: string = ''
): ApiRecord[] | null {
  try {
    const key = getRecordsCacheKey(babyId, date, category)
    const cache: CacheEntry<ApiRecord[]> | undefined = Taro.getStorageSync(key)
    if (cache && cache.data) {
      return cache.data
    }
  } catch (error) {
    console.error('获取记录缓存失败:', error)
  }
  return null
}

export function setCachedRecords(
  babyId: number,
  date: string,
  category: string = '',
  records: ApiRecord[]
) {
  try {
    const key = getRecordsCacheKey(babyId, date, category)
    const cache: CacheEntry<ApiRecord[]> = {
      data: records,
      timestamp: Date.now(),
    }
    Taro.setStorageSync(key, cache)
  } catch (error) {
    console.error('设置记录缓存失败:', error)
  }
}

export function clearCachedRecords(babyId: number, date: string, category: string = '') {
  try {
    const key = getRecordsCacheKey(babyId, date, category)
    Taro.removeStorageSync(key)
  } catch (error) {
    console.error('清除记录缓存失败:', error)
  }
}

// 清除某个宝宝所有日期的记录缓存
export function clearAllCachedRecords(babyId?: number) {
  try {
    const storageInfo = Taro.getStorageInfoSync()
    const keysToRemove = storageInfo.keys.filter(key => {
      if (babyId) {
        return key.startsWith(`${CACHE_KEYS.RECORDS}${babyId}_`)
      }
      return key.startsWith(CACHE_KEYS.RECORDS)
    })
    keysToRemove.forEach(key => {
      Taro.removeStorageSync(key)
    })
  } catch (error) {
    console.error('清除所有记录缓存失败:', error)
  }
}

// ============ 乐观更新相关 ============

// 乐观更新：添加记录到缓存
export function optimisticallyAddRecord(
  babyId: number,
  date: string,
  record: ApiRecord
) {
  const cachedRecords = getCachedRecords(babyId, date)
  if (cachedRecords) {
    const updatedRecords = [record, ...cachedRecords]
    setCachedRecords(babyId, date, '', updatedRecords)
  }
}

// 乐观更新：更新缓存中的记录
export function optimisticallyUpdateRecord(
  babyId: number,
  date: string,
  recordId: number,
  updatedRecord: Partial<ApiRecord>
) {
  const cachedRecords = getCachedRecords(babyId, date)
  if (cachedRecords) {
    const updatedRecords = cachedRecords.map(r =>
      r.id === recordId ? { ...r, ...updatedRecord } : r
    )
    setCachedRecords(babyId, date, '', updatedRecords)
  }
}

// 乐观更新：从缓存中删除记录
export function optimisticallyDeleteRecord(
  babyId: number,
  date: string,
  recordId: number
) {
  const cachedRecords = getCachedRecords(babyId, date)
  if (cachedRecords) {
    const updatedRecords = cachedRecords.filter(r => r.id !== recordId)
    setCachedRecords(babyId, date, '', updatedRecords)
  }
}

// ============ 清除所有缓存 ============

export function clearAllCache() {
  try {
    clearIndexCache()
    clearCachedCurrentUser()
    clearCachedBabies()
    clearAllCachedRecords()
  } catch (error) {
    console.error('清除所有缓存失败:', error)
  }
}
