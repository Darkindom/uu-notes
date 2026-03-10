import { View, Text, Button, Picker } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useState } from 'react'
import { joinBaby } from '../../utils/api'
import { clearIndexCache } from '../../utils/cache'
import './index.less'

const ROLES = ['妈妈', '爸爸', '奶奶', '爷爷', '外婆', '外公', '其他']

export default function JoinBabyPage() {
  const [loading, setLoading] = useState(false)
  const [role, setRole] = useState('妈妈')
  const [roleIdx, setRoleIdx] = useState(0)
  const [babyId, setBabyId] = useState<number | null>(null)

  useLoad(async (options) => {
    // 从 URL 参数或本地存储获取邀请的 babyId
    const inviteBabyId = options?.babyId || Taro.getStorageSync('invite_baby_id')
    
    if (!inviteBabyId) {
      Taro.showToast({ title: '邀请链接无效', icon: 'none' })
      setTimeout(() => {
        Taro.redirectTo({ url: '/pages/add-baby/index' })
      }, 1500)
      return
    }
    
    setBabyId(parseInt(inviteBabyId))
    console.log('📨 加入宝宝 ID:', inviteBabyId)
  })

  async function handleSubmit() {
    if (!babyId) {
      Taro.showToast({ title: '邀请链接无效', icon: 'none' })
      return
    }

    setLoading(true)
    try {
      await joinBaby(babyId, role)
      
      // 清除本地存储的邀请参数
      Taro.removeStorageSync('invite_baby_id')
      
      // 清除首页缓存，强制重新加载新宝宝信息
      clearIndexCache()
      
      Taro.showToast({ title: '加入成功！', icon: 'success' })
      setTimeout(() => {
        Taro.switchTab({ url: '/pages/home/index' })
      }, 1500)
    } catch (error: any) {
      console.error('加入失败:', error)
      Taro.showToast({ 
        title: error.message || '加入失败，请重试', 
        icon: 'none' 
      })
    } finally {
      setLoading(false)
    }
  }

  function handleCancel() {
    // 清除本地存储的邀请参数
    Taro.removeStorageSync('invite_baby_id')
    Taro.redirectTo({ url: '/pages/add-baby/index' })
  }

  return (
    <View className='page-container join-baby-page'>
      <View className='main-card'>
        <View className='welcome-section'>
          <Text className='welcome-title'>🎉 加入宝宝</Text>
          <Text className='welcome-subtitle'>您收到了一个邀请，请选择您与宝宝的关系</Text>
        </View>

        <View className='section'>
          <Text className='field-label'>👨‍👩‍👧 您与宝宝的关系</Text>
          <Picker
            mode='selector'
            range={ROLES}
            value={roleIdx}
            onChange={e => {
              const idx = parseInt(String(e.detail.value))
              setRoleIdx(idx)
              setRole(ROLES[idx])
            }}
          >
            <View className='picker-display'>{role}</View>
          </Picker>
        </View>

        <View className='button-row'>
          <Button className='back-btn' onClick={handleCancel}>
            取消
          </Button>
          <Button
            className='submit-btn'
            onClick={handleSubmit}
            loading={loading}
          >
            加入
          </Button>
        </View>
      </View>
    </View>
  )
}
