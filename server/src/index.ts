import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  createRoom,
  joinRoom,
  getRoom,
  getRoomBySocketId,
  handlePlayCard,
  handleEndTurn,
  handleDiscardCard,
  handleUnequipCard,
  handleLeaveRoom,
  removePlayer,
  startRoomCleanup,
} from './rooms.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());

// 生产环境：托管前端静态文件
const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));

// 托管资源文件（卡牌图片、Buff图标等）
const assetsDir = path.resolve(__dirname, '../../assets');
app.use('/assets', express.static(assetsDir));

// 所有非 API 路由返回 index.html（SPA 支持）
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  // 生产环境从 env 读取
  pingInterval: 10000,
  pingTimeout: 5000,
});

io.on('connection', (socket) => {
  console.log(`[连接] ${socket.id}`);

  // ===== 创建房间 =====
  socket.on('create_room', (playerName: string, callback) => {
    console.log(`[创建房间] ${socket.id} 玩家名: ${playerName}`);
    const { roomId, playerId } = createRoom(socket.id, playerName || `玩家${socket.id.slice(0, 4)}`);
    socket.join(roomId);
    callback({ roomId, playerId });
    console.log(`[创建成功] 房间: ${roomId}, 玩家: ${playerId}`);
  });

  // ===== 加入房间 =====
  socket.on('join_room', ({ roomId, playerName }: { roomId: string; playerName?: string }, callback) => {
    console.log(`[加入房间] ${socket.id} -> ${roomId}`);

    const room = getRoom(roomId);
    if (!room) {
      callback({ success: false, error: '房间不存在' });
      return;
    }

    const result = joinRoom(
      roomId,
      socket.id,
      playerName || `玩家${socket.id.slice(0, 4)}`
    );

    if (result.success) {
      socket.join(roomId);

      // 通知房间内已有玩家
      io.to(roomId).emit('player_joined', {
        playerCount: room.players.length,
        players: room.players.map(p => ({ id: p.id, name: p.name })),
      });

      // 如果游戏开始，通知双方
      if (result.gameState) {
        // 分别发送游戏状态（每人看自己的视角）
        for (const player of room.players) {
          const stateForPlayer = filterStateForPlayer(result.gameState, player.id);
          io.to(player.socketId).emit('game_started', stateForPlayer);
        }
      }

      callback({ success: true, playerId: result.playerId });
    } else {
      callback({ success: false, error: result.error });
    }
  });

  // ===== 出牌 =====
  socket.on('play_card', ({ cardId, targetId }: { cardId: string; targetId: string }, callback) => {
    console.log(`[出牌] ${socket.id} card:${cardId} -> ${targetId}`);

    const result = handlePlayCard(socket.id, cardId, targetId);

    if (result.success && result.gameState) {
      // 广播给房间内双方
      const roomInfo = getRoomBySocketId(socket.id);
      if (roomInfo) {
        const room = getRoom(roomInfo.roomId);
        if (room) {
          for (const player of room.players) {
            const stateForPlayer = filterStateForPlayer(result.gameState, player.id);
            io.to(player.socketId).emit('state_update', stateForPlayer);
          }

          // 游戏结束处理
          if (result.gameState.phase === 'gameOver') {
            // 延迟一点发送结束事件
            setTimeout(() => {
              for (const player of room.players) {
                io.to(player.socketId).emit('game_over', {
                  winnerId: result.gameState!.winnerId,
                  state: filterStateForPlayer(result.gameState!, player.id),
                });
              }
            }, 500);
          }
        }
      }

      callback({ success: true, messages: result.messages });
    } else {
      callback({ success: false, error: result.error });
    }
  });

  // ===== 结束回合 =====
  socket.on('end_turn', (_data, callback) => {
    console.log(`[结束回合] ${socket.id}`);

    const result = handleEndTurn(socket.id);

    if (result.success && result.gameState) {
      const roomInfo = getRoomBySocketId(socket.id);
      if (roomInfo) {
        const room = getRoom(roomInfo.roomId);
        if (room) {
          for (const player of room.players) {
            const stateForPlayer = filterStateForPlayer(result!.gameState!, player.id);
            io.to(player.socketId).emit('state_update', stateForPlayer);
          }
        }
      }
      callback({ success: true });
    } else {
      callback({ success: false, error: result.error });
    }
  });

  // ===== 丢弃手牌 =====
  socket.on('discard_card', ({ cardId }: { cardId: string }, callback) => {
    console.log(`[丢弃] ${socket.id} card:${cardId}`);

    const result = handleDiscardCard(socket.id, cardId);

    if (result.success && result.gameState) {
      const roomInfo = getRoomBySocketId(socket.id);
      if (roomInfo) {
        const room = getRoom(roomInfo.roomId);
        if (room) {
          for (const player of room.players) {
            const stateForPlayer = filterStateForPlayer(result.gameState, player.id);
            io.to(player.socketId).emit('state_update', stateForPlayer);
          }
        }
      }
      callback({ success: true });
    } else {
      callback({ success: false, error: result.error });
    }
  });

  // ===== 卸下装备 =====
  socket.on('unequip_card', ({ slot }: { slot: string }, callback) => {
    const result = handleUnequipCard(socket.id, slot);
    if (result.success && result.gameState) {
      const roomInfo = getRoomBySocketId(socket.id);
      if (roomInfo) {
        const room = getRoom(roomInfo.roomId);
        if (room) {
          for (const player of room.players) {
            io.to(player.socketId).emit('state_update', filterStateForPlayer(result.gameState, player.id));
          }
        }
      }
      callback({ success: true });
    } else {
      callback({ success: false, error: result.error });
    }
  });

  // ===== 主动离开房间 =====
  socket.on('leave_room', () => {
    console.log(`[离开房间] ${socket.id}`);
    handleLeaveRoom(socket.id);
  });

  // ===== 断线处理 =====
  socket.on('disconnect', () => {
    console.log(`[断线] ${socket.id}`);
    const roomInfo = removePlayer(socket.id);
    if (roomInfo) {
      io.to(roomInfo.roomId).emit('opponent_left');
    }
  });
});

/**
 * 为特定玩家过滤游戏状态（隐藏对手手牌和牌库）
 */
function filterStateForPlayer(state: any, playerId: string): any {
  const filtered = JSON.parse(JSON.stringify(state));

  for (const player of filtered.players) {
    if (player.id !== playerId) {
      // 对手只看手牌数量，不看作具体牌
      player.hand = player.hand.map(() => ({ hidden: true }));
      // 隐藏对手牌库
      player.deck = [];
    }
  }

  return filtered;
}

// 启动服务器
const PORT = parseInt(process.env.PORT || '3001', 10);
httpServer.listen(PORT, () => {
  console.log(`[CardPVP] 服务器启动: http://localhost:${PORT}`);
  startRoomCleanup();
});
