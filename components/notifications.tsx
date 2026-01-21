'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  doc,
  deleteDoc,
  QueryConstraint,
} from 'firebase/firestore';
import { Bell, X } from 'lucide-react';

interface Notification {
  id: string;
  recipientId: string;
  type: string;
  title: string;
  message: string;
  formId?: string;
  createdAt: any;
  read: boolean;
}

export function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (!user) return;

    const constraints: QueryConstraint[] = [
      where('recipientId', '==', user.uid),
    ];

    const notificationsRef = collection(db, 'notifications');
    const notificationsQuery = query(notificationsRef, ...constraints);

    const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
      const notificationsList = snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .sort(
          (a, b) =>
            (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0)
        ) as Notification[];

      setNotifications(notificationsList.slice(0, 10)); // Keep last 10
    });

    return () => unsubscribe();
  }, [user]);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        read: true,
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleDelete = async (notificationId: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', notificationId));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-secondary rounded-lg transition-colors"
      >
        <Bell size={24} className="text-foreground" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-5 h-5 bg-destructive text-primary-foreground text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-card border border-border rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              No notifications yet
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-secondary/30 transition-colors ${
                    !notification.read ? 'bg-secondary/50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() =>
                        handleMarkAsRead(notification.id)
                      }
                    >
                      <h4 className="text-sm font-semibold text-foreground">
                        {notification.title}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground/60 mt-2">
                        {new Date(
                          notification.createdAt?.toDate?.() || Date.now()
                        ).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(notification.id)}
                      className="p-1 hover:bg-secondary rounded"
                    >
                      <X size={16} className="text-muted-foreground" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
