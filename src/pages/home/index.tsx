import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { getCurrentBaby, checkLogin, getRecentRecordsByCategory } from '../../utils/api'
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
  const [timeSinceFood, setTimeSinceFood] = useState<string>('')
  const [timeSinceShit, setTimeSinceShit] = useState<string>('')

  // 计算时间差
  const calculateTimeDiff = (timestamp: number): string => {
    const now = Date.now()
    const diff = now - timestamp
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    // 超过2天，显示"x天以上"
    if (days > 2) {
      return `${days} 天以上`
    }

    const parts: string[] = []
    if (days > 0) parts.push(`${days} 天`)
    if (hours > 0) parts.push(`${hours} 时`)
    if (minutes > 0) parts.push(`${minutes} 分`)

    return parts.length > 0 ? parts.join(' ') : '刚刚'
  }

  // 获取最近记录
  const fetchRecentRecords = async () => {
    try {
      // 获取最近的吃记录
      const foodRecords = await getRecentRecordsByCategory('food', 1)
      if (foodRecords.length > 0) {
        setTimeSinceFood(calculateTimeDiff(foodRecords[0].startTime))
      } else {
        setTimeSinceFood('')
      }

      // 获取最近的拉记录（不区分大便和换尿片）
      const shitRecords = await getRecentRecordsByCategory('shit', 1)
      if (shitRecords.length > 0) {
        setTimeSinceShit(calculateTimeDiff(shitRecords[0].startTime))
      } else {
        setTimeSinceShit('')
      }
    } catch (error) {
      console.error('获取记录失败:', error)
    }
  }

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

      // 获取最近记录
      await fetchRecentRecords()
    } catch (error) {
      console.error('验证失败:', error)
    }
  })

  // 定时更新时间差
  useEffect(() => {
    const timer = setInterval(() => {
      fetchRecentRecords()
    }, 60000) // 每分钟更新一次

    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

        {/* 提示区域 */}
        <View className='hint-section'>
          {timeSinceFood && (
            <View className='hint-item'>
              <View className='hint-label'>
                <Text className='hint-label-light'>距上次</Text>
                <Text className='hint-label-eat'>吃</Text>
              </View>
              <Text className='hint-time'>{timeSinceFood}</Text>
            </View>
          )}
          {timeSinceShit && (
            <View className='hint-item'>
              <View className='hint-label'>
                <Text className='hint-label-light'>距上次</Text>
                <Text className='hint-label-poop'>拉</Text>
              </View>
              <Text className='hint-time'>{timeSinceShit}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  )
}
