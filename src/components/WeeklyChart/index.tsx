import { View, Text, Canvas } from '@tarojs/components'
import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import uCharts from '@qiun/ucharts'
import './index.less'

export interface DayData {
  date: string
  milk: number
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

  useEffect(() => {
    if (data && data.length > 0) {
      setTimeout(() => {
        initChart()
      }, 500)
    }

    return () => {
      if (chartInstance) {
        chartInstance = null
      }
    }
  }, [data, activeTab])

  const initChart = () => {
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

        const chartData = prepareChartData()

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
          padding: [15, 30, 15, 10],
          enableScroll: false,
          legend: {
            show: true,
            position: 'bottom',
            float: 'center',
            padding: 8,
            margin: 10,
            fontSize: 16,
            fontColor: '#333333',
            itemGap: 20,
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

        chartInstance = new uCharts(config)
      })
  }

  const prepareChartData = () => {
    const categories = data.map((day) => {
      const dateObj = new Date(day.date)
      return `${dateObj.getMonth() + 1}/${dateObj.getDate()}`
    })

    if (activeTab === 'milk') {
      return {
        categories,
        colors: ['#FF9500', '#4CAF7D'],
        series: [
          {
            name: '奶量',
            data: data.map((d) => d.milk || 0),
            type: 'column',
            color: '#FF9500',
            index: 0,
          },
          {
            name: '辅食',
            data: data.map((d) => d.food || 0),
            type: 'line',
            color: '#4CAF7D',
            style: 'curve',
            index: 1,
          },
        ],
      }
    } else if (activeTab === 'sleep') {
      return {
        categories,
        colors: ['#5B8DEF', '#9B59B6'],
        series: [
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
        ],
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
  }

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
    </View>
  )
}
