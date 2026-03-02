require('dotenv').config()
const express = require('express')
const cors = require('cors')
const Database = require('better-sqlite3')
const jwt = require('jsonwebtoken')
const fs = require('fs')
const path = require('path')
const NodeCache = require('node-cache')

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

// 初始化数据库
const db = new Database(process.env.DB_PATH || './data/uu-notes.db')
log('INFO', '数据库初始化完成')

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

// 缓存辅助函数
function generateCacheKey(prefix, params) {
  return `${prefix}:${JSON.stringify(params)}`
}

// 清除相关缓存
function clearRecordsCacheForBaby(babyId) {
  const keys = cache.keys()
  keys.forEach(key => {
    if (key.startsWith('records:') && key.includes(`"babyId":${babyId}`)) {
      cache.del(key)
    }
  })
  log('INFO', `清除宝宝 ${babyId} 的记录缓存`)
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

    // 生成缓存键
    const cacheKey = generateCacheKey('records', { 
      babyId, 
      category, 
      limit, 
      offset, 
      startDate, 
      endDate 
    })

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

    if (babyId) {
      query += ' AND r.babyId = ?'
      params.push(parseInt(babyId))
    }

    if (category) {
      query += ' AND r.category = ?'
      params.push(category)
    }

    // 日期范围过滤
    if (startDate) {
      query += ' AND r.startTime >= ?'
      params.push(parseInt(startDate))
    }

    if (endDate) {
      query += ' AND r.startTime <= ?'
      params.push(parseInt(endDate))
    }

    query += ' ORDER BY r.startTime DESC LIMIT ? OFFSET ?'
    params.push(parseInt(limit))
    params.push(parseInt(offset))

    const records = db.prepare(query).all(...params)

    // 获取总数
    let countQuery = 'SELECT COUNT(*) as total FROM records r WHERE 1=1'
    const countParams = []
    
    if (babyId) {
      countQuery += ' AND r.babyId = ?'
      countParams.push(parseInt(babyId))
    }
    
    if (category) {
      countQuery += ' AND r.category = ?'
      countParams.push(category)
    }

    // 日期范围过滤（计数时也需要）
    if (startDate) {
      countQuery += ' AND r.startTime >= ?'
      countParams.push(parseInt(startDate))
    }

    if (endDate) {
      countQuery += ' AND r.startTime <= ?'
      countParams.push(parseInt(endDate))
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
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + records.length < total,
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
