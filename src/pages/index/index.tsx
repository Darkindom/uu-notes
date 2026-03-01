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

export default function Index() {
  const [babyName, setBabyName] = useState(() => {
    // 初始化时先从缓存读取
    const cache = getIndexCache()
    return cache?.name || ''
  })
  const [loading, setLoading] = useState(true)

  useDidShow(async () => {
    // 先从缓存读取快速显示
    const cache = getIndexCache()
    if (cache && cache.name) {
      setBabyName(cache.name)
      setLoading(false)
    }

    // 异步请求接口，验证并更新数据
    try {
      // 检查是否已登录
      const isLoggedIn = await checkLogin()
      if (!isLoggedIn) {
        clearIndexCache()
        Taro.redirectTo({ url: '/pages/onboarding/index' })
        return
      }

      // 已登录，检查是否有当前宝宝
      const baby = await getCurrentBaby()
      if (!baby) {
        // 有用户但没有宝宝，清除缓存并跳转到添加宝宝页面
        clearIndexCache()
        Taro.redirectTo({ url: '/pages/onboarding/index?step=2' })
        return
      }

      // 数据有效，更新缓存（下次进入会使用新数据）
      setIndexCache(baby.name)
      
      // 如果接口返回的数据与当前显示不一致，更新显示
      if (baby.name !== babyName) {
        setBabyName(baby.name)
      }
    } catch (error) {
      console.error('加载数据失败:', error)
      // 如果没有缓存数据，才显示错误提示
      if (!cache || !cache.name) {
        Taro.showToast({ title: '加载失败', icon: 'none' })
      }
    } finally {
      setLoading(false)
    }
  })

  return (
    <View className='index-page'>
      <View className='content'>
        <View className='title-section'>
          <Text className='baby-title'>{loading ? '加载中' : `${babyName} 的日常`}</Text>
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
