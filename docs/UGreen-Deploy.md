# 绿联 NAS DXP4800 Plus 部署完整教程

> 🎯 专门为绿联 DXP4800 Plus 优化的部署教程

## 📱 DXP4800 Plus 配置信息

你的设备配置：
- **CPU**: Intel N100（4核）
- **内存**: 8GB DDR5
- **系统**: UGOS Pro
- **Docker**: ✅ 原生支持
- **性能**: 非常适合运行我们的服务

## 🚀 快速部署（30分钟）

### 第一步：准备工作（5分钟）

1. **确认 Docker 已安装**
   - 打开 UGOS 管理界面（浏览器输入 NAS 的 IP）
   - 左侧菜单 → "应用" → 找到 "Docker"
   - 如果没有，点击"应用中心"搜索并安装 Docker

2. **开启 SSH**
   - 设置 → 服务 → SSH
   - 开启 SSH 服务
   - 端口默认 22

### 第二步：上传文件（5分钟）

#### 方法 A：使用文件管理器（推荐）

1. **访问 UGOS 文件管理器**
   - 浏览器打开：`http://你的NAS的IP`
   - 登录 UGOS

2. **创建项目文件夹**
   - 进入"共享文件夹"
   - 找到 `Public` 文件夹（或创建 `docker` 文件夹）
   - 创建新文件夹 `uu-notes-server`

3. **上传文件**
   - 将以下文件上传到 `/Public/uu-notes-server/`：
     ```
     server/index.js
     server/package.json
     server/.env.example
     server/Dockerfile
     server/docker-compose.yml
     ```

#### 方法 B：使用 SMB/Samba 共享

1. **Windows 访问**
   ```
   \\你的NAS的IP\Public
   ```

2. **Mac 访问**
   ```
   smb://你的NAS的IP/Public
   ```

3. **创建文件夹并复制文件**
   - 创建 `uu-notes-server` 文件夹
   - 将 `server` 文件夹下所有文件复制进去

### 第三步：配置环境变量（2分钟）

1. **复制配置文件**
   - 在文件管理器中找到 `.env.example`
   - 复制并重命名为 `.env`

2. **编辑 `.env` 文件**
   
   可以直接在 UGOS 文件管理器中右键编辑，或用文本编辑器：
   
   ```bash
   PORT=3000
   JWT_SECRET=ugreen-abc123-xyz789-qwerty  # 改成任意随机字符串
   DB_PATH=./data/uu-notes.db
   ALLOWED_ORIGINS=*
   ```

### 第四步：启动服务（3分钟）

1. **SSH 连接到绿联 NAS**
   
   Windows（PowerShell）：
   ```powershell
   ssh root@你的NAS的IP
   # 输入 UGOS 管理员密码
   ```

   Mac（终端）：
   ```bash
   ssh root@你的NAS的IP
   # 输入 UGOS 管理员密码
   ```

2. **进入项目目录**
   ```bash
   # 绿联的共享文件夹通常在这里
   cd /mnt/user/Public/uu-notes-server
   
   # 如果找不到，可以试试
   cd /mnt/data/Public/uu-notes-server
   
   # 查看文件是否都在
   ls -la
   ```

3. **启动 Docker 容器**
   ```bash
   # 启动服务
   docker-compose up -d
   
   # 查看运行状态
   docker-compose ps
   
   # 查看日志
   docker-compose logs -f
   ```

4. **看到以下内容说明成功**：
   ```
   ✓ Container uu-notes-server  Started
   🚀 服务器运行在 http://localhost:3000
   📦 数据库: ./data/uu-notes.db
   数据库初始化完成
   ```

   按 `Ctrl+C` 退出日志查看

### 第五步：测试服务（1分钟）

打开浏览器，访问：
```
http://你的NAS的IP:3000/health
```

如果看到 `{"status":"ok","timestamp":...}` 就成功了！🎉

**如果无法访问**：

检查绿联防火墙：
```bash
# SSH 连接后执行
# 开放 3000 端口
iptables -I INPUT -p tcp --dport 3000 -j ACCEPT
```

或在 UGOS 管理界面：
- 设置 → 安全 → 防火墙
- 添加规则允许 3000 端口

### 第六步：配置 HTTPS（15分钟，必须）

小程序要求必须使用 HTTPS。推荐使用 **Cloudflare Tunnel**（最简单，免费）。

#### 6.1 准备域名

如果还没有域名，先购买一个（约 ¥30-50/年）：
- 阿里云：https://wanwang.aliyun.com
- 腾讯云：https://dnspod.cloud.tencent.com

#### 6.2 注册 Cloudflare

1. 访问 https://dash.cloudflare.com/sign-up
2. 注册免费账号
3. 添加你的域名
4. 按提示修改域名的 DNS 服务器

