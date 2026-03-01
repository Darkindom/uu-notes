import { View, Text, Input, Button, Picker } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useState } from 'react'
// 已迁移到自建后端 API
import { createBaby } from '../../utils/api'
// import { createBaby, getCurrentUser } from '../../utils/db' // 云开发已废弃
import { clearIndexCache } from '../../utils/cache'
import './index.less'

const ROLES = ['妈妈', '爸爸', '奶奶', '爷爷', '外婆', '外公', '其他']

export default function AddBabyPage() {
  const [loading, setLoading] = useState(false)
  const [role, setRole] = useState('妈妈')
  const [roleIdx, setRoleIdx] = useState(0)
  
  const [babyName, setBabyName] = useState('')
  const [gender, setGender] = useState<'male' | 'female'>('male')
  const [birthday, setBirthday] = useState('')

  useLoad(async () => {
    // 不需要获取用户昵称，API 不使用该字段
  })

  async function handleSubmit() {
    if (!babyName.trim()) {
      Taro.showToast({ title: '请输入宝宝姓名', icon: 'none' })
      return
    }
    if (!birthday) {
      Taro.showToast({ title: '请选择宝宝生日', icon: 'none' })
      return
    }

    setLoading(true)
    try {
      const baby = await createBaby({
        name: babyName,
        gender,
        birthday: new Date(birthday).getTime(),
        role,
      })
      
      if (!baby) {
        throw new Error('创建宝宝信息失败')
      }

      // 清除首页缓存，强制重新加载新宝宝信息
      clearIndexCache()
      Taro.showToast({ title: '添加成功！', icon: 'success' })
      setTimeout(() => {
        Taro.switchTab({ url: '/pages/home/index' })
      }, 1500)
    } catch (error) {
      console.error('添加失败:', error)
      Taro.showToast({ title: '添加失败，请重试', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className='page-container add-baby-page'>
      <View className='main-card'>
        <View className='welcome-section'>
          <Text className='welcome-title'>🍼 添加新宝宝</Text>
          <Text className='welcome-subtitle'>请填写宝宝的基本信息</Text>
        </View>

        <View className='section'>
          <Text className='field-label'>👶 宝宝姓名</Text>
          <Input
            className='text-input'
            placeholder='请输入宝宝姓名'
            value={babyName}
            onInput={e => setBabyName(e.detail.value)}
          />
        </View>

        <View className='section'>
          <Text className='field-label'>⚥ 性别</Text>
          <View className='options-row'>
            <View
              className={`option-chip ${gender === 'male' ? 'active' : ''}`}
              onClick={() => setGender('male')}
            >
              <Text>男宝</Text>
            </View>
            <View
              className={`option-chip ${gender === 'female' ? 'active' : ''}`}
              onClick={() => setGender('female')}
            >
              <Text>女宝</Text>
            </View>
          </View>
        </View>

        <View className='section'>
          <Text className='field-label'>🎂 生日</Text>
          <Picker
            mode='date'
            value={birthday}
            end={new Date().toISOString().split('T')[0]}
            onChange={e => setBirthday(e.detail.value)}
          >
            <View className='picker-display'>
              {birthday || '请选择生日'}
            </View>
          </Picker>
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
          <Button className='back-btn' onClick={() => Taro.navigateBack()}>
            取消
          </Button>
          <Button
            className='submit-btn'
            onClick={handleSubmit}
            loading={loading}
          >
            完成
          </Button>
        </View>
      </View>
    </View>
  )
}
