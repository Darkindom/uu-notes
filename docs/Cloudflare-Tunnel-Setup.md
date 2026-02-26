# Cloudflare Tunnel 配置教程

> 为你的绿联 NAS 上的小程序后端配置 HTTPS 访问

## 🎯 目标

将 `http://192.168.31.16:17717` 映射到 `https://your-domain.com`

## 📝 准备工作

### 1. 购买域名（如果还没有）

推荐平台：
- **阿里云**：https://wanwang.aliyun.com （¥29/年起）
- **腾讯云**：https://dnspod.cloud.tencent.com （¥35/年起）
- **Cloudflare**：https://www.cloudflare.com/products/registrar/ （约 $10/年）

购买任意域名即可，比如：`yourbaby-notes.com`

### 2. 注册 Cloudflare 账号

1. 访问：https://dash.cloudflare.com/sign-up
2. 注册免费账号
3. 添加你的域名
4. 按照提示修改域名的 DNS 服务器为 Cloudflare 提供的地址

等待 DNS 生效（通常 5-30 分钟）

## 🚀 安装 Cloudflare Tunnel

### 步骤 1：在绿联 NAS 上安装 cloudflared

SSH 连接到你的绿联 NAS，执行：

```bash
# 进入项目目录
cd /volume2/docker/uu-notes-server

# 下载 cloudflared（Linux x86_64 版本，适合你的 N100）
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64

# 如果 wget 不可用，尝试 curl
# curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared-linux-amd64

# 重命名并添加执行权限
mv cloudflared-linux-amd64 cloudflared
chmod +x cloudflared

# 验证安装
./cloudflared version
```

### 步骤 2：登录 Cloudflare

```bash
# 登录（会生成一个 URL）
./cloudflared tunnel login
```

**重要**：
- 执行后会显示一个 URL，类似：`https://dash.cloudflare.com/argotunnel?callback=...`
- **复制这个 URL 到浏览器打开**
- 在网页上选择你的域名并授权
- 授权成功后，会在 `~/.cloudflared/` 目录下生成证书文件

### 步骤 3：创建隧道

```bash
# 创建名为 uu-notes 的隧道
./cloudflared tunnel create uu-notes

# 执行后会显示：
# Tunnel credentials written to /root/.cloudflared/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.json
# 记下这个 Tunnel ID（xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx）
```

### 步骤 4：配置 DNS 路由

把 `your-domain.com` 替换为你的实际域名：

```bash
# 配置 DNS（把 your-domain.com 改成你的域名）
./cloudflared tunnel route dns uu-notes your-domain.com
```

执行成功会显示：
```
Created CNAME record for your-domain.com which points to xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.cfargotunnel.com
```

### 步骤 5：创建配置文件

```bash
# 在项目目录创建配置文件
nano config.yml
```

**粘贴以下内容**（需要修改 3 处）：

```yaml
tunnel: uu-notes
credentials-file: /root/.cloudflared/你的隧道ID.json  # ⬅️ 改成步骤3中的ID

ingress:
  - hostname: your-domain.com  # ⬅️ 改成你的域名
    service: http://localhost:17717  # ⬅️ 确认端口号是你的实际端口
  - service: http_status:404
```

**保存文件**：
- 按 `Ctrl+O` 保存
- 按 `Enter` 确认
- 按 `Ctrl+X` 退出

### 步骤 6：启动隧道

```bash
# 测试配置（前台运行，查看是否有错误）
./cloudflared tunnel run uu-notes

# 看到以下内容说明成功：
# INF Connection registered connIndex=0
# INF Connection registered connIndex=1
# INF Connection registered connIndex=2
# INF Connection registered connIndex=3
```

**如果测试成功**，按 `Ctrl+C` 停止，然后后台运行：

```bash
# 后台运行
nohup ./cloudflared tunnel run uu-notes > cloudflared.log 2>&1 &

# 查看进程
ps aux | grep cloudflared

# 查看日志
tail -f cloudflared.log
```

### 步骤 7：测试 HTTPS 访问

打开浏览器，访问：

```
https://your-domain.com/health
```

如果看到 `{"status":"ok","timestamp":...}` 就成功了！🎉

## 🔄 开机自启动

让 Cloudflare Tunnel 在绿联 NAS 重启后自动启动：

### 方法 A：使用 systemd（推荐）

```bash
# 创建 systemd 服务文件
sudo nano /etc/systemd/system/cloudflared.service
```

粘贴以下内容（修改路径）：

```ini
[Unit]
Description=Cloudflare Tunnel
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/volume2/docker/uu-notes-server
ExecStart=/volume2/docker/uu-notes-server/cloudflared tunnel run uu-notes
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
```

启用服务：

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

### 方法 B：使用 rc.local

```bash
# 编辑 rc.local
sudo nano /etc/rc.local
```

添加以下内容：

```bash
#!/bin/sh
cd /volume2/docker/uu-notes-server
nohup ./cloudflared tunnel run uu-notes > cloudflared.log 2>&1 &
exit 0
```

添加执行权限：

```bash
sudo chmod +x /etc/rc.local
```

## 🛠️ 维护命令

```bash
# 查看隧道状态
./cloudflared tunnel info uu-notes

# 查看日志
tail -f cloudflared.log

# 重启隧道
pkill cloudflared
nohup ./cloudflared tunnel run uu-notes > cloudflared.log 2>&1 &

# 列出所有隧道
./cloudflared tunnel list

# 删除隧道（如果需要重建）
./cloudflared tunnel delete uu-notes
```

## ❓ 常见问题

### Q1: 提示 "Unable to reach the origin service"

**原因**：后端服务没有运行或端口配置错误

**解决**：
```bash
# 检查后端服务
docker ps

# 检查端口
netstat -tulnp | grep 17717

# 测试本地访问
curl http://localhost:17717/health
```

### Q2: DNS 未生效

**原因**：DNS 记录尚未传播

**解决**：
- 等待 5-30 分钟
- 使用 DNS 检测工具：https://dnschecker.org

### Q3: Cloudflare Tunnel 连接失败

**查看详细日志**：
```bash
cat cloudflared.log
```

**常见原因**：
1. 网络问题 - 检查 NAS 能否访问外网
2. 配置文件路径错误 - 检查 credentials-file 路径
3. 隧道 ID 错误 - 重新创建隧道

## ✅ 检查清单

- [ ] 域名已购买
- [ ] Cloudflare 账号已注册
- [ ] 域名已添加到 Cloudflare
- [ ] DNS 已切换到 Cloudflare
- [ ] cloudflared 已安装
- [ ] 已登录 Cloudflare
- [ ] 隧道已创建
- [ ] DNS 路由已配置
- [ ] config.yml 已创建并正确配置
- [ ] 隧道已启动
- [ ] 可以通过 HTTPS 访问 /health 接口
- [ ] 开机自启已配置

## 🎉 完成！

现在你的小程序后端已经可以通过 HTTPS 访问了！

下一步：配置微信小程序
- 在微信公众平台配置服务器域名
- 修改小程序代码中的 API_BASE 地址
- 配置微信登录
