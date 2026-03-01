# 数据库设计

## 集合（表）结构

### 1. babies（宝宝表）
```json
{
  "_id": "baby_xxx",
  "name": "猪宝",
  "gender": "male/female",
  "birthday": 1703001600000,
  "avatar": "cloud://xxx.png",
  "createTime": 1703001600000,
  "creatorOpenId": "user_openid_xxx",
  "members": [
    {
      "openId": "user_openid_xxx",
      "role": "爸爸/妈妈/奶奶/爷爷/其他",
      "nickname": "昵称",
      "joinTime": 1703001600000,
      "permission": "admin/editor/viewer"
    }
  ]
}
```

### 2. records（记录表）
```json
{
  "_id": "record_xxx",
  "babyId": "baby_xxx",
  "timestamp": 1703001600000,
  "category": "food/sleep/shit/other",
  "subcategory": "milk/big/...",
  "value": "120",
  "extra": "{}",
  "reporter": {
    "openId": "user_openid_xxx",
    "role": "妈妈",
    "nickname": "昵称"
  },
  "createTime": 1703001600000
}
```

### 3. users（用户表）
```json
{
  "_id": "user_xxx",
  "openId": "user_openid_xxx",
  "nickname": "昵称",
  "avatar": "cloud://xxx.png",
  "currentBabyId": "baby_xxx",
  "babies": ["baby_xxx", "baby_yyy"],
  "createTime": 1703001600000,
  "lastLoginTime": 1703001600000
}
```

## 数据权限

- 只有 `members` 中的用户可以读写对应宝宝的记录
- `admin` 可以邀请/移除成员
- `editor` 可以添加/删除记录
- `viewer` 只能查看记录
