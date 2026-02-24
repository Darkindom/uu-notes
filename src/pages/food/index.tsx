import { View, Text, Input, Picker, Button } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useState } from 'react'
import { addRecord } from '../../utils/db'
import {
  getCurrentDateTime,
  dateTimeToTimestamp,
  AMOUNT_LABELS,
  AMOUNT_VALUES,
} from '../../utils/format'
import './index.less'

type FoodType = 'breast_milk' | 'milk' | 'water' | 'babycook'

const FOOD_TYPES: { label: string; value: FoodType }[] = [
  { label: '母乳', value: 'breast_milk' },
  { label: '奶粉', value: 'milk' },
  { label: '水', value: 'water' },
  { label: '辅食', value: 'babycook' },
]

export default function FoodPage() {
  const dt = getCurrentDateTime()
  const [date, setDate] = useState(dt.date)
  const [time, setTime] = useState(dt.time)
  const [foodType, setFoodType] = useState<FoodType>('milk')
  const [milkAmount, setMilkAmount] = useState('')
  const [amountIdx, setAmountIdx] = useState<number | null>(null)
  const [foodName, setFoodName] = useState('')

  useLoad(() => {})

  const isMilk = foodType === 'breast_milk' || foodType === 'milk'

  function handleSubmit() {
    let value = ''
    let extra = ''

    if (isMilk) {
      if (!milkAmount) {
        Taro.showToast({ title: '请输入奶量', icon: 'none' })
        return
      }
      value = milkAmount
    } else if (foodType === 'babycook') {
      value = amountIdx !== null ? AMOUNT_VALUES[amountIdx] : ''
      extra = JSON.stringify({ food_type: foodName })
    } else {
      value = amountIdx !== null ? AMOUNT_VALUES[amountIdx] : ''
    }

    addRecord({
      timestamp: dateTimeToTimestamp(date, time),
      category: 'food',
      subcategory: foodType,
      value,
      extra,
    })

    Taro.showToast({ title: '记录成功！', icon: 'success' })
    setTimeout(() => Taro.navigateBack(), 1000)
  }

  return (
    <View className='page-container food-page'>
      <View className='main-card'>

        {/* Time */}
        <View className='section'>
          <Text className='field-label'>🕐 时间</Text>
          <View className='time-row'>
            <Picker mode='date' value={date} onChange={e => setDate(e.detail.value)}>
              <View className='picker-display'>{date}</View>
            </Picker>
            <Picker mode='time' value={time} onChange={e => setTime(e.detail.value)}>
              <View className='picker-display'>{time}</View>
            </Picker>
          </View>
        </View>

        {/* Food type */}
        <View className='section'>
          <Text className='field-label'>🍼 类型</Text>
          <View className='options-row'>
            {FOOD_TYPES.map(ft => (
              <View
                key={ft.value}
                className={`option-chip ${foodType === ft.value ? 'active' : ''}`}
                onClick={() => { setFoodType(ft.value); setAmountIdx(null) }}
              >
                <Text>{ft.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Amount */}
        <View className='section'>
          <Text className='field-label'>{isMilk ? '💧 奶量' : '🥣 饭量'}</Text>
          {isMilk ? (
            <View className='number-input-row'>
              <Input
                className='amount-input'
                type='number'
                placeholder='请输入奶量'
                value={milkAmount}
                onInput={e => setMilkAmount(e.detail.value)}
              />
              <Text className='unit-text'>毫升</Text>
            </View>
          ) : (
            <View className='options-row'>
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
          )}
        </View>

        {/* Food name — only for babycook */}
        {foodType === 'babycook' && (
          <View className='section'>
            <Text className='field-label'>🥕 食物名称（选填）</Text>
            <Input
              className='text-input'
              placeholder='如：米粥、南瓜泥...'
              value={foodName}
              onInput={e => setFoodName(e.detail.value)}
            />
          </View>
        )}

      </View>

      <Button className='submit-btn' onClick={handleSubmit}>
        ✓ 记录
      </Button>
    </View>
  )
}
