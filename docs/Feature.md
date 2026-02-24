# 需求功能

## 介绍
这是一个用于记录小宝宝每天日常的小程序
可以记录喝奶的奶量，时间；大小便的时间，量，软硬，颜色；睡眠的时间，次数，多久；辅食的时间，次数，饭量等

## UI
首页是 4 个大按钮，对应 吃、睡、拉、其他
1 点击吃，顶部是时间输入，然后是奶量输入，辅食输入（包括类型和量两个）或者水，底部是提交按钮，点击提交并回到首页
2 点击睡，顶部是时间输入，然后是睡眠时间输入，底部是提交按钮，同上
3 点击拉，顶部是时间输入，然后是选择大小便，量，颜色输入，软硬输入，底部是提交按钮同上
4 点击更多，会出现二级菜单：补剂、户外、哭闹。补剂有 AD，D3，钙，铁，锌，其他 UI 参考上面

## 数据记录
建表把数据存起来
record table
1 timestamp, 时间戳，记录的时间
2 category (food/sleep/shit/other), 类型，有 4 种
3 subcategory
  - food: breast milk, milk, water, babycook
  - sleep: sleep
  - shit: big, small
  - other: tonic, 其他待补充
4 value
  - string 类型
  - 对于 food，如果分类是breast milk 或 milk，value 是奶量，单位毫升；如果是babycook 或者 water，value 是食物的量，对应 012 - 较少，适中，很多
  - 对于 sleep，value 是睡眠时间，单位分钟，
  - 对于 shit，value 是大小便的量 012-较少，适中，很多
5 extra
  - json string 类型
  - 对于 shit，有 color 字段，比如 extra: { color: 'black' }
  - 对于 tonic，有 tonic_type 字段, 比如 extra: { tonic_type: 'AD' }