#### 6.3 安装 Cloudflare Tunnel

SSH 连接到绿联 NAS：

```bash
# 进入项目目录
cd /mnt/user/Public/uu-notes-server

# 下载 cloudflared
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64

# 添加执行权限
chmod +x cloudflared-linux-amd64
mv cloudflared-linux-amd64 cloudflared

# 登录 Cloudflare
./cloudflared tunnel login
```

会显示一个网址，**复制到浏览器打开**，选择你的域名授权。

#### 6.4 创建隧道

```bash
# 创建隧道
./cloudflared tunnel create uu-notes
# 记下显示的 Tunnel ID

# 配置路由（把 your-domain.com 改成你的域名）
./cloudflared tunnel route dns uu-notes your-domain.com

# 创建配置文件
nano config.yml
```

**粘贴以下内容**（修改两处）：

```yaml
tunnel: uu-notes
credentials-file: /root/.cloudflared/你的隧道ID.json  # 改成上面的 ID

ingress:
  - hostname: your-domain.com  # 改成你的域名
    service: http://localhost:3000
  - service: http_status:404
```

按 `Ctrl+O` 保存，`Ctrl+X` 退出

#### 6.5 运行隧道

```bash
# 后台运行
nohup ./cloudflared tunnel run uu-notes > cloudflared.log 2>&1 &

# 等待 10 秒
sleep 10

# 查看日志确认成功
tail -f cloudflared.log
```

看到 `Connection registered` 就成功了！按 `Ctrl+C` 退出

#### 6.6 测试 HTTPS

浏览器访问：`https://your-domain.com/health`

如果看到 `{"status":"ok"...}` 就完成了！🎉🎉🎉

### 第七步：配置微信小程序（5分钟）

#### 7.1 配置服务器域名

1. 登录 https://mp.weixin.qq.com
2. 开发 → 开发管理 → 开发设置
3. 找到"服务器域名"
4. request 合法域名：填入 `https://your-domain.com`
5. 保存

#### 7.2 配置微信登录

**获取 AppID 和 AppSecret**：
- 在微信公众平台"开发设置"页面
- 复制 AppID
- 点击 AppSecret 旁边的"重置"（需要管理员扫码）

**配置到 NAS**：

方法 A：直接在绿联文件管理器中编辑 `.env`

方法 B：SSH 编辑
```bash
cd /mnt/user/Public/uu-notes-server
nano .env
```

添加：
```bash
WECHAT_APPID=你的AppID
WECHAT_SECRET=你的AppSecret
```

保存后重启服务：
```bash
docker-compose restart
```

#### 7.3 修改小程序代码

1. **修改 API 地址**
   
   编辑 `src/utils/api.ts` 第 4 行：
   ```typescript
   const API_BASE = 'https://your-domain.com/api'  // 改成你的域名
   ```

2. **替换所有 API 调用**
   
   在 VS Code 中批量替换：
   - 按 `Ctrl+Shift+H`（Mac: `Cmd+Shift+H`）
   - 查找：`from '@/utils/db'`
   - 替换为：`from '@/utils/api'`
   - 点击"全部替换"

3. **修改后端登录逻辑**
   
   编辑 `server/index.js`，找到第 67 行左右：
   
   删除：
   ```javascript
   const openId = `mock_${code}`
   ```
   
   替换为：
   ```javascript
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

4. **重启服务**
   ```bash
   cd /mnt/user/Public/uu-notes-server
   docker-compose restart
   ```

#### 7.4 测试小程序

1. **清除缓存**
   - 微信开发者工具 → 工具 → 清除缓存 → 全部清除

2. **重新编译**
   - 点击"编译"按钮

3. **测试功能**
   - ✅ 登录
   - ✅ 创建宝宝
   - ✅ 添加记录
   - ✅ 查看记录

全部正常就完成了！🎊

## 🔧 绿联 NAS 特殊说明

### 文件路径

绿联的共享文件夹路径：
```bash
# 主要路径
/mnt/user/Public/

# 备用路径
/mnt/data/Public/

# 查看所有挂载点
df -h
```

### Docker 管理

绿联 UGOS 提供了图形界面管理 Docker：
- UGOS 界面 → 应用 → Docker
- 可以查看容器状态、日志、重启等

### 开机自启

Docker Compose 默认配置了 `restart: unless-stopped`，绿联重启后会自动启动服务。

Cloudflare Tunnel 需要设置开机自启：

```bash
# 创建启动脚本
nano /etc/rc.local
```

添加：
```bash
#!/bin/sh
cd /mnt/user/Public/uu-notes-server
nohup ./cloudflared tunnel run uu-notes > cloudflared.log 2>&1 &
exit 0
```

```bash
# 添加执行权限
chmod +x /etc/rc.local
```

## 📊 维护命令

### 查看服务状态

```bash
# SSH 连接后
cd /mnt/user/Public/uu-notes-server

