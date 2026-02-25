import { PropsWithChildren } from 'react'
import Taro, { useLaunch } from '@tarojs/taro'

import './app.less'

// 云环境 ID，需要在微信开发者工具中开通云开发后替换
const CLOUD_ENV_ID = 'cloudbase-0gom0wo33480db9c'

function App({ children }: PropsWithChildren<any>) {
  useLaunch(() => {
    console.log('App launched.')

    // 初始化云开发
    if (Taro.cloud) {
      Taro.cloud.init({
        env: CLOUD_ENV_ID,
        traceUser: true,
      })
      console.log('Cloud initialized with env:', CLOUD_ENV_ID)
      
      // 预加载：提前调用一次云函数来"热身"
      setTimeout(() => {
        Taro.cloud.callFunction({
          name: 'login',
          data: {}
        }).then(() => {
          console.log('预加载：云函数已预热')
        }).catch(err => {
          console.log('预加载失败（正常）:', err)
        })
      }, 100)
    }
  })

  // children 是将要会渲染的页面
  return children
}

export default App
