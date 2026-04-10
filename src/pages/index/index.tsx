import { View, Text } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { login } from '../../utils/api'
import { getIndexCache } from '../../utils/cache'
import './index.less'

export default function PrelandingPage() {
  useLoad(async (options) => {
    try {
      // 分享卡片打开时 query 会带上 babyId + inviteFrom
      const babyId = options?.babyId
      const inviteFrom = options?.inviteFrom
      const inviteFromShare =
        babyId != null && String(babyId) !== '' && inviteFrom === 'share'

      console.log('📨 启动参数:', { babyId, inviteFrom, inviteFromShare })

      if (process.env.NODE_ENV === 'development') {
        console.log('🧹 开发模式：清除所有缓存')
        Taro.clearStorageSync()
      }

      let pendingInviteBabyId: string | null = null
      if (inviteFromShare) {
        pendingInviteBabyId = String(babyId)
        Taro.setStorageSync('invite_baby_id', pendingInviteBabyId)
        console.log('💾 保存邀请参数:', pendingInviteBabyId)
      } else {
        const stored = Taro.getStorageSync('invite_baby_id')
        if (stored) pendingInviteBabyId = String(stored)
      }

      // 问题根因之一：有 index 昵称缓存就 switchTab 首页，会跳过登录与邀请。
      // 仅当「没有待处理邀请」时才允许走这条捷径。
      if (!pendingInviteBabyId) {
        const cache = getIndexCache()
        console.log('📦 本地缓存:', cache)
        if (cache?.name) {
          Taro.switchTab({ url: '/pages/home/index' })
          return
        }
      }

      // 2. 检查用户登录状态
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
        Taro.redirectTo({ url: '/pages/onboarding/index' })
        return
      }

      const inviteToHandle = Taro.getStorageSync('invite_baby_id')
      if (inviteToHandle) {
        Taro.redirectTo({ url: `/pages/join-baby/index?babyId=${inviteToHandle}` })
        return
      }

      if (!user.babyIds || user.babyIds.length === 0) {
        Taro.redirectTo({ url: '/pages/add-baby/index' })
        return
      }

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
