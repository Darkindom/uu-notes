# 从微信云开发迁移到自建服务器

## 迁移方案对比

### 方案 A：完全迁移（推荐）
- 优点：完全免费，数据自主可控
- 缺点：需要配置域名和 HTTPS，需要一定技术能力
- 适合：有 NAS 且愿意折腾的用户

### 方案 B：混合方案
- 优点：渐进式迁移，风险小
- 缺点：需要维护两套系统
- 适合：想先测试再决定的用户

### 方案 C：继续使用云开发
- 优点：简单省心，微信官方维护
- 缺点：需要付费
- 适合：不想折腾的用户

## 完全迁移步骤

### 第一阶段：准备工作

#### 1. 确认 NAS 环境
- [ ] NAS 可以运行 Docker 或 Node.js
- [ ] NAS 有公网 IP 或可以使用内网穿透
- [ ] 有域名（可以在阿里云/腾讯云购买，约 ¥50/年）
- [ ] 准备 SSL 证书（Let's Encrypt 免费）

#### 2. 域名备案（仅国内需要）
如果你的 NAS 在国内且使用国内域名：
- 到域名服务商提交备案申请
- 等待审核（通常 7-20 天）
- 备案完成后才能使用 80/443 端口

**快速方案（跳过备案）**：
- 使用境外服务器（如香港 VPS）做中转
- 使用 Cloudflare 等 CDN 服务
- 缺点：可能影响访问速度

### 第二阶段：部署后端服务

#### 方法 1：使用 Docker（推荐）

```bash
# 1. 将 server 文件夹上传到 NAS
# 例如上传到: /volume1/docker/uu-notes-server

# 2. SSH 连接到 NAS
ssh your-nas-ip

# 3. 进入目录
cd /volume1/docker/uu-notes-server

# 4. 配置环境变量
cp .env.example .env
nano .env  # 编辑配置

# 5. 启动服务
docker-compose up -d

# 6. 查看日志
docker-compose logs -f
```

#### 方法 2：直接运行 Node.js

```bash
# 1. 上传到 NAS
# 例如: /volume1/nodejs/uu-notes-server

# 2. 安装依赖
cd /volume1/nodejs/uu-notes-server
npm install

# 3. 配置环境变量
cp .env.example .env
nano .env

# 4. 启动服务
npm start

# 或使用 PM2（推荐）
npm install -g pm2
pm2 start index.js --name uu-notes-server
pm2 startup  # 设置开机自启
pm2 save
```

### 第三阶段：配置 HTTPS

#### 使用 Nginx 反向代理

1. **安装 Nginx**
   - 群晖：套件中心安装 "Web Station"
   - QNAP：App Center 安装 "NGINX"
   - 或使用 Docker：`docker pull nginx:alpine`

2. **获取 SSL 证书**

   **方法 A：Let's Encrypt（免费）**
   ```bash
   # 安装 certbot
   apt-get install certbot
   
   # 获取证书
   certbot certonly --standalone -d your-domain.com
   ```

   **方法 B：使用 Cloudflare**
   - 将域名解析到 Cloudflare
   - 在 Cloudflare 面板开启 SSL/TLS（Flexible 模式）
   - 下载 Origin 证书

   **方法 C：阿里云/腾讯云证书**
   - 在云服务商申请免费 SSL 证书
   - 下载证书文件

3. **配置 Nginx**

   创建 `nginx.conf`:
   ```nginx
   http {
       upstream uu-notes-api {
           server localhost:3000;
       }

       server {
           listen 80;
           server_name your-domain.com;
           
           # HTTP 重定向到 HTTPS
           return 301 https://$server_name$request_uri;
       }

       server {
           listen 443 ssl http2;
           server_name your-domain.com;

           # SSL 证书
           ssl_certificate /path/to/cert.pem;
           ssl_certificate_key /path/to/key.pem;
           
           # SSL 配置
           ssl_protocols TLSv1.2 TLSv1.3;
           ssl_ciphers HIGH:!aNULL:!MD5;
           ssl_prefer_server_ciphers on;

           # API 代理
           location /api {
               proxy_pass http://uu-notes-api;
               proxy_set_header Host $host;
               proxy_set_header X-Real-IP $remote_addr;
               proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
               proxy_set_header X-Forwarded-Proto $scheme;
               
               # CORS（如果需要）
               add_header Access-Control-Allow-Origin *;
               add_header Access-Control-Allow-Methods 'GET, POST, PUT, DELETE, OPTIONS';
               add_header Access-Control-Allow-Headers 'Authorization, Content-Type';
           }

           # 健康检查
           location /health {
               proxy_pass http://uu-notes-api/health;
           }
       }
   }
   ```

4. **重启 Nginx**
   ```bash
   nginx -t  # 测试配置
   nginx -s reload  # 重启
   ```

#### 使用内网穿透（无公网 IP）

