# 🚀 NAS 部署超简单教程（10 分钟上手）

> 这是最简化的教程，让你快速上手。详细教程见：群晖 `Synology-Deploy.md` 或威联通 `QNAP-Deploy.md`

## 📋 准备清单

在开始前，确认你有：
- ✅ NAS（群晖/威联通/其他）
- ✅ 能访问 NAS 的网页管理界面
- ✅ 10-20 分钟时间
- ✅ （可选）域名

## 🎯 核心步骤（只需 3 步！）

```
步骤 1: 在 NAS 上安装 Docker
    ↓
步骤 2: 上传项目文件并启动
    ↓
步骤 3: 配置 HTTPS（使用 Cloudflare Tunnel）
```

---

## 步骤 1️⃣：安装 Docker

### 群晖用户
1. 打开"套件中心"
2. 搜索 "Container Manager"（或 "Docker"）
3. 点击"安装"
4. ✅ 完成！

### 威联通用户
1. 打开 "App Center"
2. 搜索 "Container Station"
3. 点击"安装"
4. ✅ 完成！

### 其他 NAS
- 查看 NAS 是否支持 Docker
- 或使用 Node.js 直接部署（见方案二）

---

## 步骤 2️⃣：上传文件并启动

### 2.1 上传文件

**群晖**：
1. 打开 File Station
2. 进入 `/docker` 文件夹（没有就创建）
3. 创建文件夹 `uu-notes-server`
4. 将 `server` 文件夹下的所有文件上传进去

**威联通**：
1. 打开 File Station
2. 进入 `/Container` 文件夹
3. 创建文件夹 `uu-notes-server`
4. 上传 `server` 文件夹下的所有文件

**Windows 用户快捷方式**：
- 在文件资源管理器输入：
  - 群晖：`\\你的NAS的IP\docker`
  - 威联通：`\\你的NAS的IP\Container`
- 直接拖拽文件

### 2.2 配置环境变量

在 `uu-notes-server` 文件夹中：

1. **复制文件**：
   - 找到 `.env.example`
   - 复制并重命名为 `.env`

2. **编辑 `.env`**：
   ```bash
   PORT=3000
   JWT_SECRET=abc123xyz789qwerty  # 改成任意随机字符串
   DB_PATH=./data/uu-notes.db
   ALLOWED_ORIGINS=*
   ```

### 2.3 启动服务

**方法 A：使用命令行（推荐，3 行命令搞定）**

1. **开启 SSH**：
   - 群晖：控制面板 → 终端机和 SNMP → 启动 SSH
   - 威联通：控制台 → 网络与文件服务 → Telnet/SSH → 允许 SSH

2. **连接 NAS**：
   
   Windows 打开 PowerShell：
   ```powershell
   ssh admin@你的NAS的IP
   # 例如：ssh admin@192.168.1.100
   # 输入密码
   ```

   Mac 打开终端：
   ```bash
   ssh admin@你的NAS的IP
   # 输入密码
   ```

3. **运行服务**（就 3 行！）：
   
   **群晖**：
   ```bash
   cd /volume1/docker/uu-notes-server
   sudo docker-compose up -d
   sudo docker-compose logs -f
   ```

   **威联通**：
   ```bash
   cd /share/Container/uu-notes-server
   docker-compose up -d
   docker-compose logs -f
   ```

4. **看到类似内容就成功了**：
   ```
   ✓ Container uu-notes-server  Started
   🚀 服务器运行在 http://localhost:3000
   数据库初始化完成
   ```

**方法 B：使用图形界面**

群晖：
1. 打开 Container Manager
2. 点击"项目" → "新增"
3. 项目名称：`uu-notes-server`
4. 路径选择上传文件的位置
5. 点击"完成"

威联通：
1. 打开 Container Station
2. 点击"创建" → "Create Application"
3. 粘贴 `docker-compose.yml` 内容
4. 点击"Create"

### 2.4 测试服务

打开浏览器，访问：
```
http://你的NAS的IP:3000/health
```

例如：`http://192.168.1.100:3000/health`

如果看到 `{"status":"ok"...}` 就成功了！🎉

**如果访问不了**：
- 检查防火墙是否开放 3000 端口
- 群晖：控制面板 → 安全性 → 防火墙 → 编辑规则 → 新增 → 端口 3000
- 威联通：控制台 → 安全性 → 安全等级 → 允许 3000 端口

