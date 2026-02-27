import { View, Text, Input, Picker, Button } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useState } from 'react'
// 已迁移到自建后端 API
import { createRecord, getRecentRecordsByCategory, getCurrentBaby, type Record as ApiRecord } from '../../utils/api'
// import { addRecord, getRecentByCategory, type Record as DbRecord } from '../../utils/db' // 云开发已废弃
import { getCurrentDateTime, dateTimeToTimestamp, formatRecordSummary } from '../../utils/format'
import './index.less'

export default function SleepPage() {
  const dt = getCurrentDateTime()
  const [date, setDate] = useState(dt.date)
  const [time, setTime] = useState(dt.time)
  const [hours, setHours] = useState('')
  const [minutes, setMinutes] = useState('')
  const [recentRecords, setRecentRecords] = useState<ApiRecord[]>([])

  useLoad(async () => {
    try {
      const records = await getRecentRecordsByCategory('sleep', 5)
      // 去重：使用 formatRecordSummary 生成的摘要作为唯一标识
      const uniqueRecords: ApiRecord[] = []
      const seen = new Set<string>()
      
      for (const record of records) {
        const summary = formatRecordSummary(record)
        if (!seen.has(summary)) {
          seen.add(summary)
          uniqueRecords.push(record)
        }
      }
      
      setRecentRecords(uniqueRecords)
    } catch (error) {
      console.error('加载历史记录失败:', error)
    }
  })

  function applyPrefill(r: ApiRecord) {
    const totalMin = parseInt(r.value || '0') || 0
    setHours(String(Math.floor(totalMin / 60)))
    setMinutes(String(totalMin % 60))
  }

  async function handleSubmit() {
    const h = parseInt(hours) || 0
    const m = parseInt(minutes) || 0
    const totalMinutes = h * 60 + m

    if (totalMinutes <= 0) {
      Taro.showToast({ title: '请输入睡眠时长', icon: 'none' })
      return
    }

    try {
      const baby = await getCurrentBaby()
      if (!baby) {
        Taro.showToast({ title: '请先选择宝宝', icon: 'none' })
        return
      }

      const startTime = dateTimeToTimestamp(date, time)
      await createRecord({
        babyId: baby.id,
        category: 'sleep',
        subCategory: 'sleep',
        startTime,
        value: String(totalMinutes),
      })

      Taro.showToast({ title: '记录成功！', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 1000)
    } catch (error) {
      console.error('记录失败:', error)
      Taro.showToast({ title: '记录失败', icon: 'none' })
    }
  }

  function quickSet(min: number) {
    setHours(String(Math.floor(min / 60)))
    setMinutes(String(min % 60))
  }

  return (
    <View className='page-container sleep-page'>
      <View className='main-card'>
        {/* Time */}
        <View className='section section-inline'>
          <Text className='field-label'>时间</Text>
          <View className='time-row'>
            <Picker mode='date' value={date} onChange={(e) => setDate(e.detail.value)}>
              <View className='picker-display'>{date}</View>
            </Picker>
            <Picker mode='time' value={time} onChange={(e) => setTime(e.detail.value)}>
              <View className='picker-display'>{time}</View>
            </Picker>
          </View>
        </View>

        {/* Duration */}
        <View className='section'>
          <Text className='field-label'>睡眠时长</Text>
          <View className='duration-row'>
            <View className='duration-group'>
              <Input
                className='duration-input'
                type='number'
                placeholder='0'
                value={hours}
                onInput={(e) => setHours(e.detail.value)}
              />
              <Text className='unit-text'>小时</Text>
            </View>
            <View className='duration-group'>
              <Input
                className='duration-input'
                type='number'
                placeholder='0'
                value={minutes}
                onInput={(e) => setMinutes(e.detail.value)}
              />
              <Text className='unit-text'>分钟</Text>
            </View>
          </View>
        </View>

        {/* Quick select */}
        <View className='section'>
          <Text className='field-label'>快速选择</Text>
          <View className='options-row'>
            {[30, 60, 90, 120].map((min) => (
              <View key={min} className='option-chip quick-chip' onClick={() => quickSet(min)}>
                <Text>{min < 60 ? `${min}分` : `${min / 60}小时`}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Prefill - 移到最下面 */}
        {recentRecords.length > 0 && (
          <View className='section section-vertical'>
            <Text className='field-label'>历史预填</Text>
            <View className='prefill-row'>
              {recentRecords.map((r) => (
                <View key={r.id} className='prefill-chip' onClick={() => applyPrefill(r)}>
                  <Text>{formatRecordSummary(r)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      <Button className='submit-btn' onClick={handleSubmit}>
        记录
      </Button>
    </View>
  )
}