**方案 A：frp（免费开源）**

1. **准备一台有公网 IP 的服务器**（可以买最便宜的 VPS，约 ¥20/月）

2. **服务器端配置**
   ```bash
   # 下载 frps
   wget https://github.com/fatedier/frp/releases/download/v0.52.0/frp_0.52.0_linux_amd64.tar.gz
   tar -xzf frp_0.52.0_linux_amd64.tar.gz
   cd frp_0.52.0_linux_amd64

   # 配置 frps.ini
   cat > frps.ini << EOF
   [common]
   bind_port = 7000
   token = your-secret-token
   vhost_https_port = 443
   EOF

   # 启动服务端
   ./frps -c frps.ini
   ```

3. **NAS 端配置**
   ```bash
   # 下载 frpc
   wget https://github.com/fatedier/frp/releases/download/v0.52.0/frp_0.52.0_linux_amd64.tar.gz
   tar -xzf frp_0.52.0_linux_amd64.tar.gz
   cd frp_0.52.0_linux_amd64

   # 配置 frpc.ini
   cat > frpc.ini << EOF
   [common]
   server_addr = your-server-ip
   server_port = 7000
   token = your-secret-token

   [uu-notes-https]
   type = https
   local_ip = 127.0.0.1
   local_port = 3000
   custom_domains = your-domain.com
   EOF

   # 启动客户端
   ./frpc -c frpc.ini
   ```

**方案 B：Cloudflare Tunnel（免费）**

1. **注册 Cloudflare 账号**
2. **添加你的域名**
3. **安装 cloudflared**
   ```bash
   # 在 NAS 上安装
   wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
   chmod +x cloudflared-linux-amd64
   mv cloudflared-linux-amd64 /usr/local/bin/cloudflared

   # 登录
   cloudflared tunnel login

   # 创建隧道
   cloudflared tunnel create uu-notes

   # 配置路由
   cloudflared tunnel route dns uu-notes your-domain.com

   # 创建配置文件
   cat > ~/.cloudflared/config.yml << EOF
   tunnel: uu-notes
   credentials-file: /root/.cloudflared/<tunnel-id>.json

   ingress:
     - hostname: your-domain.com
       service: http://localhost:3000
     - service: http_status:404
   EOF

   # 运行隧道
   cloudflared tunnel run uu-notes
   ```

### 第四阶段：配置小程序

#### 1. 配置服务器域名

登录微信公众平台 https://mp.weixin.qq.com

1. 进入"开发" → "开发管理" → "开发设置"
2. 找到"服务器域名"
3. 配置：
   - **request 合法域名**：`https://your-domain.com`
   - **uploadFile 合法域名**：`https://your-domain.com`

⚠️ 注意：
- 必须是 HTTPS
- 必须是 443 端口（不能加端口号）
- 域名需要备案（国内）

#### 2. 配置微信登录

后端需要调用微信 API 获取 openId：

在 `server/index.js` 中找到 `POST /api/auth/login` 路由，修改：

```javascript
// 替换 TODO 部分
const wxRes = await fetch(
  `https://api.weixin.qq.com/sns/jscode2session?` +
  `appid=YOUR_APPID&` +
  `secret=YOUR_SECRET&` +
  `js_code=${code}&` +
  `grant_type=authorization_code`
)
const wxData = await wxRes.json()

if (wxData.errcode) {
  throw new Error(wxData.errmsg)
}

const openId = wxData.openid
```

在微信公众平台获取：
- **AppID**：开发设置页面
- **AppSecret**：开发设置页面（需要管理员扫码）

**安全建议**：将 AppID 和 AppSecret 放到环境变量：

`.env`:
```bash
WECHAT_APPID=your_appid
WECHAT_SECRET=your_secret
```

代码中使用：
```javascript
const APPID = process.env.WECHAT_APPID
const SECRET = process.env.WECHAT_SECRET
```

#### 3. 修改小程序代码

将所有 `src/utils/db.ts` 的调用替换为 `src/utils/api.ts`：

**示例修改**：

修改前（`src/pages/index/index.tsx`）:
```typescript
import { getCurrentBaby } from '@/utils/db'

// ...
const baby = await getCurrentBaby()
```

修改后：
```typescript
import { getCurrentBaby } from '@/utils/api'

