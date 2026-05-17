export interface VoiceAnalysisItem {
  category: string
  subCategory?: string
  value?: string
  extra?: any
  note?: string
}

const CATEGORY_LABELS: Record<string, string> = {
  food: '吃',
  sleep: '睡',
  shit: '拉',
  other: '其他',
}

const SUBCATEGORY_LABELS: Record<string, string> = {
  breast_milk: '母乳',
  milk: '奶粉',
  water: '水',
  babycook: '辅食',
  fruit: '水果',
  snack: '零食',
  sleep: '睡眠',
  big: '大便',
  small: '换尿布',
  tonic: '补剂',
  medicine: '药',
  temperature: '体温',
  growth: '成长',
  outdoor: '户外',
  cry: '哭闹',
  gear: '护具',
}

const AMOUNT_LABELS = ['少', '中', '多']

const SHIT_COLORS: Record<string, string> = {
  yellow: '黄',
  brown: '棕',
  black: '黑',
  green: '绿',
  red: '红',
}

const SHIT_HARDNESS: Record<string, string> = {
  loose: '稀',
  soft: '软',
  hard: '硬',
}

function amountLabel(value?: string): string {
  if (!value) return ''
  const idx = parseInt(value)
  return AMOUNT_LABELS[idx] ?? value
}

function durationLabel(value?: string): string {
  if (!value) return ''
  const mins = parseInt(value)
  if (!mins) return value
  if (mins >= 60) {
    return `${Math.floor(mins / 60)}小时${mins % 60 > 0 ? `${mins % 60}分钟` : ''}`
  }
  return `${mins}分钟`
}

export function formatVoiceAnalysisReview(item: VoiceAnalysisItem): string {
  const extra = item.extra || {}
  const parts = [
    CATEGORY_LABELS[item.category] || CATEGORY_LABELS.other,
    item.subCategory ? SUBCATEGORY_LABELS[item.subCategory] || item.subCategory : '',
  ]

  if (item.category === 'food') {
    if (item.subCategory === 'babycook' || item.subCategory === 'fruit' || item.subCategory === 'snack') {
      if (extra.food_type) parts.push(extra.food_type)
      if (item.value) parts.push(item.subCategory === 'babycook' ? amountLabel(item.value) : item.value)
    } else if (item.value) {
      parts.push(item.subCategory === 'water' ? amountLabel(item.value) : `${item.value}ml`)
    }
  } else if (item.category === 'shit') {
    if (item.value) parts.push(`量${amountLabel(item.value)}`)
    if (extra.color) parts.push(SHIT_COLORS[extra.color] || extra.color)
    if (extra.hardness) parts.push(SHIT_HARDNESS[extra.hardness] || extra.hardness)
  } else if (item.category === 'sleep') {
    if (item.value) parts.push(durationLabel(item.value))
  } else if (item.value && item.value !== '1') {
    parts.push(item.value)
  }

  if (parts.filter(Boolean).length <= 2 && item.note) {
    parts.push(item.note)
  }

  return parts.filter(Boolean).join(' · ')
}

export function buildVoiceRecordPayload(
  babyId: number,
  item: VoiceAnalysisItem,
  fallbackNote: string,
  startTime: number = Date.now(),
) {
  return {
    babyId,
    category: item.category,
    subCategory: item.subCategory,
    startTime,
    value: item.value,
    extra: item.extra,
    note: item.note || fallbackNote,
  }
}
