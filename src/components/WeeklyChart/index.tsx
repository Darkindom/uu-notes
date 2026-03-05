import { View, Text, Canvas } from '@tarojs/components'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Taro from '@tarojs/taro'
import uCharts from '@qiun/ucharts'
import './index.less'

export interface DayData {
  date: string
  milk: number
  nightMilk: number
  food: number
  sleepMinutes: number
  sleepCount: number
  protectorMinutes: number
}

interface WeeklyChartProps {
  data: DayData[]
}

type TabType = 'milk' | 'sleep' | 'protector'

let chartInstance: any = null

export default function WeeklyChart({ data }: WeeklyChartProps) {
  const [activeTab, setActiveTab] = useState<TabType>('milk')
  const [canvasId] = useState(`chart-${Math.random().toString(36).slice(2)}`)
  const [visibleSeries, setVisibleSeries] = useState<Record<string, boolean>>({
    奶量: true,
    夜奶: true,
    辅食: true,
    '睡眠(h)': true,
    次数: true,
    '佩戴时长(h)': true,
  })
  const chartInstanceRef = useRef<any>(null)
  const isInitializingRef = useRef(false)
  const updateTimerRef = useRef<any>(null)

  useEffect(() => {
    if (data && data.length > 0 && !isInitializingRef.current) {
      // 清除之前的定时器
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current)
      }

      isInitializingRef.current = true
      updateTimerRef.current = setTimeout(() => {
        initChart()
        isInitializingRef.current = false
      }, 100)

      return () => {
        if (updateTimerRef.current) {
          clearTimeout(updateTimerRef.current)
        }
        isInitializingRef.current = false
      }
    }

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current = null
      }
    }
  }, [data, activeTab, visibleSeries])

  // 切换 tab 时重置为显示全部
  useEffect(() => {
    setVisibleSeries({
      奶量: true,
      夜奶: true,
      辅食: true,
      '睡眠(h)': true,
      次数: true,
      '佩戴时长(h)': true,
    })
  }, [activeTab])

  const toggleSeries = useCallback((seriesName: string) => {
    // 防止在初始化时点击
    if (isInitializingRef.current) return

    setVisibleSeries((prev) => {
      // 检查当前是否只显示这一个系列
      const currentVisible = Object.entries(prev).filter(([_, visible]) => visible)
      const isOnlyThisVisible = currentVisible.length === 1 && prev[seriesName]

      if (isOnlyThisVisible) {
        // 如果当前只显示这个系列，点击后显示全部
        const allVisible: Record<string, boolean> = {}
        Object.keys(prev).forEach((key) => {
          allVisible[key] = true
        })
        return allVisible
      } else {
        // 否则，只显示点击的这个系列
        const onlyThis: Record<string, boolean> = {}
        Object.keys(prev).forEach((key) => {
          onlyThis[key] = key === seriesName
        })
        return onlyThis
      }
    })
  }, [])

  const getLegendItems = useMemo(() => {
    if (activeTab === 'milk') {
      return [
        { name: '奶量', color: '#FFB84D' },
        { name: '夜奶', color: '#E63946' },
        { name: '辅食', color: '#34C759' },
      ]
    } else if (activeTab === 'sleep') {
      return [
        { name: '睡眠(h)', color: '#5B8DEF' },
        { name: '次数', color: '#9B59B6' },
      ]
    } else {
      return [{ name: '佩戴时长(h)', color: '#4CAF7D' }]
    }
  }, [activeTab])

  // 准备图表数据
  const chartData = useMemo(() => {
    const categories = data.map((day) => {
      const dateObj = new Date(day.date)
      return `${dateObj.getMonth() + 1}/${dateObj.getDate()}`
    })

    if (activeTab === 'milk') {
      const allSeries = [
        {
          name: '奶量',
          data: data.map((d) => d.milk || 0),
          type: 'column',
          color: '#FFB84D',
          index: 0,
        },
        {
          name: '夜奶',
          data: data.map((d) => d.nightMilk || 0),
          type: 'line',
          color: '#E63946',
          style: 'straight',
          index: 0,
          lineWidth: 4,
          pointShape: 'circle',
        },
        {
          name: '辅食',
          data: data.map((d) => d.food || 0),
          type: 'line',
          color: '#34C759',
          style: 'curve',
          index: 1,
          lineWidth: 3,
        },
      ]

      const filteredSeries = allSeries.filter((s) => visibleSeries[s.name])
      const activeColors = filteredSeries.map((s) => s.color)

      return {
        categories,
        colors: activeColors,
        series: filteredSeries,
      }
    } else if (activeTab === 'sleep') {
      const allSeries = [
        {
          name: '睡眠(h)',
          data: data.map((d) => Math.round((d.sleepMinutes || 0) / 60)),
          type: 'column',
          color: '#5B8DEF',
          index: 0,
        },
        {
          name: '次数',
          data: data.map((d) => d.sleepCount || 0),
          type: 'line',
          color: '#9B59B6',
          style: 'curve',
          index: 1,
        },
      ]

      const filteredSeries = allSeries.filter((s) => visibleSeries[s.name])
      const activeColors = filteredSeries.map((s) => s.color)

      return {
        categories,
        colors: activeColors,
        series: filteredSeries,
      }
    } else {
      const protectorData = data.map((d) => {
        const hours = (d.protectorMinutes || 0) / 60
        return Math.round(hours * 10) / 10
      })
      console.log('护具数据:', data.map(d => ({ date: d.date, minutes: d.protectorMinutes, hours: d.protectorMinutes / 60 })))
      console.log('图表数据:', protectorData)
      return {
        categories,
        colors: ['#4CAF7D'],
        series: [
          {
            name: '佩戴时长(h)',
            data: protectorData,
            type: 'column',
            color: '#4CAF7D',
            index: 0,
          },
        ],
      }
    }
  }, [data, activeTab, visibleSeries])

  const initChart = useCallback(() => {
    const query = Taro.createSelectorQuery()
    query
      .select(`#${canvasId}`)
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0]) {
          console.error('Canvas not found')
          return
        }

        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        const dpr = Taro.getSystemInfoSync().pixelRatio
        const width = res[0].width
        const height = res[0].height

        canvas.width = width * dpr
        canvas.height = height * dpr
        ctx.scale(dpr, dpr)

        if (chartInstance) {
          chartInstance = null
        }

        const yAxisConfig = activeTab === 'protector' 
          ? {
              data: [
                {
                  disabled: false,
                  position: 'left',
                  gridType: 'dash',
                  dashLength: 2,
                  fontSize: 14,
                  fontColor: '#666666',
                  format: (val: number) => val.toFixed(1),
                },
              ],
            }
          : {
              data: [
                {
                  disabled: false,
                  position: 'left',
                  gridType: 'dash',
                  dashLength: 2,
                  fontSize: 14,
                  fontColor: '#666666',
                  format: (val: number) => val.toFixed(0),
                },
                {
                  disabled: false,
                  position: 'right',
                  gridType: 'none',
                  fontSize: 14,
                  fontColor: '#666666',
                  format: (val: number) => val.toFixed(0),
                },
              ],
            }

        const config = {
          type: 'mix',
          context: ctx,
          width: width,
          height: height,
          categories: chartData.categories,
          series: chartData.series,
          animation: false,
          background: '#FFFFFF',
          color: chartData.colors,
          padding: [15, 30, 50, 10],
          enableScroll: false,
          legend: {
            show: false,
          },
          dataLabel: true,
          dataPointShape: true,
          xAxis: {
            disableGrid: true,
            fontSize: 14,
            fontColor: '#666666',
          },
          yAxis: yAxisConfig,
          extra: {
            mix: {
              column: {
                width: 15,
              },
            },
          },
        }

        chartInstanceRef.current = new uCharts(config)
      })
  }, [data, activeTab, visibleSeries, chartData])

  const legendItems = useMemo(() => getLegendItems, [activeTab])

  if (!data || data.length === 0) {
    return (
      <View className='weekly-chart-empty'>
        <Text className='empty-text'>暂无数据</Text>
      </View>
    )
  }

  return (
    <View className='weekly-chart-container'>
      <View className='chart-title'>最近7天数据对比</View>

      <View className='chart-tabs'>
        <View
          className={`chart-tab ${activeTab === 'milk' ? 'active' : ''}`}
          onClick={() => setActiveTab('milk')}
        >
          <Text className='tab-text'>奶量</Text>
        </View>
        <View
          className={`chart-tab ${activeTab === 'sleep' ? 'active' : ''}`}
          onClick={() => setActiveTab('sleep')}
        >
          <Text className='tab-text'>睡眠情况</Text>
        </View>
        <View
          className={`chart-tab ${activeTab === 'protector' ? 'active' : ''}`}
          onClick={() => setActiveTab('protector')}
        >
          <Text className='tab-text'>护具</Text>
        </View>
      </View>

      <View className='chart-wrapper'>
        <Canvas
          id={canvasId}
          canvasId={canvasId}
          type='2d'
          className='chart-canvas'
        />
      </View>

      <View className='custom-legend'>
        {legendItems.map((item) => (
          <View
            key={item.name}
            className={`legend-item ${!visibleSeries[item.name] ? 'disabled' : ''}`}
            onClick={() => toggleSeries(item.name)}
          >
            <View
              className='legend-color'
              style={{ backgroundColor: item.color, opacity: visibleSeries[item.name] ? 1 : 0.3 }}
            />
            <Text className='legend-text' style={{ opacity: visibleSeries[item.name] ? 1 : 0.5 }}>
              {item.name}
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}
