import type { Record } from './db'

export const AMOUNT_LABELS = ['较少', '适中', '很多']
export const AMOUNT_VALUES = ['0', '1', '2']

export const SHIT_COLORS = [
  { label: '黄', value: 'yellow' },
  { label: '绿', value: 'green' },
  { label: '棕', value: 'brown' },
  { label: '黑', value: 'black' },
  { label: '其他', value: 'other' },
]

export const SHIT_HARDNESS = [
  { label: '稀', value: 'loose' },
  { label: '软', value: 'soft' },
  { label: '硬', value: 'hard' },
]

export const TONIC_TYPES = ['AD', 'D3', '钙', '铁', '锌', '其他']

export const SUBCATEGORY_LABELS: Record<string, string> = {
  breast_milk: '母乳',
  milk: '奶粉',
  water: '水',
  babycook: '辅食',
  sleep: '睡眠',
  big: '大便',
  small: '小便',
  tonic: '补剂',
  outdoor: '户外',
  cry: '哭闹',
}

export const CATEGORY_LABELS: Record<string, string> = {
  food: '吃',
  sleep: '睡',
  shit: '拉',
  other: '其他',
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
  const sub = record.subcategory
  const val = record.value
  const extra = record.extra ? JSON.parse(record.extra) : {}

  if (sub === 'breast_milk' || sub === 'milk') {
    return `${SUBCATEGORY_LABELS[sub]} ${val}ml`
  }
  if (sub === 'water') {
    return `喝水 ${AMOUNT_LABELS[parseInt(val)] ?? val}`
  }
  if (sub === 'babycook') {
    const food = extra.food_type ? `(${extra.food_type})` : ''
    return `辅食${food} ${AMOUNT_LABELS[parseInt(val)] ?? val}`
  }
  if (sub === 'sleep') {
    const mins = parseInt(val)
    if (mins >= 60) {
      return `睡了 ${Math.floor(mins / 60)}小时${mins % 60 > 0 ? (mins % 60) + '分钟' : ''}`
    }
    return `睡了 ${val}分钟`
  }
  if (sub === 'big') {
    const color = SHIT_COLORS.find(c => c.value === extra.color)?.label ?? ''
    const hardness = SHIT_HARDNESS.find(h => h.value === extra.hardness)?.label ?? ''
    return `大便 ${AMOUNT_LABELS[parseInt(val)] ?? val} ${color} ${hardness}`.trim()
  }
  if (sub === 'small') {
    return `小便 ${AMOUNT_LABELS[parseInt(val)] ?? val}`
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
