# UU Notes - 宝宝日常记录小程序

一个简洁实用的宝宝日常记录小程序，帮助家长记录宝宝的吃喝拉撒睡等日常活动。

## ✨ 特性

- 🍼 **多类型记录**：支持吃饭、睡觉、大小便、其他活动
- 👶 **多宝宝管理**：可以添加多个宝宝，切换记录
- 📊 **历史查看**：查看宝宝的所有历史记录
- 🎨 **美观界面**：现代化设计，大字体，易于操作
- 🔄 **数据同步**：支持多端同步（云开发或自建后端）
- ⚡ **性能优化**：预加载、缓存、骨架屏

## 📱 功能模块

### 首页
- 快速入口：吃、睡、拉、其他
- 显示当前宝宝名称
- 骨架屏加载优化

### 宝宝管理
- 添加/删除宝宝
- 切换当前宝宝
- 查看宝宝信息

### 记录管理
- 查看所有历史记录
- 按时间倒序排列
- 显示记录者信息

### 记录详情
- **吃饭**：记录奶量、食物、时间
- **睡觉**：记录睡眠时间段
- **大小便**：记录类型、数量、颜色、软硬度
- **其他**：自定义记录类型和时长

## 🚀 部署方案

### 方案 A：使用 NAS（推荐，每年节省 ¥500-1000）

**优势**：
- ✅ 几乎免费（仅域名 ¥50/年）
- ✅ 数据完全自主
- ✅ 性能更好

**部署教程**：

| 教程 | 适合人群 | 时间 | 难度 |
|------|---------|------|------|
| 📗 [UGreen-Deploy.md](docs/UGreen-Deploy.md) | 绿联 NAS 用户 | 30分钟 | ⭐ |
| 📘 [Quick-Deploy.md](docs/Quick-Deploy.md) | 其他 NAS / 有经验 | 10分钟 | ⭐⭐ |
| 📙 [Migration.md](docs/Migration.md) | 想了解细节 | 1-2小时 | ⭐⭐⭐ |

### 方案 B：使用微信云开发

**优势**：
- ✅ 简单省心
- ✅ 微信官方维护

**劣势**：
- ❌ 需要付费（约 ¥50/月）

**部署教程**：[Release.md](docs/Release.md)

## 📁 项目结构

```
uu-notes/
├── src/                    # 小程序源码
│   ├── pages/             # 页面
│   │   ├── index/         # 首页
│   │   ├── baby-selector/ # 宝宝管理
│   │   ├── food/          # 吃饭记录
│   │   ├── sleep/         # 睡觉记录
│   │   ├── shit/          # 大小便记录
│   │   ├── other/         # 其他记录
│   │   └── records/       # 记录列表
│   ├── utils/             # 工具函数
│   │   ├── api.ts         # API 调用（自建后端）
│   │   ├── db.ts          # 云开发调用
│   │   └── format.ts      # 数据格式化
│   └── styles/            # 全局样式
│
├── server/                 # 后端服务（自建方案）
│   ├── index.js           # Express 服务器
│   ├── package.json       # 依赖配置
│   ├── Dockerfile         # Docker 配置
│   ├── docker-compose.yml # Docker Compose
│   └── README.md          # 后端文档
│
├── cloud/                  # 云函数（云开发方案）
│   └── login/             # 登录函数
│
└── docs/                   # 文档
    ├── Deploy-Guide.md    # 📌 部署方案选择
    ├── Quick-Deploy.md    # 快速部署
    ├── Synology-Deploy.md # 群晖部署
    ├── QNAP-Deploy.md     # 威联通部署
    ├── Migration.md       # 完整迁移指南
    ├── Release.md         # 云开发发布
    └── NAS-Setup.md       # NAS 方案总览
```

## 🛠️ 技术栈

### 小程序端
- **框架**：Taro 4.x + React
- **样式**：Less
- **语言**：TypeScript
- **UI**：自定义组件

### 后端（自建方案）
- **运行时**：Node.js 18+
- **框架**：Express
- **数据库**：SQLite (better-sqlite3)
- **认证**：JWT
- **部署**：Docker / PM2

