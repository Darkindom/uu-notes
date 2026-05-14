import { PropsWithChildren } from 'react'
import Taro, { useLaunch, useShareAppMessage, useShareTimeline } from '@tarojs/taro'

import './app.less'

function App({ children }: PropsWithChildren<any>) {
  useLaunch(() => {
    console.log('App launched.')
    console.log('自建后端 API: https://dksiuu.top/api')
  })

  useShareAppMessage(() => ({
    title: 'UU日记 - 记录宝宝日常',
    path: '/pages/index/index',
  }))

  useShareTimeline(() => ({
    title: 'UU日记 - 宝宝成长记录好帮手',
  }))

  return children
}

export default App
