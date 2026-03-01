import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { getCurrentBaby, checkLogin } from '../../utils/api'
import { getIndexCache, setIndexCache, clearIndexCache } from '../../utils/cache'
import './index.less'

const MENU_ITEMS = [
  { label: '吃', emoji: '🍼', path: '/pages/food/index', color: '#FF9500', bg: '#FFF3E0' },
  { label: '睡', emoji: '😴', path: '/pages/sleep/index', color: '#5B8DEF', bg: '#EEF4FF' },
  { label: '拉', emoji: '🚽', path: '/pages/shit/index', color: '#8B6E5B', bg: '#F5EDE8' },
  { label: '其他', emoji: '✨', path: '/pages/other/index', color: '#4CAF7D', bg: '#EDFBF3' },
]

export default function HomePage() {
  const [babyName, setBabyName] = useState(() => {
    // 从缓存读取宝宝名称
    const cache = getIndexCache()
    return cache?.name || ''
  })

  useDidShow(async () => {
    // 后台验证缓存数据是否有效
    try {
      const isLoggedIn = await checkLogin()
      if (!isLoggedIn) {
        clearIndexCache()
        Taro.redirectTo({ url: '/pages/index/index' })
        return
      }

      const baby = await getCurrentBaby()
      if (!baby) {
        clearIndexCache()
        Taro.redirectTo({ url: '/pages/index/index' })
        return
      }

      // 更新缓存
      setIndexCache(baby.name)
      if (baby.name !== babyName) {
        setBabyName(baby.name)
      }
    } catch (error) {
      console.error('验证失败:', error)
    }
  })

  return (
    <View className='index-page'>
      <View className='content'>
        <View className='title-section'>
          <Text className='baby-title'>{babyName ? `${babyName} 的日常` : '加载中'}</Text>
        </View>

        <View className='grid'>
          {MENU_ITEMS.map((item) => (
            <View
              key={item.label}
              className='menu-btn'
              style={{ background: item.bg, borderColor: item.color }}
              onClick={() => Taro.navigateTo({ url: item.path })}
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
