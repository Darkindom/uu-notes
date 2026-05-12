import { View, Text, Button, Textarea } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { getCurrentBaby, createRecord, analyzeVoiceText } from '../../utils/api'
import './index.less'

// 声明微信插件类型
declare const requirePlugin: any

export default function VoiceRecordPage() {
  const [isRecording, setIsRecording] = useState(false)
  const [editedText, setEditedText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [babyId, setBabyId] = useState<number | null>(null)

  useEffect(() => {
    loadBabyInfo()
  }, [])

  const loadBabyInfo = async () => {
    try {
      const baby = await getCurrentBaby()
      if (baby) {
        setBabyId(baby.id)
      } else {
        Taro.showToast({ title: '请先选择宝宝', icon: 'none' })
        setTimeout(() => Taro.navigateBack(), 1500)
      }
    } catch (error) {
      console.error('获取宝宝信息失败:', error)
    }
  }

  const appendText = (newText: string, existing: string) => {
    const trimmed = newText.trim()
    if (!trimmed) return existing
    if (!existing.trim()) return trimmed
    // 如果已有文字以标点结尾，直接拼接；否则加逗号
    return /[，,。.！!？?、；;：:]$/.test(existing) ? existing + trimmed : existing + '，' + trimmed
  }

  const startRecording = () => {
    try {
      const plugin = requirePlugin('WechatSI')
      const manager = plugin.getRecordRecognitionManager()

      manager.onStart = () => {
        console.log('录音开始')
        setIsRecording(true)
      }

      manager.onRecognize = (res) => {
        console.log('实时识别:', res.result)
      }

      manager.onStop = (res) => {
        console.log('识别完成:', res)
        setIsRecording(false)
        const text = res.result || ''
        if (text) {
          setEditedText(prev => appendText(text, prev))
          Taro.showToast({ title: '识别成功', icon: 'success', duration: 1000 })
        } else {
          Taro.showToast({ title: '未识别到内容', icon: 'none' })
        }
      }

      manager.onError = (err) => {
        console.error('识别错误:', err)
        setIsRecording(false)
        Taro.showToast({ title: '识别失败，请重试', icon: 'none' })
      }

      manager.start({ lang: 'zh_CN' })
    } catch (error) {
      console.error('语音识别插件加载失败:', error)
      Taro.showToast({ title: '语音功能暂不可用', icon: 'none' })
    }
  }

  const stopRecording = () => {
    try {
      const plugin = requirePlugin('WechatSI')
      plugin.getRecordRecognitionManager().stop()
    } catch (error) {
      console.error('停止录音失败:', error)
      setIsRecording(false)
    }
  }

  const handleSubmit = async () => {
    if (!babyId) {
      Taro.showToast({ title: '宝宝信息加载中', icon: 'none' })
      return
    }

    const text = editedText.trim()
    if (!text) {
      Taro.showToast({ title: '请先录音或输入内容', icon: 'none' })
      return
    }

    setIsSubmitting(true)
    Taro.showLoading({ title: 'AI 分析中...', mask: true })

    try {
      const aiResults = await analyzeVoiceText(text, babyId)
      Taro.hideLoading()

      if (!aiResults || aiResults.length === 0) {
        Taro.showToast({ title: '分析失败，请重试', icon: 'none' })
        return
      }

      // 逐条创建记录
      let created = 0
      for (const item of aiResults) {
        try {
          await createRecord({
            babyId,
            category: item.category,
            subCategory: item.subCategory,
            startTime: Date.now(),
            value: item.value,
            note: item.note || text,
          })
          created++
        } catch (err) {
          console.error('创建记录失败:', item, err)
        }
      }

      if (created > 0) {
        Taro.showToast({ title: `已记录 ${created} 条`, icon: 'success' })
        setTimeout(() => {
          Taro.switchTab({ url: '/pages/records/index' })
        }, 1000)
      } else {
        Taro.showToast({ title: '记录失败，请重试', icon: 'none' })
      }
    } catch (error) {
      Taro.hideLoading()
      const msg = error?.message || '提交失败，请重试'
      Taro.showToast({ title: msg, icon: 'none', duration: 2500 })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <View className='voice-record-page'>
      <View className='header'>
        <Text className='title'>语音记录</Text>
        <Text className='subtitle'>说出你想记录的内容，我会帮你识别</Text>
      </View>

      <View className='recording-section'>
        {/* 录音按钮 */}
        {!isRecording ? (
          <View className='record-button-wrapper'>
            <View className='record-button' onClick={startRecording}>
              <View className='record-icon'>🎤</View>
              <Text className='record-text'>点击开始录音</Text>
            </View>
            <Text className='hint'>说话时请靠近麦克风，清晰地说出记录内容</Text>
          </View>
        ) : (
          <View className='recording-active'>
            <View className='recording-animation'>
              <View className='wave wave-1'></View>
              <View className='wave wave-2'></View>
              <View className='wave wave-3'></View>
              <View className='mic-icon'>🎤</View>
            </View>
            <Text className='recording-text'>正在录音...</Text>
            <Button className='stop-button' onClick={stopRecording}>
              停止录音
            </Button>
          </View>
        )}

        {/* 文本框 - 始终可见 */}
        <View className='text-section'>
          <Textarea
            className='text-input'
            placeholder='录音后文字会出现在这里，也可以直接输入'
            value={editedText}
            onInput={(e) => setEditedText(e.detail.value)}
            maxlength={500}
            autoHeight
            disabled={isSubmitting}
          />
        </View>

        {/* 提交按钮 */}
        <View className='action-buttons'>
          <Button
            className='btn btn-primary'
            onClick={handleSubmit}
            loading={isSubmitting}
            disabled={isSubmitting}
          >
            提交记录
          </Button>
        </View>
      </View>
    </View>
  )
}
