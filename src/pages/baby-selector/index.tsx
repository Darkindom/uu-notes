import { View, Text, Button } from '@tarojs/components'
import Taro, { useLoad, useShareAppMessage, useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import {
  getBabies,
  switchBaby,
  getCurrentUser,
  deleteBaby,
  getRecords,
  type Baby,
} from '../../utils/api'
import { clearIndexCache } from '../../utils/cache'
import './index.less'

interface TodayStats {
  milk: number // 奶量 ml
  food: number // 辅食次数
  sleep: number // 睡眠次数
  sleepMinutes: number // 睡眠总分钟数
  shit: number // 排便次数
  outdoor: number // 户外次数
  tonic: number // 补剂次数
  cry: number // 哭闹次数
  gearHours: number // 护具佩戴小时数
}

export default function BabySelectorPage() {
  const [babies, setBabies] = useState<Baby[]>([])
  const [currentBabyId, setCurrentBabyId] = useState<number | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [showMembersModal, setShowMembersModal] = useState(false)
  const [selectedBaby, setSelectedBaby] = useState<Baby | null>(null)
  const [todayStats, setTodayStats] = useState<TodayStats | null>(null)

  useLoad(async () => {
    await loadBabies()
  })

  useDidShow(async () => {
    // 每次显示页面时刷新统计数据
    if (currentBabyId) {
      await loadTodayStats(currentBabyId)
    }
  })

  useShareAppMessage(() => {
    if (!selectedBaby) {
      return {
        title: '宝宝成长记录',
        path: '/pages/home/index',
      }
    }
    return {
      title: `邀请你加入「${selectedBaby.name}」的成长记录`,
      path: `/pages/home/index?babyId=${selectedBaby.id}&inviteFrom=share`,
    }
  })

  async function loadBabies() {
    setLoading(true)
    try {
      const [babyList, user] = await Promise.all([getBabies(), getCurrentUser()])
      setBabies(babyList)
      setCurrentBabyId(user?.currentBabyId)

      // 加载当前宝宝的今日统计
      if (user?.currentBabyId) {
        await loadTodayStats(user.currentBabyId)
      }
    } catch (error) {
      console.error('加载宝宝列表失败:', error)
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  async function loadTodayStats(babyId: number) {
    try {
      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date()
      endOfDay.setHours(23, 59, 59, 999)

      // 使用日期范围参数获取今天的所有记录
      const response = await getRecords({
        babyId,
        limit: 1000,
        offset: 0,
        startDate: startOfDay.getTime(),
        endDate: endOfDay.getTime(),
      })
      const todayRecords = response.records

      const stats: TodayStats = {
        milk: 0,
        food: 0,
        sleep: 0,
        sleepMinutes: 0,
        shit: 0,
        outdoor: 0,
        tonic: 0,
        cry: 0,
        gearHours: 0,
      }

      // 用于计算护具佩戴时间
      const gearEvents: { type: 'on' | 'off'; time: number }[] = []

      todayRecords.forEach((record) => {
        switch (record.category) {
          case 'food':
            if (record.subCategory === 'breast_milk' || record.subCategory === 'milk') {
              // 统计奶量
              stats.milk += parseInt(record.value || '0') || 0
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

      // 计算护具佩戴时长
      gearEvents.sort((a, b) => a.time - b.time)
      let totalGearMinutes = 0
      let lastOnTime: number | null = null

      gearEvents.forEach((event) => {
        if (event.type === 'on') {
          lastOnTime = event.time
        } else if (event.type === 'off' && lastOnTime !== null) {
          totalGearMinutes += (event.time - lastOnTime) / (1000 * 60)
          lastOnTime = null
        }
      })

      // 如果有未脱下的，计算到当前时间
      if (lastOnTime !== null) {
        totalGearMinutes += (Date.now() - lastOnTime) / (1000 * 60)
      }

      stats.gearHours = Math.round((totalGearMinutes / 60) * 10) / 10 // 保留1位小数

      setTodayStats(stats)
    } catch (error) {
      console.error('加载今日统计失败:', error)
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

  async function handleDelete(babyId: number, babyName: string, e: any) {
    e.stopPropagation()

    const res = await Taro.showModal({
      title: '确认删除',
      content: `确定要删除宝宝"${babyName}"吗？删除后所有相关记录将被清空且无法恢复。`,
      confirmText: '删除',
      cancelText: '取消',
      confirmColor: '#ff4d4f',
    })

    if (!res.confirm) return

    try {
      Taro.showLoading({ title: '删除中...' })
      await deleteBaby(babyId)
      // 清除首页缓存
      clearIndexCache()
      Taro.hideLoading()
      Taro.showToast({ title: '删除成功', icon: 'success' })
      await loadBabies()

      // 如果删除的是当前选中的宝宝，重新加载页面
      if (babyId === currentBabyId) {
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
    const now = Date.now()
    const diff = now - birthday
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

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

  return (
    <View className='page-container baby-selector-page'>
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
                  className={`baby-card ${baby.id === currentBabyId ? 'active' : ''}`}
                >
                  <View className='baby-content' onClick={() => handleSwitch(baby.id)}>
                    <View className='baby-avatar'>{baby.gender === 'male' ? '👦' : '👧'}</View>
                    <View className='baby-info'>
                      <Text className='baby-name'>{baby.name}</Text>
                      <Text className='baby-age'>{getAge(baby.birthday)}</Text>
                      <Text className='baby-members'>{baby.memberIds?.length || 0} 位成员</Text>
                    </View>
                    {baby.id === currentBabyId && (
                      <View className='current-badge'>
                        <Text>当前</Text>
                      </View>
                    )}
                  </View>
                  <View className='baby-actions'>
                    <Button
                      className='view-members-btn'
                      size='mini'
                      onClick={(e) => handleViewMembers(baby, e)}
                    >
                      查看成员
                    </Button>
                    <Button
                      className='delete-btn'
                      size='mini'
                      onClick={(e) => handleDelete(baby.id, baby.name, e)}
                    >
                      删除
                    </Button>
                  </View>
                </View>
              ))}
            </View>
          )}

          <Button className='add-baby-btn' onClick={handleAddBaby}>
            + 添加新宝宝
          </Button>

          {/* 今日统计 */}
          {todayStats && currentBabyId && (
            <View className='today-stats-section'>
              <View className='stats-header'>
                <Text className='stats-title'>今日概况</Text>
                <Text className='stats-date'>{new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}</Text>
              </View>
              <View className='stats-content'>
                {/* 吃 */}
                {(todayStats.milk > 0 || todayStats.food > 0) && (
                  <View className='stat-item'>
                    <Text className='stat-label' style={{ color: '#FF9500' }}>吃</Text>
                    <Text className='stat-value'>
                      {todayStats.milk > 0 && `${todayStats.milk} ml 奶`}
                      {todayStats.milk > 0 && todayStats.food > 0 && '，'}
                      {todayStats.food > 0 && `${todayStats.food} 顿辅食`}
                    </Text>
                  </View>
                )}

                {/* 睡 */}
                {todayStats.sleep > 0 && (
                  <View className='stat-item'>
                    <Text className='stat-label' style={{ color: '#5B8DEF' }}>睡</Text>
                    <Text className='stat-value'>
                      {todayStats.sleep} 次，共 {Math.floor(todayStats.sleepMinutes / 60)} 时{' '}
                      {todayStats.sleepMinutes % 60} 分
                    </Text>
                  </View>
                )}

                {/* 拉 */}
                {todayStats.shit > 0 && (
                  <View className='stat-item'>
                    <Text className='stat-label' style={{ color: '#8B6E5B' }}>拉</Text>
                    <Text className='stat-value'>{todayStats.shit} 次</Text>
                  </View>
                )}

                {/* 其他 */}
                {(todayStats.outdoor > 0 ||
                  todayStats.tonic > 0 ||
                  todayStats.cry > 0 ||
                  todayStats.gearHours > 0) && (
                  <View className='stat-item'>
                    <Text className='stat-label' style={{ color: '#4CAF7D' }}>其他</Text>
                    <Text className='stat-value'>
                      {todayStats.outdoor > 0 && `户外 ${todayStats.outdoor} 次`}
                      {todayStats.outdoor > 0 &&
                        (todayStats.tonic > 0 || todayStats.cry > 0 || todayStats.gearHours > 0) &&
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
                    <Text className='stat-empty'>今天还没有任何记录</Text>
                  )}
              </View>
            </View>
          )}

          <View className='coming-soon-section'>
            <Text className='coming-soon-text'>图表功能开发中...</Text>
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
                    <View className='member-icon'>👤</View>
                    <View className='member-info'>
                      <Text className='member-name'>{member.nickname}</Text>
                      <Text className='member-role'>{member.role}</Text>
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
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
