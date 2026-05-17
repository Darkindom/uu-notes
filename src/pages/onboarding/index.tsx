import { View, Text, Input, Button } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useState } from 'react'
import { login, updateUser, type User } from '../../utils/api'
import {
  hasSeenOnboardingTutorial,
  markOnboardingTutorialSeen,
} from '../../utils/onboardingTutorial'
import './index.less'

const TUTORIAL_STEPS = [
  {
    title: '添加宝宝',
    desc: '先建立宝宝档案，记录会自动归到当前宝宝。',
    marker: '1',
  },
  {
    title: '记录奶量',
    desc: '在首页点“吃”，记录母乳、奶粉、水和辅食。',
    marker: '2',
  },
  {
    title: '查看记录列表',
    desc: '在“记录”页按日期查看、编辑和删除日常记录。',
    marker: '3',
  },
  {
    title: '宝宝页看趋势',
    desc: '宝宝页展示一周辅食、奶量和睡眠图表。',
    marker: '4',
  },
]

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
            <View className='tutorial-marker'>
              <Text>{step.marker}</Text>
            </View>
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
