import { View, Text, Input, Picker, Button } from '@tarojs/components'
import Taro, { useLoad, useRouter } from '@tarojs/taro'
import { useState } from 'react'
import dayjs from 'dayjs'
import {
  createRecord,
  updateRecord,
  getRecentRecordsByCategory,
  getCurrentBaby,
  type Record as ApiRecord,
} from '../../utils/api'
import {
  getCurrentDateTime,
  dateTimeToTimestamp,
  TONIC_TYPES,
  formatRecordSummary,
  timestampToDateTime,
} from '../../utils/format'
import Calendar from '../../components/Calendar'
import './index.less'

type SubType = 'tonic' | 'growth' | 'outdoor' | 'cry' | 'gear' | 'medicine' | 'temperature'

type TemperatureLevel = 'normal' | 'low' | 'medium' | 'high' | 'ultra'

const SUB_MENUS: { label: string; value: SubType }[] = [
  { label: '补剂', value: 'tonic' },
  { label: '药', value: 'medicine' },
  { label: '体温', value: 'temperature' },
  { label: '成长', value: 'growth' },
  { label: '户外', value: 'outdoor' },
  { label: '哭闹', value: 'cry' },
  { label: '护具', value: 'gear' },
]

const GEAR_TYPES = ['带上', '脱下']
const GROWTH_TYPES = ['身高', '体重']

function getTemperatureStatus(
  tempValue: string,
): { level: TemperatureLevel; label: string; message: string } | null {
  const temperature = Number.parseFloat(tempValue)

  if (Number.isNaN(temperature)) {
    return null
  }

  if (temperature < 36) {
    return {
      level: 'normal',
      label: ' 低温',
      message: '宝宝体温较低，是否测量错误？建议重新测量一次',
    }
  }

  if (temperature < 37.5) {
    return {
      level: 'normal',
      label: '正常',
      message: '宝宝体温很健康，继续正常观察就可以。',
    }
  }

  if (temperature < 38) {
    return {
      level: 'low',
      label: '低烧',
      message: '宝宝有点低烧，先多休息、适当补充水分，并继续观察体温变化。',
    }
  }

  if (temperature < 38.5) {
    return {
      level: 'medium',
      label: '中烧',
      message: '宝宝已经中烧了，建议及时物理降温，并密切观察精神状态和食欲。',
    }
  }

  if (temperature < 41) {
    return {
      level: 'high',
      label: '高烧',
      message: '宝宝高烧了，要进行降温处理，最好去医院。',
    }
  }

  return {
    level: 'ultra',
    label: '超高烧',
    message: '宝宝超高烧了，必须马上去医院。',
  }
}

function getPrefillLabel(record: ApiRecord): string {
  if (record.subCategory === 'medicine') {
    return record.value || '未命名药品'
  }

  return formatRecordSummary(record)
}

