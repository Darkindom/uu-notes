import { View, Text, Input, Button } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useState } from 'react'
import { login, updateUser, type User } from '../../utils/api'
import {
  hasSeenOnboardingTutorial,
  markOnboardingTutorialSeen,
} from '../../utils/onboardingTutorial'
import { TUTORIAL_STEPS, type TutorialVisual } from '../../utils/tutorialSteps'
import './index.less'

export default function OnboardingPage() {
  const [loading, setLoading] = useState(false)
  const [bootstrappedUser, setBootstrappedUser] = useState<User | null>(null)
  const [showTutorial, setShowTutorial] = useState(false)
  const [tutorialIndex, setTutorialIndex] = useState(0)

  // 用户信息
  const [nickname, setNickname] = useState('')

  useLoad(async () => {
    try {
      const user = await login()
      setBootstrappedUser(user)

      if (!hasSeenOnboardingTutorial(Taro, user?.id)) {
        setShowTutorial(true)
        markOnboardingTutorialSeen(Taro, user?.id)
      }
    } catch (error) {
      console.error('初始化教程状态失败:', error)
      if (!hasSeenOnboardingTutorial(Taro, null)) {
        setShowTutorial(true)
        markOnboardingTutorialSeen(Taro, null)
      }
    }
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
      const user = bootstrappedUser || await login()
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

  function handleTutorialNext() {
    if (tutorialIndex >= TUTORIAL_STEPS.length - 1) {
      setShowTutorial(false)
      return
    }

    setTutorialIndex(tutorialIndex + 1)
  }

  function handleTutorialSkip() {
    setShowTutorial(false)
  }

  function renderTutorialVisual(visual: TutorialVisual) {
    if (visual === 'add-baby') {
      return (
        <View className='tutorial-visual add-baby-visual'>
          <View className='visual-phone-header' />
          <View className='baby-avatar-preview'>
            <Text>宝</Text>
          </View>
          <View className='visual-input wide' />
          <View className='visual-input' />
          <View className='visual-primary-btn' />
        </View>
      )
    }

    if (visual === 'record-milk') {
      return (
        <View className='tutorial-visual record-milk-visual'>
          <View className='visual-phone-header' />
          <View className='milk-bottle'>
            <View className='milk-cap' />
            <View className='milk-level' />
          </View>
          <View className='amount-preview'>
            <Text>150ml</Text>
          </View>
          <View className='visual-chip-row'>
            <View className='visual-chip active' />
            <View className='visual-chip' />
            <View className='visual-chip' />
          </View>
        </View>
      )
    }

    if (visual === 'records-list') {
      return (
        <View className='tutorial-visual records-list-visual'>
          <View className='visual-phone-header' />
          <View className='record-row'>
            <View className='record-dot food' />
            <View className='record-lines'>
              <View className='record-line long' />
              <View className='record-line short' />
            </View>
          </View>
          <View className='record-row'>
            <View className='record-dot sleep' />
            <View className='record-lines'>
              <View className='record-line medium' />
              <View className='record-line short' />
            </View>
          </View>
          <View className='record-row'>
            <View className='record-dot poop' />
            <View className='record-lines'>
              <View className='record-line long' />
              <View className='record-line short' />
            </View>
          </View>
        </View>
      )
    }

    return (
      <View className='tutorial-visual baby-chart-visual'>
        <View className='visual-phone-header' />
        <View className='food-week-row'>
          <View className='food-pill filled' />
          <View className='food-pill filled' />
          <View className='food-pill' />
          <View className='food-pill filled' />
        </View>
        <View className='chart-preview'>
          <View className='chart-bar small' />
          <View className='chart-bar medium' />
          <View className='chart-bar tall' />
          <View className='chart-bar medium' />
          <View className='chart-bar small' />
        </View>
        <View className='chart-legend'>
          <View className='legend-item orange' />
          <View className='legend-item blue' />
        </View>
      </View>
    )
  }

  if (showTutorial) {
    const step = TUTORIAL_STEPS[tutorialIndex]
    const isLast = tutorialIndex === TUTORIAL_STEPS.length - 1

    return (
      <View className='page-container onboarding-page'>
        <View className='tutorial-card'>
          <View className='tutorial-header'>
            <Text className='tutorial-title'>UU宝宝日记</Text>
            <Text className='tutorial-subtitle'>用 4 步完成宝宝日常记录</Text>
          </View>

          <View className='tutorial-body'>
            {renderTutorialVisual(step.visual)}
            <Text className='tutorial-step-title'>{step.title}</Text>
            <Text className='tutorial-step-desc'>{step.desc}</Text>
          </View>

          <View className='tutorial-dots'>
            {TUTORIAL_STEPS.map((item, index) => (
              <View
                key={item.marker}
                className={`tutorial-dot ${index === tutorialIndex ? 'active' : ''}`}
              />
            ))}
          </View>

          <View className='tutorial-actions'>
            {!isLast && (
              <Button className='tutorial-skip-btn' onClick={handleTutorialSkip}>
                跳过
              </Button>
            )}
            <Button className='tutorial-next-btn' onClick={handleTutorialNext}>
              {isLast ? '开始使用' : '下一步'}
            </Button>
          </View>
        </View>
      </View>
    )
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
