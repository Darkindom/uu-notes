require('dotenv').config()
const express = require('express')
const cors = require('cors')
const Database = require('better-sqlite3')
const jwt = require('jsonwebtoken')
const fs = require('fs')
const path = require('path')
const https = require('https')
const NodeCache = require('node-cache')

// DeepSeek API 配置
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || ''
const DEEPSEEK_API_BASE = process.env.DEEPSEEK_API_BASE || 'https://api.deepseek.com'

const app = express()
const PORT = process.env.PORT || 1717

// 初始化缓存：stdTTL 为默认过期时间（秒），checkperiod 为检查过期的周期
const cache = new NodeCache({
  stdTTL: 300,        // 5分钟默认过期
  checkperiod: 60,    // 每60秒检查一次过期
  useClones: false    // 不克隆对象，提高性能
})

// 确保日志目录存在
const logsDir = path.join(__dirname, 'logs')
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true })
}

// 日志工具函数
function log(level, message, data = null) {
  const timestamp = new Date().toISOString()
  const logMessage = data
    ? `[${timestamp}] [${level}] ${message} ${JSON.stringify(data)}`
    : `[${timestamp}] [${level}] ${message}`

  // 输出到控制台
  console.log(logMessage)

  // 写入日志文件
  const logFile = path.join(logsDir, `${new Date().toISOString().split('T')[0]}.log`)
  fs.appendFileSync(logFile, logMessage + '\n')
}

// 确保数据目录和备份目录存在
const dataDir = path.dirname(process.env.DB_PATH || './data/uu-notes.db')
const backupDir = path.join(dataDir, 'backups')
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true })
}

// 数据库备份函数
function backupDatabase() {
  try {
    const dbPath = process.env.DB_PATH || './data/uu-notes.db'
    if (!fs.existsSync(dbPath)) {
      log('WARN', '数据库文件不存在，跳过备份')
      return
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]
    const backupPath = path.join(backupDir, `backup-${timestamp}.db`)

    // 如果今天已经备份过，跳过
    if (fs.existsSync(backupPath)) {
      log('INFO', '今天已备份，跳过')
      return
    }

    // 复制数据库文件
    fs.copyFileSync(dbPath, backupPath)
    log('INFO', `数据库备份成功: ${backupPath}`)

    // 清理7天前的备份
    const files = fs.readdirSync(backupDir)
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    files.forEach(file => {
      const filePath = path.join(backupDir, file)
      const stats = fs.statSync(filePath)
      if (stats.mtimeMs < sevenDaysAgo) {
        fs.unlinkSync(filePath)
        log('INFO', `删除旧备份: ${file}`)
      }
    })
  } catch (error) {
    log('ERROR', '数据库备份失败', { error: error.message })
  }
}

// 每天凌晨3点备份数据库
setInterval(() => {
  const now = new Date()
  if (now.getHours() === 3 && now.getMinutes() === 0) {
    backupDatabase()
  }
}, 60 * 1000) // 每分钟检查一次

// 启动时立即备份一次
backupDatabase()

// 初始化数据库（开发环境优先使用 LOCAL_DB_PATH）
const dbPath = (process.env.NODE_ENV === 'development' && process.env.LOCAL_DB_PATH)
  ? process.env.LOCAL_DB_PATH
  : (process.env.DB_PATH || './data/uu-notes.db')
const db = new Database(dbPath)
log('INFO', `数据库初始化完成: ${dbPath}`)