export default function OtherPage() {
  const router = useRouter()
  const editId = router.params.editId ? parseInt(router.params.editId) : null
  const isEdit = !!editId

  const dt = getCurrentDateTime()
  const [date, setDate] = useState(dt.date)
  const [time, setTime] = useState(dt.time)
  const [subType, setSubType] = useState<SubType>('tonic')
  const [tonicType, setTonicType] = useState(TONIC_TYPES[0])
  const [gearType, setGearType] = useState(GEAR_TYPES[0])
  const [growthType, setGrowthType] = useState(GROWTH_TYPES[0])
  const [growthValue, setGrowthValue] = useState('')
  const [medicineName, setMedicineName] = useState('')
  const [medicineAmount, setMedicineAmount] = useState('')
  const [temperature, setTemperature] = useState('')
  const [duration, setDuration] = useState('')
  const [recentRecords, setRecentRecords] = useState<ApiRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)

  useLoad(async () => {
    try {
      if (isEdit && editId) {
        const record = Taro.getStorageSync('editRecord')
        if (record && record.id === editId) {
          const recordDateTime = timestampToDateTime(record.startTime)
          setDate(recordDateTime.date)
          setTime(recordDateTime.time)
          setSubType(record.subCategory as SubType)

          if (record.subCategory === 'tonic' && record.extra) {
            setTonicType(record.extra.tonic_type || TONIC_TYPES[0])
          } else if (record.subCategory === 'gear' && record.extra) {
            setGearType(record.extra.gear_type || GEAR_TYPES[0])
          } else if (record.subCategory === 'growth' && record.extra) {
            setGrowthType(record.extra.growth_type || GROWTH_TYPES[0])
            setGrowthValue(record.value || '')
          } else if (record.subCategory === 'medicine') {
            setMedicineName(record.value || '')
            setMedicineAmount(record.extra?.medicine_amount || '')
          } else if (record.subCategory === 'temperature') {
            setTemperature(record.value || '')
          } else {
            setDuration(record.value || '')
          }
        }
      }

      const records = await getRecentRecordsByCategory('other', 50)
      setRecentRecords(records)
    } catch (error) {
      console.error('加载数据失败:', error)
    }
  })

  function resetSharedFields() {
    setDuration('')
    setGrowthValue('')
    setMedicineName('')
    setMedicineAmount('')
    setTemperature('')
    setTonicType(TONIC_TYPES[0])
    setGearType(GEAR_TYPES[0])
    setGrowthType(GROWTH_TYPES[0])
  }

  function applyPrefill(record: ApiRecord) {
    const nextSubType = record.subCategory as SubType
    setSubType(nextSubType)
    resetSharedFields()

    if (nextSubType === 'tonic') {
      setTonicType(record.extra?.tonic_type ?? TONIC_TYPES[0])
      return
    }

    if (nextSubType === 'gear') {
      setGearType(record.extra?.gear_type ?? GEAR_TYPES[0])
      return
    }

    if (nextSubType === 'growth') {
      setGrowthType(record.extra?.growth_type ?? GROWTH_TYPES[0])
      setGrowthValue(record.value || '')
      return
    }

    if (nextSubType === 'medicine') {
      setMedicineName(record.value || '')
      return
    }

    if (nextSubType === 'temperature') {
      setTemperature(record.value || '')
      return
    }

    setDuration(record.value || '')
  }

  async function handleSubmit() {
    if (loading) return

    let value = ''
    let extra: any = null

    if (subType === 'tonic') {
      value = '1'
      extra = { tonic_type: tonicType }
    } else if (subType === 'gear') {
      value = '1'
      extra = { gear_type: gearType }
    } else if (subType === 'growth') {
      if (!growthValue) {
        Taro.showToast({ title: `请输入${growthType}`, icon: 'none' })
        return
      }
      value = growthValue
      extra = { growth_type: growthType }
    } else if (subType === 'medicine') {
      if (!medicineName) {
        Taro.showToast({ title: '请输入药品名称', icon: 'none' })
        return
      }
      if (!medicineAmount) {
        Taro.showToast({ title: '请输入药量', icon: 'none' })
        return
      }
      value = medicineName
      extra = { medicine_amount: medicineAmount }
    } else if (subType === 'temperature') {
      if (!temperature) {
        Taro.showToast({ title: '请输入体温', icon: 'none' })
        return
      }

      const parsedTemperature = Number.parseFloat(temperature)
      if (Number.isNaN(parsedTemperature)) {
        Taro.showToast({ title: '体温格式不正确', icon: 'none' })
        return
      }

      value = temperature
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
        await updateRecord(editId, {
          category: 'other',
          subCategory: subType,
          startTime,
          value,
          extra,
        })
        Taro.showToast({ title: '更新成功！', icon: 'success' })
      } else {
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

  const temperatureStatus = getTemperatureStatus(temperature)
  const recentRecordsForCurrentType: ApiRecord[] = []
  const seenPrefillLabels = new Set<string>()

  for (const record of recentRecords) {
    if (record.subCategory !== subType) {
      continue
    }

    const label = getPrefillLabel(record)
    if (!label || seenPrefillLabels.has(label)) {
      continue
    }

    seenPrefillLabels.add(label)
    recentRecordsForCurrentType.push(record)

    if (recentRecordsForCurrentType.length >= 5) {
      break
    }
  }

  return (
    <View className='page-container other-page'>
      <View className='main-card'>
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

        <View className='section section-inline'>
          <Text className='field-label'>时间</Text>
          <View className='time-row'>
            <View className='picker-display' onClick={handleOpenCalendar}>
              {date}
            </View>
            <Picker mode='time' value={time} onChange={(e) => setTime(e.detail.value)}>
              <View className='picker-display'>{time}</View>
            </Picker>
          </View>
        </View>

        {subType === 'tonic' && (
          <View className='section'>
            <Text className='field-label'>补剂种类</Text>
            <View className='options-row'>
              {TONIC_TYPES.map((item) => (
                <View
                  key={item}
                  className={`option-chip ${tonicType === item ? 'active' : ''}`}
                  onClick={() => setTonicType(item)}
                >
                  <Text>{item}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {subType === 'gear' && (
          <View className='section'>
            <Text className='field-label'>类型</Text>
            <View className='options-row'>
              {GEAR_TYPES.map((item) => (
                <View
                  key={item}
                  className={`option-chip ${gearType === item ? 'active' : ''}`}
                  onClick={() => setGearType(item)}
                >
                  <Text>{item}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {subType === 'growth' && (
          <>
            <View className='section'>
              <Text className='field-label'>类型</Text>
              <View className='options-row'>
                {GROWTH_TYPES.map((item) => (
                  <View
                    key={item}
                    className={`option-chip ${growthType === item ? 'active' : ''}`}
                    onClick={() => setGrowthType(item)}
                  >
                    <Text>{item}</Text>
                  </View>
                ))}
              </View>
            </View>
            <View className='section'>
              <Text className='field-label'>{growthType}</Text>
              <View className='number-input-row'>
                <Input
                  className='duration-input'
                  type='digit'
                  placeholder={growthType === '身高' ? '厘米' : '千克(公斤)'}
                  value={growthValue}
                  onInput={(e) => setGrowthValue(e.detail.value)}
                />
                <Text className='unit-text'>{growthType === '身高' ? '厘米' : '千克'}</Text>
              </View>
            </View>
          </>
        )}

        {subType === 'medicine' && (
          <>
            <View className='section'>
              <Text className='field-label'>药品名称</Text>
              <Input
                className='text-input'
                type='text'
                placeholder='请输入药品名称'
                value={medicineName}
                onInput={(e) => setMedicineName(e.detail.value)}
              />
            </View>
            <View className='section'>
              <Text className='field-label'>药量</Text>
              <Input
                className='text-input'
                type='text'
                placeholder='例如 5ml / 半包'
                value={medicineAmount}
                onInput={(e) => setMedicineAmount(e.detail.value)}
              />
            </View>
          </>
        )}

        {subType === 'temperature' && (
          <>
            <View className='section'>
              <Text className='field-label'>体温</Text>
              <View className='number-input-row'>
                <Input
                  className='duration-input'
                  type='digit'
                  placeholder='请输入体温'
                  value={temperature}
                  onInput={(e) => setTemperature(e.detail.value)}
                />
                <Text className='unit-text'>℃</Text>
              </View>
            </View>
            <View className='section section-vertical'>
              <View className={`temperature-card ${temperatureStatus?.level || 'normal'}`}>
                <Text className='temperature-title'>
                  {temperatureStatus ? `当前判断：${temperatureStatus.label}` : '体温提示'}
                </Text>
                <Text className='temperature-message'>
                  {temperatureStatus
                    ? temperatureStatus.message
                    : '输入体温后，这里会显示对应的体温提示。'}
                </Text>
              </View>
            </View>
          </>
        )}

        {(subType === 'outdoor' || subType === 'cry') && (
          <View className='section'>
            <Text className='field-label'>时长</Text>
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

        {!isEdit && recentRecordsForCurrentType.length > 0 && (
          <View className='section section-vertical'>
            <Text className='field-label'>最近的记录</Text>
            <View className='prefill-row'>
              {recentRecordsForCurrentType.map((record) => (
                <View key={record.id} className='prefill-chip' onClick={() => applyPrefill(record)}>
                  <Text>{getPrefillLabel(record)}</Text>
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
