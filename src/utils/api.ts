import Taro from '@tarojs/taro'
import {
  getCachedCurrentUser,
  setCachedCurrentUser,
  clearCachedCurrentUser,
  getCachedBabies,
  setCachedBabies,
  clearCachedBabies,
  clearAllCachedRecords,
} from './cache'
import { recordStore } from '../store/recordStore'

// 环境配置
const ENV = process.env.TARO_APP_ENV || 'dev' // 默认使用开发环境

// API 配置 - 根据环境选择不同的 API 地址
const API_CONFIG = {
  dev: 'http://localhost:1717/api', // 本地开发
  test: 'https://dksiuu.top/api', // 测试环境（NAS）
  prod: 'https://dksiuu.top/api', // 生产环境（NAS）
}

const API_BASE = API_CONFIG[ENV]

console.log(`🌍 当前环境: ${ENV}`)
console.log(`🔗 API 地址: ${API_BASE}`)

// 获取 token
const getToken = (): string | null => {
  return Taro.getStorageSync('auth_token')
}

// 设置 token
export const setToken = (token: string) => {
  Taro.setStorageSync('auth_token', token)
}

// 清除 token
export const clearToken = () => {
  Taro.removeStorageSync('auth_token')
}

// 通用请求方法
const request = async <T>(options: {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: any
  needAuth?: boolean
}): Promise<T> => {
  const { url, method = 'GET', data, needAuth = true } = options

  const header: any = {
    'Content-Type': 'application/json',
  }

  if (needAuth) {
    const token = getToken()
    if (token) {
      header.Authorization = `Bearer ${token}`
    }
  }

  try {
    const res = await Taro.request({
      url: `${API_BASE}${url}`,
      method,
      data,
      header,
      timeout: 10000,
    })

    if (res.statusCode === 200 && res.data.success) {
      return res.data.data
    } else if (res.statusCode === 401) {
      // Token 失效，清除并跳转登录
      clearToken()
      Taro.showToast({ title: '登录已过期', icon: 'none' })
      // 可以在这里触发重新登录
      throw new Error('未授权')
    } else {
      throw new Error(res.data.error || '请求失败')
    }
  } catch (error: any) {
    console.error('API 请求失败:', error)

    // 网络错误处理
    if (error.errMsg && error.errMsg.includes('timeout')) {
      Taro.showToast({ title: '网络超时', icon: 'none' })
    } else if (error.errMsg && error.errMsg.includes('fail')) {
      Taro.showToast({ title: '网络连接失败', icon: 'none' })
    }

    throw error
  }
}

// ============ 认证相关 ============

/**
 * 登录
 */
export const login = async (): Promise<any> => {
  try {
    // 获取微信登录凭证
    const { code } = await Taro.login()

    if (!code) {
      throw new Error('获取登录凭证失败')
    }

    // 调用后端接口
    const data = await request<{ token: string; user: any }>({
      url: '/auth/login',
      method: 'POST',
      data: { code },
      needAuth: false,
    })

    // 保存 token
    setToken(data.token)

    return data.user
  } catch (error) {
    console.error('登录失败:', error)
    throw error
  }
}

/**
 * 检查登录状态
 */
export const checkLogin = async (): Promise<boolean> => {
  const token = getToken()
  if (!token) {
    return false
  }

  try {
    await getCurrentUser()
    return true
  } catch (error) {
    return false
  }
}

// ============ 用户相关 ============

export interface User {
  id: number
  openId: string
  nickname?: string
  avatarUrl?: string
  currentBabyId?: number
  babyIds: number[]
  createdAt: number
  updatedAt: number
}

export const getCurrentUser = async (): Promise<User> => {
  const cached = getCachedCurrentUser()

  // 有缓存立即返回，同时在后台刷新
  if (cached) {
    request<User>({ url: '/user/current' })
      .then(setCachedCurrentUser)
      .catch((err) => console.error('后台更新用户数据失败:', err))
    return cached
  }

  // 无缓存等待请求
  const user = await request<User>({ url: '/user/current' })
  setCachedCurrentUser(user)
  return user
}

export const updateUser = async (data: {
  nickname?: string
  avatarUrl?: string
  currentBabyId?: number
}): Promise<void> => {
  await request({ url: '/user/current', method: 'PUT', data })

  // 更新用户信息后，清除用户缓存
  clearCachedCurrentUser()
}

// ============ 宝宝相关 ============

