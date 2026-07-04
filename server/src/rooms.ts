import { GameState, GamePhase, CardDef } from '../../shared/types';
import {
  createGame, initGame, startTurn, endTurn, playCard,
  discardFromHand, unequipCard, handleGuessWeight, handleDraftPick,
  handleBucketChoice, handleEquipChoice, handleBrewConversion,
} from '../../shared/gameEngine';
import { validatePlayCard, validateEndTurn } from '../../shared/validation';
import { deepClone } from '../../shared/buffEngine';
import { CARDS } from '../../shared/constants';
import { addCardToHand } from '../../shared/cardEngine';

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
  rematchRequestedBy?: string; // playerId of who requested a rematch
}

export const rooms = new Map<string, Room>();
export const socketToRoom = new Map<string, { roomId: string; playerId: string }>();

// ===== 房间操作 =====
export function createRoom(socketId: string, playerName: string): { roomId: string; playerId: string } | null {
  const roomId = generateRoomCode();
  const playerId = generatePlayerId();

  const room: Room = {
    id: roomId,
    players: [{ id: playerId, socketId, name: playerName }],
    gameState: null,
    createdAt: Date.now(),
  };

  rooms.set(roomId, room);
  socketToRoom.set(socketId, { roomId, playerId });
  console.log(`[房间] 创建房间 ${roomId} (${playerName})`);
  return { roomId, playerId };
}

export function joinRoom(socketId: string, roomId: string, playerName: string): { success: boolean; playerId?: string; error?: string } {
  const room = rooms.get(roomId);
  if (!room) return { success: false, error: '房间不存在' };
  if (room.players.length >= 2) return { success: false, error: '房间已满' };

  const playerId = generatePlayerId();
  room.players.push({ id: playerId, socketId, name: playerName });
  socketToRoom.set(socketId, { roomId, playerId });

  // 两名玩家到齐，开始游戏
  if (room.players.length === 2) {
    const gameState = createGame(
      roomId,
      room.players[0].id, room.players[0].name,
      room.players[1].id, room.players[1].name
    );
    room.gameState = initGame(gameState);
  }

  return { success: true, playerId };
}

export function getRoom(roomId: string): Room | undefined {
  return rooms.get(roomId);
}

export function getRoomBySocketId(socketId: string): { roomId: string; playerId: string } | undefined {
  return socketToRoom.get(socketId);
}

export function removePlayer(socketId: string): { roomId: string; playerId: string } | undefined {
  const roomInfo = socketToRoom.get(socketId);
  if (!roomInfo) return undefined;

  const room = rooms.get(roomInfo.roomId);
  if (room) {
    if (room.players.length > 0) return roomInfo;
    room.players = room.players.filter(p => p.socketId !== socketId);
    if (room.players.length === 0) {
      rooms.delete(roomInfo.roomId);
      console.log(`[房间] 删除空房间 ${roomInfo.roomId}`);
    }
  }

  socketToRoom.delete(socketId);
  return roomInfo;
}

export function getAllRooms(): any[] {
  return Array.from(rooms.values()).map(room => ({
    id: room.id,
    players: room.players,
    status: room.gameState?.phase === 'playing' ? 'playing' : room.gameState?.phase === 'gameOver' ? 'finished' : 'waiting',
    elapsed: Math.floor((Date.now() - room.createdAt) / 1000),
  }));
}

function generateRoomCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function generatePlayerId(): string {
  return `player_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
}

// ===== 处理出牌 =====
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
    messages: result.messages,
  };
}

// ===== 处理结束回合 =====
export function handleEndTurn(socketId: string): { success: boolean; gameState?: GameState; error?: string } {
  const roomInfo = getRoomBySocketId(socketId);
  if (!roomInfo) return { success: false, error: '未找到房间' };

  const room = rooms.get(roomInfo.roomId);
  if (!room || !room.gameState) return { success: false, error: '房间或游戏状态不存在' };

  const validation = validateEndTurn(room.gameState, roomInfo.playerId);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  room.gameState = endTurn(room.gameState);
  if (room.gameState.phase !== GamePhase.GameOver) {
    room.gameState = startTurn(room.gameState);
  }

  return { success: true, gameState: room.gameState };
}

// ===== 丢弃手牌 =====
export function handleDiscardCard(socketId: string, cardId: string): { success: boolean; gameState?: GameState; error?: string } {
  const roomInfo = getRoomBySocketId(socketId);
  if (!roomInfo) return { success: false, error: '未找到房间' };

  const room = rooms.get(roomInfo.roomId);
  if (!room || !room.gameState) return { success: false, error: '房间或游戏状态不存在' };

  room.gameState = discardFromHand(room.gameState, roomInfo.playerId, cardId);
  return { success: true, gameState: room.gameState };
}

// ===== 卸下装备 =====
export function handleUnequipCard(socketId: string, slot: string): { success: boolean; gameState?: GameState; error?: string } {
  const roomInfo = getRoomBySocketId(socketId);
  if (!roomInfo) return { success: false, error: '未找到房间' };

  const room = rooms.get(roomInfo.roomId);
  if (!room || !room.gameState) return { success: false, error: '房间或游戏状态不存在' };

  room.gameState = unequipCard(room.gameState, roomInfo.playerId, slot);
  return { success: true, gameState: room.gameState };
}

// ===== 离开房间 =====
export function handleLeaveRoom(socketId: string): { roomId?: string; gameState?: GameState } {
  const roomInfo = removePlayer(socketId);
  if (!roomInfo) return {};

  const room = rooms.get(roomInfo.roomId);
  return { roomId: roomInfo.roomId, gameState: room?.gameState ?? undefined };
}

// ===== 侦测器 =====
export function handleGuessWeightAction(socketId: string, guess: number): { success: boolean; gameState?: GameState; error?: string } {
  const roomInfo = getRoomBySocketId(socketId);
  if (!roomInfo) return { success: false, error: '未找到房间' };
  const room = rooms.get(roomInfo.roomId);
  if (!room || !room.gameState) return { success: false, error: '房间或游戏状态不存在' };
  room.gameState = handleGuessWeight(room.gameState, roomInfo.playerId, guess);
  return { success: true, gameState: room.gameState };
}

// ===== 运输矿车 =====
export function handleDraftPickAction(socketId: string, cardIndex: number): { success: boolean; gameState?: GameState; error?: string } {
  const roomInfo = getRoomBySocketId(socketId);
  if (!roomInfo) return { success: false, error: '未找到房间' };
  const room = rooms.get(roomInfo.roomId);
  if (!room || !room.gameState) return { success: false, error: '房间或游戏状态不存在' };
  room.gameState = handleDraftPick(room.gameState, roomInfo.playerId, cardIndex);
  return { success: true, gameState: room.gameState };
}

// ===== 水桶 =====
export function handleBucketChoiceAction(socketId: string, lockType: string): { success: boolean; gameState?: GameState; error?: string } {
  const roomInfo = getRoomBySocketId(socketId);
  if (!roomInfo) return { success: false, error: '未找到房间' };
  const room = rooms.get(roomInfo.roomId);
  if (!room || !room.gameState) return { success: false, error: '房间或游戏状态不存在' };
  room.gameState = handleBucketChoice(room.gameState, roomInfo.playerId, lockType);
  return { success: true, gameState: room.gameState };
}

// ===== 诡异钓竿 =====
export function handleEquipChoiceAction(socketId: string, slot: string): { success: boolean; gameState?: GameState; error?: string } {
  const roomInfo = getRoomBySocketId(socketId);
  if (!roomInfo) return { success: false, error: '未找到房间' };
  const room = rooms.get(roomInfo.roomId);
  if (!room || !room.gameState) return { success: false, error: '房间或游戏状态不存在' };
  room.gameState = handleEquipChoice(room.gameState, roomInfo.playerId, slot);
  return { success: true, gameState: room.gameState };
}

// ===== 酿造台 =====
export function handleBrewConversionAction(socketId: string, cardId: string): { success: boolean; gameState?: GameState; error?: string } {
  const roomInfo = getRoomBySocketId(socketId);
  if (!roomInfo) return { success: false, error: '未找到房间' };
  const room = rooms.get(roomInfo.roomId);
  if (!room || !room.gameState) return { success: false, error: '房间或游戏状态不存在' };
  room.gameState = handleBrewConversion(room.gameState, roomInfo.playerId, cardId);
  return { success: true, gameState: room.gameState };
}

// ===== 调试：摸指定卡牌 =====
export function handleDebugDrawCard(socketId: string, cardIdInput: string): { success: boolean; gameState?: GameState; error?: string } {
  const roomInfo = getRoomBySocketId(socketId);
  if (!roomInfo) return { success: false, error: '未找到房间' };
  const room = rooms.get(roomInfo.roomId);
  if (!room || !room.gameState) return { success: false, error: '房间或游戏状态不存在' };

  const templateId = cardIdInput.startsWith('card_') ? cardIdInput : `card_${cardIdInput}`;
  const template = CARDS.find(c => c.id === templateId);
  if (!template) return { success: false, error: `未找到卡牌: ${cardIdInput}` };

  const newCard: CardDef = {
    ...template,
    id: `debug_${templateId}_${Date.now()}`,
  };

  const state = deepClone(room.gameState);
  const idx = state.players.findIndex(p => p.id === roomInfo.playerId);
  if (idx === -1) return { success: false, error: '玩家不存在' };
  addCardToHand(state.players[idx], newCard);
  room.gameState = state;
  return { success: true, gameState: state };
}

// ===== 管理员删除房间 =====
export function adminDeleteRoom(roomId: string): boolean {
  if (!rooms.has(roomId)) return false;
  rooms.delete(roomId);
  console.log(`[管理员] 删除房间 ${roomId}`);
  return true;
}

// ===== 再战 =====
export function handleRematchRequest(socketId: string): { success: boolean; requesterName?: string; error?: string } {
  const roomInfo = getRoomBySocketId(socketId);
  if (!roomInfo) return { success: false, error: '未找到房间' };

  const room = rooms.get(roomInfo.roomId);
  if (!room) return { success: false, error: '房间不存在' };
  if (room.gameState?.phase !== GamePhase.GameOver) {
    return { success: false, error: '游戏未结束' };
  }

  room.rematchRequestedBy = roomInfo.playerId;
  const requester = room.players.find(p => p.id === roomInfo.playerId);
  return { success: true, requesterName: requester?.name };
}

export function handleRematchAccept(socketId: string): { success: boolean; gameState?: GameState; error?: string } {
  const roomInfo = getRoomBySocketId(socketId);
  if (!roomInfo) return { success: false, error: '未找到房间' };

  const room = rooms.get(roomInfo.roomId);
  if (!room) return { success: false, error: '房间不存在' };
  if (!room.rematchRequestedBy) return { success: false, error: '没有再战请求' };

  // 重置再战状态
  room.rematchRequestedBy = undefined;

  // 创建新游戏
  const gameState = createGame(
    room.id,
    room.players[0].id, room.players[0].name,
    room.players[1].id, room.players[1].name,
  );
  room.gameState = initGame(gameState);
  return { success: true, gameState: room.gameState };
}

export function handleRematchDecline(socketId: string): { success: boolean; error?: string } {
  const roomInfo = getRoomBySocketId(socketId);
  if (!roomInfo) return { success: false, error: '未找到房间' };

  const room = rooms.get(roomInfo.roomId);
  if (!room) return { success: false, error: '房间不存在' };

  room.rematchRequestedBy = undefined;
  return { success: true };
}

// ===== 清理过期房间 =====
const ROOM_TTL = 5 * 60 * 1000;
export function startRoomCleanup(): void {
  setInterval(() => {
    const now = Date.now();
    for (const [roomId, room] of rooms.entries()) {
      // 原逻辑：人数 < 2 且 游戏未开始 且 超时 -> 删除
      // 这会导致只有房主一个人在等待时，超时后房间被删
      if (room.players.length < 2 && room.gameState === null && (now - room.createdAt) > ROOM_TTL) {
        console.log(`[清理] 过期房间 ${roomId}`);
        rooms.delete(roomId);
      }
    }
  }, 30000);
}
// 根据 playerId 查找所在的房间和玩家对象
export function getRoomByPlayerId(playerId: string): { room: Room; player: RoomPlayer } | undefined {
    for (const room of rooms.values()) {
        const player = room.players.find(p => p.id === playerId);
        if (player) return { room, player };
    }
    return undefined;
}

// 更新玩家的 socketId，并重新绑定 socketToRoom 映射
export function updatePlayerSocket(playerId: string, newSocketId: string): boolean {
    const data = getRoomByPlayerId(playerId);
    if (!data) return false;
    
    const { room, player } = data;
    
    // 更新房间内的 socketId
    player.socketId = newSocketId;
    
    // 更新映射表
    socketToRoom.set(newSocketId, { roomId: room.id, playerId });
    
    return true;
}