### 云开发方案
- **数据库**：云数据库
- **云函数**：Node.js
- **认证**：云开发登录

## 📦 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 选择后端方案

#### 方案 A：自建后端（推荐）

1. 按照 [Deploy-Guide.md](docs/Deploy-Guide.md) 选择合适的教程
2. 在 NAS/服务器上部署后端
3. 修改 `src/utils/api.ts` 中的 `API_BASE`
4. 将所有 `import from '@/utils/db'` 改为 `import from '@/utils/api'`

#### 方案 B：云开发

1. 在微信公众平台开通云开发
2. 创建数据库集合：`users`, `babies`, `records`
3. 部署云函数：`cloud/login`
4. 配置 `src/app.ts` 中的 `CLOUD_ENV_ID`

### 3. 开发

```bash
# 开发模式
npm run dev:weapp

# 构建
npm run build:weapp

# 多环境构建（云开发）
npm run build:weapp:test   # 测试环境
npm run build:weapp:prod   # 生产环境
```

### 4. 发布

1. 在微信开发者工具中上传代码
2. 在微信公众平台提交审核
3. 审核通过后发布

详细步骤见 [Release.md](docs/Release.md)

## 📖 文档索引

### 部署教程
- 👉 [UGreen-Deploy.md](docs/UGreen-Deploy.md) - **绿联 NAS 完整教程（推荐）**
- 📘 [Quick-Deploy.md](docs/Quick-Deploy.md) - 10分钟快速部署（通用）
- 📙 [Migration.md](docs/Migration.md) - 完整迁移指南（深入学习）

### 发布与配置
- 📙 [Release.md](docs/Release.md) - 云开发发布指南
- 📄 [server/README.md](server/README.md) - 后端 API 文档

### 其他文档
- 📄 [CloudSetup.md](docs/CloudSetup.md) - 云开发配置
- 📄 [Database.md](docs/Database.md) - 数据库设计
- 📄 [Storage.md](docs/Storage.md) - 存储方案

## 💰 成本对比

| 方案 | 初始成本 | 月费用 | 年费用 | 数据控制 |
|------|---------|--------|--------|---------|
| **NAS 自建** | 域名 ¥50 | ¥4 | ¥50 | ✅ 完全自主 |
| 云服务器 | 域名 ¥50 | ¥50 | ¥650 | ✅ 完全自主 |
| 微信云开发 | ¥0 | ¥50-100 | ¥600-1200 | ❌ 微信管理 |

**使用 NAS 每年节省 ¥500-1000！**

## 🎯 功能特点

### UI/UX 优化
- ✨ 大字体设计，易于阅读
- 🎨 现代化配色方案
- 📱 底部 Tab 导航
- ⚡ 骨架屏加载
- 🔄 预加载优化

### 数据管理
- 👶 多宝宝支持
- 👨‍👩‍👧‍👦 多成员共享
- 📝 详细记录信息
- 🔍 历史记录查询
- 🗑️ 删除功能

### 性能优化
- 🚀 云函数预热
- 💾 数据缓存
- 🎭 乐观更新
- ⏱️ 快速响应

## 🔒 隐私和安全

### 自建方案
- ✅ 数据存储在自己的服务器
- ✅ 完全掌控数据访问权限
- ✅ 支持备份和恢复
- ✅ HTTPS 加密传输
- ✅ JWT 认证

### 云开发方案
- ✅ 微信官方安全保障
- ✅ 数据隔离
- ✅ 自动备份

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 License

MIT License

## 🙏 致谢

- Taro 框架
- React 生态
- 微信小程序平台
- 所有开源贡献者

---

## 🚀 开始部署

**使用绿联 NAS？** 👉 查看 [UGreen-Deploy.md](docs/UGreen-Deploy.md) 完整教程

**其他 NAS / 服务器？** 👉 查看 [Quick-Deploy.md](docs/Quick-Deploy.md) 快速部署

**继续用云开发？** 👉 查看 [Release.md](docs/Release.md) 发布指南

祝部署顺利！🎉
