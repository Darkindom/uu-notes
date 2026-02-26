# 绿联 NAS + Cloudflare Tunnel 部署完整实战记录

> 📝 基于实际部署经验的完整指南，记录所有遇到的问题和解决方案

## 🎯 项目概述

- **项目名称**：UU Notes 育儿记录小程序
- **部署目标**：将微信小程序后端部署到绿联 NAS，使用 Cloudflare Tunnel 实现 HTTPS 访问
- **域名**：dksiuu.top（阿里云购买）
- **设备**：绿联 DXP4800 Plus（Intel N100 + 8GB RAM）

## 📊 最终架构

```
微信小程序（用户）
    ↓ HTTPS 请求
https://dksiuu.top/api
    ↓
Cloudflare CDN（全球加速）
    ↓ 加密隧道
Cloudflare Tunnel（绿联 NAS）
    ↓
Node.js 后端（端口 1717）
    ↓
SQLite 数据库
```

## 💰 成本对比

| 方案 | 年费用 | 说明 |
|------|--------|------|
| **本方案（Cloudflare Tunnel + 绿联 NAS）** | **¥30** | 仅域名费用 |
| 阿里云 ECS + 绿联 NAS | ¥330+ | 域名 + 服务器 |
| 微信云开发 | ¥500+ | 云开发套餐 |

**节省**：每年约 ¥300-500 💰

---

## 第一步：后端服务部署到绿联 NAS

### 1.1 准备工作

**SSH 连接绿联 NAS：**

```bash
# Mac/Windows PowerShell
ssh root@192.168.31.16
# 或
ssh Darkindom@192.168.31.16
```

**⚠️ 常见问题：用户名**
- 有些绿联 NAS 用户名是 `root`
- 有些是创建时设置的用户名（如 `Darkindom`）
- 如果不确定，查看 NAS 管理界面的用户设置

### 1.2 找到正确的存储路径

**问题：找不到 `/mnt/user/Public` 目录**

**解决方案：绿联 NAS 的实际路径**

```bash
# 查看存储卷
ls /volume*/

# 绿联 NAS 通常使用这些路径：
/volume1/    # 第一块硬盘
/volume2/    # 第二块硬盘
```

**最终确定的路径：**
```bash
/volume2/docker/uu-notes-server
```

**经验：**
- ✅ 使用 `/volume*/docker/` 目录，专门存放 Docker 项目
- ✅ 避免使用 `/tmp/` 临时目录
- ✅ 检查权限：`ls -la /volume1/` 或 `ls -la /volume2/`

### 1.3 上传项目文件

**方法 A：使用 SCP（推荐）**

在 Mac 本地终端执行：

```bash
# 进入项目目录
cd /Users/你的用户名/Desktop/DP_team/其他/uu-notes

# 上传 server 文件夹
scp -r server/* Darkindom@192.168.31.16:/volume2/docker/uu-notes-server/
```

**方法 B：使用 UGOS 文件管理器**

1. 浏览器打开：`http://192.168.31.16`
2. 文件管理 → 创建文件夹 `uu-notes-server`
3. 拖拽上传文件

### 1.4 配置并启动 Docker

**进入项目目录：**

```bash
cd /volume2/docker/uu-notes-server
```

**配置环境变量：**

```bash
# 复制配置文件
cp .env.example .env

# 编辑配置
nano .env
```

修改为：

```bash
PORT=3000
JWT_SECRET=随机字符串-abc123xyz-qwerty
DB_PATH=./data/uu-notes.db
ALLOWED_ORIGINS=*
```

保存：`Ctrl+O` → `Enter` → `Ctrl+X`

**启动 Docker 容器：**

```bash
# 方法 1：使用 docker compose（新版）
docker compose up -d

# 方法 2：使用 docker-compose（旧版）
docker-compose up -d

# 查看日志
docker compose logs -f
# 或
docker logs -f uu-notes-server
```

**⚠️ 常见问题：docker-compose 命令不存在**

