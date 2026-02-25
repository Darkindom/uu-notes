# 快速发布指南

## 第一步：配置多环境

### 1. 创建云环境（一次性配置）

登录 [微信公众平台](https://mp.weixin.qq.com)，创建两个新的云环境：

- **测试环境**：用于测试版本
- **生产环境**：用于正式发布

### 2. 更新云环境 ID

编辑 `src/app.ts`，修改 `ENV_CONFIG`:

```typescript
const ENV_CONFIG = {
  dev: 'cloudbase-0gom0wo33480db9c',  // 保持不变
  test: '你的测试环境ID',              // ← 填写这里
  prod: '你的生产环境ID',              // ← 填写这里
}
```

### 3. 配置数据库和云函数

为 **test** 和 **prod** 环境分别：

1. 创建数据库集合：`users`, `babies`, `records`
2. 部署云函数：右键 `cloud/login` → "上传并部署：云端安装依赖"

## 第二步：测试版发布

```bash
# 1. 构建测试版本
npm run build:weapp:test

# 2. 在微信开发者工具中上传
# 3. 在微信公众平台设置为体验版
```

## 第三步：正式版发布

```bash
# 1. 构建生产版本
npm run build:weapp:prod

# 2. 在微信开发者工具中上传
# 3. 在微信公众平台提交审核
# 4. 审核通过后点击发布
```

## 常用命令

```bash
# 开发（本地测试）
npm run dev:weapp           # 开发环境
npm run dev:weapp:test      # 测试环境
npm run dev:weapp:prod      # 生产环境

# 构建（准备上传）
npm run build:weapp:test    # 测试环境
npm run build:weapp:prod    # 生产环境
```

## 注意事项

- ⚠️ 首次发布前，确保已配置小程序基本信息（名称、图标、分类）
- ⚠️ 提交审核时需要提供功能描述和隐私协议
- ⚠️ 审核通常需要 1-7 天
- ⚠️ 确保测试环境和生产环境数据完全隔离

## 更多详细信息

查看完整文档：`docs/Release.md`
