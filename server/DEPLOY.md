# NAS 部署

## 更新服务（使用脚本）

```bash
cd server
./deploy.sh 192.168.xx.xx nas用户名
```

脚本会自动：推送代码 → 打包 → 上传到 NAS → 重建容器（依赖会在构建时自动安装）

## 更新服务（手动）

```bash
# 1. 本地推送代码
git push

# 2. 上传文件到 NAS
scp server/index.js nas@192.168.xx.xx:/xx/xx/uu-notes-server/
scp server/package.json nas@192.168.xx.xx:/xx/xx/uu-notes-server/

# 3. SSH 到 NAS 重建容器
ssh nas@192.168.xx.xx
sudo docker compose -f /xx/xx/uu-notes-server/docker-compose.yml down
sudo docker compose -f /xx/xx/uu-notes-server/docker-compose.yml up -d --build
```

注意：`npm install` 会在 Docker 构建时自动执行，不需要在 NAS 主机上运行。

## 首次部署

需要在 NAS 上准备以下文件：
- `index.js`
- `package.json`
- `package-lock.json`
- `Dockerfile`
- `docker-compose.yml`
- `.env`

```bash
# 1. 通过 File Station 上传所有文件到 /xx/xx/uu-notes-server/

# 2. SSH 创建目录并启动
ssh nas@192.168.xx.xx
cd /xx/xx/uu-notes-server
mkdir -p data logs
sudo docker compose up -d --build
```

`.env` 必填项：
```env
JWT_SECRET=your-random-secret
WECHAT_APPID=your-appid
WECHAT_SECRET=your-secret
```

## 数据备份与日志

### 自动备份
- 服务会在每天凌晨 3 点自动备份数据库
- 备份文件保存在 `data/backups/` 目录，保留最近 7 天
- 服务启动时也会执行一次备份
- 查看备份：`ls -lh /xx/xx/uu-notes-server/data/backups/`

### 日志系统
- 接口调用日志按天保存在 `logs/` 目录
- 日志文件命名格式：`YYYY-MM-DD.log`
- 查看今日日志：`tail -f /xx/xx/uu-notes-server/logs/$(date +%Y-%m-%d).log`
- 日志包含：请求方法、路径、状态码、响应时间、错误信息等

### 手动备份
```bash
# 备份数据库和配置
cd /xx/xx/uu-notes-server
tar -czf backup-$(date +%Y%m%d).tar.gz data .env

# 下载到本地
scp nas@192.168.xx.xx:/xx/xx/uu-notes-server/backup-*.tar.gz ./
```

## 常用命令

```bash
# 查看容器日志（包含启动信息）
sudo docker logs -f uu-notes-server

# 查看接口调用日志
tail -f /xx/xx/uu-notes-server/logs/$(date +%Y-%m-%d).log

# 查看所有日志文件
ls -lh /xx/xx/uu-notes-server/logs/

# 查看备份文件
ls -lh /xx/xx/uu-notes-server/data/backups/

# 重启容器
sudo docker restart uu-notes-server

# 完全重建
cd /xx/xx/uu-notes-server
sudo docker compose down
sudo docker compose up -d --build
```