---

## 步骤 3️⃣：配置 HTTPS（Cloudflare Tunnel）

小程序必须用 HTTPS，用 Cloudflare Tunnel 最简单（免费、不需要公网 IP）

### 3.1 准备域名

**如果还没有域名**，先购买一个（约 ¥30-50/年）：
- 阿里云：https://wanwang.aliyun.com
- 腾讯云：https://dnspod.cloud.tencent.com
- 推荐买 `.com` 或 `.cn` 域名

### 3.2 注册 Cloudflare

1. 访问 https://dash.cloudflare.com/sign-up
2. 注册免费账号
3. 添加你的域名
4. 按提示修改域名的 DNS 服务器（在域名商那里改）
5. 等待生效（通常几分钟到几小时）

### 3.3 安装 Cloudflare Tunnel

SSH 连接到 NAS 后：

```bash
# 进入项目目录
cd /volume1/docker/uu-notes-server  # 群晖
# 或
cd /share/Container/uu-notes-server  # 威联通

# 下载 cloudflared（一行命令）
sudo wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 && sudo chmod +x cloudflared-linux-amd64 && sudo mv cloudflared-linux-amd64 cloudflared

# 登录 Cloudflare
sudo ./cloudflared tunnel login
```

这时会显示一个网址，**复制到浏览器打开**，选择你的域名授权。

### 3.4 创建隧道

```bash
# 创建隧道（把 uu-notes 换成你喜欢的名字）
sudo ./cloudflared tunnel create uu-notes

# 会显示类似：Created tunnel uu-notes with id xxxxxxxxxx
# 记下这个 ID

# 配置路由（把 your-domain.com 改成你的域名）
sudo ./cloudflared tunnel route dns uu-notes your-domain.com
```

### 3.5 创建配置文件

```bash
# 创建配置文件
sudo nano config.yml
```

粘贴以下内容（**修改两处**）：

```yaml
tunnel: uu-notes
credentials-file: /root/.cloudflared/你的隧道ID.json  # 改成上面显示的 ID

ingress:
  - hostname: your-domain.com  # 改成你的域名
    service: http://localhost:3000
  - service: http_status:404
```

按 `Ctrl + O` 保存，`Ctrl + X` 退出

### 3.6 运行隧道

```bash
# 后台运行
sudo nohup ./cloudflared tunnel run uu-notes > cloudflared.log 2>&1 &

# 等待 10 秒
sleep 10

# 查看日志（按 Ctrl+C 退出）
tail -f cloudflared.log
```

看到 `Connection registered` 就成功了！

### 3.7 测试 HTTPS

浏览器访问：`https://your-domain.com/health`

如果看到 `{"status":"ok"...}` 就大功告成了！🎉🎉🎉

---

## 步骤 4️⃣：配置小程序（5 分钟）

### 4.1 修改小程序代码

编辑 `src/utils/api.ts` 第 4 行：

```typescript
const API_BASE = 'https://your-domain.com/api'  // 改成你的域名
```

### 4.2 配置微信后台

1. 登录 https://mp.weixin.qq.com
2. 开发 → 开发管理 → 开发设置
3. 找到"服务器域名"
4. request 合法域名：填入 `https://your-domain.com`
5. 保存

### 4.3 配置微信登录

1. **获取 AppID 和 AppSecret**：
   - 在微信公众平台"开发设置"页面
   - 复制 AppID 和 AppSecret（需要管理员扫码）

2. **配置到 NAS**：
   
   编辑 NAS 上的 `.env` 文件，添加：
   ```bash
   WECHAT_APPID=你的AppID
   WECHAT_SECRET=你的AppSecret
   ```