# 查看容器状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 查看最近 100 行日志
docker-compose logs --tail=100

# 重启服务
docker-compose restart

# 停止服务
docker-compose stop

# 启动服务
docker-compose start
```

### 查看 Cloudflare Tunnel 状态

```bash
# 查看日志
tail -f /mnt/user/Public/uu-notes-server/cloudflared.log

# 重启隧道
pkill cloudflared
cd /mnt/user/Public/uu-notes-server
nohup ./cloudflared tunnel run uu-notes > cloudflared.log 2>&1 &
```

### 备份数据

```bash
# 备份数据库
cp /mnt/user/Public/uu-notes-server/data/uu-notes.db /mnt/user/Backup/uu-notes-$(date +%Y%m%d).db

# 查看数据库大小
du -h /mnt/user/Public/uu-notes-server/data/uu-notes.db
```

### 更新服务

```bash
cd /mnt/user/Public/uu-notes-server

# 停止容器
docker-compose down

# 更新代码（如果有新版本）
# 替换 index.js 等文件

# 重新构建并启动
docker-compose up -d --build
```

## 🎯 性能优化

### DXP4800 Plus 优化建议

你的配置（N100 + 8GB）很适合运行这个服务：

1. **内存充足**
   - 当前服务只需要约 100-200MB
   - 完全不用担心性能问题

2. **存储优化**
   - 数据库建议存储在 SSD（如果有）
   - 定期备份到机械盘

3. **网络优化**
   - 如果有多块网卡，可以绑定提升速度
   - 千兆网络足够使用

## ❓ 常见问题

### Q1: SSH 连接不上？

**A**: 检查 SSH 服务：
```bash
# 在 UGOS 界面确认 SSH 已开启
# 设置 → 服务 → SSH
```

### Q2: Docker 命令找不到？

**A**: 确认 Docker 已安装：
```bash
# 检查 Docker
which docker
docker --version

# 如果没有，在 UGOS 应用中心安装
```

### Q3: 找不到项目文件？

**A**: 检查路径：
```bash
# 尝试不同路径
ls /mnt/user/Public/
ls /mnt/data/Public/
ls /volume1/Public/

# 查看所有挂载点
mount | grep mnt
```

### Q4: 3000 端口无法访问？

**A**: 开放防火墙：
```bash
# 方法 1: iptables
iptables -I INPUT -p tcp --dport 3000 -j ACCEPT
iptables-save

# 方法 2: UGOS 界面
# 设置 → 安全 → 防火墙 → 添加规则
```

### Q5: Cloudflare Tunnel 连接失败？

**A**: 
```bash
# 查看详细日志
cat cloudflared.log

# 常见原因：
# 1. 网络问题 - 检查 NAS 能否访问外网
# 2. 配置错误 - 检查 config.yml 文件
# 3. 隧道 ID 错误 - 重新创建隧道

# 重新启动
pkill cloudflared
./cloudflared tunnel run uu-notes
```

### Q6: 小程序请求失败？

**A**: 
1. 确认域名已在微信后台配置
2. 确认用的是 HTTPS 不是 HTTP
3. 查看小程序控制台错误信息
4. 检查后端日志：`docker-compose logs -f`

## ✅ 部署检查清单

### 基础环境
- [ ] Docker 已安装
- [ ] SSH 已开启
- [ ] 项目文件已上传
- [ ] .env 文件已配置

### 服务运行
- [ ] Docker 容器正常启动
- [ ] 可访问 `http://NAS的IP:3000/health`
- [ ] 日志无错误

### HTTPS 配置
- [ ] 域名已购买
- [ ] Cloudflare 账号已注册
- [ ] Tunnel 已创建
- [ ] 可访问 `https://your-domain.com/health`

### 小程序配置
- [ ] 微信后台域名已配置
- [ ] AppID/AppSecret 已配置
- [ ] API_BASE 已修改
- [ ] db.ts 已替换为 api.ts
- [ ] 小程序测试通过

## 🎉 完成！

恭喜你完成部署！现在你有了：
- ✅ 完全免费的后端服务（除了域名 ¥50/年）
- ✅ 数据完全掌控在自己的 NAS 上
- ✅ 高性能运行（N100 性能足够）
- ✅ 每年节省 ¥500-1000

## 📚 延伸阅读

- [Migration.md](Migration.md) - 完整迁移指南和优化建议
- [server/README.md](../server/README.md) - 后端 API 详细文档
- [Flowchart.md](Flowchart.md) - 架构图解

---

**遇到问题？** 查看上面的"常见问题"章节或后端日志！

祝使用愉快！🚀
