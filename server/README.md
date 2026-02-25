# UU Notes 后端服务

基于 Node.js + Express + SQLite 的轻量级后端服务，可以运行在 NAS 上。

## 特性

- ✅ 轻量级，资源占用少
- ✅ 使用 SQLite，无需额外数据库服务
- ✅ RESTful API 设计
- ✅ JWT 认证
- ✅ 支持跨域请求

## 安装

### 在 NAS 上安装 Node.js

根据你的 NAS 系统选择安装方式：

**群晖 (Synology)**
```bash
# 通过套件中心安装 Node.js
# 或使用 SSH 安装
wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
```

**威联通 (QNAP)**
```bash
# 通过 App Center 安装 Node.js
# 或使用命令行
opkg update
opkg install node
```

**通用方法（Docker）**
```bash
# 使用 Docker 运行（推荐）
docker run -d \
  --name uu-notes-server \
  --restart unless-stopped \
  -p 3000:3000 \
  -v /your/nas/path/data:/app/data \
  -v /your/nas/path/server:/app \
  node:18-alpine \
  sh -c "cd /app && npm install && npm start"
```

### 安装依赖

```bash
cd server
npm install
```

### 配置

1. 复制环境变量文件
```bash
cp .env.example .env
```

2. 编辑 `.env` 文件
```bash
PORT=3000
JWT_SECRET=your-random-secret-key-here
DB_PATH=./data/uu-notes.db
ALLOWED_ORIGINS=https://your-domain.com
```

### 启动服务

```bash
# 开发模式（自动重启）
npm run dev

# 生产模式
npm start
```

## 配置 HTTPS 和域名

### 方案 1：使用 Nginx 反向代理（推荐）

1. 在 NAS 上安装 Nginx
2. 配置 SSL 证书（Let's Encrypt 免费）
3. 配置反向代理

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location /api {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 方案 2：使用内网穿透（无公网 IP）

如果 NAS 没有公网 IP，可以使用内网穿透服务：

**frp (免费开源)**
```bash
# 下载 frpc
wget https://github.com/fatedier/frp/releases/download/v0.52.0/frp_0.52.0_linux_amd64.tar.gz
tar -xzf frp_0.52.0_linux_amd64.tar.gz

# 配置 frpc.ini
[common]
server_addr = your-frp-server.com
server_port = 7000
token = your_token

[uu-notes]
type = https
local_port = 3000
custom_domains = your-domain.com

# 启动 frpc
./frpc -c frpc.ini
```

**其他选择**
- [ngrok](https://ngrok.com/) - 简单但需付费
- [Cloudflare Tunnel](https://www.cloudflare.com/products/tunnel/) - 免费，但需域名托管在 Cloudflare
- [花生壳](https://hsk.oray.com/) - 国内服务

## 配置小程序

### 1. 配置服务器域名

在微信公众平台：
1. 登录 https://mp.weixin.qq.com
2. 进入"开发" → "开发管理" → "开发设置"
3. 找到"服务器域名"
4. 配置：
   - **request 合法域名**：`https://your-domain.com`
   - **uploadFile 合法域名**：`https://your-domain.com`（如果需要上传图片）

⚠️ 注意：
- 必须是 HTTPS
- 必须备案（如果域名在国内）
- 端口只能是 443（HTTPS 默认端口）

### 2. 修改小程序代码

创建新的 API 工具类 `src/utils/api.ts`：

```typescript
import Taro from '@tarojs/taro'

const API_BASE = 'https://your-domain.com/api'

// 获取 token
const getToken = (): string | null => {
  return Taro.getStorageSync('token')
}

// 设置 token
export const setToken = (token: string) => {
  Taro.setStorageSync('token', token)
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
    })

    if (res.statusCode === 200 && res.data.success) {
      return res.data.data
    } else {
      throw new Error(res.data.error || '请求失败')
    }
  } catch (error) {
    console.error('API 请求失败:', error)
    throw error
  }
}

// 登录
export const login = async (code: string) => {
  const data = await request<{ token: string; user: any }>({
    url: '/auth/login',
    method: 'POST',
    data: { code },
    needAuth: false,
  })
  setToken(data.token)
  return data.user
}

// 获取当前用户
export const getCurrentUser = () => {
  return request<any>({ url: '/user/current' })
}

// 更新用户信息
export const updateUser = (data: any) => {
  return request({ url: '/user/current', method: 'PUT', data })
}

// 获取宝宝列表
export const getBabies = () => {
  return request<any[]>({ url: '/babies' })
}

// 创建宝宝
export const createBaby = (data: any) => {
  return request({ url: '/babies', method: 'POST', data })
}

// 删除宝宝
export const deleteBaby = (id: number) => {
  return request({ url: `/babies/${id}`, method: 'DELETE' })
}

// 获取记录列表
export const getRecords = (params: { babyId?: number; category?: string; limit?: number }) => {
  const query = new URLSearchParams(params as any).toString()
  return request<any[]>({ url: `/records?${query}` })
}

// 创建记录
export const createRecord = (data: any) => {
  return request({ url: '/records', method: 'POST', data })
}

// 删除记录
export const deleteRecord = (id: number) => {
  return request({ url: `/records/${id}`, method: 'DELETE' })
}
```

### 3. 修改现有代码

将 `src/utils/db.ts` 中的所有云开发调用替换为 API 调用。

## 数据迁移

如果已有云开发数据，需要导出并导入到 SQLite：

1. 从云开发导出数据（JSON 格式）
2. 编写迁移脚本导入到 SQLite

## 监控和维护

### 使用 PM2 管理进程

```bash
# 安装 PM2
npm install -g pm2

# 启动服务
pm2 start index.js --name uu-notes-server

# 开机自启
pm2 startup
pm2 save

# 查看日志
pm2 logs uu-notes-server

# 重启
pm2 restart uu-notes-server
```

### 日志

日志会输出到控制台，使用 PM2 可以自动管理日志文件。

### 备份

定期备份 `data/uu-notes.db` 文件：

```bash
# 手动备份
cp data/uu-notes.db data/backup/uu-notes-$(date +%Y%m%d).db

# 自动备份（crontab）
0 2 * * * /your/path/backup.sh
```

## 性能优化

1. 使用 SQLite 的 WAL 模式（已默认启用）
2. 添加适当的索引（已配置）
3. 使用 Redis 缓存热点数据（可选）
4. 启用 gzip 压缩

## 成本对比

| 项目 | 微信云开发 | NAS 自建 |
|------|----------|---------|
| 数据库 | ¥19.9/月起 | 免费 |
| 云函数 | ¥0.0133/万次 | 免费 |
| CDN | 按量计费 | 免费（带宽受限） |
| 存储 | ¥0.18/GB/月 | 免费（NAS 容量） |
| **总计** | **~¥50/月** | **~¥0** |

## 注意事项

⚠️ **需要配置的微信功能**
- 需要在小程序后台配置服务器域名
- 需要实现真实的微信登录（调用微信 API 获取 openId）
- 需要配置 AppID 和 AppSecret

⚠️ **安全建议**
- 使用强密码作为 JWT_SECRET
- 定期更新依赖包
- 启用防火墙，只开放必要端口
- 使用 HTTPS
- 添加请求限流（rate limiting）

⚠️ **备案要求**
- 如果域名在国内，需要 ICP 备案
- 如果使用境外服务器，可以不备案但访问速度可能较慢
