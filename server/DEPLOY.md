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

# 2. SSH 创建数据目录并启动
ssh nas@192.168.xx.xx
mkdir -p /xx/xx/uu-notes-server/data
cd /xx/xx/uu-notes-server
sudo docker compose up -d --build
```

`.env` 必填项：
```env
JWT_SECRET=your-random-secret
WECHAT_APPID=your-appid
WECHAT_SECRET=your-secret
```

## 常用命令

```bash
# 查看日志
sudo docker logs -f uu-notes-server

# 重启容器
sudo docker restart uu-notes-server

# 完全重建
cd /xx/xx/uu-notes-server
sudo docker compose down
sudo docker compose up -d --build
```
