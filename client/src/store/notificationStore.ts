import { create } from 'zustand';

interface Notification {
  id: number;
  text: string;
}

interface NotificationStore {
  notifications: Notification[];
  addNotification: (text: string) => void;
  removeNotification: (id: number) => void;
}

// 使用计数器生成唯一ID，比 Date.now + Math.random 更高效且唯一性更强
let notificationId = 0;

export const useNotificationStore = create<NotificationStore>((set) => ({
  notifications: [],

  addNotification: (text) => {
    const id = ++notificationId;

    // 优化点1：使用函数式更新 set(state => ...)
    // 避免在 setTimeout 延迟期间，如果外部直接修改了 state 导致的状态覆盖或丢失问题
    set((state) => {
      const newNotifications = [...state.notifications, { id, text }];
      
      // 优化点2：限制最大显示数量（例如最多3条）
      // 防止快速刷屏时，界面上堆叠太多提示导致布局崩坏
      if (newNotifications.length > 3) {
        newNotifications.shift(); // 移除最早的一条
      }
      
      return { notifications: newNotifications };
    });

    setTimeout(() => {
      // 优化点3：移除时同样使用函数式更新
      // 确保只移除当前 ID，且不影响在计时器期间新添加的通知
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id),
      }));
    }, 3000);
  },

  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },
}));

/** 任意位置调用：屏幕上方弹出提示，3 秒后消失，多条自动向下堆叠（上限3条） */
export function displayMessage(text: string) {
  useNotificationStore.getState().addNotification(text);
}