// 创建表
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    openId TEXT UNIQUE NOT NULL,
    nickname TEXT,
    avatarUrl TEXT,
    currentBabyId INTEGER,
    babyIds TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS babies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    gender TEXT NOT NULL,
    birthday INTEGER NOT NULL,
    avatarUrl TEXT,
    creatorId INTEGER NOT NULL,
    memberIds TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    FOREIGN KEY (creatorId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    babyId INTEGER NOT NULL,
    category TEXT NOT NULL,
    subCategory TEXT,
    startTime INTEGER NOT NULL,
    endTime INTEGER,
    value TEXT,
    extra TEXT,
    note TEXT,
    reporterId INTEGER NOT NULL,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    FOREIGN KEY (babyId) REFERENCES babies(id),
    FOREIGN KEY (reporterId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS baby_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    babyId INTEGER NOT NULL,
    userId INTEGER NOT NULL,
    role TEXT NOT NULL,
    createdAt INTEGER NOT NULL,
    FOREIGN KEY (babyId) REFERENCES babies(id) ON DELETE CASCADE,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(babyId, userId)
  );

  CREATE INDEX IF NOT EXISTS idx_users_openId ON users(openId);
  CREATE INDEX IF NOT EXISTS idx_babies_creatorId ON babies(creatorId);
  CREATE INDEX IF NOT EXISTS idx_records_babyId ON records(babyId);
  CREATE INDEX IF NOT EXISTS idx_records_startTime ON records(startTime);
  CREATE INDEX IF NOT EXISTS idx_baby_members_babyId ON baby_members(babyId);
  CREATE INDEX IF NOT EXISTS idx_baby_members_userId ON baby_members(userId);
`)

// 自动迁移数据库 schema
function ensureSchema() {
  // 为 users 表添加 llm_daily_limit 字段（-1 表示无限）
  try {
    const userCols = db.prepare("PRAGMA table_info(users)").all().map(c => c.name)
    if (!userCols.includes('llm_daily_limit')) {
      db.exec("ALTER TABLE users ADD COLUMN llm_daily_limit INTEGER DEFAULT 20")
      log('MIGRATE', 'users 表已添加 llm_daily_limit 字段')
    }
  } catch (error) {
    log('WARN', 'users 表迁移失败（可能已存在）', { error: error.message })
  }

  // 为 babies 表添加 llm_daily_limit 字段（-1 表示无限，NULL 表示使用全局默认 50）
  try {
    const babyCols = db.prepare("PRAGMA table_info(babies)").all().map(c => c.name)
    if (!babyCols.includes('llm_daily_limit')) {
      db.exec("ALTER TABLE babies ADD COLUMN llm_daily_limit INTEGER DEFAULT NULL")
      log('MIGRATE', 'babies 表已添加 llm_daily_limit 字段')
    }
  } catch (error) {
    log('WARN', 'babies 表迁移失败（可能已存在）', { error: error.message })
  }

  // 创建 LLM 调用记录表
  db.exec(`
    CREATE TABLE IF NOT EXISTS llm_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      babyId INTEGER NOT NULL,
      date TEXT NOT NULL,
      count INTEGER DEFAULT 1,
      UNIQUE(userId, babyId, date)
    );
    CREATE INDEX IF NOT EXISTS idx_llm_usage_user_date ON llm_usage(userId, date);
    CREATE INDEX IF NOT EXISTS idx_llm_usage_baby_date ON llm_usage(babyId, date);
  `)
  log('MIGRATE', '数据库 schema 迁移完成')
}
ensureSchema()

// 缓存辅助函数
function generateCacheKey(prefix, params) {
  return `${prefix}:${JSON.stringify(params)}`
}

// 清除相关缓存
function clearRecordsCacheForBaby(babyId) {
  const keys = cache.keys()
  const cleared = []
  keys.forEach(key => {
    // 同时匹配数字和字符串格式的 babyId
    if (key.startsWith('records:') &&
        (key.includes(`"babyId":${babyId}`) || key.includes(`"babyId":"${babyId}"`))) {
      cache.del(key)
      cleared.push(key)
    }
  })
  log('INFO', `清除宝宝 ${babyId} 的记录缓存`, { cleared, count: cleared.length })
}

// 中间件
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true,
  }),
)
app.use(express.json())

// 请求日志中间件
app.use((req, res, next) => {
  const startTime = Date.now()

  // 记录响应
  const originalSend = res.send
  res.send = function(data) {
    const duration = Date.now() - startTime
    log('API', `${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`, {
      query: req.query,
      body: req.method !== 'GET' ? req.body : undefined,
    })
    return originalSend.call(this, data)
  }

  next()
})

// JWT 验证中间件
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '')

  // 开发模式：无 token 时自动使用测试用户
  if (process.env.NODE_ENV === 'development' && !token) {
    req.userId = 1
    req.openId = process.env.DEV_OPENID || 'test'
    return next()
  }

  if (!token) {
    return res.status(401).json({ error: '未提供认证令牌' })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.userId = decoded.userId
    req.openId = decoded.openId
    next()
  } catch (error) {
    return res.status(401).json({ error: '无效的认证令牌' })
  }
}

// ============ 认证接口 ============

// 登录/注册（使用微信 code 换取 openId）
app.post('/api/auth/login', async (req, res) => {
  try {
    const { code } = req.body

    let openId

    // 开发环境：使用环境变量中的测试 openId
    if (process.env.NODE_ENV === 'development' && process.env.DEV_OPENID) {
      console.log('🔧 开发模式：使用测试 openId')
      openId = process.env.DEV_OPENID
    } else if (!process.env.WECHAT_APPID) {
      log('ERROR', '开发环境缺少配置 DEV_OPENID')
      return res.status(500).json({ error: '服务器配置错误' })
    } else {
      // 生产环境：调用微信 API 获取 openId
      const APPID = process.env.WECHAT_APPID
      const SECRET = process.env.WECHAT_SECRET

      if (!APPID || !SECRET) {
        log('ERROR', '缺少微信配置: WECHAT_APPID 或 WECHAT_SECRET')
        return res.status(500).json({ error: '服务器配置错误' })
      }

      const wxRes = await fetch(
        `https://api.weixin.qq.com/sns/jscode2session?appid=${APPID}&secret=${SECRET}&js_code=${code}&grant_type=authorization_code`
      )
      const wxData = await wxRes.json()

      if (wxData.errcode) {
        log('ERROR', '微信登录失败', { errcode: wxData.errcode, errmsg: wxData.errmsg })
        return res.status(400).json({ error: wxData.errmsg || '微信登录失败' })
      }

      openId = wxData.openid
    }

    // 查找或创建用户
    let user = db.prepare('SELECT * FROM users WHERE openId = ?').get(openId)

    console.log('查询到的用户:', user)

    if (!user) {
      const now = Date.now()
      const result = db
        .prepare(
          `
        INSERT INTO users (openId, createdAt, updatedAt)
        VALUES (?, ?, ?)
      `,
        )
        .run(openId, now, now)

      user = {
        id: result.lastInsertRowid,
        openId,
        createdAt: now,
        updatedAt: now,
      }
    }

    // 生成 JWT
    const token = jwt.sign({ userId: user.id, openId: user.openId }, process.env.JWT_SECRET, {
      expiresIn: '30d',
    })

    const responseData = {
      success: true,
      data: {
        token,
        user: {
          ...user,
          babyIds: user.babyIds ? JSON.parse(user.babyIds) : [],
        },
      },
    }

    console.log('返回的用户数据:', responseData.data.user)

    res.json(responseData)
  } catch (error) {
    log('ERROR', '登录失败', { error: error.message })
    res.status(500).json({ error: '登录失败' })
  }
})

