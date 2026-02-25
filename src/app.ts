import { PropsWithChildren } from 'react'
import Taro, { useLaunch } from '@tarojs/taro'

import './app.less'

// 云环境配置
const ENV_CONFIG = {
  // 开发环境
  dev: 'cloudbase-0gom0wo33480db9c',
  // 测试环境（需要在微信云开发中创建测试环境）
  test: 'cloudbase-0gom0wo33480db9c', // 替换为测试环境 ID
  // 生产环境（需要在微信云开发中创建生产环境）
  prod: 'cloudbase-0gom0wo33480db9c', // 替换为生产环境 ID
}

// 根据编译命令自动选择环境
// 可以通过 process.env.NODE_ENV 或自定义环境变量来切换
const getCurrentEnv = (): 'dev' | 'test' | 'prod' => {
  // 可以通过环境变量控制，例如：TARO_ENV=prod npm run build:weapp
  const env = process.env.TARO_APP_ENV || 'dev'
  return env as 'dev' | 'test' | 'prod'
}

const CURRENT_ENV = getCurrentEnv()
const CLOUD_ENV_ID = ENV_CONFIG[CURRENT_ENV]

function App({ children }: PropsWithChildren<any>) {
  useLaunch(() => {
    console.log('App launched.')
    console.log('当前环境:', CURRENT_ENV)
    console.log('云环境 ID:', CLOUD_ENV_ID)

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
