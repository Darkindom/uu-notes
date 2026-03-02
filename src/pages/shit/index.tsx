import { View, Text, Picker, Button } from '@tarojs/components'
import Taro, { useLoad, useRouter } from '@tarojs/taro'
import { useState } from 'react'
// 已迁移到自建后端 API
import { createRecord, updateRecord, getRecentRecordsByCategory, getCurrentBaby, type Record as ApiRecord } from '../../utils/api'
// import { addRecord, getRecentByCategory, type Record as DbRecord } from '../../utils/db' // 云开发已废弃
import {
  getCurrentDateTime,
  dateTimeToTimestamp,
  AMOUNT_LABELS,
  AMOUNT_VALUES,
  SHIT_COLORS,
  SHIT_HARDNESS,
  formatRecordSummary,
  timestampToDateTime,
} from '../../utils/format'
import './index.less'

export default function ShitPage() {
  const router = useRouter()
  const editId = router.params.editId ? parseInt(router.params.editId) : null
  const isEdit = !!editId

  const dt = getCurrentDateTime()
  const [date, setDate] = useState(dt.date)
  const [time, setTime] = useState(dt.time)
  const [shitType, setShitType] = useState<'big' | 'small'>('big')
  const [amountIdx, setAmountIdx] = useState<number | null>(null)
  const [color, setColor] = useState<string | null>(null)
  const [hardness, setHardness] = useState<string | null>(null)
  const [recentRecords, setRecentRecords] = useState<ApiRecord[]>([])
  const [loading, setLoading] = useState(false)

  useLoad(async () => {
    try {
      // 如果是编辑模式，从缓存读取记录详情
      if (isEdit && editId) {
        const record = Taro.getStorageSync('editRecord')
        if (record && record.id === editId) {
          const dt = timestampToDateTime(record.startTime)
          setDate(dt.date)
          setTime(dt.time)
          setShitType(record.subCategory as 'big' | 'small')
          const idx = AMOUNT_VALUES.indexOf(record.value || '')
          setAmountIdx(idx >= 0 ? idx : null)
          if (record.subCategory === 'big' && record.extra) {
            setColor(record.extra.color || null)
            setHardness(record.extra.hardness || null)
          }
        }
      }

      const records = await getRecentRecordsByCategory('shit', 5)
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
    const sub = r.subCategory as 'big' | 'small'
    setShitType(sub)
    const idx = AMOUNT_VALUES.indexOf(r.value || '')
    setAmountIdx(idx >= 0 ? idx : null)
    if (sub === 'big') {
      try {
        const extra = r.extra as any
        setColor(extra?.color ?? null)
        setHardness(extra?.hardness ?? null)
      } catch {
        setColor(null)
        setHardness(null)
      }
    } else {
      setColor(null)
      setHardness(null)
    }
  }

  async function handleSubmit() {
    if (loading) return // 防止重复提交
    
    const extra: Record<string, string> = {}
    if (shitType === 'big') {
      if (color) extra.color = color
      if (hardness) extra.hardness = hardness
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
          category: 'shit',
          subCategory: shitType,
          startTime,
          value: amountIdx !== null ? AMOUNT_VALUES[amountIdx] : '',
          extra: Object.keys(extra).length > 0 ? extra : undefined,
        })
        Taro.showToast({ title: '更新成功！', icon: 'success' })
      } else {
        // 创建新记录
        await createRecord({
          babyId: baby.id,
          category: 'shit',
          subCategory: shitType,
          startTime,
          value: amountIdx !== null ? AMOUNT_VALUES[amountIdx] : '',
          extra: Object.keys(extra).length > 0 ? extra : undefined,
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

  return (
    <View className='page-container shit-page'>
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

        {/* Amount */}
        <View className='section section-inline'>
          <Text className='field-label'>数量</Text>
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
        </View>

        {/* Color */}
        <View className='section section-inline'>
          <Text className='field-label'>颜色</Text>
          <View className='options-row'>
            {SHIT_COLORS.map((c) => (
              <View
                key={c.value}
                className={`option-chip color-chip ${color === c.value ? 'active' : ''}`}
                onClick={() => setColor(color === c.value ? null : c.value)}
              >
                <Text>{c.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Hardness */}
        <View className='section section-inline'>
          <Text className='field-label'>软硬</Text>
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
    </View>
  )
}
