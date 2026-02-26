import { PropsWithChildren } from 'react'
import { useLaunch } from '@tarojs/taro'

import './app.less'

function App({ children }: PropsWithChildren<any>) {
  useLaunch(() => {
    console.log('App launched.')
    console.log('使用自建后端 API: https://dksiuu.top/api')
    
    // 不再使用云开发，改用自建后端
    // 云开发初始化已禁用
  })

  // children 是将要会渲染的页面
  return children
}

export default App
