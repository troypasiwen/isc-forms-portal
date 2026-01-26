'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { NotificationBell } from '@/components/notifications';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { LogOut, Settings } from 'lucide-react';
import Link from 'next/link';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export function TopBar() {
  const { userData, logout, user } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profilePicture, setProfilePicture] = useState<string | null>(null);

  const initials = (userData?.fullName || 'U')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  // Real-time listener for profile picture updates
  useEffect(() => {
    if (!user?.uid) return;

    const userRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setProfilePicture(data.profilePicture || null);
      }
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // Use real-time profile picture if available, otherwise fall back to userData
  const currentProfilePicture = profilePicture || userData?.profilePicture || '/placeholder.svg';

  return (
    <div className="hidden md:flex items-center justify-between px-8 py-4 bg-card border-b border-border">
      {/* Spacer */}
      <div />

      {/* Right Section */}
      <div className="flex items-center gap-6">
        {/* Notifications */}
        <NotificationBell />

        {/* Profile Menu */}
        <div className="relative">
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-3 p-2 hover:bg-secondary rounded-lg transition-colors"
          >
            <Avatar className="w-8 h-8">
              <AvatarImage
                src={currentProfilePicture}
                alt={userData?.fullName}
              />
              <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium text-foreground hidden sm:block">
              {userData?.fullName}
            </span>
          </button>

          {/* Dropdown */}
          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-card border border-border rounded-lg shadow-lg z-50">
              <div className="p-4 border-b border-border">
                <p className="text-sm font-semibold text-foreground">
                  {userData?.fullName}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {userData?.email}
                </p>
                <p className="text-xs text-primary font-medium mt-2">
                  {userData?.role}
                </p>
              </div>

              <div className="p-3 space-y-2">
                <Link href="/profile">
                  <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-secondary rounded transition-colors">
                    <Settings size={16} />
                    Profile Settings
                  </button>
                </Link>
              </div>

              <div className="p-3 border-t border-border">
                <Button
                  onClick={async () => {
                    await logout();
                    setIsProfileOpen(false);
                  }}
                  className="w-full justify-center gap-2 bg-destructive/10 text-destructive hover:bg-destructive/20"
                >
                  <LogOut size={16} />
                  Logout
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Overlay */}
      {isProfileOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsProfileOpen(false)}
        />
      )}
    </div>
  );
}