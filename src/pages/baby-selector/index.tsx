import { View, Text, Button } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useState } from 'react'
import { getUserBabies, switchBaby, getCurrentUser, deleteBaby, type Baby } from '../../utils/db'
import './index.less'

export default function BabySelectorPage() {
  const [babies, setBabies] = useState<Baby[]>([])
  const [currentBabyId, setCurrentBabyId] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useLoad(async () => {
    await loadBabies()
  })

  async function loadBabies() {
    setLoading(true)
    try {
      const [babyList, user] = await Promise.all([
        getUserBabies(),
        getCurrentUser()
      ])
      setBabies(babyList)
      setCurrentBabyId(user?.currentBabyId || '')
    } catch (error) {
      console.error('加载宝宝列表失败:', error)
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  async function handleSwitch(babyId: string) {
    if (babyId === currentBabyId) {
      // 如果点击的是当前宝宝，不做任何操作
      return
    }

    try {
      await switchBaby(babyId)
      Taro.showToast({ title: '切换成功', icon: 'success' })
      // 刷新当前页面数据
      await loadBabies()
      // 切换到首页
      setTimeout(() => {
        Taro.switchTab({ url: '/pages/index/index' })
      }, 500)
    } catch (error) {
      console.error('切换失败:', error)
      Taro.showToast({ title: '切换失败', icon: 'none' })
    }
  }

  function handleAddBaby() {
    Taro.navigateTo({ url: '/pages/add-baby/index' })
  }

  async function handleDelete(babyId: string, babyName: string, e: any) {
    e.stopPropagation()
    
    const res = await Taro.showModal({
      title: '确认删除',
      content: `确定要删除宝宝"${babyName}"吗？删除后所有相关记录将被清空且无法恢复。`,
      confirmText: '删除',
      cancelText: '取消',
      confirmColor: '#ff4d4f'
    })

    if (!res.confirm) return

    try {
      Taro.showLoading({ title: '删除中...' })
      await deleteBaby(babyId)
      Taro.hideLoading()
      Taro.showToast({ title: '删除成功', icon: 'success' })
      await loadBabies()
      
      // 如果删除的是当前选中的宝宝，重新加载页面
      if (babyId === currentBabyId) {
        setTimeout(() => {
          Taro.reLaunch({ url: '/pages/index/index' })
        }, 500)
      }
    } catch (error: any) {
      Taro.hideLoading()
      Taro.showToast({ 
        title: error.message || '删除失败', 
        icon: 'none' 
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
                  key={baby._id}
                  className={`baby-card ${baby._id === currentBabyId ? 'active' : ''}`}
                >
                  <View className='baby-content' onClick={() => handleSwitch(baby._id)}>
                    <View className='baby-avatar'>
                      {baby.gender === 'male' ? '👦' : '👧'}
                    </View>
                    <View className='baby-info'>
                      <Text className='baby-name'>{baby.name}</Text>
                      <Text className='baby-age'>{getAge(baby.birthday)}</Text>
                      <Text className='baby-members'>{baby.members.length} 位成员</Text>
                    </View>
                    {baby._id === currentBabyId && (
                      <View className='current-badge'>
                        <Text>当前</Text>
                      </View>
                    )}
                  </View>
                  <View className='baby-actions'>
                    <Button 
                      className='delete-btn' 
                      size='mini'
                      onClick={(e) => handleDelete(baby._id, baby.name, e)}
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
        </>
      )}
    </View>
  )
}
