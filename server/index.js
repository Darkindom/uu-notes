require('dotenv').config()
const express = require('express')
const cors = require('cors')
const Database = require('better-sqlite3')
const jwt = require('jsonwebtoken')
const fs = require('fs')
const path = require('path')

const app = express()
const PORT = process.env.PORT || 1717

// 确保数据目录存在
const dataDir = path.dirname(process.env.DB_PATH || './data/uu-notes.db')
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

// 初始化数据库
const db = new Database(process.env.DB_PATH || './data/uu-notes.db')

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

  CREATE INDEX IF NOT EXISTS idx_users_openId ON users(openId);
  CREATE INDEX IF NOT EXISTS idx_babies_creatorId ON babies(creatorId);
  CREATE INDEX IF NOT EXISTS idx_records_babyId ON records(babyId);
  CREATE INDEX IF NOT EXISTS idx_records_startTime ON records(startTime);
`)

console.log('数据库初始化完成')

// 中间件
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true,
  }),
)
app.use(express.json())

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

    // TODO: 调用微信 API 获取 openId
    // const wxRes = await fetch(`https://api.weixin.qq.com/sns/jscode2session?appid=YOUR_APPID&secret=YOUR_SECRET&js_code=${code}&grant_type=authorization_code`)
    // const { openid } = await wxRes.json()

    // 暂时使用 mock 数据（需要替换为真实的微信登录）
    const openId = `mock_${code}`

    // 查找或创建用户
    let user = db.prepare('SELECT * FROM users WHERE openId = ?').get(openId)

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

    res.json({
      success: true,
      data: {
        token,
        user: {
          ...user,
          babyIds: user.babyIds ? JSON.parse(user.babyIds) : [],
        },
      },
    })
  } catch (error) {
    console.error('登录失败:', error)
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
    console.error('获取用户信息失败:', error)
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
    console.error('更新用户信息失败:', error)
    res.status(500).json({ error: '更新用户信息失败' })
  }
})

// ============ 宝宝接口 ============

app.get('/api/babies', verifyToken, (req, res) => {
  try {
    const user = db.prepare('SELECT babyIds FROM users WHERE id = ?').get(req.userId)

    if (!user || !user.babyIds) {
      return res.json({ success: true, data: [] })
    }

    const babyIds = JSON.parse(user.babyIds)
    if (babyIds.length === 0) {
      return res.json({ success: true, data: [] })
    }

    const placeholders = babyIds.map(() => '?').join(',')
    const babies = db.prepare(`SELECT * FROM babies WHERE id IN (${placeholders})`).all(...babyIds)

    res.json({
      success: true,
      data: babies.map((b) => ({
        ...b,
        memberIds: b.memberIds ? JSON.parse(b.memberIds) : [],
      })),
    })
  } catch (error) {
    console.error('获取宝宝列表失败:', error)
    res.status(500).json({ error: '获取宝宝列表失败' })
  }
})

app.post('/api/babies', verifyToken, (req, res) => {
  try {
    const { name, gender, birthday, avatarUrl, role } = req.body
    const now = Date.now()

    // 创建宝宝
    const result = db
      .prepare(
        `
      INSERT INTO babies (name, gender, birthday, avatarUrl, creatorId, memberIds, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(name, gender, birthday, avatarUrl, req.userId, JSON.stringify([]), now, now)

    const babyId = result.lastInsertRowid

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
        memberIds: [],
        createdAt: now,
        updatedAt: now,
      },
    })
  } catch (error) {
    console.error('创建宝宝失败:', error)
    res.status(500).json({ error: '创建宝宝失败' })
  }
})

app.delete('/api/babies/:id', verifyToken, (req, res) => {
  try {
    const babyId = parseInt(req.params.id)

    // 检查权限
    const baby = db.prepare('SELECT * FROM babies WHERE id = ?').get(babyId)
    if (!baby || baby.creatorId !== req.userId) {
      return res.status(403).json({ error: '无权删除此宝宝' })
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
  } catch (error) {
    console.error('删除宝宝失败:', error)
    res.status(500).json({ error: '删除宝宝失败' })
  }
})

// ============ 记录接口 ============

app.get('/api/records', verifyToken, (req, res) => {
  try {
    const { babyId, category, limit = 50 } = req.query

    let query = 'SELECT * FROM records WHERE 1=1'
    const params = []

    if (babyId) {
      query += ' AND babyId = ?'
      params.push(parseInt(babyId))
    }

    if (category) {
      query += ' AND category = ?'
      params.push(category)
    }

    query += ' ORDER BY startTime DESC LIMIT ?'
    params.push(parseInt(limit))

    const records = db.prepare(query).all(...params)

    res.json({
      success: true,
      data: records.map((r) => ({
        ...r,
        extra: r.extra ? JSON.parse(r.extra) : null,
      })),
    })
  } catch (error) {
    console.error('获取记录失败:', error)
    res.status(500).json({ error: '获取记录失败' })
  }
})

app.post('/api/records', verifyToken, (req, res) => {
  try {
    const { babyId, category, subCategory, startTime, endTime, value, extra, note } = req.body
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
  } catch (error) {
    console.error('创建记录失败:', error)
    res.status(500).json({ error: '创建记录失败' })
  }
})

app.delete('/api/records/:id', verifyToken, (req, res) => {
  try {
    const recordId = parseInt(req.params.id)

    // 检查权限
    const record = db.prepare('SELECT * FROM records WHERE id = ?').get(recordId)
    if (!record || record.reporterId !== req.userId) {
      return res.status(403).json({ error: '无权删除此记录' })
    }

    db.prepare('DELETE FROM records WHERE id = ?').run(recordId)

    res.json({ success: true })
  } catch (error) {
    console.error('删除记录失败:', error)
    res.status(500).json({ error: '删除记录失败' })
  }
})

// ============ 健康检查 ============

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() })
})

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 服务器运行在 http://localhost:${PORT}`)
  console.log(`📦 数据库: ${process.env.DB_PATH}`)
})

// 优雅关闭
process.on('SIGINT', () => {
  db.close()
  process.exit(0)
})
