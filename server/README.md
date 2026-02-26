# UU Notes Server

> UU Notes 的后端服务，基于 Node.js + Express + SQLite 构建

## 📖 简介

这是 UU Notes 宝宝成长记录小程序的后端 API 服务，提供数据存储、用户认证、记录管理等核心功能。

**技术栈**：
- Node.js + Express - Web 框架
- SQLite + better-sqlite3 - 轻量级数据库
- JWT - 用户认证
- CORS - 跨域支持

**特点**：
- ✅ 轻量级，资源占用极低（内存 < 50MB）
- ✅ 使用 SQLite，无需额外数据库服务
- ✅ 支持 Docker 一键部署
- ✅ RESTful API 设计
- ✅ 完整的错误处理和日志记录

## 🚀 快速开始

### 方式一：使用 Docker（推荐）

```bash
# 1. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，修改 JWT_SECRET

# 2. 启动服务
docker-compose up -d

# 3. 验证服务是否正常
curl http://localhost:1717/health
```

### 方式二：直接运行

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，修改配置

# 3. 启动服务
npm start

# 开发模式（自动重启）
npm run dev
```

## ⚙️ 配置说明

`.env` 文件配置项：

```bash
# 服务端口
PORT=1717

# JWT 密钥（请务必修改为随机字符串，至少 32 位）
JWT_SECRET=your-super-secret-jwt-key-change-this

# 数据库文件路径
DB_PATH=./data/uu-notes.db

# 允许的跨域来源（生产环境建议设置具体域名）
ALLOWED_ORIGINS=*
```

⚠️ **安全提示**：
- 生产环境请务必修改 `JWT_SECRET` 为随机字符串
- `ALLOWED_ORIGINS` 建议设置为小程序的具体域名，如 `https://your-domain.com`

## 📡 API 接口

### 认证相关

#### 登录/注册
```http
POST /api/auth/login
Content-Type: application/json

{
  "code": "微信登录 code"
}
```

返回：
```json
{
  "success": true,
  "data": {
    "token": "JWT Token",
    "user": { ... }
  }
}
```

### 用户相关

#### 获取当前用户信息
```http
GET /api/user/current
Authorization: Bearer {token}
```

#### 更新用户信息
```http
PUT /api/user/current
Authorization: Bearer {token}
Content-Type: application/json

{
  "nickname": "昵称",
  "avatarUrl": "头像URL",
  "currentBabyId": 1
}
```

### 宝宝管理

#### 获取宝宝列表
```http
GET /api/babies
Authorization: Bearer {token}
```

#### 创建宝宝
```http
POST /api/babies
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "宝宝名字",
  "gender": "boy/girl",
  "birthday": 1234567890000,
  "avatarUrl": "头像URL"
}
```

#### 删除宝宝
```http
DELETE /api/babies/:id
Authorization: Bearer {token}
```

### 记录管理

#### 获取记录列表
```http
GET /api/records?babyId=1&category=feed&limit=50
Authorization: Bearer {token}
```

参数说明：
- `babyId` - 宝宝ID（可选）
- `category` - 记录类型（可选）：feed/sleep/diaper/temperature 等
- `limit` - 返回数量（默认 50）

#### 创建记录
```http
POST /api/records
Authorization: Bearer {token}
Content-Type: application/json

{
  "babyId": 1,
  "category": "feed",
  "subCategory": "breast",
  "startTime": 1234567890000,
  "endTime": 1234567890000,
  "value": "120ml",
  "note": "备注"
}
```

#### 删除记录
```http
DELETE /api/records/:id
Authorization: Bearer {token}
```

### 健康检查

```http
GET /health
```

返回服务器状态和时间戳。

## 🗄️ 数据库结构

### users 表
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  openId TEXT UNIQUE NOT NULL,
  nickname TEXT,
  avatarUrl TEXT,
  currentBabyId INTEGER,
  babyIds TEXT,  -- JSON 数组
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);
```

### babies 表
```sql
CREATE TABLE babies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  gender TEXT NOT NULL,
  birthday INTEGER NOT NULL,
  avatarUrl TEXT,
  creatorId INTEGER NOT NULL,
  memberIds TEXT,  -- JSON 数组
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);
```

### records 表
```sql
CREATE TABLE records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  babyId INTEGER NOT NULL,
  category TEXT NOT NULL,
  subCategory TEXT,
  startTime INTEGER NOT NULL,
  endTime INTEGER,
  value TEXT,
  extra TEXT,  -- JSON 对象
  note TEXT,
  reporterId INTEGER NOT NULL,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);
