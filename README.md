# CardPVP 🃏

一款双人对战的卡牌游戏，基于 **React + Socket.IO + TypeScript** 构建。

> 玩家各自操控一名角色，使用手牌进行攻防对抗，率先将对方 HP 降至 0 即可获胜。

---

## 技术栈

| 层 | 技术 |
|------|------|
| **前端** | React 18 + TypeScript + Vite + Tailwind CSS |
| **后端** | Express + Socket.IO + TypeScript |
| **状态管理** | Zustand |
| **共享逻辑** | TypeScript（纯函数游戏引擎，前后端共用） |

## 快速开始

```bash
# 安装所有依赖
npm install
cd client && npm install && cd ..
cd server && npm install && cd ..

# 同时启动前后端（开发模式）
npm run dev
```

- 前端：http://localhost:5173
- 后端：http://localhost:3001

## 游戏规则

### 基本流程

1. **创建 / 加入房间** — 一名玩家创建房间，另一名输入房间号加入
2. **开局摸牌** — 双方各摸 2 张牌，随机决定先手
3. **回合流程**
   - 回合开始 → 当前玩家摸 **3 张牌**
   - 使用手牌（行动卡 1 张 / 锦囊卡最多 3 张）
   - 结束回合 → 轮到对方
4. **胜负判定** — 任意玩家 HP ≤ 0 时游戏结束

### 卡牌类型

| 类型 | 说明 |
|------|------|
| **行动卡** 🗡️ | 每回合限出 1 张，通常为攻击/核心操作 |
| **锦囊卡** 🎯 | 每回合最多出 3 张，策略性辅助效果 |
| **装备卡** 🛡️ | 占用装备槽，替换旧装备 |
| **武器卡** ⚔️ | 占用武器槽，替换旧武器 |
| **场地卡** 🏟️ | 占用场地槽，替换旧场地 |
| **回血卡** 💚 | 回复血量，不计入行动/锦囊限额 |
| **增益/减益卡** | 施加各种 Buff 效果 |

### Buff 系统

游戏包含丰富的 Buff 类型：力量、虚弱、抗性、易伤、护盾、凋零、中毒、尖刺、潮湿、蓄力、行动封锁等 20+ 种状态，支持层数叠加和回合倒计时。

### 牌组循环

牌组抽空后自动将弃牌堆洗回牌组，保证对局不会因牌尽而中断。

## 项目结构

```
CardPVP/
├── client/                  # 前端 React 应用
│   └── src/
│       ├── components/      # UI 组件（手牌、Buff、卡牌详情、日志等）
│       ├── pages/           # 页面（Lobby 大厅、Game 对战）
│       ├── hooks/           # 自定义 Hooks（Socket 连接）
│       ├── store/           # Zustand 状态管理
│       └── styles/          # 全局样式（Tailwind）
├── server/                  # 后端服务
│   └── src/
│       ├── index.ts         # Express + Socket.IO 入口
│       └── rooms.ts         # 房间管理与游戏流程调度
├── shared/                  # 前后端共享
│   ├── types.ts             # 类型定义（卡牌、Buff、玩家等）
│   ├── constants.ts         # 常量 & 卡牌模板
│   ├── gameEngine.ts        # 游戏流程引擎（回合、出牌、结束）
│   ├── cardEngine.ts        # 卡牌效果引擎（摸牌、洗牌、效果执行）
│   ├── buffEngine.ts        # Buff 计算（伤害、治疗、状态倒计时）
│   └── validation.ts        # 服务端校验
├── assets/                  # 音频、图片资源
│   ├── audio/               # 音效 & 背景音乐
│   ├── buff/                # Buff 图标
│   ├── item/                # 卡牌图标
│   └── icon/                # 类型图标
└── package.json             # 根 scripts（dev/build/start）
```

## 开发

```bash
# 仅启动后端
npm run dev:server

# 仅启动前端
npm run dev:client

# 构建前端
npm run build
```

## 许可

MIT
