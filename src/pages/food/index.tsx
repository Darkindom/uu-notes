import { View, Text, Input, Picker, Button } from '@tarojs/components'
import Taro, { useLoad, useRouter } from '@tarojs/taro'
import { useState } from 'react'
import dayjs from 'dayjs'
import { createRecord, updateRecord, getRecentRecordsByCategory, getCurrentBaby, type Record as ApiRecord } from '../../utils/api'
import {
  getCurrentDateTime,
  dateTimeToTimestamp,
  AMOUNT_LABELS,
  AMOUNT_VALUES,
  formatRecordSummary,
  timestampToDateTime,
} from '../../utils/format'
import Calendar from '../../components/Calendar'
import './index.less'

type FoodType = 'breast_milk' | 'milk' | 'water' | 'babycook'

const FOOD_TYPES: { label: string; value: FoodType }[] = [
  { label: '母乳', value: 'breast_milk' },
  { label: '奶粉', value: 'milk' },
  { label: '水', value: 'water' },
  { label: '辅食', value: 'babycook' },
]

export default function FoodPage() {
  const router = useRouter()
  const editId = router.params.editId ? parseInt(router.params.editId) : null
  const isEdit = !!editId

  const dt = getCurrentDateTime()
  const [date, setDate] = useState(dt.date)
  const [time, setTime] = useState(dt.time)
  const [foodType, setFoodType] = useState<FoodType>('milk')
  const [milkAmount, setMilkAmount] = useState('')
  const [amountIdx, setAmountIdx] = useState<number | null>(null)
  const [foodName, setFoodName] = useState('')
  const [recentRecords, setRecentRecords] = useState<ApiRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)

  useLoad(async () => {
    try {
      // 如果是编辑模式，从缓存读取记录详情
      if (isEdit && editId) {
        const record = Taro.getStorageSync('editRecord')
        if (record && record.id === editId) {
          // 填充表单
          const dt = timestampToDateTime(record.startTime)
          setDate(dt.date)
          setTime(dt.time)
          setFoodType(record.subCategory as FoodType)
          
          if (record.subCategory === 'breast_milk' || record.subCategory === 'milk') {
            setMilkAmount(record.value || '')
          } else {
            const idx = AMOUNT_VALUES.indexOf(record.value || '')
            setAmountIdx(idx >= 0 ? idx : null)
            if (record.subCategory === 'babycook' && record.extra) {
              setFoodName(record.extra.food_type || '')
            }
          }
        }
      }

      const records = await getRecentRecordsByCategory('food', 5)
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
      console.error('加载数据失败:', error)
    }
  })

  function applyPrefill(r: ApiRecord) {
    const sub = r.subCategory as FoodType
    setFoodType(sub)
    if (sub === 'breast_milk' || sub === 'milk') {
      setMilkAmount(r.value || '')
      setAmountIdx(null)
      setFoodName('')
    } else {
      setMilkAmount('')
      const idx = AMOUNT_VALUES.indexOf(r.value || '')
      setAmountIdx(idx >= 0 ? idx : null)
      if (sub === 'babycook') {
        try {
          const extra = r.extra as any
          setFoodName(extra?.food_type ?? '')
        } catch {
          setFoodName('')
        }
      } else {
        setFoodName('')
      }
    }
  }

  const isMilk = foodType === 'breast_milk' || foodType === 'milk'

  async function handleSubmit() {
    if (loading) return // 防止重复提交
    
    let value = ''
    let extra: any = null

    if (isMilk) {
      if (!milkAmount) {
        Taro.showToast({ title: '请输入奶量', icon: 'none' })
        return
      }
      value = milkAmount
    } else if (foodType === 'babycook') {
      value = amountIdx !== null ? AMOUNT_VALUES[amountIdx] : ''
      extra = { food_type: foodName }
    } else {
      value = amountIdx !== null ? AMOUNT_VALUES[amountIdx] : ''
    }

    try {
      setLoading(true)
      const baby = await getCurrentBaby()
      if (!baby) {
        Taro.showToast({ title: '请先选择宝宝', icon: 'none' })
        return
      }

      const startTime = dateTimeToTimestamp(date, time)

      if (isEdit && editId) {
        // 更新记录
        await updateRecord(editId, {
          category: 'food',
          subCategory: foodType,
          startTime,
          value,
          extra,
        })
        Taro.showToast({ title: '更新成功！', icon: 'success' })
      } else {
        // 创建新记录
        await createRecord({
          babyId: baby.id,
          category: 'food',
          subCategory: foodType,
          startTime,
          value,
          extra,
        })
        Taro.showToast({ title: '记录成功！', icon: 'success' })
      }

      setTimeout(() => Taro.navigateBack(), 1000)
    } catch (error) {
      console.error('操作失败:', error)
      Taro.showToast({ title: isEdit ? '更新失败' : '记录失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  function handleOpenCalendar() {
    setShowCalendar(true)
  }

  function handleConfirmDate(selectedDate: Date) {
    setDate(dayjs(selectedDate).format('YYYY-MM-DD'))
    setShowCalendar(false)
  }

  function handleCancelCalendar() {
    setShowCalendar(false)
  }

  return (
    <View className='page-container food-page'>
      <View className='main-card'>

          {/* Time */}
          <View className='section section-inline'>
            <Text className='field-label'>时间</Text>
            <View className='time-row'>
              <View className='picker-display' onClick={handleOpenCalendar}>{date}</View>
              <Picker mode='time' value={time} onChange={e => setTime(e.detail.value)}>
                <View className='picker-display'>{time}</View>
              </Picker>
            </View>
          </View>

          {/* Food type */}
          <View className='section food-type-section'>
            <Text className='field-label'>类型</Text>
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
            <Text className='field-label'>{isMilk ? '奶量' : '饭量'}</Text>
            {isMilk ? (
              <View className='number-input-row'>
                <Input
                  className='amount-input'
                  type='number'
                  placeholder='输入奶量'
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
              <Text className='field-label'>食物名称</Text>
              <Input
                className='text-input'
                placeholder='米粥、南瓜泥'
                value={foodName}
                onInput={e => setFoodName(e.detail.value)}
              />
            </View>
          )}

          {/* Prefill - 移到最下面，编辑时不显示 */}
          {!isEdit && recentRecords.length > 0 && (
            <View className='section section-vertical'>
              <Text className='field-label'>最近的记录</Text>
              <View className='prefill-row'>
                {recentRecords.map(r => (
                  <View key={r.id} className='prefill-chip' onClick={() => applyPrefill(r)}>
                    <Text>{formatRecordSummary(r)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

      </View>

      <Button className='submit-btn' onClick={handleSubmit} loading={loading} disabled={loading}>
        {isEdit ? '更新' : '记录'}
      </Button>

      <Calendar
        visible={showCalendar}
        value={dayjs(date).toDate()}
        maxDate={new Date()}
        onConfirm={handleConfirmDate}
        onCancel={handleCancelCalendar}
      />
    </View>
  )
}
