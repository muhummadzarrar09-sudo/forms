'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFormStore, type FormNotification } from '@/store/form-store';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Bell, Check, Users, Trash2, ExternalLink } from 'lucide-react';

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

function NotificationIcon({ type }: { type: FormNotification['type'] }) {
  switch (type) {
    case 'new_response':
    case 'response_milestone':
      return <Users className="size-3.5 text-primary" />;
    case 'form_published':
      return <ExternalLink className="size-3.5 text-success" />;
    default:
      return <Bell className="size-3.5" />;
  }
}

export function NotificationBell() {
  const {
    notifications,
    markNotificationRead,
    clearNotifications,
    openResponses,
  } = useFormStore();

  const [open, setOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleNotificationClick = (notification: FormNotification) => {
    markNotificationRead(notification.id);
    setOpen(false);
    openResponses(notification.formId);
  };

  const handleMarkAllRead = () => {
    notifications.forEach((n) => {
      if (!n.read) markNotificationRead(n.id);
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-11 relative"
        >
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -right-0.5 -top-0.5 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-xs font-bold text-destructive-foreground"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </motion.span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h4 className="text-sm font-semibold">Notifications</h4>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="min-h-10 text-xs gap-1 px-3"
                onClick={handleMarkAllRead}
              >
                <Check className="size-3" />
                Mark all read
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="min-h-10 gap-1 px-3 text-xs text-destructive hover:text-destructive"
                onClick={clearNotifications}
              >
                <Trash2 className="size-3" />
                Clear
              </Button>
            )}
          </div>
        </div>

        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
              <Bell className="size-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                You&apos;ll be notified when your forms receive new responses
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`w-full text-left px-4 py-3 transition-colors hover:bg-muted/50 ${
                    !notification.read ? 'bg-primary/5' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 size-7 rounded-full flex items-center justify-center shrink-0 ${
                      !notification.read ? 'bg-primary/10' : 'bg-muted'
                    }`}>
                      <NotificationIcon type={notification.type} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-snug ${
                        !notification.read ? 'font-medium' : 'text-muted-foreground'
                      }`}>
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {timeAgo(notification.timestamp)}
                      </p>
                    </div>
                    {!notification.read && (
                      <div className="size-2 rounded-full bg-primary mt-2 shrink-0" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
