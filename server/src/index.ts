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
  getAllRooms,
  adminDeleteRoom,
  handleGuessWeightAction,
  handleDraftPickAction,
  handleBucketChoiceAction,
  handleEquipChoiceAction,
  handleBrewConversionAction,
  handleDebugDrawCard,
  handleBlazeDiscardAction,
} from './rooms.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());

// 生产环境：托管前端静态文件
const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));

// 托管资源文件
const assetsDir = path.resolve(__dirname, '../../assets');
app.use('/assets', express.static(assetsDir));

// ===== 管理 API =====
app.get('/api/rooms', (_req, res) => {
  res.json(getAllRooms());
});

app.delete('/api/rooms/:roomId', (req, res) => {
  const { roomId } = req.params;
  const deleted = adminDeleteRoom(roomId);
  if (deleted) {
    res.json({ success: true, message: `房间 ${roomId} 已删除` });
  } else {
    res.status(404).json({ success: false, error: '房间不存在' });
  }
});

// ===== 后台管理页面 =====
app.get('/admin', (_req, res) => {
  const adminPath = path.resolve(__dirname, 'admin.html');
  res.sendFile(adminPath);
});

// ===== 托管前端（SPA 降级） =====
app.get('*', (_req, res) => {
  res.sendFile(path.resolve(clientDist, 'index.html'));
});

// ===== Socket.IO =====
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

const PORT = 3001;

// 服务端通知 → 广播给所有客户端（在 cardEngine.ts 中调用 showMessage 时触发）
(globalThis as any).__card_notify_handler = (msg: string, target: string) => {
  console.log('[Notify] 服务端发送 server_notify:', msg, 'target:', target);
  io.emit('server_notify', { text: msg, target });
};
console.log('[Notify] handler 已注册');

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
      socket.id,
      roomId,
      playerName || `玩家${socket.id.slice(0, 4)}`
    );

    if (result.success) {
      socket.join(roomId);

      // 通知房间内已有玩家
      io.to(roomId).emit('player_joined', {
        playerCount: room.players.length,
      });

      // 有 2 名玩家，开始游戏
      if (room.gameState) {
        io.to(roomId).emit('game_started', room.gameState);

        // 通知双方游戏开始
        for (const p of room.players) {
          const stateForPlayer = filterStateForPlayer(room.gameState, p.id);
          io.to(p.socketId).emit('state_update', stateForPlayer);
        }
      }

      callback({ success: true, playerId: result.playerId });
    } else {
      callback({ success: false, error: result.error });
    }
  });

  // ===== 出牌 =====
  socket.on('play_card', ({ cardId, targetId }: { cardId: string; targetId: string }, callback) => {
    console.log(`[出牌] ${socket.id} card:${cardId} target:${targetId}`);

    const result = handlePlayCard(socket.id, cardId, targetId);

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
            io.to(player.socketId).emit('state_update', filterStateForPlayer(result.gameState, player.id));
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

  // ===== 离开房间 =====
  socket.on('leave_room', () => {
    const result = handleLeaveRoom(socket.id);
    if (result.roomId) {
      socket.leave(result.roomId);
    }
  });

  // ===== 获取房间列表 =====
  socket.on('get_rooms', (callback) => {
    callback(getAllRooms());
  });

  // ===== 侦测器：猜测权重 =====
  socket.on('guess_weight', ({ guess }: { guess: number }, callback) => {
    const result = handleGuessWeightAction(socket.id, guess);
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

  // ===== 运输矿车：选牌 =====
  socket.on('draft_pick', ({ cardIndex }: { cardIndex: number }, callback) => {
    const result = handleDraftPickAction(socket.id, cardIndex);
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

  // ===== 水桶：选择封锁类型 =====
  socket.on('bucket_choice', ({ lockType }: { lockType: string }, callback) => {
    const result = handleBucketChoiceAction(socket.id, lockType);
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

  // ===== 诡异钓竿：选择装备 =====
  socket.on('equip_choice', ({ slot }: { slot: string }, callback) => {
    const result = handleEquipChoiceAction(socket.id, slot);
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

  // ===== 酿造台：选择转化方向 =====
  socket.on('brew_choice', ({ cardId }: { cardId: string }, callback) => {
    const result = handleBrewConversionAction(socket.id, cardId);
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

  // ===== 调试：摸指定卡牌 =====
  socket.on('debug_draw_card', ({ cardId }: { cardId: string }, callback) => {
    const result = handleDebugDrawCard(socket.id, cardId);
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

  // ===== 断线处理 =====
  socket.on('disconnect', () => {
    console.log(`[断线] ${socket.id}`);
    const roomInfo = removePlayer(socket.id);
    if (roomInfo) {
      io.to(roomInfo.roomId).emit('opponent_left');
    }
  });
});

function filterStateForPlayer(state: any, playerId: string): any {
  const filtered = JSON.parse(JSON.stringify(state));

  const draftOwner = filtered.players.find((p: any) => p.draftCards?.length > 0);
  const draftInfo = draftOwner ? { draftCards: draftOwner.draftCards, draftPlayerPick: draftOwner.draftPlayerPick, draftPickedBy: draftOwner.draftPickedBy } : null;

  for (const p of filtered.players) {
    if (p.id !== playerId) {
      p.hand = p.hand.map(() => ({ hidden: true }));
      p.deck = [];
      p.draftPickCount = undefined;
    } else {
      if (draftInfo) {
        p.draftCards = draftInfo.draftCards;
        p.draftPlayerPick = draftInfo.draftPlayerPick;
        p.draftPickedBy = draftInfo.draftPickedBy;
      }
    }
  }

  // 清理临时标记
  for (const p of filtered.players) {
    delete (p as any)._blazePowderTrigger;
  }

  return filtered;
}

server.listen(PORT, () => {
  console.log(`[CardPVP] 服务器启动: http://localhost:${PORT}`);
  startRoomCleanup();
});
