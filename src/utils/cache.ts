import Taro from '@tarojs/taro'

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
