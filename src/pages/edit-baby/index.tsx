import { View, Text, Input, Button, Picker } from '@tarojs/components'
import Taro, { useLoad, useRouter } from '@tarojs/taro'
import { useState } from 'react'
import { updateBaby, updateBabyMemberRole, getCurrentUser, getBabies, type Baby } from '../../utils/api'
import { clearIndexCache } from '../../utils/cache'
import './index.less'

const ROLES = ['妈妈', '爸爸', '奶奶', '爷爷', '外婆', '外公', '其他']

export default function EditBabyPage() {
  const router = useRouter()
  const [babyId, setBabyId] = useState<number | null>(null)
  const [currentUserId, setCurrentUserId] = useState<number | null>(null)
  
  const [loading, setLoading] = useState(false)
  const [babyName, setBabyName] = useState('')
  const [gender, setGender] = useState<'male' | 'female'>('male')
  const [birthday, setBirthday] = useState('')
  const [role, setRole] = useState('妈妈')
  const [roleIdx, setRoleIdx] = useState(0)

  useLoad(async () => {
    try {
      // 获取当前用户信息
      const user = await getCurrentUser()
      setCurrentUserId(user.id)

      // 从 URL 参数中获取宝宝数据
      const dataParam = router.params.data
      if (!dataParam) {
        Taro.showToast({ title: '参数错误', icon: 'none' })
        setTimeout(() => Taro.navigateBack(), 1000)
        return
      }

      const babyData = JSON.parse(decodeURIComponent(dataParam))
      
      if (!babyData.id) {
        Taro.showToast({ title: '参数错误', icon: 'none' })
        setTimeout(() => Taro.navigateBack(), 1000)
        return
      }

      // 直接使用传递过来的数据，无需再次请求
      setBabyId(babyData.id)
      setBabyName(babyData.name)
      setGender(babyData.gender as 'male' | 'female')
      const birthDate = new Date(babyData.birthday)
      setBirthday(`${birthDate.getFullYear()}-${String(birthDate.getMonth() + 1).padStart(2, '0')}-${String(birthDate.getDate()).padStart(2, '0')}`)

      // 获取当前用户在该宝宝中的角色
      const babies = await getBabies()
      const currentBaby = babies.find((b) => b.id === babyData.id)
      if (currentBaby && currentBaby.members) {
        const currentMember = currentBaby.members.find((m) => m.userId === user.id)
        if (currentMember && currentMember.role) {
          setRole(currentMember.role)
          const idx = ROLES.indexOf(currentMember.role)
          setRoleIdx(idx >= 0 ? idx : 0)
        }
      }
    } catch (error) {
      console.error('加载宝宝信息失败:', error)
      Taro.showToast({ title: '数据解析失败', icon: 'none' })
      setTimeout(() => Taro.navigateBack(), 1000)
    }
  })

  async function handleSubmit() {
    if (!babyId || !currentUserId) {
      Taro.showToast({ title: '宝宝信息加载失败', icon: 'none' })
      return
    }
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
      // 更新宝宝基本信息
      await updateBaby(babyId, {
        name: babyName,
        gender,
        birthday: new Date(birthday).getTime(),
      })
      
      // 更新当前用户的角色
      await updateBabyMemberRole(babyId, currentUserId, role)
      
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
            保存
          </Button>
        </View>
      </View>
    </View>
  )
}