**解决方案：**
- 使用 `docker compose`（空格，不是横杠）
- 或直接使用 `docker` 命令

### 1.5 测试服务

**查看端口映射：**

```bash
docker ps
```

**⚠️ 关键发现：端口号问题**

我们发现实际运行端口是 **1717** 而不是 17717！

```bash
# 测试内网访问
curl http://localhost:1717/health
# 或
curl http://192.168.31.16:1717/health

# 应该返回
{"status":"ok","timestamp":1772112395393}
```

**经验教训：**
- ✅ 部署后立即测试本地访问
- ✅ 检查 Docker 端口映射：`docker ps`
- ✅ 确认实际监听端口

---

## 第二步：配置域名和 Cloudflare

### 2.1 购买域名

**推荐平台：**
- 阿里云：https://wanwang.aliyun.com （¥29/年起）
- 腾讯云：https://dnspod.cloud.tencent.com （¥35/年起）

**本项目使用：**
- 域名：`dksiuu.top`
- 平台：阿里云
- 费用：约 ¥30/年

### 2.2 注册 Cloudflare 并添加域名

**1. 注册账号：**

访问：https://dash.cloudflare.com/sign-up

**2. 添加域名：**

1. 点击 "Add a site"
2. 输入域名：`dksiuu.top`
3. 选择 "Free" 计划（免费）
4. DNS 扫描完成后点击 "Continue"

**3. 获取 Cloudflare DNS 服务器地址**

Cloudflare 会显示两个 DNS 地址，类似：

```
xxx.ns.cloudflare.com
yyy.ns.cloudflare.com
```

记下这两个地址！

### 2.3 修改域名 DNS 服务器

**阿里云操作步骤：**

1. 登录：https://dc.console.aliyun.com
2. 找到域名 → 点击"管理"
3. 左侧菜单 → "DNS 修改"
4. 点击"修改 DNS 服务器"
5. 删除原有的 `dns1.hichina.com` 和 `dns2.hichina.com`
6. 填入 Cloudflare 的两个 DNS 地址
7. 点击"确定"（可能需要手机验证码）

**等待 DNS 生效：**
- 通常：5-30 分钟
- 最长：24 小时

**检查 DNS 是否生效：**
- 工具：https://dnschecker.org
- 输入域名：`dksiuu.top`
- 查看全球解析结果

---

## 第三步：安装并配置 Cloudflare Tunnel

### 3.1 下载 cloudflared

**SSH 连接到绿联 NAS，执行：**

```bash
# 进入项目目录
cd /volume2/docker/uu-notes-server

# 下载 cloudflared
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64

# 如果 wget 不可用，用 curl
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared

# 重命名并添加执行权限
mv cloudflared-linux-amd64 cloudflared
chmod +x cloudflared

# 验证安装
./cloudflared version
```

### 3.2 登录 Cloudflare

```bash
./cloudflared tunnel login
```

**会显示一个很长的 URL，复制到浏览器打开！**

```
Please open the following URL and log in with your Cloudflare account:
https://dash.cloudflare.com/argotunnel?callback=...
```

**浏览器操作：**
1. 自动登录 Cloudflare
2. 选择域名：`dksiuu.top`
3. 点击 "Authorize"（授权）
4. 看到成功提示

### 3.3 创建隧道

```bash
./cloudflared tunnel create uu-notes
```

**会显示：**

```
Tunnel credentials written to /root/.cloudflared/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.json
Created tunnel uu-notes with id xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

**⚠️ 重要：记下这个 Tunnel ID！**

**本项目的 Tunnel ID：**
```
b6c8dad3-9051-4779-be67-03637450412c
```

### 3.4 配置 DNS 路由

```bash
./cloudflared tunnel route dns uu-notes dksiuu.top
```

**成功显示：**

```
Created CNAME record for dksiuu.top which points to xxxx.cfargotunnel.com
```

### 3.5 创建配置文件

```bash
nano config.yml
```

**粘贴以下内容：**

```yaml
tunnel: uu-notes
credentials-file: ~/.cloudflared/b6c8dad3-9051-4779-be67-03637450412c.json

