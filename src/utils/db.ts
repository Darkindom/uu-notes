import Taro from '@tarojs/taro'

export type Category = 'food' | 'sleep' | 'shit' | 'other'

export type FoodSubcategory = 'breast_milk' | 'milk' | 'water' | 'babycook'
export type SleepSubcategory = 'sleep'
export type ShitSubcategory = 'big' | 'small'
export type OtherSubcategory = 'tonic' | 'outdoor' | 'cry'

export type Subcategory = FoodSubcategory | SleepSubcategory | ShitSubcategory | OtherSubcategory

export interface Record {
  id: string
  timestamp: number
  category: Category
  subcategory: Subcategory
  value: string
  extra: string
}

const STORAGE_KEY = 'uu_notes_records'

export function getAllRecords(): Record[] {
  try {
    const data = Taro.getStorageSync(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

export function addRecord(record: Omit<Record, 'id'>): Record {
  const records = getAllRecords()
  const newRecord: Record = { ...record, id: Date.now().toString() }
  records.unshift(newRecord)
  Taro.setStorageSync(STORAGE_KEY, JSON.stringify(records))
  return newRecord
}

export function deleteRecord(id: string): void {
  const records = getAllRecords()
  const filtered = records.filter(r => r.id !== id)
  Taro.setStorageSync(STORAGE_KEY, JSON.stringify(filtered))
}

export function getRecentRecords(limit = 50): Record[] {
  return getAllRecords().slice(0, limit)
}
