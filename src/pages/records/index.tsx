import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import dayjs from 'dayjs'
import { getRecords, deleteRecord, getCurrentBaby, type Record as ApiRecord } from '../../utils/api'
import {
  formatTimestamp,
  formatRecordSummary,
  CATEGORY_LABELS,
} from '../../utils/format'
import Calendar from '../../components/Calendar'
import './index.less'

const CATEGORY_STYLE: Record<string, { bg: string; color: string }> = {
  food: { bg: '#FFF3E0', color: '#FF9500' },
  sleep: { bg: '#EEF4FF', color: '#5B8DEF' },
  shit: { bg: '#F5EDE8', color: '#8B6E5B' },
  other: { bg: '#EDFBF3', color: '#4CAF7D' },
}

const CATEGORY_FILTERS = [
  { label: '全部', value: '' },
  { label: '吃', value: 'food' },
  { label: '睡', value: 'sleep' },
  { label: '拉', value: 'shit' },
  { label: '其他', value: 'other' },
]

// 缓存键前缀
const CACHE_KEY_PREFIX = 'records_cache_'

// 获取缓存键
function getCacheKey(babyId: number, category: string, date: string) {
  return `${CACHE_KEY_PREFIX}${babyId}_${category}_${date}`
}

// 保存缓存
function saveCache(babyId: number, category: string, date: string, records: ApiRecord[]) {
  const key = getCacheKey(babyId, category, date)
  try {
    Taro.setStorageSync(key, {
      records,
      timestamp: Date.now(),
    })
  } catch (error) {
    console.error('保存缓存失败:', error)
  }
}

// 读取缓存
function loadCache(babyId: number, category: string, date: string): ApiRecord[] | null {
  const key = getCacheKey(babyId, category, date)
  try {
    const cache = Taro.getStorageSync(key)
    if (cache && cache.records) {
      // 缓存有效期 5 分钟
      if (Date.now() - cache.timestamp < 5 * 60 * 1000) {
        return cache.records
      }
    }
  } catch (error) {
    console.error('读取缓存失败:', error)
  }
  return null
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
  const [allRecords, setAllRecords] = useState<ApiRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  })
  const [showCalendar, setShowCalendar] = useState(false)

  // 初始加载
  useDidShow(async () => {
    await loadRecords()
  })

  // 当 selectedDate 改变时，重新加载记录
  useEffect(() => {
    loadRecords()
  }, [selectedDate])

  async function loadRecords() {
    setLoading(true)
    try {
      const baby = await getCurrentBaby()
      if (!baby) {
        setAllRecords([])
        return
      }

      // 计算日期范围
      const startOfDay = new Date(selectedDate)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(selectedDate)
      endOfDay.setHours(23, 59, 59, 999)

      // 先尝试从缓存加载
      const cachedRecords = loadCache(baby.id, '', selectedDate)
      if (cachedRecords) {
        setAllRecords(cachedRecords)
        setLoading(false)
      }

      // 异步请求最新数据（不传 category，获取所有类型）
      const response = await getRecords({
        babyId: baby.id,
        limit: 1000,
        offset: 0,
        startDate: startOfDay.getTime(),
        endDate: endOfDay.getTime(),
      })

      setAllRecords(response.records)
      // 保存到缓存
      saveCache(baby.id, '', selectedDate, response.records)
    } catch (error) {
      console.error('加载记录失败:', error)
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
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
        const newRecords = allRecords.filter(r => r.id !== id)
        setAllRecords(newRecords)
        // 更新缓存
        const baby = await getCurrentBaby()
        if (baby) {
          saveCache(baby.id, '', selectedDate, newRecords)
        }
      } catch (error) {
        console.error('删除失败:', error)
        Taro.showToast({ title: '删除失败', icon: 'none' })
      }
    }
  }

  function handleEdit(record: ApiRecord) {
    const pathMap = {
      food: '/pages/food/index',
      sleep: '/pages/sleep/index',
      shit: '/pages/shit/index',
      other: '/pages/other/index',
    }
    
    const path = pathMap[record.category] || '/pages/home/index'
    Taro.setStorageSync('editRecord', record)
    Taro.navigateTo({
      url: `${path}?editId=${record.id}`,
    })
  }

  // 打开日历
  function handleOpenCalendar() {
    setShowCalendar(true)
  }

  // 确认选择日期
  function handleConfirmDate(date: Date) {
    const dateStr = dayjs(date).format('YYYY-MM-DD')
    setSelectedDate(dateStr)
    setShowCalendar(false)
  }

  // 取消选择日期
  function handleCancelCalendar() {
    setShowCalendar(false)
  }

  // 前端筛选：根据类型过滤记录
  const filteredRecords = categoryFilter 
    ? allRecords.filter(r => r.category === categoryFilter)
    : allRecords

  const groups = groupByDate(filteredRecords)

  return (
    <View className='records-page'>
      {/* 筛选栏 */}
      <View className='filter-bar'>
        <View className='filter-section'>
          <Text className='filter-label'>日期</Text>
          <View className='date-picker-btn' onClick={handleOpenCalendar}>
            <Text>{selectedDate}</Text>
          </View>
        </View>

        <View className='filter-section'>
          <Text className='filter-label'>类型</Text>
          <View className='category-filters'>
            {CATEGORY_FILTERS.map(cat => (
              <View
                key={cat.value}
                className={`filter-chip ${categoryFilter === cat.value ? 'active' : ''}`}
                onClick={() => setCategoryFilter(cat.value)}
              >
                <Text>{cat.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <ScrollView className='records-scroll' scrollY>
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
                      <Text className='record-reporter'>记录人 {record.reporterRole || '家长'}</Text>
                    </View>
                    <View className='record-actions'>
                      <View className='edit-btn' onClick={() => handleEdit(record)}>
                        <Text className='edit-icon'>编辑</Text>
                      </View>
                      <View className='delete-btn' onClick={() => handleDelete(record.id)}>
                        <Text className='delete-icon'>删除</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {/* 日历组件 */}
      {showCalendar && (
        <Calendar
          visible={showCalendar}
          value={dayjs(selectedDate).toDate()}
          maxDate={new Date()}
          onConfirm={handleConfirmDate}
          onCancel={handleCancelCalendar}
        />
      )}
    </View>
  )
}
