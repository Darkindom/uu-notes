import { View, Text, Button, Textarea } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { getCurrentBaby, createRecord, analyzeVoiceText, type VoiceAnalysisResult } from '../../utils/api'
import './index.less'

interface RecognitionResult extends VoiceAnalysisResult {
  text: string
}

// 声明微信插件类型
declare const requirePlugin: any

export default function VoiceRecordPage() {
  const [isRecording, setIsRecording] = useState(false)
  const [recognizedText, setRecognizedText] = useState('')
  const [editedText, setEditedText] = useState('')
  const [parsedResult, setParsedResult] = useState<RecognitionResult | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
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

  const startRecording = async () => {
    try {
      // 请求录音权限
      const { authSetting } = await Taro.getSetting()

      if (!authSetting['scope.record']) {
        try {
          await Taro.authorize({ scope: 'scope.record' })
        } catch (err) {
          Taro.showModal({
            title: '需要麦克风权限',
            content: '请在设置中允许使用麦克风以进行语音识别',
            showCancel: false,
          })
          return
        }
      }

      setRecognizedText('')
      setEditedText('')
      setParsedResult(null)

      // 开始录音
      const recorderManager = Taro.getRecorderManager()

      recorderManager.onStart(() => {
        console.log('录音开始')
        setIsRecording(true)
      })

      recorderManager.onStop((res) => {
        console.log('录音结束', res)
        setIsRecording(false)
        if (res.tempFilePath) {
          handleRecordingComplete(res.tempFilePath)
        }
      })

      recorderManager.onError((err) => {
        console.error('录音错误:', err)
        setIsRecording(false)
        Taro.showToast({ title: '录音失败，请重试', icon: 'none' })
      })

      recorderManager.start({
        duration: 60000,
        sampleRate: 16000,
        numberOfChannels: 1,
        encodeBitRate: 96000,
        format: 'mp3',
      })

      Taro.showToast({ title: '开始录音...', icon: 'none', duration: 1000 })
    } catch (error) {
      console.error('启动录音失败:', error)
      Taro.showToast({ title: '启动录音失败', icon: 'none' })
    }
  }

  const stopRecording = () => {
    const recorderManager = Taro.getRecorderManager()
    recorderManager.stop()
  }

  const handleRecordingComplete = async (_tempFilePath: string) => {
    Taro.showLoading({ title: '识别中...', mask: true })

    try {
      // 尝试使用微信同声传译插件
      const plugin = requirePlugin('WechatSI')
      const manager = plugin.getRecordRecognitionManager()

      manager.onRecognize = (res) => {
        console.log('实时识别:', res.result)
      }

      manager.onStop = (res) => {
        console.log('识别完成:', res)
        Taro.hideLoading()
        const text = res.result || ''
        setRecognizedText(text)
        setEditedText(text)

        if (text) {
          // 调用 AI Agent 进行分析
          analyzeTextWithAI(text)
        } else {
          Taro.showToast({ title: '未识别到内容', icon: 'none' })
        }
      }

      manager.onError = (err) => {
        console.error('识别错误:', err)
        Taro.hideLoading()
        Taro.showToast({ title: '识别失败，请使用文字输入', icon: 'none' })
        // 识别失败时，允许手动输入
        setRecognizedText('')
        setEditedText('')
      }

      manager.start({
        lang: 'zh_CN',
        duration: 60000,
      })
    } catch (error) {
      console.error('语音识别插件加载失败:', error)
      Taro.hideLoading()
      Taro.showToast({ title: '识别功能暂不可用，请手动输入', icon: 'none', duration: 2000 })
      
      // 插件不可用时，提供手动输入功能
      setRecognizedText('')
      setEditedText('')
    }
  }

  const parseRecognizedText = (text: string): RecognitionResult => {
    // 本地简单解析（仅作为 AI 失败时的备选方案）
    const result: RecognitionResult = {
      text,
      category: 'other',
    }

    // 吃的关键词
    if (/喝|吃|奶|母乳|奶粉|辅食|喂/.test(text)) {
      result.category = 'food'
      
      // 识别类型
      if (/母乳/.test(text)) {
        result.subCategory = 'breast'
      } else if (/奶粉/.test(text)) {
        result.subCategory = 'formula'
      } else if (/辅食/.test(text)) {
        result.subCategory = 'solid'
      }

      // 识别量（毫升或克）
      const volumeMatch = text.match(/(\d+)\s*(毫升|ml|克|g)/i)
      if (volumeMatch) {
        result.value = volumeMatch[1]
      }
    }
    // 睡觉的关键词
    else if (/睡|觉|入睡|睡着/.test(text)) {
      result.category = 'sleep'
    }
    // 拉的关键词
    else if (/拉|大便|尿|换尿布|尿片|尿不湿/.test(text)) {
      result.category = 'shit'
      
      if (/大便|拉|💩/.test(text)) {
        result.subCategory = 'big'
      } else if (/尿|换尿布|尿片|尿不湿/.test(text)) {
        result.subCategory = 'small'
      }
    }
    // 其他
    else {
      result.category = 'other'
    }

    result.note = text

    return result
  }

  /**
   * 使用 AI Agent 分析文本
   */
  const analyzeTextWithAI = async (text: string) => {
    setIsAnalyzing(true)
    Taro.showLoading({ title: 'AI 分析中...', mask: true })

    try {
      const aiResult = await analyzeVoiceText(text)
      
      const parsed: RecognitionResult = {
        text,
        category: aiResult.category,
        subCategory: aiResult.subCategory,
        value: aiResult.value,
        note: aiResult.note || text,
        confidence: aiResult.confidence,
      }

      setParsedResult(parsed)
      Taro.hideLoading()
      Taro.showToast({ title: '识别成功', icon: 'success', duration: 1000 })
    } catch (error) {
      console.error('AI 分析失败，使用本地解析:', error)
      Taro.hideLoading()
      
      // AI 失败时，使用本地正则匹配作为备选方案
      const parsed = parseRecognizedText(text)
      setParsedResult(parsed)
      
      Taro.showToast({ title: '使用本地识别', icon: 'none', duration: 1500 })
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleTextChange = (e) => {
    const newText = e.detail.value
    setEditedText(newText)
    
    // 文本修改后，重新调用 AI 分析
    if (newText.trim()) {
      analyzeTextWithAI(newText)
    } else {
      setParsedResult(null)
    }
  }

  const getCategoryDisplay = (category: string) => {
    const map = {
      food: { label: '吃', emoji: '🍼', color: '#FF9500' },
      sleep: { label: '睡', emoji: '😴', color: '#5B8DEF' },
      shit: { label: '拉', emoji: '🚽', color: '#8B6E5B' },
      other: { label: '其他', emoji: '✨', color: '#4CAF7D' },
    }
    return map[category] || map.other
  }

  const getSubCategoryDisplay = (category: string, subCategory?: string) => {
    if (category === 'food') {
      const map = {
        breast: '母乳',
        formula: '奶粉',
        solid: '辅食',
      }
      return subCategory ? map[subCategory] : ''
    }
    if (category === 'shit') {
      const map = {
        big: '大便',
        small: '换尿布',
      }
      return subCategory ? map[subCategory] : ''
    }
    return ''
  }

  const handleSubmit = async () => {
    if (!babyId) {
      Taro.showToast({ title: '宝宝信息加载中', icon: 'none' })
      return
    }

    if (!parsedResult || !editedText.trim()) {
      Taro.showToast({ title: '请先录音或输入内容', icon: 'none' })
      return
    }

    setIsSubmitting(true)

    try {
      const recordData = {
        babyId,
        category: parsedResult.category,
        subCategory: parsedResult.subCategory,
        startTime: Date.now(),
        value: parsedResult.value,
        note: editedText,
      }

      await createRecord(recordData)

      Taro.showToast({ title: '记录成功', icon: 'success' })
      
      setTimeout(() => {
        Taro.navigateBack()
      }, 1500)
    } catch (error) {
      console.error('提交记录失败:', error)
      Taro.showToast({ title: '提交失败，请重试', icon: 'none' })
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
        {!isRecording && !recognizedText && (
          <View className='record-button-wrapper'>
            <View className='record-button' onClick={startRecording}>
              <View className='record-icon'>🎤</View>
              <Text className='record-text'>点击开始录音</Text>
            </View>
            <Text className='hint'>说话时请靠近麦克风，清晰地说出记录内容</Text>
            
            <View className='divider'>
              <View className='divider-line' />
              <Text className='divider-text'>或</Text>
              <View className='divider-line' />
            </View>
            
            <View className='manual-input-section'>
              <Textarea
                className='manual-input'
                placeholder='也可以直接输入文字'
                value={editedText}
                onInput={handleTextChange}
                maxlength={200}
                autoHeight
              />
              {editedText && (
                <Button
                  className='manual-submit-btn'
                  onClick={() => {
                    setRecognizedText(editedText)
                    analyzeTextWithAI(editedText)
                  }}
                >
                  确认
                </Button>
              )}
            </View>
          </View>
        )}

        {isRecording && (
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

        {recognizedText && (
          <View className='result-section'>
            <View className='recognized-text'>
              <Text className='label'>识别结果（可编辑）：</Text>
              <Textarea
                className='text-input'
                value={editedText}
                onInput={handleTextChange}
                placeholder='请输入或修改识别结果'
                maxlength={200}
                autoHeight
                disabled={isAnalyzing}
              />
              {isAnalyzing && (
                <Text className='analyzing-hint'>AI 分析中...</Text>
              )}
            </View>

            {parsedResult && !isAnalyzing && (
              <View className='parsed-info'>
                <View className='info-header'>
                  <Text className='info-title'>智能识别</Text>
                  {parsedResult.confidence !== undefined && (
                    <Text className='confidence-badge'>
                      置信度: {Math.round(parsedResult.confidence * 100)}%
                    </Text>
                  )}
                </View>
                
                <View className='info-item'>
                  <Text className='info-label'>类别：</Text>
                  <View
                    className='category-tag'
                    style={{ backgroundColor: getCategoryDisplay(parsedResult.category).color + '20' }}
                  >
                    <Text style={{ color: getCategoryDisplay(parsedResult.category).color }}>
                      {getCategoryDisplay(parsedResult.category).emoji}{' '}
                      {getCategoryDisplay(parsedResult.category).label}
                    </Text>
                  </View>
                </View>

                {parsedResult.subCategory && (
                  <View className='info-item'>
                    <Text className='info-label'>子类别：</Text>
                    <Text className='info-value'>
                      {getSubCategoryDisplay(parsedResult.category, parsedResult.subCategory)}
                    </Text>
                  </View>
                )}

                {parsedResult.value && (
                  <View className='info-item'>
                    <Text className='info-label'>数量：</Text>
                    <Text className='info-value'>{parsedResult.value} 毫升</Text>
                  </View>
                )}
              </View>
            )}

            <View className='action-buttons'>
              <Button className='btn btn-secondary' onClick={startRecording}>
                重新录音
              </Button>
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
        )}
      </View>
    </View>
  )
}