// ============ 用户接口 ============

app.get('/api/user/current', verifyToken, (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId)

    if (!user) {
      return res.status(404).json({ error: '用户不存在' })
    }

    res.json({
      success: true,
      data: {
        ...user,
        babyIds: user.babyIds ? JSON.parse(user.babyIds) : [],
      },
    })
  } catch (error) {
    log('ERROR', '获取用户信息失败', { error: error.message, userId: req.userId })
    res.status(500).json({ error: '获取用户信息失败' })
  }
})

app.put('/api/user/current', verifyToken, (req, res) => {
  try {
    const { nickname, avatarUrl, currentBabyId } = req.body
    const now = Date.now()

    db.prepare(
      `
      UPDATE users
      SET nickname = ?, avatarUrl = ?, currentBabyId = ?, updatedAt = ?
      WHERE id = ?
    `,
    ).run(nickname, avatarUrl, currentBabyId, now, req.userId)

    res.json({ success: true })
  } catch (error) {
    log('ERROR', '更新用户信息失败', { error: error.message, userId: req.userId })
    res.status(500).json({ error: '更新用户信息失败' })
  }
})

// ============ 宝宝接口 ============

app.get('/api/babies', verifyToken, (req, res) => {
  try {
    // 生成缓存键
    const cacheKey = generateCacheKey('babies', { userId: req.userId })

    // 尝试从缓存获取
    const cachedData = cache.get(cacheKey)
    if (cachedData) {
      log('CACHE', '命中缓存 - 宝宝列表', { cacheKey })
      return res.json(cachedData)
    }

    const user = db.prepare('SELECT babyIds FROM users WHERE id = ?').get(req.userId)

    if (!user || !user.babyIds) {
      const emptyResponse = { success: true, data: [] }
      cache.set(cacheKey, emptyResponse, 60) // 空列表缓存时间短一些
      return res.json(emptyResponse)
    }

    const babyIds = JSON.parse(user.babyIds)
    if (babyIds.length === 0) {
      const emptyResponse = { success: true, data: [] }
      cache.set(cacheKey, emptyResponse, 60)
      return res.json(emptyResponse)
    }

    const placeholders = babyIds.map(() => '?').join(',')
    const babies = db.prepare(`SELECT * FROM babies WHERE id IN (${placeholders})`).all(...babyIds)

    // 为每个宝宝获取成员详细信息
    const babiesWithMembers = babies.map((b) => {
      const memberIds = b.memberIds ? JSON.parse(b.memberIds) : []

      // 获取成员详细信息
      const members = memberIds.map((userId) => {
        const userInfo = db.prepare('SELECT id, nickname FROM users WHERE id = ?').get(userId)
        const memberRelation = db.prepare('SELECT role FROM baby_members WHERE babyId = ? AND userId = ?').get(b.id, userId)

        return {
          userId,
          nickname: userInfo?.nickname || '未命名',
          role: memberRelation?.role || '成员',
        }
      })

      return {
        ...b,
        memberIds,
        members,
      }
    })

    const responseData = {
      success: true,
      data: babiesWithMembers,
    }

    // 存入缓存
    cache.set(cacheKey, responseData)
    log('CACHE', '存入缓存 - 宝宝列表', { cacheKey })

    res.json(responseData)
  } catch (error) {
    log('ERROR', '获取宝宝列表失败', { error: error.message })
    res.status(500).json({ error: '获取宝宝列表失败' })
  }
})

