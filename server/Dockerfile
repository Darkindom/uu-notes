FROM node:18-alpine

WORKDIR /app

# 安装构建工具和 sqlite
RUN apk add --no-cache \
    sqlite \
    python3 \
    make \
    g++

# 安装依赖
COPY package*.json ./
RUN npm install --production

# 复制源代码
COPY . .

# 创建数据目录
RUN mkdir -p /app/data

# 暴露端口
EXPOSE 1717

# 启动服务
CMD ["npm", "start"]
