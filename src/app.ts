import { PropsWithChildren } from 'react'
import Taro, { useLaunch } from '@tarojs/taro'

import './app.less'

function App({ children }: PropsWithChildren<any>) {
  useLaunch(() => {
    console.log('App launched.')
    console.log('使用自建后端 API: https://dksiuu.top/api')

    // ========================================
    // 云开发所有功能已迁移到自建后端
    // ========================================
    // 自建后端 API 地址: https://dksiuu.top/api
    // 数据库: SQLite (NAS 本地存储)
    // 认证方式: JWT Token
    // ========================================

    // 初始化云开发（仅用于 AI Agent）
    try {
      if (Taro.cloud && Taro.cloud.init) {
        Taro.cloud.init({
          env: 'cloudbase-0gom0wo33480db9c',
          traceUser: true,
        })
        console.log('云开发初始化成功（用于 AI Agent）')
      }
    } catch (error) {
      console.error('云开发初始化失败:', error)
    }
  })

  // children 是将要会渲染的页面
  return children
}

export default App
