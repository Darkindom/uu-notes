import { View, Text, Input, Button, Picker } from '@tarojs/components'
import Taro, { useLoad, useRouter } from '@tarojs/taro'
import { useState } from 'react'
import { updateBaby, getBabies, getCurrentUser } from '../../utils/api'
import { clearIndexCache } from '../../utils/cache'
import './index.less'

export default function EditBabyPage() {
  const router = useRouter()
  const babyId = router.params.id ? parseInt(router.params.id) : null
  
  const [loading, setLoading] = useState(false)
  const [babyName, setBabyName] = useState('')
  const [gender, setGender] = useState<'male' | 'female'>('male')
  const [birthday, setBirthday] = useState('')

  useLoad(async () => {
    if (!babyId) {
      Taro.showToast({ title: '参数错误', icon: 'none' })
      setTimeout(() => Taro.navigateBack(), 1000)
      return
    }

    try {
      const babies = await getBabies()
      const baby = babies.find(b => b.id === babyId)
      
      if (!baby) {
        Taro.showToast({ title: '宝宝不存在', icon: 'none' })
        setTimeout(() => Taro.navigateBack(), 1000)
        return
      }

      setBabyName(baby.name)
      setGender(baby.gender as 'male' | 'female')
      const birthDate = new Date(baby.birthday)
      setBirthday(`${birthDate.getFullYear()}-${String(birthDate.getMonth() + 1).padStart(2, '0')}-${String(birthDate.getDate()).padStart(2, '0')}`)
    } catch (error) {
      console.error('加载宝宝信息失败:', error)
      Taro.showToast({ title: '加载失败', icon: 'none' })
    }
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
      await updateBaby(babyId!, {
        name: babyName,
        gender,
        birthday: new Date(birthday).getTime(),
      })
      
      // 清除首页缓存，强制重新加载新宝宝信息
      clearIndexCache()
      Taro.showToast({ title: '更新成功！', icon: 'success' })
      setTimeout(() => {
        Taro.navigateBack()
      }, 1500)
    } catch (error: any) {
      console.error('更新失败:', error)
      Taro.showToast({ title: error.message || '更新失败，请重试', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className='page-container edit-baby-page'>
      <View className='main-card'>
        <View className='welcome-section'>
          <Text className='welcome-title'>✏️ 编辑宝宝信息</Text>
          <Text className='welcome-subtitle'>修改宝宝的基本信息</Text>
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

        <View className='button-row'>
          <Button className='back-btn' onClick={() => Taro.navigateBack()}>
            取消
          </Button>
          <Button
            className='submit-btn'
            onClick={handleSubmit}
            loading={loading}
          >
            保存
          </Button>
        </View>
      </View>
    </View>
  )
}
