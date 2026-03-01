import Taro from '@tarojs/taro'

export type Category = 'food' | 'sleep' | 'shit' | 'other'

export type FoodSubcategory = 'breast_milk' | 'milk' | 'water' | 'babycook'
export type SleepSubcategory = 'sleep'
export type ShitSubcategory = 'big' | 'small'
export type OtherSubcategory = 'tonic' | 'outdoor' | 'cry'

export type Subcategory = FoodSubcategory | SleepSubcategory | ShitSubcategory | OtherSubcategory

export interface Reporter {
  openId: string
  role: string
  nickname: string
}

export interface Record {
  _id: string
  babyId: string
  timestamp: number
  category: Category
  subcategory: Subcategory
  value: string
  extra: string
  reporter: Reporter
  createTime: number
}

export interface BabyMember {
  openId: string
  role: string
  nickname: string
  joinTime: number
  permission: 'admin' | 'editor' | 'viewer'
}

export interface Baby {
  _id: string
  name: string
  gender: 'male' | 'female'
  birthday: number
  avatar?: string
  createTime: number
  creatorOpenId: string
  members: BabyMember[]
}

export interface User {
  _id: string
  openId: string
  nickname: string
  avatar?: string
  currentBabyId?: string
  babies: string[]
  createTime: number
  lastLoginTime: number
}

// 获取数据库实例（延迟初始化）
function getDB() {
  if (!Taro.cloud) {
    console.error('云开发未初始化')
    return null
  }
  return Taro.cloud.database()
}

// ============ 用户相关 ============

export async function getCurrentUser(): Promise<User | null> {
  const db = getDB()
  if (!db) return null
  try {
    const openId = await getOpenId()
    const res = await db
      .collection('users')
      .where({
        openId,
      })
      .get()
    const data = res.data || (res.result && res.result.data)
    return data?.[0] || null
  } catch (error) {
    console.error('获取当前用户失败:', error)
    return null
  }
}

export async function createUser(userData: Partial<User>): Promise<User | null> {
  const db = getDB()
  if (!db) return null
  try {
    const openId = await getOpenId()
    const user: Omit<User, '_id'> = {
      openId,
      nickname: userData.nickname || '未命名',
      avatar: userData.avatar,
      currentBabyId: undefined,
      babies: [],
      createTime: Date.now(),
      lastLoginTime: Date.now(),
    }
    const { _id } = await db.collection('users').add({ data: user })
    return { ...user, _id } as User
  } catch (error) {
    console.error('创建用户失败:', error)
    return null
  }
}

export async function updateUser(updates: Partial<User>): Promise<boolean> {
  const db = getDB()
  if (!db) return false
  try {
    const openId = await getOpenId()
    await db
      .collection('users')
      .where({
        openId,
      })
      .update({
        data: updates,
      })
    return true
  } catch (error) {
    console.error('更新用户失败:', error)
    return false
  }
}

// ============ 宝宝相关 ============

export async function createBaby(babyData: {
  name: string
  gender: 'male' | 'female'
  birthday: number
  role: string
  nickname: string
}): Promise<Baby | null> {
  const db = getDB()
  if (!db) return null
  const _ = db.command
  try {
    const openId = await getOpenId()
    const baby: Omit<Baby, '_id'> = {
      name: babyData.name,
      gender: babyData.gender,
      birthday: babyData.birthday,
      createTime: Date.now(),
      creatorOpenId: openId,
      members: [
        {
          openId,
          role: babyData.role,
          nickname: babyData.nickname,
          joinTime: Date.now(),
          permission: 'admin',
        },
      ],
    }
    const { _id } = await db.collection('babies').add({ data: baby })

    // 更新用户的 babies 和 currentBabyId
    await db
      .collection('users')
      .where({ openId })
      .update({
        data: {
          babies: _.push(_id),
          currentBabyId: _id,
        },
      })

    return { ...baby, _id } as Baby
  } catch (error) {
    console.error('创建宝宝失败:', error)
    return null
  }
}

export async function getCurrentBaby(): Promise<Baby | null> {
  const db = getDB()
  if (!db) return null
  try {
    const user = await getCurrentUser()
    if (!user || !user.currentBabyId) return null

    const res = await db.collection('babies').doc(user.currentBabyId).get()
    const data = res.data || (res.result && res.result.data)
    return data as Baby
  } catch (error) {
    console.error('获取当前宝宝失败:', error)
    return null
  }
}

export async function getUserBabies(): Promise<Baby[]> {
  const db = getDB()
  if (!db) return []
  const _ = db.command
  try {
    const user = await getCurrentUser()
    if (!user || !user.babies.length) return []

    const res = await db
      .collection('babies')
      .where({
        _id: _.in(user.babies),
      })
      .get()
    const data = res.data || (res.result && res.result.data)
    return (data as Baby[]) || []
  } catch (error) {
    console.error('获取宝宝列表失败:', error)
    return []
  }
}

