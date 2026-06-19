import { useNotificationStore } from '../store/notificationStore';

export default function NotificationToast() {
  const notifications = useNotificationStore(s => s.notifications);
  const remove = useNotificationStore(s => s.removeNotification);

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] flex flex-col items-center gap-2 pointer-events-none">
      {notifications.map((n, i) => (
        <div
          key={n.id}
          className="bg-white/95 border border-red-200 rounded-xl px-5 py-3 shadow-lg text-sm text-accent-attack font-medium pointer-events-auto animate-fade-in"
          onClick={() => remove(n.id)}
        >
          ⚠️ {n.text}
        </div>
      ))}
    </div>
  );
}