app.post('/api/babies', verifyToken, (req, res) => {
  try {
    const { name, gender, birthday, avatarUrl, role } = req.body
    const now = Date.now()

    // 创建宝宝，将创建者添加到成员列表
    const result = db
      .prepare(
        `
      INSERT INTO babies (name, gender, birthday, avatarUrl, creatorId, memberIds, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(name, gender, birthday, avatarUrl, req.userId, JSON.stringify([req.userId]), now, now)

    const babyId = result.lastInsertRowid

    // 添加成员关系记录（保存角色信息）
    db.prepare(
      `
      INSERT INTO baby_members (babyId, userId, role, createdAt)
      VALUES (?, ?, ?, ?)
    `,
    ).run(babyId, req.userId, role || '家长', now)

    // 更新用户的宝宝列表
    const user = db.prepare('SELECT babyIds, currentBabyId FROM users WHERE id = ?').get(req.userId)
    const babyIds = user.babyIds ? JSON.parse(user.babyIds) : []
    babyIds.push(babyId)

    db.prepare(
      `
      UPDATE users
      SET babyIds = ?, currentBabyId = ?, updatedAt = ?
      WHERE id = ?
    `,
    ).run(JSON.stringify(babyIds), user.currentBabyId || babyId, now, req.userId)

    res.json({
      success: true,
      data: {
        id: babyId,
        name,
        gender,
        birthday,
        avatarUrl,
        creatorId: req.userId,
        memberIds: [req.userId],
        createdAt: now,
        updatedAt: now,
      },
    })

    // 清除用户的宝宝列表缓存
    const userCacheKey = generateCacheKey('babies', { userId: req.userId })
    cache.del(userCacheKey)
  } catch (error) {
    log('ERROR', '创建宝宝失败', { error: error.message, userId: req.userId })
    res.status(500).json({ error: '创建宝宝失败' })
  }
})

app.put('/api/babies/:id', verifyToken, (req, res) => {
  try {
    const babyId = parseInt(req.params.id)
    const { name, gender, birthday, avatarUrl } = req.body

    // 检查权限：只有创建者可以编辑
    const baby = db.prepare('SELECT * FROM babies WHERE id = ?').get(babyId)
    if (!baby) {
      return res.status(404).json({ error: '宝宝不存在' })
    }
    if (baby.creatorId !== req.userId) {
      return res.status(403).json({ error: '只有创建者可以编辑宝宝信息' })
    }

    const now = Date.now()

    db.prepare(
      `
      UPDATE babies
      SET name = ?, gender = ?, birthday = ?, avatarUrl = ?, updatedAt = ?
      WHERE id = ?
    `,
    ).run(name, gender, birthday, avatarUrl, now, babyId)

    res.json({ success: true })

    // 清除用户的宝宝列表缓存
    const userCacheKey = generateCacheKey('babies', { userId: req.userId })
    cache.del(userCacheKey)
  } catch (error) {
    log('ERROR', '更新宝宝信息失败', { error: error.message, babyId: req.params.id })
    res.status(500).json({ error: '更新宝宝信息失败' })
  }
})

app.delete('/api/babies/:id', verifyToken, (req, res) => {
  try {
    const babyId = parseInt(req.params.id)

    // 检查权限：只有创建者可以删除
    const baby = db.prepare('SELECT * FROM babies WHERE id = ?').get(babyId)
    if (!baby) {
      return res.status(404).json({ error: '宝宝不存在' })
    }
    if (baby.creatorId !== req.userId) {
      return res.status(403).json({ error: '只有创建者可以删除宝宝' })
    }

    // 删除宝宝的所有记录
    db.prepare('DELETE FROM records WHERE babyId = ?').run(babyId)

    // 删除宝宝
    db.prepare('DELETE FROM babies WHERE id = ?').run(babyId)

    // 更新用户的宝宝列表
    const user = db.prepare('SELECT babyIds, currentBabyId FROM users WHERE id = ?').get(req.userId)
    const babyIds = user.babyIds ? JSON.parse(user.babyIds) : []
    const newBabyIds = babyIds.filter((id) => id !== babyId)
    const newCurrentBabyId =
      user.currentBabyId === babyId ? newBabyIds[0] || null : user.currentBabyId

    db.prepare(
      `
      UPDATE users
      SET babyIds = ?, currentBabyId = ?, updatedAt = ?
      WHERE id = ?
    `,
    ).run(JSON.stringify(newBabyIds), newCurrentBabyId, Date.now(), req.userId)

    res.json({ success: true })

    // 清除相关缓存
    const userCacheKey = generateCacheKey('babies', { userId: req.userId })
    cache.del(userCacheKey)
    clearRecordsCacheForBaby(babyId)
  } catch (error) {
    log('ERROR', '删除宝宝失败', { error: error.message, babyId: req.params.id })
    res.status(500).json({ error: '删除宝宝失败' })
  }
})

// 删除宝宝成员
app.delete('/api/babies/:babyId/members/:userId', verifyToken, (req, res) => {
  try {
    const babyId = parseInt(req.params.babyId)
    const memberUserId = parseInt(req.params.userId)

    // 检查宝宝是否存在
    const baby = db.prepare('SELECT * FROM babies WHERE id = ?').get(babyId)
    if (!baby) {
      return res.status(404).json({ error: '宝宝不存在' })
    }

    // 检查权限：只有创建者可以删除成员
    if (baby.creatorId !== req.userId) {
      return res.status(403).json({ error: '只有创建者可以删除成员' })
    }

    // 检查要删除的成员是否存在
    const memberIds = baby.memberIds ? JSON.parse(baby.memberIds) : []
    if (!memberIds.includes(memberUserId)) {
      return res.status(404).json({ error: '该成员不存在于宝宝列表中' })
    }

    // 如果删除的是创建者自己，需要将第二个成员提升为创建者
    let newCreatorId = baby.creatorId
    if (memberUserId === baby.creatorId) {
      // 找到第二个成员（不是创建者的第一个成员）
      const otherMembers = memberIds.filter(id => id !== memberUserId)

      if (otherMembers.length === 0) {
        // 如果没有其他成员了，不允许删除自己（创建者）
        return res.status(400).json({ error: '创建者是最后一个成员，无法删除。请先添加其他成员或删除整个宝宝。' })
      }

      // 将第一个其他成员设置为新的创建者
      newCreatorId = otherMembers[0]

      log('INFO', '创建者删除自己，提升新创建者', {
        babyId,
        oldCreatorId: memberUserId,
        newCreatorId
      })
    }

    // 从成员列表中移除该用户
    const newMemberIds = memberIds.filter(id => id !== memberUserId)

    // 更新宝宝的成员列表和创建者（如果需要）
    const now = Date.now()
    db.prepare(
      `
      UPDATE babies
      SET memberIds = ?, creatorId = ?, updatedAt = ?
      WHERE id = ?
    `
    ).run(JSON.stringify(newMemberIds), newCreatorId, now, babyId)

    // 从 baby_members 表中删除关系记录
    db.prepare('DELETE FROM baby_members WHERE babyId = ? AND userId = ?').run(babyId, memberUserId)

    // 从被删除用户的宝宝列表中移除这个宝宝
    const memberUser = db.prepare('SELECT babyIds, currentBabyId FROM users WHERE id = ?').get(memberUserId)
    if (memberUser) {
      const userBabyIds = memberUser.babyIds ? JSON.parse(memberUser.babyIds) : []
      const newUserBabyIds = userBabyIds.filter(id => id !== babyId)
      const newCurrentBabyId = memberUser.currentBabyId === babyId
        ? (newUserBabyIds[0] || null)
        : memberUser.currentBabyId

      db.prepare(
        `
        UPDATE users
        SET babyIds = ?, currentBabyId = ?, updatedAt = ?
        WHERE id = ?
      `
      ).run(JSON.stringify(newUserBabyIds), newCurrentBabyId, now, memberUserId)
    }

    res.json({
      success: true,
      data: {
        newCreatorId: newCreatorId !== baby.creatorId ? newCreatorId : undefined
      }
    })

    // 清除相关用户的宝宝列表缓存
    const creatorCacheKey = generateCacheKey('babies', { userId: req.userId })
    const memberCacheKey = generateCacheKey('babies', { userId: memberUserId })
    cache.del(creatorCacheKey)
    cache.del(memberCacheKey)

    // 如果提升了新创建者，也清除新创建者的缓存
    if (newCreatorId !== baby.creatorId) {
      const newCreatorCacheKey = generateCacheKey('babies', { userId: newCreatorId })
      cache.del(newCreatorCacheKey)
    }

    log('INFO', '删除宝宝成员成功', {
      babyId,
      deletedUserId: memberUserId,
      newCreatorId: newCreatorId !== baby.creatorId ? newCreatorId : undefined
    })
  } catch (error) {
    log('ERROR', '删除宝宝成员失败', {
      error: error.message,
      babyId: req.params.babyId,
      userId: req.params.userId
    })
    res.status(500).json({ error: '删除宝宝成员失败' })
  }
})

// 加入宝宝（通过邀请）
app.post('/api/babies/:babyId/join', verifyToken, (req, res) => {
  try {
    const babyId = parseInt(req.params.babyId)
    const { role } = req.body

    // 检查宝宝是否存在
    const baby = db.prepare('SELECT * FROM babies WHERE id = ?').get(babyId)
    if (!baby) {
      return res.status(404).json({ error: '宝宝不存在' })
    }

    // 检查用户是否已经是成员
    const memberIds = baby.memberIds ? JSON.parse(baby.memberIds) : []
    if (memberIds.includes(req.userId)) {
      return res.status(400).json({ error: '您已经是该宝宝的成员' })
    }

    // 将用户添加到宝宝的成员列表
    const newMemberIds = [...memberIds, req.userId]
    const now = Date.now()

    db.prepare(
      `
      UPDATE babies
      SET memberIds = ?, updatedAt = ?
      WHERE id = ?
    `
    ).run(JSON.stringify(newMemberIds), now, babyId)

    // 添加成员关系记录
    db.prepare(
      `
      INSERT INTO baby_members (babyId, userId, role, createdAt)
      VALUES (?, ?, ?, ?)
    `
    ).run(babyId, req.userId, role || '家长', now)

    // 更新用户的宝宝列表
    const user = db.prepare('SELECT babyIds, currentBabyId FROM users WHERE id = ?').get(req.userId)
    const userBabyIds = user.babyIds ? JSON.parse(user.babyIds) : []
    userBabyIds.push(babyId)

    db.prepare(
      `
      UPDATE users
      SET babyIds = ?, currentBabyId = ?, updatedAt = ?
      WHERE id = ?
    `
    ).run(JSON.stringify(userBabyIds), user.currentBabyId || babyId, now, req.userId)

    res.json({
      success: true,
      data: {
        babyId,
        role: role || '家长'
      }
    })

    // 清除相关缓存
    const userCacheKey = generateCacheKey('babies', { userId: req.userId })
    cache.del(userCacheKey)

    log('INFO', '用户加入宝宝成功', {
      babyId,
      userId: req.userId,
      role: role || '家长'
    })
  } catch (error) {
    log('ERROR', '加入宝宝失败', {
      error: error.message,
      babyId: req.params.babyId,
      userId: req.userId
    })
    res.status(500).json({ error: '加入宝宝失败' })
  }
})

// ============ 记录接口 ============

app.get('/api/records/:id', verifyToken, (req, res) => {
  try {
    const recordId = parseInt(req.params.id)

    // 生成缓存键
    const cacheKey = generateCacheKey('record', { id: recordId })

    // 尝试从缓存获取
    const cachedData = cache.get(cacheKey)
    if (cachedData) {
      log('CACHE', '命中缓存 - 记录详情', { cacheKey })
      return res.json(cachedData)
    }

    const query = `
      SELECT r.*, bm.role as reporterRole
      FROM records r
      LEFT JOIN baby_members bm ON r.babyId = bm.babyId AND r.reporterId = bm.userId
      WHERE r.id = ?
    `
    const record = db.prepare(query).get(recordId)

    if (!record) {
      return res.status(404).json({ error: '记录不存在' })
    }

    const responseData = {
      success: true,
      data: {
        ...record,
        extra: record.extra ? JSON.parse(record.extra) : null,
        reporterRole: record.reporterRole || '家长',
      },
    }

    // 存入缓存
    cache.set(cacheKey, responseData)
    log('CACHE', '存入缓存 - 记录详情', { cacheKey })

    res.json(responseData)
  } catch (error) {
    log('ERROR', '获取记录详情失败', { error: error.message, recordId: req.params.id })
    res.status(500).json({ error: '获取记录详情失败' })
  }
})

app.get('/api/records', verifyToken, (req, res) => {
  try {
    const { babyId, category, limit = 20, offset = 0, startDate, endDate } = req.query

    // 标准化参数（确保类型一致）
    const normalizedParams = {
      babyId: babyId ? parseInt(babyId) : undefined,
      category,
      limit: parseInt(limit),
      offset: parseInt(offset),
      startDate: startDate ? parseInt(startDate) : undefined,
      endDate: endDate ? parseInt(endDate) : undefined,
    }

    // 生成缓存键
    const cacheKey = generateCacheKey('records', normalizedParams)

    // 尝试从缓存获取
    const cachedData = cache.get(cacheKey)
    if (cachedData) {
      log('CACHE', '命中缓存 - 记录列表', { cacheKey })
      return res.json(cachedData)
    }

    let query = `
      SELECT r.*, bm.role as reporterRole
      FROM records r
      LEFT JOIN baby_members bm ON r.babyId = bm.babyId AND r.reporterId = bm.userId
      WHERE 1=1
    `
    const params = []

    if (normalizedParams.babyId) {
      query += ' AND r.babyId = ?'
      params.push(normalizedParams.babyId)
    }

    if (category) {
      query += ' AND r.category = ?'
      params.push(category)
    }

    // 日期范围过滤
    if (normalizedParams.startDate) {
      query += ' AND r.startTime >= ?'
      params.push(normalizedParams.startDate)
    }

    if (normalizedParams.endDate) {
      query += ' AND r.startTime <= ?'
      params.push(normalizedParams.endDate)
    }

    query += ' ORDER BY r.startTime DESC LIMIT ? OFFSET ?'
    params.push(normalizedParams.limit)
    params.push(normalizedParams.offset)

    const records = db.prepare(query).all(...params)

    // 获取总数
    let countQuery = 'SELECT COUNT(*) as total FROM records r WHERE 1=1'
    const countParams = []

    if (normalizedParams.babyId) {
      countQuery += ' AND r.babyId = ?'
      countParams.push(normalizedParams.babyId)
    }

    if (category) {
      countQuery += ' AND r.category = ?'
      countParams.push(category)
    }

    // 日期范围过滤（计数时也需要）
    if (normalizedParams.startDate) {
      countQuery += ' AND r.startTime >= ?'
      countParams.push(normalizedParams.startDate)
    }

    if (normalizedParams.endDate) {
      countQuery += ' AND r.startTime <= ?'
      countParams.push(normalizedParams.endDate)
    }

    const { total } = db.prepare(countQuery).get(...countParams)

    const responseData = {
      success: true,
      data: records.map((r) => ({
        ...r,
        extra: r.extra ? JSON.parse(r.extra) : null,
        reporterRole: r.reporterRole || '家长',
      })),
      pagination: {
        total,
        limit: normalizedParams.limit,
        offset: normalizedParams.offset,
        hasMore: normalizedParams.offset + records.length < total,
      },
    }

    // 存入缓存
    cache.set(cacheKey, responseData)
    log('CACHE', '存入缓存 - 记录列表', { cacheKey })

    res.json(responseData)
  } catch (error) {
    log('ERROR', '获取记录失败', { error: error.message, query: req.query })
    res.status(500).json({ error: '获取记录失败' })
  }
})

app.post('/api/records', verifyToken, (req, res) => {
  const { babyId, category, subCategory, startTime, endTime, value, extra, note } = req.body
  try {
    const now = Date.now()

    const result = db
      .prepare(
        `
      INSERT INTO records (babyId, category, subCategory, startTime, endTime, value, extra, note, reporterId, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        babyId,
        category,
        subCategory,
        startTime,
        endTime,
        value,
        extra ? JSON.stringify(extra) : null,
        note,
        req.userId,
        now,
        now,
      )

    res.json({
      success: true,
      data: {
        id: result.lastInsertRowid,
        babyId,
        category,
        subCategory,
        startTime,
        endTime,
        value,
        extra,
        note,
        reporterId: req.userId,
        createdAt: now,
        updatedAt: now,
      },
    })

    // 清除相关缓存
    clearRecordsCacheForBaby(babyId)
  } catch (error) {
    log('ERROR', '创建记录失败', { error: error.message, babyId })
    res.status(500).json({ error: '创建记录失败' })
  }
})

app.put('/api/records/:id', verifyToken, (req, res) => {
  try {
    const recordId = parseInt(req.params.id)
    const { category, subCategory, startTime, endTime, value, extra, note } = req.body
    const now = Date.now()

    // 检查记录是否存在
    const record = db.prepare('SELECT * FROM records WHERE id = ?').get(recordId)
    if (!record) {
      return res.status(404).json({ error: '记录不存在' })
    }

    // 更新记录（所有人都可以编辑）
    db.prepare(
      `
      UPDATE records
      SET category = ?, subCategory = ?, startTime = ?, endTime = ?, value = ?, extra = ?, note = ?, updatedAt = ?
      WHERE id = ?
    `,
    ).run(
      category,
      subCategory,
      startTime,
      endTime,
      value,
      extra ? JSON.stringify(extra) : null,
      note,
      now,
      recordId,
    )

    res.json({ success: true })

    // 清除相关缓存
    clearRecordsCacheForBaby(record.babyId)
  } catch (error) {
    log('ERROR', '更新记录失败', { error: error.message, recordId: req.params.id })
    res.status(500).json({ error: '更新记录失败' })
  }
})

app.delete('/api/records/:id', verifyToken, (req, res) => {
  try {
    const recordId = parseInt(req.params.id)

    // 检查记录是否存在
    const record = db.prepare('SELECT * FROM records WHERE id = ?').get(recordId)
    if (!record) {
      return res.status(404).json({ error: '记录不存在' })
    }

    // 所有人都可以删除记录
    db.prepare('DELETE FROM records WHERE id = ?').run(recordId)

    res.json({ success: true })

    // 清除相关缓存
    clearRecordsCacheForBaby(record.babyId)
  } catch (error) {
    log('ERROR', '删除记录失败', { error: error.message, recordId: req.params.id })
    res.status(500).json({ error: '删除记录失败' })
  }
})

// ============ 健康检查 ============

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() })
})