```

## 🔧 运维管理

### 使用 PM2（生产环境推荐）

```bash
# 安装 PM2
npm install -g pm2

# 启动服务
pm2 start index.js --name uu-notes-server

# 开机自启
pm2 startup
pm2 save

# 常用命令
pm2 list                    # 查看所有进程
pm2 logs uu-notes-server    # 查看日志
pm2 restart uu-notes-server # 重启服务
pm2 stop uu-notes-server    # 停止服务
pm2 delete uu-notes-server  # 删除进程
```

### 数据备份

数据库文件位于 `data/uu-notes.db`，建议定期备份。

**手动备份**：
```bash
cp data/uu-notes.db backups/uu-notes-$(date +%Y%m%d).db
```

**自动备份脚本** `backup.sh`：
```bash
#!/bin/bash
DATE=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="/path/to/backups"
DB_PATH="/path/to/uu-notes/data/uu-notes.db"

# 创建备份
cp $DB_PATH $BACKUP_DIR/uu-notes-$DATE.db

# 删除 30 天前的备份
find $BACKUP_DIR -name "uu-notes-*.db" -mtime +30 -delete

echo "备份完成: uu-notes-$DATE.db"
```

添加定时任务（每天凌晨 2 点自动备份）：
```bash
crontab -e
# 添加以下行
0 2 * * * /path/to/backup.sh >> /var/log/uu-notes-backup.log 2>&1
```

### 查看日志

```bash
# Docker 方式
docker logs -f uu-notes-server

# PM2 方式
pm2 logs uu-notes-server

# 直接运行方式
# 日志输出到标准输出
```

## 🔒 安全建议

1. **JWT 密钥**
   - 使用至少 32 位的随机字符串
   - 定期轮换密钥（需要用户重新登录）

2. **CORS 配置**
   - 生产环境限制 `ALLOWED_ORIGINS` 为具体域名
   - 避免使用 `*` 通配符

3. **HTTPS**
   - 生产环境必须使用 HTTPS
   - 推荐使用 Cloudflare Tunnel 或 Nginx + Let's Encrypt

4. **防火墙**
   - 只开放必要的端口（如 443）
   - 限制 API 端口（1717）只允许本地或内网访问

5. **依赖更新**
   - 定期运行 `npm audit` 检查安全漏洞
   - 及时更新依赖包：`npm update`

## ❓ 常见问题

### Q1: 如何修改端口？

编辑 `.env` 文件中的 `PORT` 配置，然后重启服务。

### Q2: 数据库文件损坏怎么办？

SQLite 的数据库文件比较稳定，但如果确实损坏：
1. 停止服务
2. 从备份中恢复数据库文件
3. 重新启动服务

### Q3: 如何配置微信登录？

代码中默认使用 mock 登录（用于测试）。生产环境需要配置真实的微信登录：

1. 在 `.env` 中添加：
```bash
WECHAT_APPID=你的小程序AppID
WECHAT_SECRET=你的小程序Secret
```

2. 修改 `index.js` 中的 `/api/auth/login` 接口：
```javascript
// 调用微信 API
const wxRes = await fetch(
  `https://api.weixin.qq.com/sns/jscode2session?` +
  `appid=${process.env.WECHAT_APPID}&` +
  `secret=${process.env.WECHAT_SECRET}&` +
  `js_code=${code}&` +
  `grant_type=authorization_code`
)
const { openid } = await wxRes.json()
```

### Q4: 如何重置数据库？

```bash
# 停止服务
docker-compose down  # 或 pm2 stop uu-notes-server

# 删除数据库文件
rm data/uu-notes.db

# 重新启动（会自动创建新的空数据库）
docker-compose up -d  # 或 pm2 start uu-notes-server
```

### Q5: 如何查看当前有多少用户/记录？

连接到数据库查询：
```bash
sqlite3 data/uu-notes.db

# 查看用户数
SELECT COUNT(*) FROM users;

# 查看记录数
SELECT COUNT(*) FROM records;

# 退出
.exit
```

## 📚 相关文档

- [项目整体 README](../README.md)
- [快速部署指南](../docs/Quick-Deploy.md)
- [绿联 NAS 部署教程](../docs/UGreen-Deploy.md)

## 📄 许可证

MIT License
