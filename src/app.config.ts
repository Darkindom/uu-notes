export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/home/index',
    'pages/baby-info/index',
    'pages/records/index',
    'pages/onboarding/index',
    'pages/add-baby/index',
    'pages/edit-baby/index',
    'pages/food/index',
    'pages/sleep/index',
    'pages/shit/index',
    'pages/other/index',
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#FF6B35',
    navigationBarTitleText: 'UU日记',
    navigationBarTextStyle: 'white',
    backgroundColor: '#FFF8F0',
  },
  tabBar: {
    color: '#666666',
    selectedColor: '#FF6B35',
    backgroundColor: '#ffffff',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/home/index',
        text: '首页',
      },
      {
        pagePath: 'pages/records/index',
        text: '记录',
      },
      {
        pagePath: 'pages/baby-info/index',
        text: '宝宝',
      },
    ],
  },
})