// ============ 缓存管理接口（调试用）============

// ============ 语音识别 AI 分析 ============

// 检查 LLM 调用次数限制（用户维度 + 宝宝维度）
function checkLLMRateLimit(userId, babyId) {
  const today = new Date().toISOString().split('T')[0]

  // 获取用户日限额（-1 表示无限）
  const user = db.prepare('SELECT llm_daily_limit FROM users WHERE id = ?').get(userId)
  const userLimit = user ? user.llm_daily_limit : 20

  // 获取宝宝日限额（-1 表示无限，NULL 表示默认 50）
  const baby = db.prepare('SELECT llm_daily_limit FROM babies WHERE id = ?').get(babyId)
  const babyLimit = baby?.llm_daily_limit != null ? baby.llm_daily_limit : 50

  // 查询今日用户总调用次数
  const userUsage = db.prepare(
    'SELECT COALESCE(SUM(count), 0) as total FROM llm_usage WHERE userId = ? AND date = ?'
  ).get(userId, today)

  // 查询今日该宝宝调用次数
  const babyUsage = db.prepare(
    'SELECT COALESCE(SUM(count), 0) as total FROM llm_usage WHERE babyId = ? AND date = ?'
  ).get(babyId, today)

  if (userLimit !== -1 && userUsage.total >= userLimit) {
    return { allowed: false, reason: `今日调用次数已达上限 (${userLimit}次)，联系作者可提高限额哦～` }
  }

  if (babyLimit !== -1 && babyUsage.total >= babyLimit) {
    return { allowed: false, reason: `今日该宝宝调用次数已达上限 (${babyLimit}次)，联系作者可提高限额哦～` }
  }

  return { allowed: true }
}