ingress:
  - hostname: dksiuu.top
    service: http://localhost:1717
  - service: http_status:404
```

**⚠️ 关键点：**
1. **路径问题**：使用 `~/` 而不是 `/root/`
2. **端口号**：确认是 `1717` 而不是 `17717`
3. **Tunnel ID**：替换为你的实际 ID

保存：`Ctrl+O` → `Enter` → `Ctrl+X`

### 3.6 测试运行

```bash
./cloudflared tunnel --config config.yml run uu-notes
```

**成功标志：**

```
INF Starting tunnel tunnelID=b6c8dad3-9051-4779-be67-03637450412c
INF Registered tunnel connection connIndex=0
INF Registered tunnel connection connIndex=1
INF Registered tunnel connection connIndex=2
INF Registered tunnel connection connIndex=3
```

**⚠️ 常见错误 1：文件路径不存在**

```
Tunnel credentials file '/root/.cloudflared/xxxx.json' doesn't exist
```

**解决方案：**
- 检查当前用户：`whoami`
- 如果是 `Darkindom`，路径应该是 `/home/Darkindom/.cloudflared/`
- 或直接用 `~/` 代替

**⚠️ 常见错误 2：缺少配置警告**

```
WRN No ingress rules were defined, cloudflared will return 503
```

**解决方案：**
- 创建 `config.yml` 文件
- 使用 `--config config.yml` 参数运行

### 3.7 后台运行

**测试成功后，按 `Ctrl+C` 停止，然后后台运行：**

```bash
nohup ./cloudflared tunnel --config config.yml run uu-notes > cloudflared.log 2>&1 &
```

**查看日志：**

```bash
tail -f cloudflared.log
```

按 `Ctrl+C` 退出日志查看。

---

## 第四步：配置开机自启动

### 4.1 停止手动运行的进程

```bash
pkill cloudflared
```

### 4.2 创建 systemd 服务

```bash
sudo nano /etc/systemd/system/cloudflared.service
```

**粘贴以下内容：**

```ini
[Unit]
Description=Cloudflare Tunnel
After=network.target

[Service]
Type=simple
User=Darkindom
WorkingDirectory=/volume2/docker/uu-notes-server
ExecStart=/volume2/docker/uu-notes-server/cloudflared tunnel --config config.yml run uu-notes
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
```

**⚠️ 注意修改：**
- `User=` 改为你的实际用户名
- `WorkingDirectory=` 改为你的实际路径
- `ExecStart=` 改为完整的可执行文件路径

保存：`Ctrl+O` → `Enter` → `Ctrl+X`

### 4.3 启动服务

```bash
# 重载 systemd
sudo systemctl daemon-reload

# 启动服务
sudo systemctl start cloudflared

# 设置开机自启
sudo systemctl enable cloudflared

# 查看状态
sudo systemctl status cloudflared
```

**成功标志：**

```
● cloudflared.service - Cloudflare Tunnel
   Loaded: loaded (...; enabled; preset: enabled)
   Active: active (running) since ...
```

### 4.4 查看日志

```bash
# 实时查看日志
sudo journalctl -u cloudflared -f

# 查看最近 50 行
sudo journalctl -u cloudflared -n 50
```

**成功日志：**

```
INF Registered tunnel connection connIndex=0
INF Registered tunnel connection connIndex=1
INF Registered tunnel connection connIndex=2
INF Registered tunnel connection connIndex=3
```

---

## 第五步：测试 HTTPS 访问

### 5.1 测试域名解析

```bash
# Mac/Linux
nslookup dksiuu.top

# 或者
dig dksiuu.top
```

### 5.2 测试 HTTPS 访问

**命令行测试：**

```bash
curl https://dksiuu.top/health
```

**浏览器测试：**

访问：`https://dksiuu.top/health`

**成功返回：**

```json
{"status":"ok","timestamp":1772112395393}
```

### 5.3 如果无法访问

**检查清单：**

