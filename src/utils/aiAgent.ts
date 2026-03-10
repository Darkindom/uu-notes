import Taro from '@tarojs/taro'

/**
 * 腾讯云 Agent 配置
 */
const AGENT_CONFIG = {
  agentId: 'agent-record-3gewgxci6e127640',
  env: 'cloudbase-0gom0wo33480db9c',
}

/**
 * AI Agent 分析结果
 */
export interface VoiceAnalysisResult {
  category: string
  subCategory?: string
  value?: string
  note?: string
  confidence?: number
}

/**
 * 生成唯一 ID
 */
function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * 调用腾讯云 AI Agent 分析文本
 * 
 * 使用云开发的 AI.bot.sendMessage 接口
 * 参考文档: https://docs.cloudbase.net/ai/agent/http-agent-protocol
 */
export async function analyzeVoiceText(text: string): Promise<VoiceAnalysisResult> {
  try {
    // 检查并初始化云开发
    if (!Taro.cloud || !Taro.cloud.init) {
      throw new Error('云开发未初始化，请检查配置')
    }

    // 初始化云开发（确保已初始化）
    try {
      Taro.cloud.init({
        env: AGENT_CONFIG.env,
        traceUser: true,
      })
    } catch (e) {
      console.log('云开发已初始化或初始化失败:', e)
    }

    const threadId = generateId()
    const runId = 'run_001'
    const msgId = generateId()

    console.log('[AI Agent] 开始调用:', { text, threadId })

    // 调用 AI Agent
    const res = await Taro.cloud.extend.AI.bot.sendMessage({
      data: {
        botId: AGENT_CONFIG.agentId,
        threadId: threadId,
        runId: runId,
        messages: [
          {
            id: msgId,
            role: 'user',
            content: text,
          },
        ],
        tools: [],
        context: [],
        state: {},
        forwardedProps: {},
      },
    })

    console.log('[AI Agent] 调用成功，处理响应流')

    // 处理流式响应
    let fullContent = ''
    let reasoning = ''

    for await (const event of res.eventStream) {
      if (event.data === '[DONE]') {
        break
      }

      try {
        const data = JSON.parse(event.data)

        // deepseek-r1 模型的推理内容
        if (data.reasoning_content) {
          reasoning += data.reasoning_content
          console.log('[AI Agent] 推理:', data.reasoning_content)
        }

        // 正文内容
        if (data.content && data.content.delta) {
          fullContent += data.content.delta
          console.log('[AI Agent] 内容:', data.content.delta)
        }
      } catch (parseError) {
        console.error('[AI Agent] 解析响应失败:', parseError)
      }
    }

    console.log('[AI Agent] 完整响应:', fullContent)

    // 解析 AI 返回的 JSON 结果
    const result = parseAIResponse(fullContent, text)
    
    return result
  } catch (error) {
    console.error('[AI Agent] 调用失败:', error)
    throw error
  }
}

/**
 * 解析 AI 返回的结果
 * 
 * AI 应该返回 JSON 格式，例如:
 * {
 *   "category": "food",
 *   "subCategory": "formula",
 *   "value": "150",
 *   "note": "宝宝刚喝了150毫升奶",
 *   "confidence": 0.95
 * }
 */
function parseAIResponse(content: string, originalText: string): VoiceAnalysisResult {
  try {
    // 尝试提取 JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      
      return {
        category: parsed.category || 'other',
        subCategory: parsed.subCategory,
        value: parsed.value,
        note: parsed.note || originalText,
        confidence: parsed.confidence,
      }
    }

    // 如果没有找到 JSON，尝试从文本中提取
    return extractFromText(content, originalText)
  } catch (error) {
    console.error('[AI Agent] 解析失败:', error)
    throw new Error('AI 返回格式错误')
  }
}

/**
 * 从文本中提取结构化数据（降级方案）
 */
function extractFromText(content: string, originalText: string): VoiceAnalysisResult {
  const result: VoiceAnalysisResult = {
    category: 'other',
    note: originalText,
  }

  // 尝试从 AI 返回的文本中提取信息
  const categoryMatch = content.match(/category[："]\s*["']?(\w+)["']?/i)
  if (categoryMatch) {
    result.category = categoryMatch[1]
  }

  const subCategoryMatch = content.match(/subCategory[："]\s*["']?(\w+)["']?/i)
  if (subCategoryMatch) {
    result.subCategory = subCategoryMatch[1]
  }

  const valueMatch = content.match(/value[："]\s*["']?(\d+)["']?/i)
  if (valueMatch) {
    result.value = valueMatch[1]
  }

  return result
}
