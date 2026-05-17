// 已迁移到自建后端 API
import type { Record } from './api'
// import type { Record } from './db' // 云开发已废弃

export const AMOUNT_LABELS = ['少', '中', '多']
export const AMOUNT_VALUES = ['0', '1', '2']

export const SHIT_COLORS = [
  { label: '黄', value: 'yellow' },
  { label: '棕', value: 'brown' },
  { label: '黑', value: 'black' },
  { label: '绿', value: 'green' },
  { label: '红', value: 'red' },
]

export const SHIT_HARDNESS = [
  { label: '稀', value: 'loose' },
  { label: '软', value: 'soft' },
  { label: '硬', value: 'hard' },
]

export const TONIC_TYPES = ['AD', 'D3', '钙', '铁', '锌', 'DHA']

export const SUBCATEGORY_LABELS: { [key: string]: string } = {
  breast_milk: '母乳',
  milk: '奶粉',
  water: '水',
  babycook: '辅食',
  fruit: '水果',
  snack: '零食',
  sleep: '睡眠',
  big: '大便',
  small: '换尿片',
  tonic: '补剂',
  outdoor: '户外',
  cry: '哭闹',
  gear: '护具',
  medicine: '药',
  temperature: '体温',
}

export const CATEGORY_LABELS: { [key: string]: string } = {
  food: '吃',
  sleep: '睡',
  shit: '拉',
  other: '其他',
}

export function isSolidFoodSubCategory(subCategory?: string): boolean {
  return subCategory === 'babycook' || subCategory === 'fruit' || subCategory === 'snack'
}

export function formatTimestamp(ts: number): string {
  const d = new Date(ts)
  const month = d.getMonth() + 1
  const day = d.getDate()
  const hours = String(d.getHours()).padStart(2, '0')
  const mins = String(d.getMinutes()).padStart(2, '0')
  return `${month}月${day}日 ${hours}:${mins}`
}

export function formatRecordSummary(record: Record): string {
  const sub = record.subCategory || ''
  const val = record.value || ''
  const extra = (record.extra as any) || {}

  if (sub === 'breast_milk' || sub === 'milk') {
    return `${SUBCATEGORY_LABELS[sub]} ${val}ml`
  }
  if (sub === 'water') {
    return `喝水 ${AMOUNT_LABELS[parseInt(val)] ?? val}`
  }
  if (sub === 'babycook') {
    const amount = AMOUNT_LABELS[parseInt(val)] ?? val
    if (amount) {
      return `辅食 ${amount}`
    }
    if (extra.food_type) {
      return `辅食 ${extra.food_type}`
    }
    return '辅食'
  }
  if (sub === 'fruit' || sub === 'snack') {
    const name = extra.food_type ?? ''
    return [SUBCATEGORY_LABELS[sub], name, val].filter(Boolean).join(' ')
  }
  if (sub === 'sleep') {
    const mins = parseInt(val)
    if (mins >= 60) {
      return `睡了 ${Math.floor(mins / 60)}小时${mins % 60 > 0 ? (mins % 60) + '分钟' : ''}`
    }
    return `睡了 ${val}分钟`
  }
  if (sub === 'big') {
    const color = SHIT_COLORS.find((c) => c.value === extra.color)?.label ?? ''
    const hardness = SHIT_HARDNESS.find((h) => h.value === extra.hardness)?.label ?? ''
    const amount = AMOUNT_LABELS[parseInt(val)] ? `量${AMOUNT_LABELS[parseInt(val)]}` : val
    const summary = `${amount} ${color} ${hardness}`.trim()
    return summary || record.note || SUBCATEGORY_LABELS[sub]
  }
  if (sub === 'small') {
    const amount = AMOUNT_LABELS[parseInt(val)] ?? val
    return amount ? `换尿片 ${amount}` : record.note || '换尿片'
  }
  if (sub === 'tonic') {
    return `补剂 ${extra.tonic_type ?? ''}`
  }
  if (sub === 'outdoor') {
    return `户外 ${val}分钟`
  }
  if (sub === 'cry') {
    return `哭闹 ${val}分钟`
  }
  if (sub === 'gear') {
    return `护具 ${extra.gear_type ?? ''}`
  }
  if (sub === 'growth') {
    const growthType = extra.growth_type ?? ''
    const unit = growthType === '身高' ? 'cm' : 'kg'
    return `${growthType} ${val}${unit}`
  }
  if (sub === 'medicine') {
    return `药 ${val}${extra.medicine_amount ? ` ${extra.medicine_amount}` : ''}`.trim()
  }
  if (sub === 'temperature') {
    return `体温 ${val}℃`
  }
  return SUBCATEGORY_LABELS[sub] ?? sub
}

export function getCurrentDateTime(): { date: string; time: string } {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const mins = String(now.getMinutes()).padStart(2, '0')
  return {
    date: `${year}-${month}-${day}`,
    time: `${hours}:${mins}`,
  }
}

export function dateTimeToTimestamp(date: string, time: string): number {
  return new Date(`${date}T${time}:00`).getTime()
}

export function timestampToDateTime(ts: number): { date: string; time: string } {
  const d = new Date(ts)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const mins = String(d.getMinutes()).padStart(2, '0')
  return {
    date: `${year}-${month}-${day}`,
    time: `${hours}:${mins}`,
  }
}

export function getFoodTypeDetail(record: Record): string {
  const sub = record.subCategory || ''
  const extra = (record.extra as any) || {}
  
  if (sub === 'babycook' && extra.food_type && record.value) {
    return extra.food_type
  }
  return ''
}
