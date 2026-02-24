import { View, Text, Input, Picker, Button } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useState } from 'react'
import { addRecord, getRecentByCategory, type Record as DbRecord } from '../../utils/db'
import { getCurrentDateTime, dateTimeToTimestamp, TONIC_TYPES, formatRecordSummary } from '../../utils/format'
import './index.less'

type SubType = 'tonic' | 'outdoor' | 'cry'

const SUB_MENUS: { label: string; value: SubType; emoji: string }[] = [
  { label: '户外', value: 'outdoor', emoji: '🌳' },
  { label: '补剂', value: 'tonic', emoji: '💊' },
  { label: '哭闹', value: 'cry', emoji: '😭' },
]

export default function OtherPage() {
  const dt = getCurrentDateTime()
  const [date, setDate] = useState(dt.date)
  const [time, setTime] = useState(dt.time)
  const [subType, setSubType] = useState<SubType>('outdoor')
  const [tonicType, setTonicType] = useState(TONIC_TYPES[0])
  const [duration, setDuration] = useState('')
  const [recentRecords, setRecentRecords] = useState<DbRecord[]>([])

  useLoad(() => {
    setRecentRecords(getRecentByCategory('other'))
  })

  function applyPrefill(r: DbRecord) {
    const sub = r.subcategory as SubType
    setSubType(sub)
    if (sub === 'tonic') {
      try {
        const extra = JSON.parse(r.extra || '{}')
        setTonicType(extra.tonic_type ?? TONIC_TYPES[0])
      } catch {
        setTonicType(TONIC_TYPES[0])
      }
      setDuration('')
    } else {
      setDuration(r.value)
      setTonicType(TONIC_TYPES[0])
    }
  }

  function handleSubmit() {
    let value = ''
    let extra = ''

    if (subType === 'tonic') {
      value = '1'
      extra = JSON.stringify({ tonic_type: tonicType })
    } else {
      if (!duration) {
        Taro.showToast({ title: '请输入时长', icon: 'none' })
        return
      }
      value = duration
    }

    addRecord({
      timestamp: dateTimeToTimestamp(date, time),
      category: 'other',
      subcategory: subType,
      value,
      extra,
    })

    Taro.showToast({ title: '记录成功！', icon: 'success' })
    setTimeout(() => Taro.navigateBack(), 1000)
  }

  return (
    <View className='page-container other-page'>
      <View className='main-card'>
        {/* Sub-menu */}
        <View className='section'>
          <Text className='field-label'>选择类型</Text>
          <View className='sub-menu-row'>
            {SUB_MENUS.map((item) => (
              <View
                key={item.value}
                className={`sub-btn ${subType === item.value ? 'active' : ''}`}
                onClick={() => setSubType(item.value)}
              >
                <Text className='sub-emoji'>{item.emoji}</Text>
                <Text className='sub-label'>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Time */}
        <View className='section'>
          <Text className='field-label'>🕐 时间</Text>
          <View className='time-row'>
            <Picker mode='date' value={date} onChange={(e) => setDate(e.detail.value)}>
              <View className='picker-display'>{date}</View>
            </Picker>
            <Picker mode='time' value={time} onChange={(e) => setTime(e.detail.value)}>
              <View className='picker-display'>{time}</View>
            </Picker>
          </View>
        </View>

        {/* Prefill */}
        {recentRecords.length > 0 && (
          <View className='section section-vertical'>
            <Text className='field-label'>📋 历史预填</Text>
            <View className='prefill-row'>
              {recentRecords.map(r => (
                <View key={r.id} className='prefill-chip' onClick={() => applyPrefill(r)}>
                  <Text>{formatRecordSummary(r)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Tonic */}
        {subType === 'tonic' && (
          <View className='section'>
            <Text className='field-label'>💊 补剂种类</Text>
            <View className='options-row'>
              {TONIC_TYPES.map((t) => (
                <View
                  key={t}
                  className={`option-chip ${tonicType === t ? 'active' : ''}`}
                  onClick={() => setTonicType(t)}
                >
                  <Text>{t}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Duration */}
        {(subType === 'outdoor' || subType === 'cry') && (
          <View className='section'>
            <Text className='field-label'>{subType === 'outdoor' ? '🌿 时长' : '😭 时长'}</Text>
            <View className='number-input-row'>
              <Input
                className='duration-input'
                type='number'
                placeholder='请输入分钟数'
                value={duration}
                onInput={(e) => setDuration(e.detail.value)}
              />
              <Text className='unit-text'>分钟</Text>
            </View>
          </View>
        )}
      </View>

      <Button className='submit-btn' onClick={handleSubmit}>
        ✓ 记录
      </Button>
    </View>
  )
}