// 记录 LLM 调用
function recordLLMUsage(userId, babyId) {
  const today = new Date().toISOString().split('T')[0]
  db.prepare(`
    INSERT INTO llm_usage (userId, babyId, date, count)
    VALUES (?, ?, ?, 1)
    ON CONFLICT(userId, babyId, date) DO UPDATE SET count = count + 1
  `).run(userId, babyId, today)
}

// 调用 DeepSeek API 分析语音文本
function callDeepSeekAPI(text) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: `你是一个宝宝日常记录的智能助手。你只处理与宝宝日常护理相关的内容（喂养、睡觉、排便等）。

## 重要限制
如果用户输入的内容与宝宝日常记录完全无关（比如聊天气、问编程问题、讲笑话等），请返回空数组：[]。不要对无关内容强行分类。

## 分类规则
- food: 吃/喂养（关键词：喝、吃、奶、母乳、奶粉、辅食、喂）
- sleep: 睡觉（关键词：睡、觉、入睡、睡着）
- shit: 拉/换尿布（关键词：拉、大便、尿、换尿布、尿片、尿不湿）
- other: 其他与宝宝相关但不属于以上类别的内容

## 子类别（必须使用以下精确值）
food: breast_milk(母乳) / milk(奶粉) / babycook(辅食) / water(水)
sleep: subCategory 固定为 sleep
shit: big(大便) / small(换尿布/小便)

## value 规则
- food 类型：提取奶量/食量的数字，单位默认为 ml
- **sleep 类型：必须转换为分钟**，如"睡了5小时" → value="300"，"睡了30分钟" → value="30"
- shit 类型：通常不填 value

## 输出格式
只返回 JSON 数组，不要额外解释：
[
  { "category": "food", "subCategory": "milk", "value": "150", "note": "喝了150毫升奶" },
  { "category": "sleep", "subCategory": "sleep", "value": "300", "note": "睡了5小时" },
  { "category": "shit", "subCategory": "small", "note": "换了尿布" }
]`,
        },
        { role: 'user', content: text },
      ],
      temperature: 0.1,
      max_tokens: 1000,
    })

    const url = new URL('/v1/chat/completions', DEEPSEEK_API_BASE)
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
        },
        timeout: 30000,
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data)
            if (parsed.error) {
              reject(new Error(parsed.error.message || 'DeepSeek API 错误'))
              return
            }
            resolve(parsed.choices[0].message.content)
          } catch (e) {
            reject(new Error('DeepSeek 响应解析失败: ' + data.substring(0, 200)))
          }
        })
      }
    )

    req.on('timeout', () => {
      req.destroy()
      reject(new Error('DeepSeek API 请求超时'))
    })
    req.on('error', (e) => reject(e))
    req.write(body)
    req.end()
  })
}