export interface BabyMember {
  userId: number
  nickname: string
  role: string
}

export interface Baby {
  id: number
  name: string
  gender: string
  birthday: number
  avatarUrl?: string
  creatorId: number
  memberIds: number[]
  members?: BabyMember[]
  createdAt: number
  updatedAt: number
}

export const getBabies = async (): Promise<Baby[]> => {
  const cached = getCachedBabies()

  // 有缓存立即返回，同时在后台刷新
  if (cached) {
    request<Baby[]>({ url: '/babies' })
      .then(setCachedBabies)
      .catch((err) => console.error('后台更新宝宝列表失败:', err))
    return cached
  }

  // 无缓存等待请求
  const babies = await request<Baby[]>({ url: '/babies' })
  setCachedBabies(babies)
  return babies
}

export const createBaby = async (data: {
  name: string
  gender: string
  birthday: number
  avatarUrl?: string
  role?: string
}): Promise<Baby> => {
  const result = await request<Baby>({ url: '/babies', method: 'POST', data })

  // 创建宝宝后，清除宝宝列表缓存
  clearCachedBabies()
  clearCachedCurrentUser()

  return result
}

export const updateBaby = async (
  id: number,
  data: {
    name: string
    gender: string
    birthday: number
    avatarUrl?: string
  },
): Promise<void> => {
  await request({ url: `/babies/${id}`, method: 'PUT', data })

  // 更新宝宝后，清除宝宝列表缓存
  clearCachedBabies()
}

export const updateBabyMemberRole = async (
  babyId: number,
  userId: number,
  role: string,
): Promise<void> => {
  await request({ url: `/babies/${babyId}/members/${userId}`, method: 'PUT', data: { role } })

  // 更新成员角色后，清除宝宝列表缓存
  clearCachedBabies()
}

export const deleteBaby = async (id: number): Promise<void> => {
  await request({ url: `/babies/${id}`, method: 'DELETE' })

  // 删除宝宝后，清除相关缓存
  clearCachedBabies()
  clearCachedCurrentUser()
  clearAllCachedRecords(id)
}

export const deleteBabyMember = async (babyId: number, userId: number): Promise<void> => {
  await request({ url: `/babies/${babyId}/members/${userId}`, method: 'DELETE' })

  // 删除成员后，清除宝宝列表缓存
  clearCachedBabies()
}

export const joinBaby = async (babyId: number, role: string): Promise<void> => {
  await request({ url: `/babies/${babyId}/join`, method: 'POST', data: { role } })

  // 加入宝宝后，清除宝宝列表和用户缓存
  clearCachedBabies()
  clearCachedCurrentUser()
}

// ============ 记录相关 ============

export interface Record {
  id: number
  babyId: number
  category: string
  subCategory?: string
  startTime: number
  endTime?: number
  value?: string
  extra?: any
  note?: string
  reporterId: number
  reporterRole?: string
  createdAt: number
  updatedAt: number
}

export interface RecordsResponse {
  records: Record[]
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
}

