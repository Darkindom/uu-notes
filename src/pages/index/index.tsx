import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { isFirstTime, getCurrentBaby } from '../../utils/db'
import './index.less'

const MENU_ITEMS = [
  { label: '吃', emoji: '🍼', path: '/pages/food/index', color: '#FF9500', bg: '#FFF3E0' },
  { label: '睡', emoji: '😴', path: '/pages/sleep/index', color: '#5B8DEF', bg: '#EEF4FF' },
  { label: '拉', emoji: '🚽', path: '/pages/shit/index', color: '#8B6E5B', bg: '#F5EDE8' },
  { label: '其他', emoji: '✨', path: '/pages/other/index', color: '#4CAF7D', bg: '#EDFBF3' },
]

export default function Index() {
  const [babyName, setBabyName] = useState('')
  const [loading, setLoading] = useState(true)

  useDidShow(async () => {
    setLoading(true)
    try {
      // 检查是否首次使用（没有用户信息）
      const firstTime = await isFirstTime()
      if (firstTime) {
        Taro.redirectTo({ url: '/pages/onboarding/index' })
        return
      }

      // 有用户信息，检查是否有当前宝宝
      const baby = await getCurrentBaby()
      if (!baby) {
        // 有用户但没有宝宝，跳转到宝宝选择页面（可以添加新宝宝）
        Taro.switchTab({ url: '/pages/baby-selector/index' })
        return
      }

      setBabyName(baby.name)
    } catch (error) {
      console.error('加载数据失败:', error)
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  })

  return (
    <View className='index-page'>
      <View className='content'>
        <View className='title-section'>
          <Text className='baby-title'>
            {loading ? '加载中' : `${babyName} 的日常`}
          </Text>
        </View>
        
        <View className='grid'>
          {MENU_ITEMS.map((item) => (
            <View
              key={item.label}
              className='menu-btn'
              style={{ background: item.bg, borderColor: item.color }}
              onClick={() => !loading && Taro.navigateTo({ url: item.path })}
            >
              <Text className='menu-emoji'>{item.emoji}</Text>
              <Text className='menu-label' style={{ color: item.color }}>
                {item.label}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  )
}
