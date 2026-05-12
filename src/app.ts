import { PropsWithChildren } from 'react'
import Taro, { useLaunch } from '@tarojs/taro'

import './app.less'

function App({ children }: PropsWithChildren<any>) {
  useLaunch(() => {
    console.log('App launched.')
    console.log('自建后端 API: https://dksiuu.top/api')
  })

  // children 是将要会渲染的页面
  return children
}

export default App
