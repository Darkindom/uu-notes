export type TutorialVisual = 'add-baby' | 'record-milk' | 'records-list' | 'baby-chart'

export interface TutorialStep {
  title: string
  desc: string
  marker: string
  visual: TutorialVisual
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: '添加宝宝',
    desc: '先建立宝宝档案，记录会自动归到当前宝宝。',
    marker: '1',
    visual: 'add-baby',
  },
  {
    title: '记录奶量',
    desc: '在首页点“吃”，记录母乳、奶粉、水和辅食。',
    marker: '2',
    visual: 'record-milk',
  },
  {
    title: '查看记录列表',
    desc: '在“记录”页按日期查看、编辑和删除日常记录。',
    marker: '3',
    visual: 'records-list',
  },
  {
    title: '宝宝页看趋势',
    desc: '宝宝页展示一周辅食、奶量和睡眠图表。',
    marker: '4',
    visual: 'baby-chart',
  },
]