3. **修改后端代码**：
   
   编辑 `server/index.js`，找到第 67 行左右：
   
   ```javascript
   // 删除这行
   const openId = `mock_${code}`
   
   // 替换为（复制粘贴）：
   const APPID = process.env.WECHAT_APPID
   const SECRET = process.env.WECHAT_SECRET
   
   const wxRes = await fetch(
     `https://api.weixin.qq.com/sns/jscode2session?` +
     `appid=${APPID}&secret=${SECRET}&js_code=${code}&grant_type=authorization_code`
   )
   const wxData = await wxRes.json()
   
   if (wxData.errcode) {
     throw new Error(wxData.errmsg || '微信登录失败')
   }
   
   const openId = wxData.openid
   ```

4. **重启服务**：
   ```bash
   cd /volume1/docker/uu-notes-server  # 或威联通路径
   sudo docker-compose restart
   ```

### 4.4 替换所有 API 调用

需要修改 10 个文件，将 `@/utils/db` 改为 `@/utils/api`：

**快速批量替换方法**（VS Code）：
1. 按 `Ctrl+Shift+H`（Mac: `Cmd+Shift+H`）
2. 查找：`from '@/utils/db'`
3. 替换为：`from '@/utils/api'`
4. 点击"全部替换"

或者手动修改这些文件：
- `src/app.ts`
- `src/pages/index/index.tsx`
- `src/pages/baby-info/index.tsx`
- `src/pages/add-baby/index.tsx`
- `src/pages/onboarding/index.tsx`
- `src/pages/food/index.tsx`
- `src/pages/sleep/index.tsx`
- `src/pages/shit/index.tsx`
- `src/pages/other/index.tsx`
- `src/pages/records/index.tsx`

### 4.5 测试小程序

1. **清除缓存**：
   - 微信开发者工具 → 工具 → 清除缓存 → 全部清除

2. **重新编译**：
   - 点击"编译"

3. **测试功能**：
   - ✅ 登录
   - ✅ 创建宝宝
   - ✅ 添加记录
   - ✅ 查看记录

全部正常就完成了！🎊

---

## 🎯 检查清单

部署完成后，确认以下项目：

- [ ] NAS 上 Docker 容器正在运行
- [ ] 可以访问 `http://NAS的IP:3000/health`
- [ ] 可以访问 `https://your-domain.com/health`
- [ ] Cloudflare Tunnel 正在运行
- [ ] 微信后台已配置服务器域名
- [ ] 小程序可以正常登录
- [ ] 小程序可以创建宝宝和记录

---

## 🔧 常用命令

### 查看服务状态
```bash
# SSH 连接后
cd /volume1/docker/uu-notes-server  # 或威联通路径

# 查看容器状态
sudo docker-compose ps

# 查看日志
sudo docker-compose logs -f

# 重启服务
sudo docker-compose restart
```

### 备份数据
```bash
# 备份数据库
cp /volume1/docker/uu-notes-server/data/uu-notes.db ~/uu-notes-backup-$(date +%Y%m%d).db
```

### 查看 Cloudflare Tunnel 状态
```bash
cd /volume1/docker/uu-notes-server
tail -f cloudflared.log
```

---

## ❓ 常见问题

### Q1: 3000 端口访问不了？
**A**: 检查防火墙，开放 3000 端口

### Q2: Cloudflare Tunnel 连接失败？
**A**: 
```bash
# 查看日志
cat cloudflared.log

# 重启隧道
sudo pkill cloudflared
sudo nohup ./cloudflared tunnel run uu-notes > cloudflared.log 2>&1 &
```

### Q3: 小程序请求失败？
**A**: 
1. 确认域名已在微信后台配置
2. 确认用的是 HTTPS 不是 HTTP
3. 查看小程序控制台错误信息

### Q4: 重启 NAS 后服务没有自动启动？
**A**: 
```bash
# 设置 Docker 容器自动启动
cd /volume1/docker/uu-notes-server
sudo docker-compose up -d

# 设置 Cloudflare Tunnel 开机自启（群晖）
sudo nano /usr/local/etc/rc.d/cloudflared.sh
```

内容：
```bash
#!/bin/sh
cd /volume1/docker/uu-notes-server
./cloudflared tunnel run uu-notes > cloudflared.log 2>&1 &
```

```bash
sudo chmod +x /usr/local/etc/rc.d/cloudflared.sh
```

---

## 📚 完整文档

需要更详细的说明？查看：

- **群晖详细教程**：`docs/Synology-Deploy.md`
- **威联通详细教程**：`docs/QNAP-Deploy.md`
- **完整迁移指南**：`docs/Migration.md`
- **后端 API 文档**：`server/README.md`

---

## 🎉 恭喜完成！

现在你有了：
- ✅ 完全免费的后端服务（除了域名）
- ✅ 数据完全自主掌控
- ✅ 每年节省 ¥500-1000

享受你的小程序吧！🚀
