import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import dayjs from 'dayjs'
import { getRecords, deleteRecord, getCurrentBaby, type Record as ApiRecord } from '../../utils/api'
import { formatTimestamp, formatRecordSummary, CATEGORY_LABELS } from '../../utils/format'
import { clearCachedRecords } from '../../utils/cache'
import Calendar from '../../components/Calendar'
import LoadingSpinner from '../../components/LoadingSpinner'
import './index.less'

interface TodayStats {
  milk: number // 奶量（ml）
  food: number // 辅食次数
  sleep: number // 睡眠次数
  sleepMinutes: number // 睡眠总分钟数
  shit: number // 大便次数
  outdoor: number // 户外次数
  tonic: number // 补剂次数
  cry: number // 哭闹次数
  gearHours: number // 护具佩戴小时数
}

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

function groupByDate(records: ApiRecord[]) {
  const groups: { date: string; records: ApiRecord[] }[] = []
  const map: Record<string, ApiRecord[]> = {}

  records.forEach((r) => {
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
  const [refreshing, setRefreshing] = useState(false) // 后台刷新状态
  const [categoryFilter, setCategoryFilter] = useState('')
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate(),
    ).padStart(2, '0')}`
  })
  const [showCalendar, setShowCalendar] = useState(false)
  const [todayStats, setTodayStats] = useState<TodayStats | null>(null)

  // 初始加载
  useDidShow(async () => {
    await loadRecords()
  })

  // 当 selectedDate 改变时，重新加载记录
  useEffect(() => {
    loadRecords()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate])

  // 计算统计数据
  async function calculateStats(records: ApiRecord[], babyId: number): Promise<TodayStats> {
    const stats: TodayStats = {
      milk: 0,
      food: 0,
      sleep: 0,
      sleepMinutes: 0,
      shit: 0,
      outdoor: 0,
      tonic: 0,
      cry: 0,
      gearHours: 0,
    }

    const startOfDay = new Date(selectedDate)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(selectedDate)
    endOfDay.setHours(23, 59, 59, 999)

    const gearEvents: { type: 'on' | 'off'; time: number }[] = []

    records.forEach((record) => {
      switch (record.category) {
        case 'food':
          if (record.subCategory === 'breast_milk' || record.subCategory === 'milk') {
            stats.milk += parseInt(record.value || '0') || 0
          } else if (record.subCategory === 'babycook') {
            stats.food++
          }
          break
        case 'sleep':
          stats.sleep++
          stats.sleepMinutes += parseInt(record.value || '0') || 0
          break
        case 'shit':
          stats.shit++
          break
        case 'other':
          if (record.subCategory === 'outdoor') {
            stats.outdoor++
          } else if (record.subCategory === 'tonic') {
            stats.tonic++
          } else if (record.subCategory === 'cry') {
            stats.cry++
          } else if (record.subCategory === 'gear') {
            const gearType = record.extra?.gear_type
            if (gearType === '带上') {
              gearEvents.push({ type: 'on', time: record.startTime })
            } else if (gearType === '脱下') {
              gearEvents.push({ type: 'off', time: record.startTime })
            }
          }
          break
      }
    })

    // 计算护具佩戴时长
    if (gearEvents.length > 0) {
      // 获取前一天最后的护具记录
      const yesterdayStart = new Date(startOfDay)
      yesterdayStart.setDate(yesterdayStart.getDate() - 1)
      const yesterdayEnd = new Date(startOfDay)
      yesterdayEnd.setMilliseconds(-1)

      const yesterdayResponse = await getRecords({
        babyId,
        limit: 1000,
        offset: 0,
        startDate: yesterdayStart.getTime(),
        endDate: yesterdayEnd.getTime(),
      })

      const yesterdayGearEvents = yesterdayResponse.records
        .filter((r) => r.category === 'other' && r.subCategory === 'gear')
        .map((r) => ({
          type: r.extra?.gear_type === '带上' ? ('on' as const) : ('off' as const),
          time: r.startTime,
        }))
        .sort((a, b) => a.time - b.time)

      let yesterdayLastGearOn = false
      if (yesterdayGearEvents.length > 0) {
        const lastEvent = yesterdayGearEvents[yesterdayGearEvents.length - 1]
        yesterdayLastGearOn = lastEvent.type === 'on'
      }

      gearEvents.sort((a, b) => a.time - b.time)

      const filteredGearEvents: { type: 'on' | 'off'; time: number }[] = []
      let lastType: 'on' | 'off' | null = yesterdayLastGearOn ? 'on' : null

      for (const event of gearEvents) {
        if (event.type !== lastType) {
          filteredGearEvents.push(event)
          lastType = event.type
        }
      }

      let totalGearMinutes = 0
      let lastOnTime: number | null = null

      if (yesterdayLastGearOn && filteredGearEvents.length > 0) {
        if (filteredGearEvents[0].type === 'off') {
          totalGearMinutes += (filteredGearEvents[0].time - startOfDay.getTime()) / (1000 * 60)
        } else {
          lastOnTime = filteredGearEvents[0].time
        }
        for (let i = 1; i < filteredGearEvents.length; i++) {
          const event = filteredGearEvents[i]
          if (event.type === 'on') {
            lastOnTime = event.time
          } else if (event.type === 'off' && lastOnTime !== null) {
            totalGearMinutes += (event.time - lastOnTime) / (1000 * 60)
            lastOnTime = null
          }
        }
      } else {
        filteredGearEvents.forEach((event) => {
          if (event.type === 'on') {
            lastOnTime = event.time
          } else if (event.type === 'off' && lastOnTime !== null) {
            totalGearMinutes += (event.time - lastOnTime) / (1000 * 60)
            lastOnTime = null
          }
        })
      }

      if (lastOnTime !== null) {
        const isToday = dayjs(selectedDate).format('YYYY-MM-DD') === dayjs().format('YYYY-MM-DD')
        const endTime = isToday ? Date.now() : endOfDay.getTime()
        totalGearMinutes += (endTime - lastOnTime) / (1000 * 60)
      } else if (yesterdayLastGearOn && filteredGearEvents.length === 0) {
        const isToday = dayjs(selectedDate).format('YYYY-MM-DD') === dayjs().format('YYYY-MM-DD')
        const endTime = isToday ? Date.now() : endOfDay.getTime()
        totalGearMinutes += (endTime - startOfDay.getTime()) / (1000 * 60)
      }

      stats.gearHours = Math.round((totalGearMinutes / 60) * 10) / 10
    }

    return stats
  }

  async function loadRecords() {
    const isInitialLoad = allRecords.length === 0
    if (isInitialLoad) {
      setLoading(true)
    } else {
      setRefreshing(true)
    }

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

      // 请求数据（会自动使用缓存）
      const response = await getRecords({
        babyId: baby.id,
        limit: 1000,
        offset: 0,
        startDate: startOfDay.getTime(),
        endDate: endOfDay.getTime(),
      })

      setAllRecords(response.records)

      // 计算统计数据
      const stats = await calculateStats(response.records, baby.id)
      setTodayStats(stats)
    } catch (error) {
      console.error('加载记录失败:', error)
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // 强制刷新（清除缓存后重新加载）
  async function handleForceRefresh() {
    setRefreshing(true)
    try {
      const baby = await getCurrentBaby()
      if (!baby) {
        return
      }

      // 计算日期范围
      const startOfDay = new Date(selectedDate)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(selectedDate)
      endOfDay.setHours(23, 59, 59, 999)

      // 清除缓存
      clearCachedRecords(baby.id, selectedDate)

      // 请求数据
      const response = await getRecords({
        babyId: baby.id,
        limit: 1000,
        offset: 0,
        startDate: startOfDay.getTime(),
        endDate: endOfDay.getTime(),
      })

      setAllRecords(response.records)

      // 计算统计数据
      const stats = await calculateStats(response.records, baby.id)
      setTodayStats(stats)
    } catch (error) {
      console.error('刷新失败:', error)
    } finally {
      setRefreshing(false)
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
        const newRecords = allRecords.filter((r) => r.id !== id)
        setAllRecords(newRecords)
        // 缓存会在 deleteRecord 中自动清除
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
    ? allRecords.filter((r) => r.category === categoryFilter)
    : allRecords

  const groups = groupByDate(filteredRecords)

  // 判断当前选择的日期是否是今天
  const isToday = selectedDate === dayjs().format('YYYY-MM-DD')

  // 回到今天
  const handleBackToToday = () => {
    setSelectedDate(dayjs().format('YYYY-MM-DD'))
  }

  return (
    <View className='records-page'>
      {/* 筛选栏 */}
      <View className='filter-bar'>
        <View className='filter-section filter-section-row'>
          <Text className='filter-label'>日期</Text>
          <View className='date-picker-btn' onClick={handleOpenCalendar}>
            <Text>{selectedDate}</Text>
          </View>
          {!isToday && (
            <View className='back-to-today-btn' onClick={handleBackToToday}>
              <Text>回到今天</Text>
            </View>
          )}
        </View>

        <View className='filter-section'>
          <View className='filter-row-with-category'>
            <Text className='filter-label'>类别</Text>
            <View className='category-filters'>
              {CATEGORY_FILTERS.map((cat) => (
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

          <View className='stats-row'>
            <View className='stats-header'>
              <View className='stats-title-wrapper'>
                <Text className='stats-prefix'>统计：</Text>
                <Text className='total-count'>{filteredRecords.length} 条</Text>
              </View>
              <View className='stats-right'>
                {refreshing ? (
                  <LoadingSpinner size='small' color='#999' />
                ) : (
                  <View className='refresh-btn' onClick={handleForceRefresh}>
                    <Text className='refresh-text'>刷新</Text>
                  </View>
                )}
              </View>
            </View>
            <View className='stats-summary'>
              {todayStats ? (
                <>
                  {/* 全部类别 - 显示简洁统计 */}
                  {categoryFilter === '' && (
                    <View className='stat-line'>
                      <Text className='stat-value-text'>
                        吃{allRecords.filter((r) => r.category === 'food').length}次，睡
                        {allRecords.filter((r) => r.category === 'sleep').length}次，拉
                        {allRecords.filter((r) => r.category === 'shit').length}次，其他
                        {allRecords.filter((r) => r.category === 'other').length}项
                      </Text>
                    </View>
                  )}

                  {/* 吃类别 */}
                  {categoryFilter === 'food' && (todayStats.milk > 0 || todayStats.food > 0) && (
                    <View className='stat-line'>
                      <Text className='stat-value-text'>
                        {todayStats.milk > 0 && `${todayStats.milk} ml 奶`}
                        {todayStats.milk > 0 && todayStats.food > 0 && '，'}
                        {todayStats.food > 0 && `${todayStats.food} 顿辅食`}
                      </Text>
                    </View>
                  )}

                  {/* 睡类别 */}
                  {categoryFilter === 'sleep' && todayStats.sleep > 0 && (
                    <View className='stat-line'>
                      <Text className='stat-value-text'>
                        {todayStats.sleep} 次，共 {Math.floor(todayStats.sleepMinutes / 60)} 时{' '}
                        {todayStats.sleepMinutes % 60} 分
                      </Text>
                    </View>
                  )}

                  {/* 拉类别 */}
                  {categoryFilter === 'shit' && todayStats.shit > 0 && (
                    <View className='stat-line'>
                      <Text className='stat-value-text'>{todayStats.shit} 次</Text>
                    </View>
                  )}

                  {/* 其他类别 */}
                  {categoryFilter === 'other' &&
                    (todayStats.outdoor > 0 ||
                      todayStats.tonic > 0 ||
                      todayStats.cry > 0 ||
                      todayStats.gearHours > 0) && (
                      <View className='stat-line'>
                        <Text className='stat-value-text'>
                          {todayStats.outdoor > 0 && `户外 ${todayStats.outdoor} 次`}
                          {todayStats.outdoor > 0 &&
                            (todayStats.tonic > 0 ||
                              todayStats.cry > 0 ||
                              todayStats.gearHours > 0) &&
                            '，'}
                          {todayStats.tonic > 0 && `补剂 ${todayStats.tonic} 次`}
                          {todayStats.tonic > 0 &&
                            (todayStats.cry > 0 || todayStats.gearHours > 0) &&
                            '，'}
                          {todayStats.cry > 0 && `哭闹 ${todayStats.cry} 次`}
                          {todayStats.cry > 0 && todayStats.gearHours > 0 && '，'}
                          {todayStats.gearHours > 0 && `护具 ${todayStats.gearHours} 小时`}
                        </Text>
                      </View>
                    )}

                  {/* 单个类别无数据提示 */}
                  {categoryFilter !== '' &&
                    ((categoryFilter === 'food' &&
                      todayStats.milk === 0 &&
                      todayStats.food === 0) ||
                      (categoryFilter === 'sleep' && todayStats.sleep === 0) ||
                      (categoryFilter === 'shit' && todayStats.shit === 0) ||
                      (categoryFilter === 'other' &&
                        todayStats.outdoor === 0 &&
                        todayStats.tonic === 0 &&
                        todayStats.cry === 0 &&
                        todayStats.gearHours === 0)) && (
                      <Text className='stat-empty-inline'>暂无数据</Text>
                    )}
                </>
              ) : (
                <Text className='stat-empty-inline'>计算中...</Text>
              )}
            </View>
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
            <Text className='empty-text'>{isToday ? '今天' : '这天'}还没有记录</Text>
            <Text className='empty-sub'>快去首页记录宝宝的日常吧~</Text>
          </View>
        ) : (
          <>
            {groups.map((group) => (
              <View key={group.date} className='date-group'>
                {group.records.map((record) => (
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
                    <View className='record-content'>
                      <View className='record-main-row'>
                        <Text className='record-summary'>{formatRecordSummary(record)}</Text>
                        <View className='record-actions'>
                          <View className='edit-btn' onClick={() => handleEdit(record)}>
                            <Text className='edit-icon'>编辑</Text>
                          </View>
                          <View className='delete-btn' onClick={() => handleDelete(record.id)}>
                            <Text className='delete-icon'>删除</Text>
                          </View>
                        </View>
                      </View>
                      <View className='record-sub-row'>
                        <Text className='record-time'>{formatTimestamp(record.startTime)}</Text>
                        <Text className='record-reporter'>
                          记录人 {record.reporterRole || '家长'}
                        </Text>
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
