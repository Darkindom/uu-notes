import { View, Text, Button, Textarea } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { getCurrentBaby, createRecord, analyzeVoiceText, type VoiceAnalysisResult } from '../../utils/api'
import './index.less'

declare const requirePlugin: any

const CATEGORY_MAP = {
  food: { label: '吃', emoji: '🍼', color: '#FF9500' },
  sleep: { label: '睡', emoji: '😴', color: '#5B8DEF' },
  shit: { label: '拉', emoji: '🚽', color: '#8B6E5B' },
  other: { label: '其他', emoji: '✨', color: '#4CAF7D' },
} as const

const SUB_LABELS: Record<string, Record<string, string>> = {
  food: { breast_milk: '母乳', milk: '奶粉', babycook: '辅食', water: '水' },
  shit: { big: '大便', small: '换尿布' },
  sleep: { sleep: '睡眠' },
}

function subLabel(item: VoiceAnalysisResult) {
  return item.subCategory ? SUB_LABELS[item.category]?.[item.subCategory] || '' : ''
}

function valueWithUnit(item: VoiceAnalysisResult) {
  if (!item.value) return ''
  if (item.category === 'sleep') {
    const v = parseInt(item.value)
    if (v >= 60) return `${Math.floor(v / 60)}小时${v % 60 > 0 ? v % 60 + '分钟' : ''}`
    return `${v}分钟`
  }
  if (item.category === 'food') return `${item.value}ml`
  return item.value
}

export default function VoiceRecordPage() {
  const [isRecording, setIsRecording] = useState(false)
  const [editedText, setEditedText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [babyId, setBabyId] = useState<number | null>(null)
  const [results, setResults] = useState<VoiceAnalysisResult[] | null>(null)

  useEffect(() => {
    loadBabyInfo()
  }, [])

  const loadBabyInfo = async () => {
    try {
      const baby = await getCurrentBaby()
      if (baby) setBabyId(baby.id)
      else {
        Taro.showToast({ title: '请先选择宝宝', icon: 'none' })
        setTimeout(() => Taro.navigateBack(), 1500)
      }
    } catch (error) {
      console.error('获取宝宝信息失败:', error)
    }
  }

  const appendText = (newText: string, existing: string) => {
    const t = newText.trim()
    if (!t) return existing
    if (!existing.trim()) return t
    return /[，,。.！!？?、；;：:]$/.test(existing) ? existing + t : existing + '，' + t
  }

  const startRecording = () => {
    try {
      const plugin = requirePlugin('WechatSI')
      const manager = plugin.getRecordRecognitionManager()
      manager.onStart = () => setIsRecording(true)
      manager.onRecognize = (res) => { console.log('实时:', res.result) }
      manager.onStop = (res) => {
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
      Taro.showToast({ title: '语音功能暂不可用', icon: 'none' })
    }
  }

  const stopRecording = () => {
    try {
      requirePlugin('WechatSI').getRecordRecognitionManager().stop()
    } catch { setIsRecording(false) }
  }

  const handleAnalyze = async () => {
    if (!babyId) { Taro.showToast({ title: '宝宝信息加载中', icon: 'none' }); return }
    const text = editedText.trim()
    if (!text) { Taro.showToast({ title: '请先录音或输入内容', icon: 'none' }); return }

    setIsSubmitting(true)
    Taro.showLoading({ title: 'AI 分析中...', mask: true })
    try {
      const r = await analyzeVoiceText(text, babyId)
      Taro.hideLoading()
      if (!r || r.length === 0) {
        Taro.showToast({ title: '分析失败，请重试', icon: 'none' })
      } else {
        setResults(r)
      }
    } catch (error) {
      Taro.hideLoading()
      Taro.showToast({ title: error?.message || '分析失败', icon: 'none', duration: 2500 })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleConfirm = async () => {
    if (!babyId || !results) return
    setIsSubmitting(true)
    Taro.showLoading({ title: '保存中...', mask: true })
    let created = 0
    for (const item of results) {
      try {
        await createRecord({
          babyId,
          category: item.category,
          subCategory: item.subCategory,
          startTime: Date.now(),
          value: item.value,
          note: item.note || editedText,
        })
        created++
      } catch (err) { console.error('创建失败:', item, err) }
    }
    Taro.hideLoading()
    if (created > 0) {
      Taro.showToast({ title: `已记录 ${created} 条`, icon: 'success' })
      setTimeout(() => Taro.switchTab({ url: '/pages/records/index' }), 1000)
    } else {
      Taro.showToast({ title: '记录失败，请重试', icon: 'none' })
    }
    setIsSubmitting(false)
  }

  const clearText = () => { setEditedText(''); setResults(null) }

  return (
    <View className='voice-record-page'>
      <View className='header'>
        <Text className='title'>语音记录</Text>
        <Text className='subtitle'>长按录音，松手结束</Text>
      </View>

      <View className='recording-section'>
        {/* 文本框 */}
        <View className='text-section'>
          <Textarea
            className='text-input'
            placeholder='录音后文字会出现在这里，也可以直接输入…'
            value={editedText}
            onInput={(e) => { setEditedText(e.detail.value); setResults(null) }}
            maxlength={500}
            autoHeight
            disabled={isSubmitting}
          />
        </View>

        {/* 分析按钮 / 确认列表 */}
        {!results ? (
          <View className='action-buttons'>
            {editedText.trim() && (
              <Button className='btn btn-secondary' onClick={clearText}>清空</Button>
            )}
            <Button className='btn btn-primary' onClick={handleAnalyze} loading={isSubmitting} disabled={isSubmitting}>
              提交分析
            </Button>
          </View>
        ) : (
          <View className='review-section'>
            <Text className='review-title'>识别结果，确认后提交</Text>
            {results.map((item, i) => {
              const cat = CATEGORY_MAP[item.category] || CATEGORY_MAP.other
              const sub = subLabel(item)
              const unit = valueWithUnit(item)
              return (
                <View key={i} className='review-item'>
                  <View className='review-left'>
                    <Text className='review-emoji'>{cat.emoji}</Text>
                    <View className='review-info'>
                      <Text className='review-category'>{cat.label}{sub ? ` · ${sub}` : ''}{unit ? ` · ${unit}` : ''}</Text>
                      {item.note && <Text className='review-note'>{item.note}</Text>}
                    </View>
                  </View>
                  <View className='review-delete' onClick={() => setResults(results.filter((_, j) => j !== i))}>
                    <Text>✕</Text>
                  </View>
                </View>
              )
            })}
            <View className='review-actions'>
              <Button className='btn btn-secondary' onClick={handleAnalyze}>重新分析</Button>
              <Button className='btn btn-primary' onClick={handleConfirm} loading={isSubmitting}>确认提交</Button>
            </View>
          </View>
        )}
      </View>

      {/* 底部录音按钮 */}
      <View
        className='record-footer'
        onTouchStart={() => { if (!isSubmitting && !isRecording) startRecording() }}
        onTouchEnd={() => { if (isRecording) stopRecording() }}
        onTouchCancel={() => { if (isRecording) stopRecording() }}
      >
        <View className={`record-bar${isRecording ? ' recording' : ''}`}>
          {!isRecording ? (
            <>
              <View className='record-icon'>🎤</View>
              <Text className='record-text'>按住录音</Text>
            </>
          ) : (
            <>
              <View className='recording-dot'></View>
              <Text className='recording-text'>松手结束</Text>
            </>
          )}
        </View>
      </View>
    </View>
  )
}
