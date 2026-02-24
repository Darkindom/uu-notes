import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { getRecentRecords } from '../../utils/db'
import { formatTimestamp, formatRecordSummary, CATEGORY_LABELS } from '../../utils/format'
import './index.less'

const MENU_ITEMS = [
  { label: '吃', emoji: '🍼', path: '/pages/food/index', color: '#FF9500', bg: '#FFF3E0' },
  { label: '睡', emoji: '😴', path: '/pages/sleep/index', color: '#5B8DEF', bg: '#EEF4FF' },
  { label: '拉', emoji: '🚽', path: '/pages/shit/index', color: '#8B6E5B', bg: '#F5EDE8' },
  { label: '其他', emoji: '✨', path: '/pages/other/index', color: '#4CAF7D', bg: '#EDFBF3' },
]

export default function Index() {
  const [recentRecords, setRecentRecords] = useState<ReturnType<typeof getRecentRecords>>([])

  useDidShow(() => {
    setRecentRecords(getRecentRecords(5))
  })

  return (
    <View className='index-page'>
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

      <View className='recent-section'>
        <View className='recent-header'>
          <Text className='recent-title'>最近记录</Text>
          <Text
            className='view-all'
            onClick={() => Taro.navigateTo({ url: '/pages/records/index' })}
          >
            查看全部 &gt;
          </Text>
        </View>

        {recentRecords.length === 0 ? (
          <View className='empty-tip'>
            <Text className='empty-text'>还没有记录，快来添加吧~</Text>
          </View>
        ) : (
          recentRecords.map((record) => (
            <View key={record.id} className='record-item'>
              <View
                className='record-tag'
                style={{
                  background:
                    MENU_ITEMS.find((m) => m.label === CATEGORY_LABELS[record.category])?.bg ??
                    '#f5f5f5',
                  color:
                    MENU_ITEMS.find((m) => m.label === CATEGORY_LABELS[record.category])?.color ??
                    '#666',
                }}
              >
                <Text>{CATEGORY_LABELS[record.category]}</Text>
              </View>
              <View className='record-info'>
                <Text className='record-summary'>{formatRecordSummary(record)}</Text>
                <Text className='record-time'>{formatTimestamp(record.timestamp)}</Text>
              </View>
            </View>
          ))
        )}
      </View>
    </View>
  )
}
