import { PropsWithChildren } from 'react'
import { useLaunch } from '@tarojs/taro'

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
  })

  // children 是将要会渲染的页面
  return children
}

export default App