export const getRecords = async (params: {
  babyId?: number
  category?: string
  limit?: number
  offset?: number
  startDate?: number
  endDate?: number
}): Promise<RecordsResponse> => {
  const query = Object.entries(params)
    .filter(([_, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${v}`)
    .join('&')

  // 如果有 babyId 和日期范围，尝试使用全局 recordStore
  if (params.babyId && params.startDate && params.endDate) {
    const startDate = new Date(params.startDate)
    const endDate = new Date(params.endDate)

    // 检查是否查询单天数据
    const isSingleDay =
      startDate.getFullYear() === endDate.getFullYear() &&
      startDate.getMonth() === endDate.getMonth() &&
      startDate.getDate() === endDate.getDate()

    if (isSingleDay) {
      const dateKey = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(
        2,
        '0',
      )}-${String(startDate.getDate()).padStart(2, '0')}`

      // 先尝试从 recordStore 获取
      const cachedRecords = recordStore.getRecords(params.babyId, dateKey)

      if (cachedRecords) {
        // 有缓存，立即返回，同时在后台刷新
        request<any>({ url: `/records${query ? '?' + query : ''}` })
          .then((data) => {
            const records = data.data || data
            recordStore.setRecords(params.babyId!, dateKey, records)
          })
          .catch((err) => console.error('[getRecords] 后台更新失败:', err))

        // 如果有 category 筛选，过滤结果
        const filteredRecords = params.category
          ? cachedRecords.filter((r) => r.category === params.category)
          : cachedRecords

        return {
          records: filteredRecords,
          pagination: {
            total: filteredRecords.length,
            limit: params.limit || 20,
            offset: 0,
            hasMore: false,
          },
        }
      }

      // 无缓存，等待请求
      const data = await request<any>({ url: `/records${query ? '?' + query : ''}` })
      const records = data.data || data

      // 存入 recordStore
      recordStore.setRecords(params.babyId, dateKey, records)

      return {
        records,
        pagination: data.pagination || { total: 0, limit: 20, offset: 0, hasMore: false },
      }
    }
  }

  // 跨天查询或没有缓存条件，直接请求
  const data = await request<any>({ url: `/records${query ? '?' + query : ''}` })
  return {
    records: data.data || data,
    pagination: data.pagination || { total: 0, limit: 20, offset: 0, hasMore: false },
  }
}

export const getRecord = (id: number): Promise<Record> => {
  return request<Record>({ url: `/records/${id}` })
}

export const createRecord = async (data: {
  babyId: number
  category: string
  subCategory?: string
  startTime: number
  endTime?: number
  value?: string
  extra?: any
  note?: string
}): Promise<Record> => {
  const result = await request<Record>({ url: '/records', method: 'POST', data })

  // 成功后，清除相关日期的缓存以便重新加载
  clearAllCachedRecords(data.babyId)
  recordStore.clearBabyRecords(data.babyId)

  return result
}

export const updateRecord = async (
  id: number,
  data: {
    category: string
    subCategory?: string
    startTime: number
    endTime?: number
    value?: string
    extra?: any
    note?: string
  },
): Promise<void> => {
  await request({ url: `/records/${id}`, method: 'PUT', data })

  // 成功后，清除所有记录缓存以便重新加载
  clearAllCachedRecords()
  recordStore.clearAll()
}

export const deleteRecord = async (id: number): Promise<void> => {
  await request({ url: `/records/${id}`, method: 'DELETE' })

  // 成功后，清除所有记录缓存以便重新加载
  clearAllCachedRecords()
  recordStore.clearAll()
}

// ============ 辅助函数 ============

/**
 * 获取当前选中的宝宝
 */
export const getCurrentBaby = async (): Promise<Baby | null> => {
  try {
    const user = await getCurrentUser()
    if (!user.currentBabyId) {
      return null
    }

    const babies = await getBabies()
    return babies.find((b) => b.id === user.currentBabyId) || null
  } catch (error) {
    console.error('获取当前宝宝失败:', error)
    return null
  }
}

/**
 * 切换当前宝宝
 */
export const switchBaby = async (babyId: number): Promise<void> => {
  await updateUser({ currentBabyId: babyId })
}

/**
 * 获取指定分类的最近记录
 */
export const getRecentRecordsByCategory = async (
  category: string,
  limit: number = 5,
): Promise<Record[]> => {
  try {
    const baby = await getCurrentBaby()
    if (!baby) {
      return []
    }

    // 先尝试从 recordStore 获取（从今天往前最多7天）
    const cachedRecords = recordStore.getRecentRecordsByCategory(baby.id, category, limit)
    if (cachedRecords && cachedRecords.length > 0) {
      console.log(`[getRecentRecordsByCategory] 从 store 获取到 ${cachedRecords.length} 条记录`)
      return cachedRecords
    }

    // 如果 store 中没有足够的数据，就请求服务器
    // 请求最近30天的数据
    const endDate = Date.now()
    const startDate = endDate - 30 * 24 * 60 * 60 * 1000

    const response = await getRecords({
      babyId: baby.id,
      category,
      limit: 100, // 获取足够多的数据
      offset: 0,
      startDate,
      endDate,
    })

    // 取最近的 limit 条
    return response.records.slice(0, limit)
  } catch (error) {
    console.error('获取最近记录失败:', error)
    return []
  }
}

// ============ 语音识别相关 ============

export interface VoiceAnalysisResult {
  category: string
  subCategory?: string
  value?: string
  extra?: any
  note?: string
}

/**
 * 调用后端 AI 接口分析语音文本
 */
export const analyzeVoiceText = async (text: string, babyId: number): Promise<VoiceAnalysisResult[]> => {
  const data = await request<VoiceAnalysisResult[]>({
    url: '/voice/analyze',
    method: 'POST',
    data: { text, babyId },
  })
  return data
}
