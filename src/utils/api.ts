import Taro from '@tarojs/taro'

// 环境配置
const ENV = process.env.TARO_APP_ENV || 'prod' // 默认使用生产环境

// API 配置 - 根据环境选择不同的 API 地址
const API_CONFIG = {
  // dev: 'http://localhost:1717/api', // 开发环境（本地服务器）
  dev: 'https://dksiuu.top/api', // 开发环境
  test: 'https://dksiuu.top/api', // 测试环境
  prod: 'https://dksiuu.top/api', // 生产环境（正式发布使用）
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

export const getCurrentUser = (): Promise<User> => {
  return request<User>({ url: '/user/current' })
}

export const updateUser = (data: {
  nickname?: string
  avatarUrl?: string
  currentBabyId?: number
}): Promise<void> => {
  return request({ url: '/user/current', method: 'PUT', data })
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

export const getBabies = (): Promise<Baby[]> => {
  return request<Baby[]>({ url: '/babies' })
}

export const createBaby = (data: {
  name: string
  gender: string
  birthday: number
  avatarUrl?: string
  role?: string
}): Promise<Baby> => {
  return request<Baby>({ url: '/babies', method: 'POST', data })
}

export const updateBaby = (
  id: number,
  data: {
    name: string
    gender: string
    birthday: number
    avatarUrl?: string
  },
): Promise<void> => {
  return request({ url: `/babies/${id}`, method: 'PUT', data })
}

export const deleteBaby = (id: number): Promise<void> => {
  return request({ url: `/babies/${id}`, method: 'DELETE' })
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

export const getRecords = (params: {
  babyId?: number
  category?: string
  limit?: number
  offset?: number
  startDate?: number // 开始时间戳
  endDate?: number // 结束时间戳
}): Promise<RecordsResponse> => {
  const query = Object.entries(params)
    .filter(([_, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${v}`)
    .join('&')

  return request<any>({ url: `/records${query ? '?' + query : ''}` }).then((data) => ({
    records: data.data || data,
    pagination: data.pagination || { total: 0, limit: 20, offset: 0, hasMore: false },
  }))
}

export const getRecord = (id: number): Promise<Record> => {
  return request<Record>({ url: `/records/${id}` })
}

export const createRecord = (data: {
  babyId: number
  category: string
  subCategory?: string
  startTime: number
  endTime?: number
  value?: string
  extra?: any
  note?: string
}): Promise<Record> => {
  return request<Record>({ url: '/records', method: 'POST', data })
}

export const updateRecord = (
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
  return request({ url: `/records/${id}`, method: 'PUT', data })
}

export const deleteRecord = (id: number): Promise<void> => {
  return request({ url: `/records/${id}`, method: 'DELETE' })
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

    const response = await getRecords({ babyId: baby.id, category, limit, offset: 0 })
    return response.records
  } catch (error) {
    console.error('获取最近记录失败:', error)
    return []
  }
}
