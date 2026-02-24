import { View, Text, Input, Picker, Button } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useState } from 'react'
import { addRecord } from '../../utils/db'
import { getCurrentDateTime, dateTimeToTimestamp } from '../../utils/format'
import './index.less'

export default function SleepPage() {
  const dt = getCurrentDateTime()
  const [date, setDate] = useState(dt.date)
  const [time, setTime] = useState(dt.time)
  const [hours, setHours] = useState('')
  const [minutes, setMinutes] = useState('')

  useLoad(() => {})

  function handleSubmit() {
    const h = parseInt(hours) || 0
    const m = parseInt(minutes) || 0
    const totalMinutes = h * 60 + m

    if (totalMinutes <= 0) {
      Taro.showToast({ title: '请输入睡眠时长', icon: 'none' })
      return
    }

    addRecord({
      timestamp: dateTimeToTimestamp(date, time),
      category: 'sleep',
      subcategory: 'sleep',
      value: String(totalMinutes),
      extra: '',
    })

    Taro.showToast({ title: '记录成功！', icon: 'success' })
    setTimeout(() => Taro.navigateBack(), 1000)
  }

  function quickSet(min: number) {
    setHours(String(Math.floor(min / 60)))
    setMinutes(String(min % 60))
  }

  return (
    <View className='page-container sleep-page'>
      <View className='main-card'>

        {/* Time */}
        <View className='section'>
          <Text className='field-label'>🕐 入睡时间</Text>
          <View className='time-row'>
            <Picker mode='date' value={date} onChange={e => setDate(e.detail.value)}>
              <View className='picker-display'>{date}</View>
            </Picker>
            <Picker mode='time' value={time} onChange={e => setTime(e.detail.value)}>
              <View className='picker-display'>{time}</View>
            </Picker>
          </View>
        </View>

        {/* Duration */}
        <View className='section'>
          <Text className='field-label'>⏱️ 睡眠时长</Text>
          <View className='duration-row'>
            <View className='duration-group'>
              <Input
                className='duration-input'
                type='number'
                placeholder='0'
                value={hours}
                onInput={e => setHours(e.detail.value)}
              />
              <Text className='unit-text'>小时</Text>
            </View>
            <View className='duration-group'>
              <Input
                className='duration-input'
                type='number'
                placeholder='0'
                value={minutes}
                onInput={e => setMinutes(e.detail.value)}
              />
              <Text className='unit-text'>分钟</Text>
            </View>
          </View>
        </View>

        {/* Quick select */}
        <View className='section'>
          <Text className='field-label'>⚡ 快速选择</Text>
          <View className='options-row'>
            {[30, 60, 90, 120].map(min => (
              <View
                key={min}
                className='option-chip quick-chip'
                onClick={() => quickSet(min)}
              >
                <Text>{min < 60 ? `${min}分` : `${min / 60}小时`}</Text>
              </View>
            ))}
          </View>
        </View>

      </View>

      <Button className='submit-btn' onClick={handleSubmit}>
        ✓ 记录
      </Button>
    </View>
  )
}
