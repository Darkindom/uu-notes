import { View, Text, Input, Picker, Button } from '@tarojs/components'
import Taro, { useLoad, useRouter } from '@tarojs/taro'
import { useState } from 'react'
import dayjs from 'dayjs'
import { createRecord, updateRecord, getRecentRecordsByCategory, getCurrentBaby, type Record as ApiRecord } from '../../utils/api'
import { getCurrentDateTime, dateTimeToTimestamp, TONIC_TYPES, formatRecordSummary, timestampToDateTime } from '../../utils/format'
import Calendar from '../../components/Calendar'
import './index.less'

type SubType = 'tonic' | 'outdoor' | 'cry' | 'gear'

const SUB_MENUS: { label: string; value: SubType }[] = [
  { label: '户外', value: 'outdoor' },
  { label: '补剂', value: 'tonic' },
  { label: '哭闹', value: 'cry' },
  { label: '护具', value: 'gear' },
]

const GEAR_TYPES = ['带上', '脱下']

export default function OtherPage() {
  const router = useRouter()
  const editId = router.params.editId ? parseInt(router.params.editId) : null
  const isEdit = !!editId

  const dt = getCurrentDateTime()
  const [date, setDate] = useState(dt.date)
  const [time, setTime] = useState(dt.time)
  const [subType, setSubType] = useState<SubType>('outdoor')
  const [tonicType, setTonicType] = useState(TONIC_TYPES[0])
  const [gearType, setGearType] = useState(GEAR_TYPES[0])
  const [duration, setDuration] = useState('')
  const [recentRecords, setRecentRecords] = useState<ApiRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)

  useLoad(async () => {
    try {
      // 如果是编辑模式，从缓存读取记录详情
      if (isEdit && editId) {
        const record = Taro.getStorageSync('editRecord')
        if (record && record.id === editId) {
          const dt = timestampToDateTime(record.startTime)
          setDate(dt.date)
          setTime(dt.time)
          setSubType(record.subCategory as SubType)
          
          if (record.subCategory === 'tonic' && record.extra) {
            setTonicType(record.extra.tonic_type || TONIC_TYPES[0])
          } else if (record.subCategory === 'gear' && record.extra) {
            setGearType(record.extra.gear_type || GEAR_TYPES[0])
          } else {
            setDuration(record.value || '')
          }
        }
      }

      const records = await getRecentRecordsByCategory('other', 5)
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
    const sub = r.subCategory as SubType
    setSubType(sub)
    if (sub === 'tonic') {
      try {
        const extra = r.extra as any
        setTonicType(extra?.tonic_type ?? TONIC_TYPES[0])
      } catch {
        setTonicType(TONIC_TYPES[0])
      }
      setDuration('')
      setGearType(GEAR_TYPES[0])
    } else if (sub === 'gear') {
      try {
        const extra = r.extra as any
        setGearType(extra?.gear_type ?? GEAR_TYPES[0])
      } catch {
        setGearType(GEAR_TYPES[0])
      }
      setDuration('')
      setTonicType(TONIC_TYPES[0])
    } else {
      setDuration(r.value || '')
      setTonicType(TONIC_TYPES[0])
      setGearType(GEAR_TYPES[0])
    }
  }

  async function handleSubmit() {
    if (loading) return // 防止重复提交
    
    let value = ''
    let extra: any = null

    if (subType === 'tonic') {
      value = '1'
      extra = { tonic_type: tonicType }
    } else if (subType === 'gear') {
      value = '1'
      extra = { gear_type: gearType }
    } else {
      if (!duration) {
        Taro.showToast({ title: '请输入时长', icon: 'none' })
        return
      }
      value = duration
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
          category: 'other',
          subCategory: subType,
          startTime,
          value,
          extra,
        })
        Taro.showToast({ title: '更新成功！', icon: 'success' })
      } else {
        // 创建新记录
        await createRecord({
          babyId: baby.id,
          category: 'other',
          subCategory: subType,
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
                <Text className='sub-label'>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Time */}
        <View className='section section-inline'>
          <Text className='field-label'>时间</Text>
          <View className='time-row'>
            <View className='picker-display' onClick={handleOpenCalendar}>{date}</View>
            <Picker mode='time' value={time} onChange={(e) => setTime(e.detail.value)}>
              <View className='picker-display'>{time}</View>
            </Picker>
          </View>
        </View>

        {/* Tonic */}
        {subType === 'tonic' && (
          <View className='section'>
            <Text className='field-label'>补剂种类</Text>
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

        {/* Gear */}
        {subType === 'gear' && (
          <View className='section'>
            <Text className='field-label'>类型</Text>
            <View className='options-row'>
              {GEAR_TYPES.map((t) => (
                <View
                  key={t}
                  className={`option-chip ${gearType === t ? 'active' : ''}`}
                  onClick={() => setGearType(t)}
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
            <Text className='field-label'>{subType === 'outdoor' ? '时长' : '时长'}</Text>
            <View className='number-input-row'>
              <Input
                className='duration-input'
                type='number'
                placeholder='分钟数'
                value={duration}
                onInput={(e) => setDuration(e.detail.value)}
              />
              <Text className='unit-text'>分钟</Text>
            </View>
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