1. **DNS 是否生效？**
   - 访问：https://dnschecker.org
   - 输入域名检查

2. **Cloudflare Tunnel 是否运行？**
   ```bash
   sudo systemctl status cloudflared
   ```

3. **后端服务是否运行？**
   ```bash
   docker ps
   curl http://localhost:1717/health
   ```

4. **配置文件端口是否正确？**
   ```bash
   cat config.yml
   # 检查 service: http://localhost:1717
   ```

---

## 第六步：配置小程序代码

### 6.1 修改 API 地址

编辑 `src/utils/api.ts`：

```typescript
// 第 4 行
const API_BASE = 'https://dksiuu.top/api'
```

### 6.2 配置微信小程序后台（待 DNS 生效后）

**登录微信公众平台：**

https://mp.weixin.qq.com

**配置服务器域名：**

1. 开发 → 开发管理 → 开发设置
2. 找到"服务器域名"
3. request 合法域名：`https://dksiuu.top`
4. 保存

### 6.3 配置微信登录（可选）

**获取 AppID 和 AppSecret：**

1. 微信公众平台 → 开发设置
2. 复制 AppID
3. 重置 AppSecret（需要管理员扫码）

**配置到 NAS：**

```bash
# SSH 连接到 NAS
cd /volume2/docker/uu-notes-server
nano .env
```

添加：

```bash
WECHAT_APPID=你的AppID
WECHAT_SECRET=你的AppSecret
```

**重启服务：**

```bash
docker compose restart
```

---

## 🎯 完整命令速查表

### Docker 管理

```bash
# 启动
docker compose up -d

# 停止
docker compose stop

# 重启
docker compose restart

# 查看日志
docker compose logs -f

# 查看状态
docker ps
```

### Cloudflare Tunnel 管理

```bash
# 启动服务
sudo systemctl start cloudflared

# 停止服务
sudo systemctl stop cloudflared

# 重启服务
sudo systemctl restart cloudflared

# 查看状态
sudo systemctl status cloudflared

# 查看日志
sudo journalctl -u cloudflared -f
```

### 测试命令

```bash
# 测试本地服务
curl http://localhost:1717/health

# 测试 HTTPS
curl https://dksiuu.top/health

# 测试域名解析
nslookup dksiuu.top
```

---

## ⚠️ 常见问题和解决方案

### 问题 1：找不到 Public 目录

**错误：**
```bash
cd /mnt/user/Public
bash: cd: /mnt/user/Public: Permission denied
```

**解决：**
```bash
# 查找实际路径
ls /volume*/
# 使用实际找到的路径，如：
cd /volume2/docker/
```

### 问题 2：docker-compose 命令不存在

**错误：**
```bash
bash: docker-compose: command not found
```

**解决：**
```bash
# 使用新版命令（空格，不是横杠）
docker compose up -d
```

### 问题 3：端口号错误

**现象：**
- 配置的是 17717，但实际是 1717
- 访问失败

**解决：**
```bash
# 检查实际端口
docker ps
# 或
curl http://localhost:1717/health
curl http://localhost:17717/health

# 修改 config.yml 中的端口号
```

### 问题 4：Tunnel 凭证文件路径错误

**错误：**
```
Tunnel credentials file '/root/.cloudflared/xxxx.json' doesn't exist
```

**解决：**
```bash
# 检查当前用户
whoami

# 如果是 Darkindom，修改 config.yml 为：
credentials-file: ~/.cloudflared/xxxx.json
# 或
credentials-file: /home/Darkindom/.cloudflared/xxxx.json
```

### 问题 5：DNS 未生效

**现象：**
```bash
curl: (6) Could not resolve host: dksiuu.top
```

**解决：**
- 等待 5-30 分钟
- 检查：https://dnschecker.org
- 确认 DNS 服务器已修改

### 问题 6：No ingress rules 警告

**警告：**
```
WRN No ingress rules were defined, cloudflared will return 503
```

**解决：**
- 创建 `config.yml` 文件
- 使用 `--config config.yml` 参数运行

---

