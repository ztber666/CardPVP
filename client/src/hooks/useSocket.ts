import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useGameStore } from '../store/gameStore';
import type { GameState } from '@shared/types';

// 全局单例 socket
let globalSocket: Socket | null = null;

function getSocket(): Socket {
  if (!globalSocket) {
    globalSocket = io(window.location.origin, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
    });
  }
  return globalSocket;
}

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const {
    setConnected,
    setPlayer,
    setGameState,
    setWaitingForOpponent,
    reset,
  } = useGameStore();

  // 连接
  const connect = useCallback(() => {
    const socket = getSocket();
    socket.connect();
    socketRef.current = socket;
  }, []);

  // 断开
  const disconnect = useCallback(() => {
    const socket = getSocket();
    socket.disconnect();
    socketRef.current = null;
    reset();
  }, [reset]);

  // 创建房间
  const createRoom = useCallback((playerName: string): Promise<{ roomId: string; playerId: string }> => {
    return new Promise((resolve, reject) => {
      const socket = getSocket();
      socket.emit('create_room', playerName, (response: { roomId: string; playerId: string }) => {
        if (response.roomId) {
          setPlayer({ id: response.playerId, name: playerName, roomId: response.roomId });
          setWaitingForOpponent(true);
          resolve(response);
        } else {
          reject(new Error('创建房间失败'));
        }
      });
    });
  }, [setPlayer, setWaitingForOpponent]);

  // 加入房间
  const joinRoom = useCallback((roomId: string, playerName: string): Promise<{ success: boolean; playerId?: string; error?: string }> => {
    return new Promise((resolve) => {
      const socket = getSocket();
      socket.emit('join_room', { roomId, playerName }, (response: { success: boolean; playerId?: string; error?: string }) => {
        if (response.success && response.playerId) {
          setPlayer({ id: response.playerId, name: playerName, roomId });
          resolve(response);
        } else {
          resolve(response);
        }
      });
    });
  }, [setPlayer]);

  // 出牌
  const playCard = useCallback((cardId: string, targetId: string): Promise<{ success: boolean; error?: string }> => {
    return new Promise((resolve) => {
      const socket = getSocket();
      socket.emit('play_card', { cardId, targetId }, (response: { success: boolean; error?: string }) => {
        resolve(response);
      });
    });
  }, []);

  // 结束回合
  const endTurn = useCallback((): Promise<{ success: boolean; error?: string }> => {
    return new Promise((resolve) => {
      const socket = getSocket();
      socket.emit('end_turn', {}, (response: { success: boolean; error?: string }) => {
        resolve(response);
      });
    });
  }, []);

  // 丢弃手牌
  const discardCard = useCallback((cardId: string): Promise<{ success: boolean; error?: string }> => {
    return new Promise((resolve) => {
      const socket = getSocket();
      socket.emit('discard_card', { cardId }, (response: { success: boolean; error?: string }) => {
        resolve(response);
      });
    });
  }, []);

  // 卸下装备
  const unequipCard = useCallback((slot: string): Promise<{ success: boolean; error?: string }> => {
    return new Promise((resolve) => {
      const socket = getSocket();
      socket.emit('unequip_card', { slot }, (response: { success: boolean; error?: string }) => {
        resolve(response);
      });
    });
  }, []);

  // 离开房间
  const leaveRoom = useCallback(() => {
    const socket = getSocket();
    socket.emit('leave_room');
    reset();
  }, [reset]);

  // 侦测器：猜测权重
  const guessWeight = useCallback((guess: number): Promise<{ success: boolean; error?: string }> => {
    return new Promise((resolve) => {
      const socket = getSocket();
      socket.emit('guess_weight', { guess }, (response: { success: boolean; error?: string }) => {
        resolve(response);
      });
    });
  }, []);

  // 附魔台：丢弃牌
  const enchantDiscard = useCallback((cardId: string): Promise<{ success: boolean; error?: string }> => {
    return new Promise((resolve) => {
      const socket = getSocket();
      socket.emit('enchant_discard', { cardId }, (response: { success: boolean; error?: string }) => {
        resolve(response);
      });
    });
  }, []);

  // 水桶：选择封锁类型
  const bucketChoice = useCallback((lockType: 'action' | 'strategy'): Promise<{ success: boolean; error?: string }> => {
    return new Promise((resolve) => {
      const socket = getSocket();
      socket.emit('bucket_choice', { lockType }, (response: { success: boolean; error?: string }) => {
        resolve(response);
      });
    });
  }, []);

  // 运输矿车：选牌
  const draftPick = useCallback((cardIndex: number): Promise<{ success: boolean; error?: string }> => {
    return new Promise((resolve) => {
      const socket = getSocket();
      socket.emit('draft_pick', { cardIndex }, (response: { success: boolean; error?: string }) => {
        resolve(response);
      });
    });
  }, []);

  // 初始化事件监听
  useEffect(() => {
    const socket = getSocket();

    socket.on('connect', () => {
      console.log('[Socket] 已连接');
      setConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('[Socket] 已断开');
      setConnected(false);
    });

    socket.on('player_joined', (data: { playerCount: number }) => {
      console.log('[Socket] 有玩家加入', data);
      setWaitingForOpponent(false);
    });

    socket.on('game_started', (state: GameState) => {
      console.log('[Socket] 游戏开始', state);
      setGameState(state);
      setWaitingForOpponent(false);
    });

    socket.on('state_update', (state: GameState) => {
      console.log('[Socket] 状态更新', state);
      setGameState(state);
    });

    socket.on('game_over', (data: { winnerId: string; state: GameState }) => {
      console.log('[Socket] 游戏结束', data);
      setGameState(data.state);
    });

    socket.on('opponent_left', () => {
      console.log('[Socket] 对手离开，返回大厅');
      reset();
      window.location.reload();
    });

    socket.on('error', (error: string) => {
      console.error('[Socket] 错误', error);
      if (error.includes('房间不存在') || error.includes('未找到房间')) {
        reset();
        window.location.reload();
      }
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('player_joined');
      socket.off('game_started');
      socket.off('state_update');
      socket.off('game_over');
      socket.off('opponent_left');
      socket.off('error');
    };
  }, [setConnected, setGameState, setWaitingForOpponent]);

  return {
    connect,
    disconnect,
    createRoom,
    joinRoom,
    playCard,
    endTurn,
    discardCard,
    unequipCard,
    leaveRoom,
    guessWeight,
    enchantDiscard,
    draftPick,
    bucketChoice,
  };
}