export async function switchBaby(babyId: string): Promise<boolean> {
  const db = getDB()
  if (!db) return false
  try {
    const openId = await getOpenId()
    await db
      .collection('users')
      .where({ openId })
      .update({
        data: { currentBabyId: babyId },
      })
    return true
  } catch (error) {
    console.error('切换宝宝失败:', error)
    return false
  }
}

export async function deleteBaby(babyId: string): Promise<boolean> {
  const db = getDB()
  if (!db) return false
  const _ = db.command
  try {
    const openId = await getOpenId()
    const user = await getCurrentUser()
    if (!user) return false

    // 检查权限：只有创建者可以删除
    const baby = await db.collection('babies').doc(babyId).get()
    const babyData = baby.data || (baby.result && baby.result.data)
    if (babyData && babyData.creatorOpenId !== openId) {
      throw new Error('只有创建者可以删除宝宝')
    }

    // 删除宝宝相关的所有记录
    await db.collection('records').where({ babyId }).remove()

    // 删除宝宝
    await db.collection('babies').doc(babyId).remove()

    // 从用户的 babies 数组中移除
    await db
      .collection('users')
      .where({ openId })
      .update({
        data: {
          babies: _.pull(babyId),
          currentBabyId: user.currentBabyId === babyId ? '' : user.currentBabyId,
        },
      })

    return true
  } catch (error) {
    console.error('删除宝宝失败:', error)
    throw error
  }
}

// ============ 记录相关 ============

export async function addRecord(
  record: Omit<Record, '_id' | 'babyId' | 'reporter' | 'createTime'>,
): Promise<Record | null> {
  const db = getDB()
  if (!db) return null
  try {
    const [baby, user, openId] = await Promise.all([
      getCurrentBaby(),
      getCurrentUser(),
      getOpenId(),
    ])

    if (!baby || !user) {
      Taro.showToast({ title: '请先创建宝宝信息', icon: 'none' })
      return null
    }

    const member = baby.members.find((m) => m.openId === openId)
    if (!member) {
      Taro.showToast({ title: '无权限添加记录', icon: 'none' })
      return null
    }

    const newRecord: Omit<Record, '_id'> = {
      ...record,
      babyId: baby._id,
      reporter: {
        openId: member.openId,
        role: member.role,
        nickname: member.nickname,
      },
      createTime: Date.now(),
    }

    const { _id } = await db.collection('records').add({ data: newRecord })
    return { ...newRecord, _id } as Record
  } catch (error) {
    console.error('添加记录失败:', error)
    return null
  }
}

export async function getAllRecords(): Promise<Record[]> {
  const db = getDB()
  if (!db) return []
  try {
    const baby = await getCurrentBaby()
    if (!baby) return []

    const res = await db
      .collection('records')
      .where({ babyId: baby._id })
      .orderBy('timestamp', 'desc')
      .limit(100)
      .get()
    const data = res.data || (res.result && res.result.data)
    return (data as Record[]) || []
  } catch (error) {
    console.error('获取记录失败:', error)
    return []
  }
}

export async function getRecentRecords(limit = 50): Promise<Record[]> {
  const db = getDB()
  if (!db) return []
  try {
    const baby = await getCurrentBaby()
    if (!baby) return []

    const res = await db
      .collection('records')
      .where({ babyId: baby._id })
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get()
    const data = res.data || (res.result && res.result.data)
    return (data as Record[]) || []
  } catch (error) {
    console.error('获取最近记录失败:', error)
    return []
  }
}

export async function getRecentByCategory(category: Category, limit = 5): Promise<Record[]> {
  const db = getDB()
  if (!db) return []
  try {
    const baby = await getCurrentBaby()
    if (!baby) return []

    const res = await db
      .collection('records')
      .where({
        babyId: baby._id,
        category,
      })
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get()
    const data = res.data || (res.result && res.result.data)
    return (data as Record[]) || []
  } catch (error) {
    console.error('获取分类记录失败:', error)
    return []
  }
}

export async function deleteRecord(id: string): Promise<boolean> {
  const db = getDB()
  if (!db) return false
  try {
    await db.collection('records').doc(id).remove()
    return true
  } catch (error) {
    console.error('删除记录失败:', error)
    return false
  }
}

// ============ 辅助函数 ============

async function getOpenId(): Promise<string> {
  try {
    const { result } = await Taro.cloud.callFunction({
      name: 'login',
      data: {},
    })
    return (result as any).openid
  } catch (error) {
    console.error('获取 openId 失败:', error)
    throw error
  }
}

// 检查是否是首次使用
export async function isFirstTime(): Promise<boolean> {
  try {
    const user = await getCurrentUser()
    return !user
  } catch {
    return true
  }
}

// 获取当前用户在当前宝宝中的成员信息
export async function getCurrentMember(): Promise<BabyMember | null> {
  try {
    const [baby, openId] = await Promise.all([getCurrentBaby(), getOpenId()])
    if (!baby) return null
    return baby.members.find((m) => m.openId === openId) || null
  } catch (error) {
    console.error('获取当前成员信息失败:', error)
    return null
  }
}