// 子类别别名映射表：LLM 返回的各种可能值 → 系统实际值
const SUBCATEGORY_ALIASES = {
  // food
  breast: 'breast_milk',
  breast_milk: 'breast_milk',
  formula: 'milk',
  milk: 'milk',
  solid: 'babycook',
  babycook: 'babycook',
  water: 'water',
  // sleep
  sleep: 'sleep',
  // shit
  big: 'big',
  small: 'small',
}

// 校验并清理 LLM 返回的单条记录
function validateRecordItem(item) {
  const validCategories = ['food', 'sleep', 'shit', 'other']
  const category = validCategories.includes(item.category) ? item.category : 'other'
  const result = { category }

  // 子类别：先通过别名表转换，再校验
  if (item.subCategory) {
    const mapped = SUBCATEGORY_ALIASES[item.subCategory]
    if (mapped) {
      result.subCategory = mapped
    }
  }

  // 睡眠没有子类别时补上
  if (category === 'sleep' && !result.subCategory) {
    result.subCategory = 'sleep'
  }

  // value 处理：提取数字并做单位转换
  if (item.value && /^\d+/.test(String(item.value))) {
    let v = parseInt(String(item.value).match(/^\d+/)[0])

    // 睡眠单位转换：如果文字里提到"小时/h/小时(s)"且数值 < 24，转换为分钟
    if (category === 'sleep' && v > 0) {
      const text = (item.note || '').toLowerCase()
      if (/小时|个小时|个钟|hour|h\b/.test(text) && v < 24) {
        v = v * 60
      }
    }

    result.value = String(v)
  }

  result.note = item.note || ''

  return result
}