// ...
const baby = await getCurrentBaby()
```

需要修改的文件：
- `src/app.ts` - 登录逻辑
- `src/pages/index/index.tsx`
- `src/pages/baby-info/index.tsx`
- `src/pages/add-baby/index.tsx`
- `src/pages/onboarding/index.tsx`
- `src/pages/food/index.tsx`
- `src/pages/sleep/index.tsx`
- `src/pages/shit/index.tsx`
- `src/pages/other/index.tsx`
- `src/pages/records/index.tsx`

#### 4. 更新 API 域名

编辑 `src/utils/api.ts`，修改：
```typescript
const API_BASE = 'https://your-domain.com/api'  // 改为你的域名
```

### 第五阶段：数据迁移

#### 1. 导出云开发数据

登录微信公众平台 → 云开发控制台：

```bash
# 导出每个集合
# users, babies, records
```

或使用云开发 CLI：
```bash
npm install -g @cloudbase/cli
tcb login
tcb database:export users -e your-env-id -f users.json
tcb database:export babies -e your-env-id -f babies.json
tcb database:export records -e your-env-id -f records.json
```

#### 2. 导入到 SQLite

创建迁移脚本 `server/migrate.js`:

```javascript
const Database = require('better-sqlite3')
const fs = require('fs')

const db = new Database('./data/uu-notes.db')

// 读取导出的数据
const users = JSON.parse(fs.readFileSync('users.json', 'utf8'))
const babies = JSON.parse(fs.readFileSync('babies.json', 'utf8'))
const records = JSON.parse(fs.readFileSync('records.json', 'utf8'))

// 导入 users
const insertUser = db.prepare(`
  INSERT INTO users (openId, nickname, avatarUrl, currentBabyId, babyIds, createdAt, updatedAt)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`)

for (const user of users) {
  insertUser.run(
    user.openId,
    user.nickname,
    user.avatarUrl,
    user.currentBabyId,
    JSON.stringify(user.babyIds || []),
    user.createdAt || Date.now(),
    user.updatedAt || Date.now()
  )
}

// 导入 babies（类似）
// 导入 records（类似）

console.log('迁移完成！')
db.close()
```

运行迁移：
```bash
node migrate.js
```

### 第六阶段：测试验证

#### 1. 测试后端 API

```bash
# 健康检查
curl https://your-domain.com/health

# 测试登录（使用 mock 数据）
curl -X POST https://your-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"code":"test123"}'
```

#### 2. 测试小程序

1. 在开发者工具中运行小程序
2. 清除缓存和存储
3. 重新登录
4. 测试所有功能：
   - [ ] 登录
   - [ ] 创建宝宝
   - [ ] 切换宝宝
   - [ ] 添加记录（吃/睡/拉/其他）
   - [ ] 查看记录列表
   - [ ] 删除记录
   - [ ] 删除宝宝

#### 3. 性能测试

使用 Apache Bench 测试：
```bash
ab -n 1000 -c 10 https://your-domain.com/health
```

### 第七阶段：上线

1. **切换生产环境**
   - 将小程序改为使用新的 API
   - 在微信开发者工具中上传代码
   - 提交审核

2. **监控运行状态**
   ```bash
   # 查看服务状态
   docker-compose ps
   # 或
   pm2 status

   # 查看日志
   docker-compose logs -f
   # 或
   pm2 logs uu-notes-server
   ```

3. **设置告警**
   - 使用 UptimeRobot 监控服务可用性（免费）
   - 配置邮件/短信通知

## 回滚方案

如果迁移失败，可以快速回滚到云开发：

1. 在小程序代码中切换回 `src/utils/db.ts`
2. 重新上传并发布
3. 云开发数据仍然存在，不影响使用

## 成本分析

### 云开发成本
- 数据库：¥19.9/月
- 云函数：¥0.0133/万次
- 云存储：¥0.18/GB/月
- **总计**：约 ¥50-100/月

### 自建成本
- 域名：¥50/年（约 ¥4/月）
- SSL 证书：免费（Let's Encrypt）
- NAS：已有，¥0
- 电费：约 ¥5/月（按 10W 功耗计算）
- VPS（如需内网穿透）：¥20/月（可选）
- **总计**：¥9-29/月

**节省**：¥40-90/月，一年节省 ¥500-1000

## 常见问题

### Q: 没有公网 IP 怎么办？
A: 使用内网穿透（frp 或 Cloudflare Tunnel），或购买最便宜的 VPS 做中转（约 ¥20/月）

### Q: 域名需要备案吗？
A: 如果服务器在国内，域名需要备案。使用境外服务器或内网穿透可以跳过备案。

### Q: NAS 性能够用吗？
A: 对于个人或小团队使用完全够用。建议至少 2GB RAM。

### Q: 安全性如何保障？
A: 
- 使用 HTTPS 加密传输
- JWT token 认证
- 定期更新依赖包
- 配置防火墙
- 定期备份数据

### Q: 如果 NAS 坏了怎么办？
A: 
- 定期备份数据库文件到云盘
- 使用 RAID 保护硬盘
- 快速恢复：在其他机器上启动 Docker 容器，导入备份数据

### Q: 可以同时保留云开发作为备份吗？
A: 可以，使用双写策略，同时写入自建数据库和云开发，但会增加复杂度。

## 获取帮助

遇到问题？
1. 查看服务器日志
2. 查看小程序调试信息
3. 检查网络连接（域名解析、防火墙）
4. 参考完整文档：`server/README.md`
