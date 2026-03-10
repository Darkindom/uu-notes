import { View, Text } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { login } from '../../utils/api'
import { getIndexCache } from '../../utils/cache'
import './index.less'

export default function PrelandingPage() {
  useLoad(async (options) => {
    try {
      // 获取邀请参数
      const babyId = options?.babyId
      const inviteFrom = options?.inviteFrom
      
      console.log('📨 启动参数:', { babyId, inviteFrom })
      
      // 开发环境：清除所有缓存（但保留邀请参数）
      if (process.env.NODE_ENV === 'development') {
        console.log('🧹 开发模式：清除所有缓存')
        Taro.clearStorageSync()
      }
      
      // 如果有邀请参数，保存到本地存储（在清除缓存之后）
      if (babyId && inviteFrom === 'share') {
        Taro.setStorageSync('invite_baby_id', babyId)
        console.log('💾 保存邀请参数:', babyId)
      }
      
      // 1. 检查本地缓存
      const cache = getIndexCache()
      console.log('📦 本地缓存:', cache)
      if (cache?.name) {
        // 有缓存，直接进入首页
        Taro.switchTab({ url: '/pages/home/index' })
        return
      }

      // 2. 没有缓存，检查用户登录状态
      console.log('🔐 开始登录...')
      const user = await login()
      console.log('当前登录用户:', user)
      console.log('用户 openId:', user?.openId)

      // 3. 根据用户状态路由
      if (!user) {
        // 无法获取用户信息，进入引导页
        Taro.redirectTo({ url: '/pages/onboarding/index' })
        return
      }

      if (!user.nickname) {
        // 新用户，没有昵称，进入引导页
        Taro.redirectTo({ url: '/pages/onboarding/index' })
        return
      }

      if (!user.babyIds || user.babyIds.length === 0) {
        // 老用户，没有宝宝
        // 如果有邀请参数，跳转到加入宝宝页面
        if (babyId && inviteFrom === 'share') {
          Taro.redirectTo({ url: `/pages/join-baby/index?babyId=${babyId}` })
        } else {
          // 进入添加宝宝页
          Taro.redirectTo({ url: '/pages/add-baby/index' })
        }
        return
      }

      // 老用户，有宝宝，进入首页
      Taro.switchTab({ url: '/pages/home/index' })
    } catch (error) {
      console.error('初始化路由失败:', error)
      // 出错时进入引导页
      Taro.redirectTo({ url: '/pages/onboarding/index' })
    }
  })

  return (
    <View className='prelanding-page'>
      <View className='loading-container'>
        <Text className='loading-text'>加载中...</Text>
      </View>
    </View>
  )
}