// POST /api/voice/analyze
app.post('/api/voice/analyze', verifyToken, async (req, res) => {
  const { text, babyId } = req.body

  if (!text || !text.trim()) {
    return res.status(400).json({ error: '文本内容不能为空' })
  }
  if (!babyId) {
    return res.status(400).json({ error: '请指定宝宝' })
  }

  const trimmedText = text.trim()

  // 限流检查
  const rateCheck = checkLLMRateLimit(req.userId, babyId)
  if (!rateCheck.allowed) {
    log('RATE', 'LLM 限流', { userId: req.userId, babyId, reason: rateCheck.reason })
    return res.status(429).json({ error: rateCheck.reason })
  }

  log('AI', '开始分析语音文本', { userId: req.userId, babyId, textLength: trimmedText.length })

  try {
    const aiResponse = await callDeepSeekAPI(trimmedText)
    log('AI', 'DeepSeek 原始响应', { response: aiResponse })

    // 解析 JSON
    let parsed
    const jsonMatch = aiResponse.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0])
    } else {
      // 尝试匹配单个对象
      const objMatch = aiResponse.match(/\{[\s\S]*\}/)
      if (objMatch) {
        parsed = [JSON.parse(objMatch[0])]
      } else {
        throw new Error('无法解析 AI 响应')
      }
    }

    // 确保是数组
    const items = Array.isArray(parsed) ? parsed : [parsed]

    // 校验每条记录
    const validated = items.map(validateRecordItem).filter(item => item.note || item.category !== 'other')

    // 过滤后为空，说明内容与宝宝无关，拒绝处理
    if (validated.length === 0) {
      return res.json({ success: false, error: '请描述与宝宝日常相关的内容，如喂奶、睡觉、换尿布等' })
    }

    // 记录 LLM 调用次数
    recordLLMUsage(req.userId, babyId)

    log('AI', '分析完成', { validated, count: validated.length })
    res.json({ success: true, data: validated })
  } catch (error) {
    log('ERROR', 'AI 分析失败', { error: error.message, text: trimmedText })
    // 兜底：返回 other 记录
    res.json({ success: true, data: [{ category: 'other', note: trimmedText }] })
  }
})

// 清除所有缓存
app.post('/api/admin/cache/clear', verifyToken, (req, res) => {
  try {
    const keys = cache.keys()
    cache.flushAll()
    log('INFO', '手动清除所有缓存', { clearedCount: keys.length })
    res.json({
      success: true,
      message: `已清除 ${keys.length} 个缓存项`,
      keys
    })
  } catch (error) {
    log('ERROR', '清除缓存失败', { error: error.message })
    res.status(500).json({ error: '清除缓存失败' })
  }
})

// 查看缓存统计
app.get('/api/admin/cache/stats', verifyToken, (req, res) => {
  try {
    const keys = cache.keys()
    const stats = cache.getStats()
    res.json({
      success: true,
      data: {
        keys,
        count: keys.length,
        stats
      }
    })
  } catch (error) {
    log('ERROR', '获取缓存统计失败', { error: error.message })
    res.status(500).json({ error: '获取缓存统计失败' })
  }
})

// 启动服务器
app.listen(PORT, () => {
  log('INFO', `服务器启动成功 http://localhost:${PORT}`)
  log('INFO', `数据库: ${process.env.DB_PATH}`)
  log('INFO', `日志目录: ${logsDir}`)
  log('INFO', `备份目录: ${backupDir}`)
})

// 优雅关闭
process.on('SIGINT', () => {
  log('INFO', '服务器正在关闭...')
  db.close()
  process.exit(0)
})
