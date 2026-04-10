import { View, Text, Input, Button } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useState } from 'react'
import { login, updateUser } from '../../utils/api'
import './index.less'

export default function OnboardingPage() {
  const [loading, setLoading] = useState(false)

  // 用户信息
  const [nickname, setNickname] = useState('')

  useLoad(() => {
    // onboarding 页面不需要再做检查，由 prelanding 统一处理
  })

  function handleGetUserInfo() {
    Taro.getUserProfile({
      desc: '用于完善个人资料',
      success: (res) => {
        setNickname(res.userInfo.nickName)
        Taro.showToast({ title: '获取成功', icon: 'success' })
      },
      fail: (err) => {
        console.log('获取用户信息失败', err)
        Taro.showToast({ title: '获取信息失败', icon: 'none' })
      },
    })
  }

  async function handleSubmit() {
    if (!nickname.trim()) {
      Taro.showToast({ title: '请输入您的昵称', icon: 'none' })
      return
    }
    
    setLoading(true)
    try {
      // 1. 先登录获取 token
      const user = await login()
      if (!user) {
        throw new Error('登录失败')
      }

      // 2. 更新用户昵称
      await updateUser({ nickname })
      
      // 3. 检查是否有邀请参数
      const inviteBabyId = Taro.getStorageSync('invite_baby_id')
      
      if (inviteBabyId) {
        // 有邀请，跳转到加入宝宝页面
        Taro.redirectTo({ url: `/pages/join-baby/index?babyId=${inviteBabyId}` })
      } else {
        // 没有邀请，跳转到添加宝宝页面
        Taro.redirectTo({ url: '/pages/add-baby/index' })
      }
    } catch (error) {
      console.error('更新用户信息失败:', error)
      Taro.showToast({ title: '操作失败，请重试', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className='page-container onboarding-page'>
      <View className='main-card'>
        <View className='welcome-section'>
          <Text className='welcome-title'>👶 欢迎使用UU宝宝日记</Text>
          <Text className='welcome-subtitle'>记录宝宝成长的每一刻</Text>
        </View>

        <View className='section'>
          <Text className='field-label'>👤 您的昵称</Text>
          <Input
            className='text-input'
            placeholder='请输入您的昵称'
            value={nickname}
            onInput={(e) => setNickname(e.detail.value)}
          />
          {!nickname && (
            <Button className='get-info-btn' onClick={handleGetUserInfo}>
              或点击获取微信昵称
            </Button>
          )}
        </View>

        <Button className='submit-btn' onClick={handleSubmit} loading={loading}>
          下一步
        </Button>
      </View>
    </View>
  )
}
