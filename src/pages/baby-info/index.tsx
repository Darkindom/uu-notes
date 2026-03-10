import { View, Text, Button } from '@tarojs/components'
import Taro, { useLoad, useShareAppMessage, useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import dayjs from 'dayjs'
import {
  getBabies,
  switchBaby,
  getCurrentUser,
  deleteBaby,
  deleteBabyMember,
  getRecords,
  type Baby,
} from '../../utils/api'
import { clearIndexCache, getCachedRecords } from '../../utils/cache'
import Calendar from '../../components/Calendar'
import LoadingSpinner from '../../components/LoadingSpinner'
import WeeklyChart from '../../components/WeeklyChart'
import './index.less'

interface DayData {
  date: string
  milk: number
  food: number
  sleepMinutes: number
  sleepCount: number
}

interface TodayStats {
  milk: number // 奶量 ml
  food: number // 辅食次数
  sleep: number // 睡眠次数
  sleepMinutes: number // 睡眠总分钟数
  shit: number // 拉的总次数（包括大便和换尿片）
  poop: number // 大便次数
  diaper: number // 换尿片次数
  outdoor: number // 户外次数
  tonic: number // 补剂次数
  cry: number // 哭闹次数
  gearHours: number // 护具佩戴小时数
  nightMilkCount: number // 夜奶次数
}

export default function BabySelectorPage() {
  const [babies, setBabies] = useState<Baby[]>([])
  const [currentBabyId, setCurrentBabyId] = useState<number | undefined>(undefined)
  const [currentUserId, setCurrentUserId] = useState<number | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(false)
  const [showMembersModal, setShowMembersModal] = useState(false)
  const [selectedBaby, setSelectedBaby] = useState<Baby | null>(null)
  const [todayStats, setTodayStats] = useState<TodayStats | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [showCalendar, setShowCalendar] = useState(false)
  const [weeklyData, setWeeklyData] = useState<DayData[]>([])
  const [chartLoading, setChartLoading] = useState(false)

  useLoad(async () => {
    await loadBabies()
  })

  useDidShow(() => {
    if (currentBabyId) {
      // 并行加载数据
      Promise.all([
        loadTodayStats(currentBabyId, selectedDate),
        loadWeeklyData(currentBabyId),
      ]).catch((error) => {
        console.error('加载数据失败:', error)
      })
    }
  })

  useShareAppMessage(() => {
    if (!selectedBaby) {
      return {
        title: '宝宝成长记录',
        path: '/pages/index/index',
      }
    }
    return {
      title: `邀请你加入「${selectedBaby.name}」的成长记录`,
      path: `/pages/index/index?babyId=${selectedBaby.id}&inviteFrom=share`,
    }
  })

  async function loadBabies() {
    setLoading(true)
    try {
      const [babyList, user] = await Promise.all([getBabies(), getCurrentUser()])
      setBabies(babyList)
      setCurrentBabyId(user?.currentBabyId)
      setCurrentUserId(user?.id)
      setLoading(false)

      // 并行加载今日数据和图表数据
      if (user?.currentBabyId) {
        Promise.all([
          loadTodayStats(user.currentBabyId, selectedDate),
          loadWeeklyData(user.currentBabyId),
        ]).catch((error) => {
          console.error('加载数据失败:', error)
        })
      }
    } catch (error) {
      console.error('加载宝宝列表失败:', error)
      Taro.showToast({ title: '加载失败', icon: 'none' })
      setLoading(false)
    }
  }

  async function loadTodayStats(babyId: number, date: Date = new Date()) {
    try {
      setStatsLoading(true)
      setTodayStats(null)

      const startOfDay = new Date(date)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(date)
      endOfDay.setHours(23, 59, 59, 999)
      const dateKey = `${startOfDay.getFullYear()}-${String(startOfDay.getMonth() + 1).padStart(
        2,
        '0',
      )}-${String(startOfDay.getDate()).padStart(2, '0')}`

      const cachedRecords = getCachedRecords(babyId, dateKey, '')

      const todayResponse = await getRecords({
        babyId,
        limit: 1000,
        offset: 0,
        startDate: startOfDay.getTime(),
        endDate: endOfDay.getTime(),
      })
      const todayRecords = todayResponse.records

      // 获取前一天最后的护具记录，检查是否有未脱下的
      const yesterdayStart = new Date(startOfDay)
      yesterdayStart.setDate(yesterdayStart.getDate() - 1)
      const yesterdayEnd = new Date(startOfDay)
      yesterdayEnd.setMilliseconds(-1)

      const yesterdayResponse = await getRecords({
        babyId,
        limit: 1,
        offset: 0,
        startDate: yesterdayStart.getTime(),
        endDate: yesterdayEnd.getTime(),
        category: 'other',
      })

      const stats: TodayStats = {
        milk: 0,
        food: 0,
        sleep: 0,
        sleepMinutes: 0,
        shit: 0,
        poop: 0,
        diaper: 0,
        outdoor: 0,
        tonic: 0,
        cry: 0,
        gearHours: 0,
        nightMilkCount: 0,
      }

      // 用于计算护具佩戴时间
      const gearEvents: { type: 'on' | 'off'; time: number }[] = []

      todayRecords.forEach((record) => {
        switch (record.category) {
          case 'food':
            if (record.subCategory === 'breast_milk' || record.subCategory === 'milk') {
              // 统计奶量
              stats.milk += parseInt(record.value || '0') || 0

              // 判断是否为夜奶（晚上12点到早上6点）
              const recordTime = new Date(record.startTime)
              const hour = recordTime.getHours()
              if (hour >= 0 && hour < 6) {
                stats.nightMilkCount++
              }
            } else if (record.subCategory === 'babycook') {
              // 辅食次数
              stats.food++
            }
            break

          case 'sleep':
            stats.sleep++
            stats.sleepMinutes += parseInt(record.value || '0') || 0
            break

          case 'shit':
            stats.shit++
            // 分别统计大便和换尿片
            if (record.subCategory === 'big') {
              stats.poop++
            } else if (record.subCategory === 'small') {
              stats.diaper++
            }
            break

          case 'other':
            if (record.subCategory === 'outdoor') {
              stats.outdoor++
            } else if (record.subCategory === 'tonic') {
              stats.tonic++
            } else if (record.subCategory === 'cry') {
              stats.cry++
            } else if (record.subCategory === 'gear') {
              // 收集护具事件
              const gearType = record.extra?.gear_type
              if (gearType === '带上') {
                gearEvents.push({ type: 'on', time: record.startTime })
              } else if (gearType === '脱下') {
                gearEvents.push({ type: 'off', time: record.startTime })
              }
            }
            break
        }
      })

      // 检查昨天最后的护具状态
      let yesterdayLastGearOn = false
      if (yesterdayResponse.records.length > 0) {
        // 获取昨天所有护具记录来判断最后状态
        const yesterdayAllGear = await getRecords({
          babyId,
          limit: 1000,
          offset: 0,
          startDate: yesterdayStart.getTime(),
          endDate: yesterdayEnd.getTime(),
        })

        const yesterdayGearEvents = yesterdayAllGear.records
          .filter((r) => r.category === 'other' && r.subCategory === 'gear')
          .map((r) => ({
            type: r.extra?.gear_type === '带上' ? 'on' : 'off',
            time: r.startTime,
          }))
          .sort((a, b) => a.time - b.time)

        // 判断昨天最后一次操作
        if (yesterdayGearEvents.length > 0) {
          const lastEvent = yesterdayGearEvents[yesterdayGearEvents.length - 1]
          yesterdayLastGearOn = lastEvent.type === 'on'
        }
      }

      // 计算护具佩戴时长
      gearEvents.sort((a, b) => a.time - b.time)

      // 过滤掉连续的相同操作，只保留状态变化的事件
      const filteredGearEvents: { type: 'on' | 'off'; time: number }[] = []
      let lastType: 'on' | 'off' | null = yesterdayLastGearOn ? 'on' : null

      for (const event of gearEvents) {
        if (event.type !== lastType) {
          filteredGearEvents.push(event)
          lastType = event.type
        }
        // 如果 event.type === lastType，说明是连续的相同操作，忽略
      }

      let totalGearMinutes = 0
      let lastOnTime: number | null = null

      // 如果昨天最后是带上状态，从今天0点开始计算
      if (yesterdayLastGearOn && filteredGearEvents.length > 0) {
        // 如果今天第一个事件是"脱下"，说明从0点到脱下这段时间一直戴着
        if (filteredGearEvents[0].type === 'off') {
          totalGearMinutes += (filteredGearEvents[0].time - startOfDay.getTime()) / (1000 * 60)
        } else {
          // 如果今天第一个是"带上"，说明昨天虽然带上了但今天重新带上，不计算0点到第一个事件的时间
          lastOnTime = filteredGearEvents[0].time
        }
        // 从第二个事件开始处理
        for (let i = 1; i < filteredGearEvents.length; i++) {
          const event = filteredGearEvents[i]
          if (event.type === 'on') {
            lastOnTime = event.time
          } else if (event.type === 'off' && lastOnTime !== null) {
            totalGearMinutes += (event.time - lastOnTime) / (1000 * 60)
            lastOnTime = null
          }
        }
      } else {
        // 正常处理今天的事件
        filteredGearEvents.forEach((event) => {
          if (event.type === 'on') {
            lastOnTime = event.time
          } else if (event.type === 'off' && lastOnTime !== null) {
            totalGearMinutes += (event.time - lastOnTime) / (1000 * 60)
            lastOnTime = null
          }
        })
      }

      // 如果有未脱下的，计算到当天结束或当前时间
      if (lastOnTime !== null) {
        // 如果查看的是今天，计算到现在；否则计算到当天结束
        const isToday = dayjs(date).format('YYYY-MM-DD') === dayjs().format('YYYY-MM-DD')
        const endTime = isToday ? Date.now() : endOfDay.getTime()
        totalGearMinutes += (endTime - lastOnTime) / (1000 * 60)
      } else if (yesterdayLastGearOn && filteredGearEvents.length === 0) {
        // 昨天带上了，今天没有任何护具记录，说明一直戴着
        // 如果查看的是今天，计算到现在；否则计算到当天结束
        const isToday = dayjs(date).format('YYYY-MM-DD') === dayjs().format('YYYY-MM-DD')
        const endTime = isToday ? Date.now() : endOfDay.getTime()
        totalGearMinutes += (endTime - startOfDay.getTime()) / (1000 * 60)
      }

      stats.gearHours = Math.round((totalGearMinutes / 60) * 10) / 10

      setTodayStats(stats)
    } catch (error) {
      console.error('加载今日统计失败:', error)
      setTodayStats(null)
    } finally {
      setStatsLoading(false)
    }
  }

  async function loadWeeklyData(babyId: number) {
    try {
      setChartLoading(true)

      const weekData: DayData[] = []
      const today = new Date()

      for (let i = 6; i >= 0; i--) {
        const date = new Date(today)
        date.setDate(date.getDate() - i)
        const startOfDay = new Date(date)
        startOfDay.setHours(0, 0, 0, 0)
        const endOfDay = new Date(date)
        endOfDay.setHours(23, 59, 59, 999)

        const dateStr = dayjs(date).format('YYYY-MM-DD')

        try {
          // 获取当天记录
          const response = await getRecords({
            babyId,
            limit: 1000,
            offset: 0,
            startDate: startOfDay.getTime(),
            endDate: endOfDay.getTime(),
          })

          let milk = 0
          let nightMilk = 0
          let food = 0
          let sleepMinutes = 0
          let sleepCount = 0
          const gearEvents: { type: 'on' | 'off'; time: number }[] = []

          response.records.forEach((record) => {
            switch (record.category) {
              case 'food':
                if (record.subCategory === 'breast_milk' || record.subCategory === 'milk') {
                  const amount = parseInt(record.value || '0') || 0
                  milk += amount

                  // 判断是否为夜奶（晚上12点到早上6点）
                  const recordTime = new Date(record.startTime)
                  const hour = recordTime.getHours()
                  if (hour >= 0 && hour < 6) {
                    nightMilk += amount
                  }
                } else if (record.subCategory === 'babycook') {
                  food++
                }
                break
              case 'sleep':
                sleepMinutes += parseInt(record.value || '0') || 0
                sleepCount++
                break
              case 'other':
                if (record.subCategory === 'gear') {
                  const gearType = record.extra?.gear_type
                  if (gearType === '带上') {
                    gearEvents.push({ type: 'on', time: record.startTime })
                  } else if (gearType === '脱下') {
                    gearEvents.push({ type: 'off', time: record.startTime })
                  }
                }
                break
            }
          })

          // 获取前一天最后的护具状态
          const yesterdayStart = new Date(startOfDay)
          yesterdayStart.setDate(yesterdayStart.getDate() - 1)
          const yesterdayEnd = new Date(startOfDay)
          yesterdayEnd.setMilliseconds(-1)

          let yesterdayLastGearOn = false
          const yesterdayAllGear = await getRecords({
            babyId,
            limit: 1000,
            offset: 0,
            startDate: yesterdayStart.getTime(),
            endDate: yesterdayEnd.getTime(),
          })

          const yesterdayGearEvents = yesterdayAllGear.records
            .filter((r) => r.category === 'other' && r.subCategory === 'gear')
            .map((r) => ({
              type: (r.extra?.gear_type === '带上' ? 'on' : 'off') as 'on' | 'off',
              time: r.startTime,
            }))
            .sort((a, b) => a.time - b.time)

          if (yesterdayGearEvents.length > 0) {
            const lastEvent = yesterdayGearEvents[yesterdayGearEvents.length - 1]
            yesterdayLastGearOn = lastEvent.type === 'on'
          }

          // 排序今天的护具事件
          gearEvents.sort((a, b) => a.time - b.time)

          // 过滤连续相同操作
          const filteredGearEvents: { type: 'on' | 'off'; time: number }[] = []
          let lastType: 'on' | 'off' | null = yesterdayLastGearOn ? 'on' : null

          for (const event of gearEvents) {
            if (event.type !== lastType) {
              filteredGearEvents.push(event)
              lastType = event.type
            }
          }

          // 计算护具佩戴时长
          let totalGearMinutes = 0
          let lastOnTime: number | null = null

          if (yesterdayLastGearOn && filteredGearEvents.length > 0) {
            if (filteredGearEvents[0].type === 'off') {
              totalGearMinutes += (filteredGearEvents[0].time - startOfDay.getTime()) / (1000 * 60)
            } else {
              lastOnTime = filteredGearEvents[0].time
            }
            for (let j = 1; j < filteredGearEvents.length; j++) {
              const event = filteredGearEvents[j]
              if (event.type === 'on') {
                lastOnTime = event.time
              } else if (event.type === 'off' && lastOnTime !== null) {
                totalGearMinutes += (event.time - lastOnTime) / (1000 * 60)
                lastOnTime = null
              }
            }
          } else {
            filteredGearEvents.forEach((event) => {
              if (event.type === 'on') {
                lastOnTime = event.time
              } else if (event.type === 'off' && lastOnTime !== null) {
                totalGearMinutes += (event.time - lastOnTime) / (1000 * 60)
                lastOnTime = null
              }
            })
          }

          // 如果有未脱下的，计算到当天结束或当前时间
          if (lastOnTime !== null) {
            const isToday = dayjs(date).format('YYYY-MM-DD') === dayjs().format('YYYY-MM-DD')
            const endTime = isToday ? Date.now() : endOfDay.getTime()
            totalGearMinutes += (endTime - lastOnTime) / (1000 * 60)
          } else if (yesterdayLastGearOn && filteredGearEvents.length === 0) {
            const isToday = dayjs(date).format('YYYY-MM-DD') === dayjs().format('YYYY-MM-DD')
            const endTime = isToday ? Date.now() : endOfDay.getTime()
            totalGearMinutes += (endTime - startOfDay.getTime()) / (1000 * 60)
          }

          // 获取成长数据 - 身高和体重
          const growthRecords = response.records.filter(
            (r) => r.category === 'other' && r.subCategory === 'growth'
          )
          let height = 0
          let weight = 0
          growthRecords.forEach((r) => {
            if (r.extra?.growth_type === '身高') {
              height = parseFloat(r.value) || 0
            } else if (r.extra?.growth_type === '体重') {
              weight = parseFloat(r.value) || 0
            }
          })

          weekData.push({
            date: dateStr,
            milk,
            nightMilk,
            food,
            sleepMinutes,
            sleepCount,
            gearMinutes: totalGearMinutes,
            height,
            weight,
          })
        } catch (error) {
          console.error(`获取 ${dateStr} 数据失败:`, error)
          weekData.push({
            date: dateStr,
            milk: 0,
            nightMilk: 0,
            food: 0,
            sleepMinutes: 0,
            sleepCount: 0,
            gearMinutes: 0,
            height: 0,
            weight: 0,
          })
        }
      }

      setWeeklyData(weekData)
    } catch (error) {
      console.error('加载周数据失败:', error)
      setWeeklyData([])
    } finally {
      setChartLoading(false)
    }
  }

  async function handleSwitch(babyId: number) {
    if (babyId === currentBabyId) {
      // 如果点击的是当前宝宝，不做任何操作
      return
    }

    try {
      await switchBaby(babyId)
      // 清除首页缓存，强制重新加载新宝宝信息
      clearIndexCache()
      Taro.showToast({ title: '切换成功', icon: 'success' })
      // 刷新当前页面数据
      await loadBabies()
      // 切换到首页
      setTimeout(() => {
        Taro.switchTab({ url: '/pages/home/index' })
      }, 500)
    } catch (error) {
      console.error('切换失败:', error)
      Taro.showToast({ title: '切换失败', icon: 'none' })
    }
  }

  function handleAddBaby() {
    Taro.navigateTo({ url: '/pages/add-baby/index' })
  }

  function handleEdit(baby: Baby, e: any) {
    e.stopPropagation()

    // 检查权限
    if (baby.creatorId !== currentUserId) {
      Taro.showModal({
        title: '提示',
        content: '目前仅支持创建者编辑宝宝信息',
        showCancel: false,
        confirmText: '知道了',
      })
      return
    }

    // 将宝宝信息通过 URL 参数传递，避免重复请求
    const babyData = encodeURIComponent(
      JSON.stringify({
        id: baby.id,
        name: baby.name,
        gender: baby.gender,
        birthday: baby.birthday,
      }),
    )
    Taro.navigateTo({ url: `/pages/edit-baby/index?data=${babyData}` })
  }

  async function handleDelete(baby: Baby, e: any) {
    e.stopPropagation()

    // 检查权限
    if (baby.creatorId !== currentUserId) {
      Taro.showModal({
        title: '提示',
        content: '目前仅支持创建者删除宝宝',
        showCancel: false,
        confirmText: '知道了',
      })
      return
    }

    const res = await Taro.showModal({
      title: '确认删除',
      content: `确定要删除宝宝"${baby.name}"吗？删除后所有相关记录将被清空且无法恢复。`,
      confirmText: '删除',
      cancelText: '取消',
      confirmColor: '#ff4d4f',
    })

    if (!res.confirm) return

    try {
      Taro.showLoading({ title: '删除中...' })
      await deleteBaby(baby.id)
      // 清除首页缓存
      clearIndexCache()
      Taro.hideLoading()
      Taro.showToast({ title: '删除成功', icon: 'success' })
      await loadBabies()

      // 如果删除的是当前选中的宝宝，重新加载页面
      if (baby.id === currentBabyId) {
        setTimeout(() => {
          Taro.switchTab({ url: '/pages/home/index' })
        }, 500)
      }
    } catch (error: any) {
      Taro.hideLoading()
      Taro.showToast({
        title: error.message || '删除失败',
        icon: 'none',
      })
    }
  }

  function getAge(birthday: number): string {
    const now = dayjs()
    const birthDate = dayjs(birthday)
    const days = now.diff(birthDate, 'day')

    if (days < 30) {
      return `${days}天`
    } else if (days < 365) {
      const months = Math.floor(days / 30)
      return `${months}个月`
    } else {
      const years = Math.floor(days / 365)
      const months = Math.floor((days % 365) / 30)
      return `${years}岁${months > 0 ? months + '个月' : ''}`
    }
  }

  function handleViewMembers(baby: Baby, e: any) {
    e.stopPropagation()
    setSelectedBaby(baby)
    setShowMembersModal(true)
  }

  async function handleDeleteMember(member: any, e: any) {
    e.stopPropagation()

    if (!selectedBaby) return

    // 检查权限：只有创建者可以删除成员
    if (selectedBaby.creatorId !== currentUserId) {
      Taro.showModal({
        title: '提示',
        content: '仅宝宝创建者有删除权限',
        showCancel: false,
        confirmText: '知道了',
      })
      return
    }

    // 二次确认
    const res = await Taro.showModal({
      title: '确认删除',
      content: `确定要删除成员"${member.nickname}"吗？`,
      confirmText: '删除',
      cancelText: '取消',
      confirmColor: '#ff4d4f',
    })

    if (!res.confirm) return

    try {
      Taro.showLoading({ title: '删除中...' })
      await deleteBabyMember(selectedBaby.id, member.userId)
      Taro.hideLoading()
      Taro.showToast({ title: '删除成功', icon: 'success' })
      
      // 刷新宝宝列表
      await loadBabies()
      
      // 更新弹窗中的宝宝信息
      const updatedBabies = await getBabies()
      const updatedBaby = updatedBabies.find((b) => b.id === selectedBaby.id)
      if (updatedBaby) {
        setSelectedBaby(updatedBaby)
      } else {
        // 如果宝宝不存在了（可能被删除），关闭弹窗
        setShowMembersModal(false)
      }
    } catch (error: any) {
      Taro.hideLoading()
      Taro.showToast({
        title: error.message || '删除失败',
        icon: 'none',
      })
    }
  }

  // 打开日历
  function handleOpenCalendar() {
    setShowCalendar(true)
  }

  // 确认选择日期
  function handleConfirmDate(date: Date) {
    setSelectedDate(date)
    setShowCalendar(false)
    if (currentBabyId) {
      loadTodayStats(currentBabyId, date)
    }
  }

  // 取消选择日期
  function handleCancelCalendar() {
    setShowCalendar(false)
  }

  return (
    <View className='page-container baby-info-page'>
      {loading ? (
        <View className='loading-container'>
          <Text>加载中...</Text>
        </View>
      ) : (
        <>
          {babies.length === 0 ? (
            <View className='empty-state'>
              <Text className='empty-icon'>👶</Text>
              <Text className='empty-title'>还没有宝宝信息</Text>
              <Text className='empty-subtitle'>点击下方按钮添加第一个宝宝</Text>
            </View>
          ) : (
            <View className='baby-list'>
              {babies.map((baby) => (
                <View
                  key={baby.id}
                  className={`baby-card ${
                    babies.length > 1 && baby.id === currentBabyId ? 'active' : ''
                  }`}
                >
                  {/* 左上角当前标签，仅在宝宝数量 > 1 时显示 */}
                  {babies.length > 1 && baby.id === currentBabyId && (
                    <View className='current-badge'>
                      <Text>当前</Text>
                    </View>
                  )}

                  <View className='baby-content' onClick={() => handleSwitch(baby.id)}>
                    <View className='baby-avatar'>{baby.gender === 'male' ? '👦' : '👧'}</View>
                    <View className='baby-info'>
                      {/* 第一行：名字 + 成员按钮 */}
                      <View className='baby-row'>
                        <Text className='baby-name'>{baby.name}</Text>
                        <View
                          className='action-btn'
                          onClick={(e) => {
                            e.stopPropagation()
                            handleViewMembers(baby, e)
                          }}
                        >
                          <Text className='action-text'>{baby.memberIds?.length || 0}位成员</Text>
                        </View>
                      </View>
                      {/* 第二行：年龄 + 编辑和删除按钮 */}
                      <View className='baby-row'>
                        <Text className='baby-age'>{getAge(baby.birthday)}</Text>
                        <View className='actions-row' onClick={(e) => e.stopPropagation()}>
                          <View className='action-btn' onClick={(e) => handleEdit(baby, e)}>
                            <Text className='action-text'>编辑</Text>
                          </View>
                          <View
                            className='action-btn delete'
                            onClick={(e) => handleDelete(baby, e)}
                          >
                            <Text className='action-text'>删除</Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* 今日统计 */}
          {currentBabyId && (
            <View className='today-stats-section'>
              <View className='stats-header'>
                <View className='stats-header-top'>
                  <View className='stats-title-wrapper'>
                    <Text className='stats-title'>
                      {dayjs(selectedDate).format('YYYY-MM-DD') === dayjs().format('YYYY-MM-DD')
                        ? '今日概况'
                        : '当日概况'}
                    </Text>
                    {statsLoading && <LoadingSpinner size='small' color='#999' />}
                  </View>
                  <View className='stats-date-wrapper'>
                    <View className='stats-date-picker' onClick={handleOpenCalendar}>
                      <Text className='stats-date'>{dayjs(selectedDate).format('YYYY.MM.DD')}</Text>
                      <Text className='date-arrow'>▼</Text>
                    </View>
                    {dayjs(selectedDate).format('YYYY-MM-DD') !== dayjs().format('YYYY-MM-DD') && (
                      <View
                        className='back-to-today-btn'
                        onClick={() => {
                          setSelectedDate(new Date())
                          if (currentBabyId) {
                            loadTodayStats(currentBabyId, new Date())
                          }
                        }}
                      >
                        <Text className='back-to-today-text'>回到今天</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
              <View className='stats-content'>
                {!todayStats && !statsLoading && <Text className='stat-empty'>暂无数据</Text>}

                {!todayStats && statsLoading && <Text className='stat-empty'>加载中...</Text>}

                {todayStats && (
                  <>
                    {/* 吃 */}
                    {(todayStats.milk > 0 || todayStats.food > 0) && (
                      <View className='stat-item'>
                        <Text className='stat-label' style={{ color: '#FF9500' }}>
                          吃
                        </Text>
                        <View className='stat-value-wrapper'>
                          {todayStats.milk > 0 && (
                            <>
                              <Text className='stat-value'>{todayStats.milk} ml 奶</Text>
                              {todayStats.nightMilkCount > 0 ? (
                                <Text className='stat-value'>
                                  (
                                  <Text
                                    className='night-milk-link'
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      Taro.showModal({
                                        title: '夜奶说明',
                                        content: '夜奶指的是晚上12点到早上6点期间的喂奶记录',
                                        showCancel: false,
                                        confirmText: '知道了',
                                      })
                                    }}
                                  >
                                    夜奶
                                  </Text>
                                  {` ${todayStats.nightMilkCount} 次)`}
                                </Text>
                              ) : (
                                <Text className='stat-value'>
                                  (无
                                  <Text
                                    className='night-milk-link'
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      Taro.showModal({
                                        title: '夜奶说明',
                                        content: '夜奶指的是晚上12点到早上6点期间的喂奶记录',
                                        showCancel: false,
                                        confirmText: '知道了',
                                      })
                                    }}
                                  >
                                    夜奶
                                  </Text>
                                  )
                                </Text>
                              )}
                            </>
                          )}
                          {todayStats.milk > 0 && todayStats.food > 0 && (
                            <Text className='stat-value'>，</Text>
                          )}
                          {todayStats.food > 0 && (
                            <Text className='stat-value'>辅食 {todayStats.food} 顿</Text>
                          )}
                        </View>
                      </View>
                    )}

                    {/* 睡 */}
                    {todayStats.sleep > 0 && (
                      <View className='stat-item'>
                        <Text className='stat-label' style={{ color: '#5B8DEF' }}>
                          睡
                        </Text>
                        <Text className='stat-value'>
                          {todayStats.sleep} 次，共 {Math.floor(todayStats.sleepMinutes / 60)} 时{' '}
                          {todayStats.sleepMinutes % 60} 分
                        </Text>
                      </View>
                    )}

                    {/* 拉 */}
                    {(todayStats.diaper > 0 || todayStats.poop > 0) && (
                      <View className='stat-item'>
                        <Text className='stat-label' style={{ color: '#8B6E5B' }}>
                          拉
                        </Text>
                        <Text className='stat-value'>
                          {todayStats.diaper > 0 && `换尿片 ${todayStats.diaper} 次`}
                          {todayStats.diaper > 0 && todayStats.poop > 0 && '，'}
                          {todayStats.poop > 0 && `大便 ${todayStats.poop} 次`}
                        </Text>
                      </View>
                    )}

                    {/* 其他 */}
                    {(todayStats.outdoor > 0 ||
                      todayStats.tonic > 0 ||
                      todayStats.cry > 0 ||
                      todayStats.gearHours > 0) && (
                      <View className='stat-item'>
                        <Text className='stat-label' style={{ color: '#4CAF7D' }}>
                          其他
                        </Text>
                        <Text className='stat-value'>
                          {todayStats.outdoor > 0 && `户外 ${todayStats.outdoor} 次`}
                          {todayStats.outdoor > 0 &&
                            (todayStats.tonic > 0 ||
                              todayStats.cry > 0 ||
                              todayStats.gearHours > 0) &&
                            '，'}
                          {todayStats.tonic > 0 && `补剂 ${todayStats.tonic} 次`}
                          {todayStats.tonic > 0 &&
                            (todayStats.cry > 0 || todayStats.gearHours > 0) &&
                            '，'}
                          {todayStats.cry > 0 && `哭闹 ${todayStats.cry} 次`}
                          {todayStats.cry > 0 && todayStats.gearHours > 0 && '，'}
                          {todayStats.gearHours > 0 && `护具 ${todayStats.gearHours} 小时`}
                        </Text>
                      </View>
                    )}

                    {/* 无数据提示 */}
                    {todayStats.milk === 0 &&
                      todayStats.food === 0 &&
                      todayStats.sleep === 0 &&
                      todayStats.shit === 0 &&
                      todayStats.outdoor === 0 &&
                      todayStats.tonic === 0 &&
                      todayStats.cry === 0 &&
                      todayStats.gearHours === 0 && (
                        <Text className='stat-empty'>当天没有任何记录</Text>
                      )}
                  </>
                )}
              </View>
            </View>
          )}

          {/* 图表 */}
          {currentBabyId && (
            <View className='chart-section'>
              {chartLoading ? (
                <View className='chart-loading'>
                  <LoadingSpinner size='large' />
                  <Text className='loading-hint'>加载图表数据中...</Text>
                </View>
              ) : (
                <WeeklyChart data={weeklyData} />
              )}
            </View>
          )}

          {/* 添加新宝宝链接 */}
          <View className='add-baby-link' onClick={handleAddBaby}>
            <Text className='add-baby-link-text'>+ 添加新宝宝</Text>
          </View>
        </>
      )}

      {/* 成员列表弹窗 */}
      {showMembersModal && selectedBaby && (
        <View className='modal-overlay' onClick={() => setShowMembersModal(false)}>
          <View className='members-modal' onClick={(e) => e.stopPropagation()}>
            <View className='modal-header'>
              <Text className='modal-title'>{selectedBaby.name} 的成员</Text>
              <View className='close-btn' onClick={() => setShowMembersModal(false)}>
                <Text>✕</Text>
              </View>
            </View>
            <View className='members-list'>
              {selectedBaby.members && selectedBaby.members.length > 0 ? (
                selectedBaby.members.map((member) => (
                  <View key={member.userId} className='member-item'>
                    <View className='member-info'>
                      <Text className='member-name'>{member.nickname}</Text>
                      <Text className='member-role'>{member.role}</Text>
                    </View>
                    <View
                      className={`delete-member-btn ${
                        selectedBaby.creatorId !== currentUserId ? 'disabled' : ''
                      }`}
                      onClick={(e) => {
                        if (selectedBaby.creatorId === currentUserId) {
                          handleDeleteMember(member, e)
                        }
                      }}
                    >
                      <Text className='delete-member-text'>删除</Text>
                    </View>
                  </View>
                ))
              ) : (
                <View className='empty-members'>
                  <Text>暂无成员信息</Text>
                </View>
              )}
            </View>
            <View className='modal-footer'>
              <Button className='invite-btn' openType='share'>
                邀请成员
              </Button>
              <Text className='permission-hint'>仅宝宝创建者有删除权限</Text>
            </View>
          </View>
        </View>
      )}

      {/* 日历组件 */}
      {showCalendar && (
        <Calendar
          visible={showCalendar}
          value={selectedDate}
          maxDate={new Date()}
          onConfirm={handleConfirmDate}
          onCancel={handleCancelCalendar}
        />
      )}
    </View>
  )
}
