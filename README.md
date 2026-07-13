# 墨源 Moyuan — AI 古籍识读与研究工作台

> 上传古籍影像 → OCR 识读 → 繁简转换 → 自动标点 → 史料库管理 → 知识图谱 → 版本比对 → 论文写作

墨源是一个面向中国古代史研究人员的本地化古籍整理与研究平台。它将 OCR 识读、文本处理、史料管理、知识图谱可视化、版本差异比对与学术写作整合在一个工作台中，帮助研究者从原始古籍影像到成文研究高效流转。

## 核心功能

### 📖 古籍识读

- 支持 PDF / JPG / PNG / TIF 格式，可批量上传（单文件最大 50MB）
- 五步流水线处理：**上传 → OCR 识别 → 繁简转换 → 自动标点 → 版式转换**
- 左右分栏对照视图：左侧原图预览，右侧识读结果
- 三栏文本切换：OCR 原文 / 简体标点 / 最终文本
- 保存时可录入标题、来源数据库、书名、版本、卷页码、可信度等级与标签
- 支持导出为 Markdown 或纯文本

### 📚 史料库

- 表格视图与卡片视图双模式
- 全文搜索（基于 SQLite FTS5）、标签筛选、可信度筛选、多维度排序
- 四种文本版本对照（原文 / 转换 / 标点 / 最终）
- 引用生成：支持 **GB/T 7714** 和 **Chicago** 两种格式，一键复制

### 🕸️ 知识图谱

- 基于 ECharts 力导向图布局的可视化网络
- 六类实体：人物（蓝）、地点（绿）、事件（橙）、时间（紫）、官职（紫蓝）、机构（青）
- 节点大小根据关系数动态计算，支持缩放、拖拽、悬停高亮相邻节点
- 点击节点查看详情：类型、描述、关联史料、关系列表

### 🔀 版本差异比对

- 两种输入模式：从史料库选择 / 直接输入文本
- 基于 `diff-match-patch` 的语义级差异计算
- 四类差异标记：相同 / 删除 / 新增 / 修改
- **AI 差异分析**：自动判断差异原因（传抄讹误、版本差异、有意修订、字形演变），附置信度
- 差异率统计

### ✍️ 写作台

- Markdown 编辑器，工具栏支持加粗 / 斜体 / 标题 / 引用 / 列表 / 分隔线
- **史料速查面板**：搜索史料 → 查看内容 → 一键插入引用标记
- **参考文献管理**：自动维护引用列表
- **一致性检查**：AI 检查论文引用的史料版本是否一致
- 自动保存（3 秒延迟 + 30 秒强制），支持 Ctrl+S 手动保存

## 技术栈

| 层级 | 技术 |
|------|------|
| **前端** | React 19 · Vite 8 · TypeScript 6 · TailwindCSS v4 · ECharts 6 · react-router-dom v7 · diff-match-patch |
| **后端** | Node.js · Express 4 · TypeScript 5 · SQLite（better-sqlite3）· FTS5 全文检索 · multer · opencc-js |
| **AI** | 兼容 OpenAI 接口（默认对接 Ollama 本地模型 qwen2.5:14b） |

## 项目结构

```
moyuan-app/
├── package.json              # 根项目（concurrently 同时启动前后端）
├── 启动说明.sh / .bat         # 一键启动脚本
├── client/                   # 前端
│   ├── src/
│   │   ├── App.tsx           # 路由定义
│   │   ├── layouts/          # 侧边栏布局
│   │   ├── pages/            # 五大功能页面
│   │   ├── services/         # API 客户端
│   │   ├── types/            # 类型定义
│   │   └── styles/           # 全局样式
│   └── vite.config.ts
└── server/                   # 后端
    ├── src/
    │   ├── app.ts            # Express 应用与中间件
    │   ├── config/           # 环境配置
    │   ├── db/               # 数据库连接 / Schema / 种子数据
    │   └── routes/           # OCR / 史料 / 标签 / 图谱 / 比对 / 文档 / AI
    └── .env.example          # 环境变量模板
```

## 快速开始

### 环境要求

- **Node.js 18+**（推荐 LTS 版）
- 无需额外安装数据库（SQLite 嵌入式运行）

### 安装与启动

```bash
# 1. 安装所有依赖
npm run install:all

# 2. 配置环境变量
cp server/.env.example server/.env

# 3. 启动开发服务器（前后端同时运行）
npm run dev
```

启动后：

- 前端：http://localhost:5173/
- 后端：http://localhost:3001/

> 也可以使用一键启动脚本：macOS/Linux 执行 `bash 启动说明.sh`，Windows 双击 `启动说明.bat`

### AI 配置（可选）

墨源默认以 **Demo 模式** 运行——不需要任何 AI 配置即可体验全部功能（标点使用规则算法，差异分析使用 mock 数据）。

如需启用完整 AI 能力，编辑 `server/.env`：

```env
AI_API_BASE_URL=http://localhost:11434/v1   # Ollama 或其他兼容 OpenAI 的接口
AI_API_KEY=sk-xxx                           # API 密钥
AI_MODEL=qwen2.5:14b                        # 推荐模型
```

推荐使用 [Ollama](https://ollama.ai) 本地部署模型，数据不出本机。

### 种子数据

```bash
cd server && npx ts-node src/db/seed.ts
```

内置北宋（王安石变法）与唐初（贞观之治）两个时期的示例史料、实体与关系数据。

## API 概览

| 模块 | 端点示例 | 说明 |
|------|----------|------|
| OCR | `POST /api/ocr/upload` · `GET /api/ocr/status/:taskId` | 上传 + 异步处理 + 轮询进度 |
| 史料 | `GET /api/materials` · `POST /api/materials` · `DELETE /api/materials/:id` | CRUD + 标签 + 引用生成 |
| 标签 | `GET /api/tags` · `POST /api/tags` | CRUD |
| 图谱 | `GET /api/graph/visualize` · `POST /api/graph/entities` | 可视化数据 + 实体/关系管理 |
| 比对 | `POST /api/diff/compare` · `POST /api/diff/analyze` | 文本比对 + AI 分析 |
| 文档 | `GET /api/documents` · `PUT /api/documents/:id` | 写作文档 + 引用管理 |
| AI | `POST /api/ai/convert` · `POST /api/ai/punctuate` | 繁简转换 + 自动标点 |

## 数据库设计

共 8 张业务表 + 1 张 FTS5 全文索引虚表：

- **materials** — 史料主表（原文 / 转换 / 标点 / 最终四版本文本）
- **tags / material_tags** — 标签与多对多关联
- **entities / relations / material_entities** — 知识图谱实体、关系与史料关联
- **documents / document_citations** — 写作文档与引用
- **ocr_tasks** — OCR 异步处理任务
- **materials_fts** — FTS5 全文索引（触发器自动同步）

所有关联表使用 `ON DELETE CASCADE` 级联删除，数据库运行于 WAL 模式。

## License

本项目仅供学习研究使用。
