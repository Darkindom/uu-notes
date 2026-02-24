import { View, Text, Button, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { getAllRecords, deleteRecord } from '../../utils/db'
import type { Record } from '../../utils/db'
import {
  formatTimestamp,
  formatRecordSummary,
  CATEGORY_LABELS,
} from '../../utils/format'
import './index.less'

const CATEGORY_STYLE: Record<string, { bg: string; color: string }> = {
  food: { bg: '#FFF3E0', color: '#FF9500' },
  sleep: { bg: '#EEF4FF', color: '#5B8DEF' },
  shit: { bg: '#F5EDE8', color: '#8B6E5B' },
  other: { bg: '#EDFBF3', color: '#4CAF7D' },
}

function groupByDate(records: ReturnType<typeof getAllRecords>) {
  const groups: { date: string; records: typeof records }[] = []
  const map: Record<string, typeof records> = {}

  records.forEach(r => {
    const d = new Date(r.timestamp)
    const key = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
    if (!map[key]) {
      map[key] = []
      groups.push({ date: key, records: map[key] })
    }
    map[key].push(r)
  })

  return groups
}

export default function RecordsPage() {
  const [records, setRecords] = useState<ReturnType<typeof getAllRecords>>([])

  useDidShow(() => {
    setRecords(getAllRecords())
  })

  function handleDelete(id: string) {
    Taro.showModal({
      title: '确认删除',
      content: '确定要删除这条记录吗？',
      confirmText: '删除',
      confirmColor: '#ff4444',
      success(res) {
        if (res.confirm) {
          deleteRecord(id)
          setRecords(getAllRecords())
        }
      },
    })
  }

  const groups = groupByDate(records)

  return (
    <ScrollView className='records-page' scrollY>
      {groups.length === 0 ? (
        <View className='empty-state'>
          <Text className='empty-icon'>📋</Text>
          <Text className='empty-text'>还没有任何记录</Text>
          <Text className='empty-sub'>快去首页记录宝宝的日常吧~</Text>
        </View>
      ) : (
        groups.map(group => (
          <View key={group.date} className='date-group'>
            <View className='date-header'>
              <Text className='date-text'>{group.date}</Text>
              <Text className='date-count'>{group.records.length} 条</Text>
            </View>

            {group.records.map(record => (
              <View key={record.id} className='record-card'>
                <View
                  className='category-badge'
                  style={{
                    background: CATEGORY_STYLE[record.category]?.bg ?? '#f5f5f5',
                    color: CATEGORY_STYLE[record.category]?.color ?? '#666',
                  }}
                >
                  <Text>{CATEGORY_LABELS[record.category]}</Text>
                </View>
                <View className='record-body'>
                  <Text className='record-summary'>{formatRecordSummary(record)}</Text>
                  <Text className='record-time'>{formatTimestamp(record.timestamp)}</Text>
                </View>
                <View className='delete-btn' onClick={() => handleDelete(record.id)}>
                  <Text className='delete-icon'>✕</Text>
                </View>
              </View>
            ))}
          </View>
        ))
      )}
    </ScrollView>
  )
}
