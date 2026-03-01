import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
// 已迁移到自建后端 API
import { getRecords, deleteRecord, getCurrentBaby, type Record as ApiRecord } from '../../utils/api'
// import { getAllRecords, deleteRecord } from '../../utils/db' // 云开发已废弃
// import type { Record } from '../../utils/db' // 云开发已废弃
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

function groupByDate(records: ApiRecord[]) {
  const groups: { date: string; records: ApiRecord[] }[] = []
  const map: Record<string, ApiRecord[]> = {}

  records.forEach(r => {
    const d = new Date(r.startTime)
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
  const [records, setRecords] = useState<ApiRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)
  const PAGE_SIZE = 20

  // 初始加载
  useDidShow(async () => {
    setLoading(true)
    setOffset(0)
    setHasMore(true)
    try {
      const baby = await getCurrentBaby()
      if (!baby) {
        setRecords([])
        return
      }
      const response = await getRecords({ babyId: baby.id, limit: PAGE_SIZE, offset: 0 })
      setRecords(response.records)
      setHasMore(response.pagination.hasMore)
      setOffset(PAGE_SIZE)
    } catch (error) {
      console.error('加载记录失败:', error)
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  })

  // 加载更多
  async function loadMore() {
    if (loadingMore || !hasMore) return
    
    setLoadingMore(true)
    try {
      const baby = await getCurrentBaby()
      if (!baby) return
      
      const response = await getRecords({ 
        babyId: baby.id, 
        limit: PAGE_SIZE, 
        offset 
      })
      
      setRecords(prev => [...prev, ...response.records])
      setHasMore(response.pagination.hasMore)
      setOffset(prev => prev + PAGE_SIZE)
    } catch (error) {
      console.error('加载更多失败:', error)
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoadingMore(false)
    }
  }

  // 滚动到底部触发加载更多
  function handleScrollToLower() {
    if (!loading && hasMore && !loadingMore) {
      loadMore()
    }
  }

  async function handleDelete(id: number) {
    const res = await Taro.showModal({
      title: '确认删除',
      content: '确定要删除这条记录吗？',
      confirmText: '删除',
      confirmColor: '#ff4444',
    })
    
    if (res.confirm) {
      try {
        await deleteRecord(id)
        Taro.showToast({ title: '删除成功', icon: 'success' })
        // 从列表中移除该记录
        setRecords(prev => prev.filter(r => r.id !== id))
      } catch (error) {
        console.error('删除失败:', error)
        Taro.showToast({ title: '删除失败', icon: 'none' })
      }
    }
  }

  const groups = groupByDate(records)

  return (
    <ScrollView 
      className='records-page' 
      scrollY
      onScrollToLower={handleScrollToLower}
      lowerThreshold={50}
    >
      {loading ? (
        <View className='loading-state'>
          <Text>加载中...</Text>
        </View>
      ) : groups.length === 0 ? (
        <View className='empty-state'>
          <Text className='empty-icon'>📋</Text>
          <Text className='empty-text'>还没有任何记录</Text>
          <Text className='empty-sub'>快去首页记录宝宝的日常吧~</Text>
        </View>
      ) : (
        <>
          {groups.map(group => (
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
                    <Text className='record-time'>{formatTimestamp(record.startTime)}</Text>
                    <Text className='record-reporter'>👤 记录人 {record.reporterRole || '家长'}</Text>
                  </View>
                  <View className='delete-btn' onClick={() => handleDelete(record.id)}>
                    <Text className='delete-icon'>✕</Text>
                  </View>
                </View>
              ))}
            </View>
          ))}
          
          {/* 加载更多提示 */}
          {loadingMore && (
            <View className='loading-more'>
              <Text>加载中...</Text>
            </View>
          )}
          
          {!hasMore && records.length > 0 && (
            <View className='no-more'>
              <Text>没有更多了</Text>
            </View>
          )}
        </>
      )}
    </ScrollView>
  )
}
