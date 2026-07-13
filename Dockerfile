FROM node:22-slim

# better-sqlite3 编译需要
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 复制 package.json 并安装依赖
COPY package.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/
RUN npm install
RUN cd server && npm install
RUN cd client && npm install

# 复制源码
COPY . .

# 构建前端
RUN cd client && npx vite build

# 生产环境变量
ENV NODE_ENV=production
ENV PORT=3001
ENV DB_PATH=/app/data/moyuan.db
ENV UPLOADS_DIR=/app/uploads

# 创建持久化目录
RUN mkdir -p /app/data /app/uploads

EXPOSE 3001

CMD ["npx", "tsx", "server/src/index.ts"]
