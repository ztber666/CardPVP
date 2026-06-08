import { GameState, GamePhase } from '../../shared/types';
import { createGame, initGame, startTurn, endTurn, playCard, PlayCardResult, discardFromHand, unequipCard } from '../../shared/gameEngine';
import { validatePlayCard, validateEndTurn } from '../../shared/validation';

/**
 * 房间管理
 */

interface RoomPlayer {
  id: string;
  socketId: string;
  name: string;
}

interface Room {
  id: string;
  players: RoomPlayer[];
  gameState: GameState | null;
  createdAt: number;
}

const rooms = new Map<string, Room>();

// 生成4位数字房间码
function generateRoomId(): string {
  let id = '';
  for (let i = 0; i < 4; i++) {
    id += Math.floor(Math.random() * 10).toString();
  }
  // 避免冲突
  if (rooms.has(id)) return generateRoomId();
  return id;
}

export function createRoom(socketId: string, playerName: string): { roomId: string; playerId: string } {
  const roomId = generateRoomId();
  const playerId = `player_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const room: Room = {
    id: roomId,
    players: [{ id: playerId, socketId, name: playerName }],
    gameState: null,
    createdAt: Date.now(),
  };

  rooms.set(roomId, room);
  return { roomId, playerId };
}

export function joinRoom(
  roomId: string,
  socketId: string,
  playerName: string
): { success: boolean; playerId?: string; error?: string; gameState?: GameState } {
  const room = rooms.get(roomId);
  if (!room) {
    return { success: false, error: '房间不存在' };
  }

  if (room.players.length >= 2) {
    return { success: false, error: '房间已满' };
  }

  const playerId = `player_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  room.players.push({ id: playerId, socketId, name: playerName });

  // 满2人，开始游戏
  if (room.players.length === 2) {
    let state = createGame(
      roomId,
      room.players[0].id,
      room.players[0].name,
      room.players[1].id,
      room.players[1].name,
    );
    state = initGame(state);
    room.gameState = state;
    return { success: true, playerId, gameState: state };
  }

  return { success: true, playerId };
}

export function getRoom(roomId: string): Room | undefined {
  return rooms.get(roomId);
}

export function getRoomBySocketId(socketId: string): { roomId: string; playerId: string } | null {
  for (const [roomId, room] of rooms.entries()) {
    const player = room.players.find(p => p.socketId === socketId);
    if (player) return { roomId, playerId: player.id };
  }
  return null;
}

export function handlePlayCard(
  socketId: string,
  cardId: string,
  targetId: string
): { success: boolean; gameState?: GameState; error?: string; messages?: string[] } {
  const roomInfo = getRoomBySocketId(socketId);
  if (!roomInfo) return { success: false, error: '未找到房间' };

  const room = rooms.get(roomInfo.roomId);
  if (!room || !room.gameState) return { success: false, error: '房间或游戏状态不存在' };

  const validation = validatePlayCard(room.gameState, roomInfo.playerId, { cardId, targetId });
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const result = playCard(room.gameState, { cardId, targetId }, roomInfo.playerId);

  if (result.success) {
    room.gameState = result.gameState;
  }

  return {
    success: result.success,
    gameState: result.gameState,
    error: result.error,
    messages: result.messages,
  };
}

export function handleEndTurn(socketId: string): { success: boolean; gameState?: GameState; error?: string } {
  const roomInfo = getRoomBySocketId(socketId);
  if (!roomInfo) return { success: false, error: '未找到房间' };

  const room = rooms.get(roomInfo.roomId);
  if (!room || !room.gameState) return { success: false, error: '房间或游戏状态不存在' };

  const validation = validateEndTurn(room.gameState, roomInfo.playerId);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // 结束回合
  let state = endTurn(room.gameState);

  // 如果游戏未结束，开始新回合
  if (state.phase === 'playing') {
    state = startTurn(state);
  }

  room.gameState = state;
  return { success: true, gameState: state };
}

export function handleDiscardCard(socketId: string, cardId: string): { success: boolean; gameState?: GameState; error?: string } {
  const roomInfo = getRoomBySocketId(socketId);
  if (!roomInfo) return { success: false, error: '未找到房间' };

  const room = rooms.get(roomInfo.roomId);
  if (!room || !room.gameState) return { success: false, error: '房间或游戏状态不存在' };

  room.gameState = discardFromHand(room.gameState, roomInfo.playerId, cardId);
  return { success: true, gameState: room.gameState };
}

export function handleUnequipCard(socketId: string, slot: string): { success: boolean; gameState?: GameState; error?: string } {
  const roomInfo = getRoomBySocketId(socketId);
  if (!roomInfo) return { success: false, error: '未找到房间' };
  const room = rooms.get(roomInfo.roomId);
  if (!room || !room.gameState) return { success: false, error: '房间或游戏状态不存在' };
  room.gameState = unequipCard(room.gameState, roomInfo.playerId, slot);
  return { success: true, gameState: room.gameState };
}

export function removePlayer(socketId: string): { roomId: string; wasHost: boolean } | null {
  for (const [roomId, room] of rooms.entries()) {
    const idx = room.players.findIndex(p => p.socketId === socketId);
    if (idx !== -1) {
      room.players.splice(idx, 1);
      if (room.players.length === 0) {
        rooms.delete(roomId);
      }
      return { roomId, wasHost: idx === 0 };
    }
  }
  return null;
}

// ===== 主动离开房间（取消匹配） =====
export function handleLeaveRoom(socketId: string): string | null {
  for (const [roomId, room] of rooms.entries()) {
    const idx = room.players.findIndex(p => p.socketId === socketId);
    if (idx !== -1) {
      room.players.splice(idx, 1);
      // 房间空了直接删除
      if (room.players.length === 0) {
        rooms.delete(roomId);
      }
      return roomId;
    }
  }
  return null;
}

// ===== 获取所有房间信息 =====
export function getAllRooms(): Array<{
  id: string;
  playerCount: number;
  players: { id: string; name: string }[];
  status: 'waiting' | 'playing' | 'finished';
  elapsed: number; // 已过秒数
  createdAt: number;
}> {
  const now = Date.now();
  const result: ReturnType<typeof getAllRooms> = [];
  for (const [roomId, room] of rooms.entries()) {
    let status: 'waiting' | 'playing' | 'finished' = 'waiting';
    if (room.gameState) {
      status = room.gameState.phase === 'gameOver' ? 'finished' : 'playing';
    }
    result.push({
      id: roomId,
      playerCount: room.players.length,
      players: room.players.map(p => ({ id: p.id, name: p.name })),
      status,
      elapsed: Math.floor((now - room.createdAt) / 1000),
      createdAt: room.createdAt,
    });
  }
  return result;
}

// ===== 管理员删除房间 =====
export function adminDeleteRoom(roomId: string): boolean {
  if (!rooms.has(roomId)) return false;
  rooms.delete(roomId);
  console.log(`[管理员] 删除房间 ${roomId}`);
  return true;
}

// ===== 清理过期房间（每30秒检查一次） =====
const ROOM_TTL = 5 * 60 * 1000; // 5分钟
export function startRoomCleanup(): void {
  setInterval(() => {
    const now = Date.now();
    for (const [roomId, room] of rooms.entries()) {
      // 只有1人且在等待中超过TTL → 删除
      if (room.players.length < 2 && room.gameState === null && (now - room.createdAt) > ROOM_TTL) {
        console.log(`[清理] 过期房间 ${roomId}`);
        rooms.delete(roomId);
      }
    }
  }, 30000);
  console.log('[房间清理] 已启动，每30秒检查一次');
}
