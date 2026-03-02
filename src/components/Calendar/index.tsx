import { View, Text } from '@tarojs/components'
import { useState, useEffect } from 'react'
import dayjs from 'dayjs'
import './index.less'

interface CalendarProps {
  visible: boolean
  value?: Date
  minDate?: Date
  maxDate?: Date
  onConfirm: (date: Date) => void
  onCancel: () => void
}

export default function Calendar({
  visible,
  value,
  minDate,
  maxDate = new Date(),
  onConfirm,
  onCancel,
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(dayjs(value || new Date()))
  const [selectedDate, setSelectedDate] = useState(dayjs(value || new Date()))

  useEffect(() => {
    if (visible && value) {
      setCurrentMonth(dayjs(value))
      setSelectedDate(dayjs(value))
    }
  }, [visible, value])

  // 获取当月的日历数据
  function getCalendarDays() {
    const firstDay = currentMonth.startOf('month')
    const lastDay = currentMonth.endOf('month')
    const startWeekday = firstDay.day() // 0-6, 0是周日

    const days: Array<{
      date: dayjs.Dayjs
      isCurrentMonth: boolean
      isToday: boolean
      isSelected: boolean
      isDisabled: boolean
    }> = []

    // 填充上个月的日期
    const prevMonthDays = startWeekday
    for (let i = prevMonthDays - 1; i >= 0; i--) {
      const date = firstDay.subtract(i + 1, 'day')
      days.push({
        date,
        isCurrentMonth: false,
        isToday: false,
        isSelected: false,
        isDisabled: true,
      })
    }

    // 填充当月的日期
    const daysInMonth = lastDay.date()
    for (let i = 1; i <= daysInMonth; i++) {
      const date = firstDay.date(i)
      const isDisabled = isDateDisabled(date)
      days.push({
        date,
        isCurrentMonth: true,
        isToday: date.format('YYYY-MM-DD') === dayjs().format('YYYY-MM-DD'),
        isSelected: date.format('YYYY-MM-DD') === selectedDate.format('YYYY-MM-DD'),
        isDisabled,
      })
    }

    // 填充下个月的日期，补齐到42个格子（6行7列）
    const remainingDays = 42 - days.length
    for (let i = 1; i <= remainingDays; i++) {
      const date = lastDay.add(i, 'day')
      days.push({
        date,
        isCurrentMonth: false,
        isToday: false,
        isSelected: false,
        isDisabled: true,
      })
    }

    return days
  }

  // 判断日期是否被禁用
  function isDateDisabled(date: dayjs.Dayjs): boolean {
    const dateStr = date.format('YYYY-MM-DD')
    if (minDate) {
      const minDateStr = dayjs(minDate).format('YYYY-MM-DD')
      if (dateStr < minDateStr) {
        return true
      }
    }
    if (maxDate) {
      const maxDateStr = dayjs(maxDate).format('YYYY-MM-DD')
      if (dateStr > maxDateStr) {
        return true
      }
    }
    return false
  }

  // 上一个月
  function handlePrevMonth() {
    setCurrentMonth(currentMonth.subtract(1, 'month'))
  }

  // 下一个月
  function handleNextMonth() {
    setCurrentMonth(currentMonth.add(1, 'month'))
  }

  // 选择日期
  function handleSelectDate(day: any) {
    if (day.isDisabled) return
    // 直接选择并关闭
    onConfirm(day.date.toDate())
  }

  // 今天
  function handleToday() {
    const today = dayjs()
    // 直接选择今天并关闭
    onConfirm(today.toDate())
  }

  if (!visible) return null

  const calendarDays = getCalendarDays()
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']

  return (
    <View className='calendar-overlay' onClick={onCancel}>
      <View className='calendar-container' onClick={(e) => e.stopPropagation()}>
        {/* 头部 */}
        <View className='calendar-header'>
          <View className='header-title'>选择日期</View>
          <View className='header-close' onClick={onCancel}>
            ✕
          </View>
        </View>

        {/* 月份切换 */}
        <View className='calendar-month-selector'>
          <View className='month-arrow' onClick={handlePrevMonth}>
            ◀
          </View>
          <Text className='month-text'>{currentMonth.format('YYYY年MM月')}</Text>
          <View className='month-arrow' onClick={handleNextMonth}>
            ▶
          </View>
        </View>

        {/* 星期标题 */}
        <View className='calendar-weekdays'>
          {weekdays.map((day) => (
            <View key={day} className='weekday-item'>
              <Text className='weekday-text'>{day}</Text>
            </View>
          ))}
        </View>

        {/* 日期网格 */}
        <View className='calendar-days'>
          {calendarDays.map((day, index) => (
            <View
              key={index}
              className={`day-item ${day.isCurrentMonth ? '' : 'other-month'} ${
                day.isToday ? 'today' : ''
              } ${day.isSelected ? 'selected' : ''} ${day.isDisabled ? 'disabled' : ''}`}
              onClick={() => handleSelectDate(day)}
            >
              <Text className='day-text'>{day.date.date()}</Text>
            </View>
          ))}
        </View>

        {/* 底部按钮 */}
        <View className='calendar-footer'>
          <View className='footer-btn today-btn' onClick={handleToday}>
            今天
          </View>
        </View>
      </View>
    </View>
  )
}
