import { View, Text, Input, Button, Picker } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useState } from 'react'
import { createBaby, login, updateUser } from '../../utils/api'
import './index.less'

const ROLES = ['妈妈', '爸爸', '奶奶', '爷爷', '外婆', '外公', '其他']

export default function OnboardingPage() {
  const [step, setStep] = useState(1) // 1: 输入用户信息, 2: 输入宝宝信息
  const [loading, setLoading] = useState(false)

  // 用户信息
  const [nickname, setNickname] = useState('')
  const [role, setRole] = useState('妈妈')
  const [roleIdx, setRoleIdx] = useState(0)

  // 宝宝信息
  const [babyName, setBabyName] = useState('')
  const [gender, setGender] = useState<'male' | 'female'>('male')
  const [birthday, setBirthday] = useState('')

  useLoad(() => {
    // 不在这里自动获取用户信息，改为用户点击按钮后获取
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

  async function handleNext() {
    if (!nickname.trim()) {
      Taro.showToast({ title: '请输入您的昵称', icon: 'none' })
      return
    }
    setStep(2)
  }

  async function handleSubmit() {
    if (!babyName.trim()) {
      Taro.showToast({ title: '请输入宝宝姓名', icon: 'none' })
      return
    }
    if (!birthday) {
      Taro.showToast({ title: '请选择宝宝生日', icon: 'none' })
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

      // 3. 创建宝宝
      const baby = await createBaby({
        name: babyName,
        gender,
        birthday: new Date(birthday).getTime(),
        role,
      })

      if (!baby) {
        throw new Error('创建宝宝信息失败')
      }

      Taro.showToast({ title: '创建成功！', icon: 'success' })
      setTimeout(() => {
        Taro.reLaunch({ url: '/pages/index/index' })
      }, 1500)
    } catch (error) {
      console.error('创建失败:', error)
      Taro.showToast({ title: '创建失败，请重试', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className='page-container onboarding-page'>
      <View className='main-card'>
        {step === 1 ? (
          <>
            <View className='welcome-section'>
              <Text className='welcome-title'>👶 欢迎使用猪宝日常</Text>
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

            <View className='section'>
              <Text className='field-label'>👨‍👩‍👧 您的角色</Text>
              <Picker
                mode='selector'
                range={ROLES}
                value={roleIdx}
                onChange={(e) => {
                  const idx = parseInt(e.detail.value)
                  setRoleIdx(idx)
                  setRole(ROLES[idx])
                }}
              >
                <View className='picker-display'>{role}</View>
              </Picker>
            </View>

            <Button className='submit-btn' onClick={handleNext}>
              下一步
            </Button>
          </>
        ) : (
          <>
            <View className='welcome-section'>
              <Text className='welcome-title'>🍼 宝宝信息</Text>
              <Text className='welcome-subtitle'>请填写宝宝的基本信息</Text>
            </View>

            <View className='section'>
              <Text className='field-label'>👶 宝宝姓名</Text>
              <Input
                className='text-input'
                placeholder='请输入宝宝姓名'
                value={babyName}
                onInput={(e) => setBabyName(e.detail.value)}
              />
            </View>

            <View className='section'>
              <Text className='field-label'>⚥ 性别</Text>
              <View className='options-row'>
                <View
                  className={`option-chip ${gender === 'male' ? 'active' : ''}`}
                  onClick={() => setGender('male')}
                >
                  <Text>男宝</Text>
                </View>
                <View
                  className={`option-chip ${gender === 'female' ? 'active' : ''}`}
                  onClick={() => setGender('female')}
                >
                  <Text>女宝</Text>
                </View>
              </View>
            </View>

            <View className='section'>
              <Text className='field-label'>🎂 生日</Text>
              <Picker
                mode='date'
                value={birthday}
                end={new Date().toISOString().split('T')[0]}
                onChange={(e) => setBirthday(e.detail.value)}
              >
                <View className='picker-display'>{birthday || '请选择生日'}</View>
              </Picker>
            </View>

            <View className='button-row'>
              <Button className='back-btn' onClick={() => setStep(1)}>
                上一步
              </Button>
              <Button className='submit-btn' onClick={handleSubmit} loading={loading}>
                完成
              </Button>
            </View>
          </>
        )}
      </View>
    </View>
  )
}
