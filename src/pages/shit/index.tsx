import { View, Text, Picker, Button } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useState } from 'react'
import { addRecord } from '../../utils/db'
import {
  getCurrentDateTime,
  dateTimeToTimestamp,
  AMOUNT_LABELS,
  AMOUNT_VALUES,
  SHIT_COLORS,
  SHIT_HARDNESS,
} from '../../utils/format'
import './index.less'

export default function ShitPage() {
  const dt = getCurrentDateTime()
  const [date, setDate] = useState(dt.date)
  const [time, setTime] = useState(dt.time)
  const [shitType, setShitType] = useState<'big' | 'small'>('big')
  const [amountIdx, setAmountIdx] = useState<number | null>(null)
  const [color, setColor] = useState<string | null>(null)
  const [hardness, setHardness] = useState<string | null>(null)

  useLoad(() => {})

  function handleSubmit() {
    const extra: Record<string, string> = {}
    if (shitType === 'big') {
      if (color) extra.color = color
      if (hardness) extra.hardness = hardness
    }

    addRecord({
      timestamp: dateTimeToTimestamp(date, time),
      category: 'shit',
      subcategory: shitType,
      value: amountIdx !== null ? AMOUNT_VALUES[amountIdx] : '',
      extra: JSON.stringify(extra),
    })

    Taro.showToast({ title: '记录成功！', icon: 'success' })
    setTimeout(() => Taro.navigateBack(), 1000)
  }

  return (
    <View className='page-container shit-page'>
      <View className='main-card'>
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

        {/* Type + Amount side by side */}
        <View className='section two-col-section'>
          <View className='col'>
            <Text className='field-label'>类型</Text>
            <View className='col-chips'>
              <View
                className={`option-chip ${shitType === 'big' ? 'active' : ''}`}
                onClick={() => { setShitType('big'); setAmountIdx(null); setColor(null); setHardness(null) }}
              >
                <Text>💩 大便</Text>
              </View>
              <View
                className={`option-chip ${shitType === 'small' ? 'active' : ''}`}
                onClick={() => { setShitType('small'); setAmountIdx(null); setColor(null); setHardness(null) }}
              >
                <Text>💧 小便</Text>
              </View>
            </View>
          </View>

          <View className='divider-v' />

          <View className='col'>
            <Text className='field-label'>量</Text>
            <View className='col-chips'>
              {AMOUNT_LABELS.map((label, idx) => (
                <View
                  key={label}
                  className={`option-chip ${amountIdx === idx ? 'active' : ''}`}
                  onClick={() => setAmountIdx(amountIdx === idx ? null : idx)}
                >
                  <Text>{label}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Color — only for big */}
        {shitType === 'big' && (
          <View className='section'>
            <Text className='field-label'>🎨 颜色</Text>
            <View className='options-row'>
              {SHIT_COLORS.map((c) => (
                <View
                  key={c.value}
                  className={`option-chip color-chip color-${c.value} ${
                    color === c.value ? 'active' : ''
                  }`}
                  onClick={() => setColor(color === c.value ? null : c.value)}
                >
                  <Text>{c.label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Hardness — only for big */}
        {shitType === 'big' && (
          <View className='section'>
            <Text className='field-label'>🧪 软硬</Text>
            <View className='options-row'>
              {SHIT_HARDNESS.map((h) => (
                <View
                  key={h.value}
                  className={`option-chip ${hardness === h.value ? 'active' : ''}`}
                  onClick={() => setHardness(hardness === h.value ? null : h.value)}
                >
                  <Text>{h.label}</Text>
                </View>
              ))}
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