## 📊 性能和监控

### 查看资源使用

```bash
# 内存使用
docker stats

# 磁盘使用
du -sh /volume2/docker/uu-notes-server

# 数据库大小
du -h /volume2/docker/uu-notes-server/data/uu-notes.db
```

### 备份数据

```bash
# 备份数据库
cp /volume2/docker/uu-notes-server/data/uu-notes.db /volume2/backup/uu-notes-$(date +%Y%m%d).db

# 定时备份（可选）
# 创建 cron 任务
crontab -e
# 添加：每天凌晨 2 点备份
0 2 * * * cp /volume2/docker/uu-notes-server/data/uu-notes.db /volume2/backup/uu-notes-$(date +\%Y\%m\%d).db
```

---

## 🎉 部署完成检查清单

### 基础环境
- [ ] SSH 可以连接到绿联 NAS
- [ ] 找到正确的存储路径（/volume2/docker/）
- [ ] 项目文件已上传

### 后端服务
- [ ] Docker 容器正常运行
- [ ] 可以访问 `http://localhost:1717/health`
- [ ] 环境变量已配置

### Cloudflare
- [ ] 域名已购买
- [ ] Cloudflare 账号已注册
- [ ] 域名已添加到 Cloudflare
- [ ] DNS 服务器已切换
- [ ] DNS 已生效

### Cloudflare Tunnel
- [ ] cloudflared 已安装
- [ ] 隧道已创建
- [ ] config.yml 配置正确
- [ ] 4 个连接已注册
- [ ] 可以访问 `https://dksiuu.top/health`
- [ ] 开机自启已配置

### 小程序
- [ ] API_BASE 已修改为正确域名
- [ ] 微信后台域名已配置
- [ ] AppID/AppSecret 已配置（可选）

---

## 💡 经验总结

### ✅ 做得好的地方

1. **使用 Cloudflare Tunnel** - 完全免费，无需公网 IP
2. **systemd 开机自启** - 自动恢复，无需手动操作
3. **实际测试验证** - 每步都测试，及时发现问题
4. **文档记录** - 详细记录所有操作和问题

### 📝 重要教训

1. **路径问题** - 不同 NAS 路径不同，需要实际查找
2. **端口确认** - 配置前先测试实际端口
3. **用户权限** - 注意当前用户和文件路径的对应关系
4. **DNS 等待** - DNS 生效需要时间，不要着急
5. **配置文件** - 使用相对路径 `~/` 更灵活

### 🚀 优化建议

1. **监控告警** - 配置服务监控和告警
2. **自动备份** - 定时备份数据库
3. **日志管理** - 定期清理或轮转日志
4. **安全加固** - 配置防火墙规则
5. **性能优化** - 根据使用情况调整资源配置

---

## 📚 相关文档

- [UGreen-Deploy.md](UGreen-Deploy.md) - 绿联 NAS 详细部署教程
- [Cloudflare-Tunnel-Setup.md](Cloudflare-Tunnel-Setup.md) - Cloudflare Tunnel 配置教程
- [Migration.md](Migration.md) - 完整迁移指南
- [server/README.md](../server/README.md) - 后端 API 文档

---

## 🎊 总结

**总耗时**：约 2-3 小时（包含 DNS 等待时间）

**总费用**：¥30/年（仅域名）

**节省费用**：每年约 ¥300-500

**技术栈**：
- 绿联 NAS（DXP4800 Plus）
- Docker
- Node.js + Express
- SQLite
- Cloudflare Tunnel
- 微信小程序

**效果**：
- ✅ 完全自主可控的后端服务
- ✅ 免费的 HTTPS 和 CDN 加速
- ✅ 开机自启，无需人工干预
- ✅ 数据完全掌控在自己手中

**适用场景**：
- 个人/家庭使用的小程序
- 小规模应用（< 1000 用户）
- 学习和实践项目
- 想要完全控制数据的开发者

---

**祝你使用愉快！** 🎉

如有问题，可以参考本文档的"常见问题"章节，或查看其他相关文档。
