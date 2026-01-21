'use client';

import { ProtectedRoute } from '@/components/protected-route';
import { Sidebar } from '@/components/sidebar';
import { TopBar } from '@/components/top-bar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth-context';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

export default function ProfilePage() {
  const { userData } = useAuth();

  const initials = (userData?.fullName || 'U')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  return (
    <ProtectedRoute>
      <div className="flex">
        <Sidebar />

        <main className="flex-1 bg-background md:ml-64">
          {/* Top Bar */}
          <TopBar />

          <div className="p-6 md:p-8 max-w-2xl">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-foreground">
                My Profile
              </h1>
              <p className="text-muted-foreground mt-2">
                View and manage your account information
              </p>
            </div>

            {/* Profile Card */}
            <Card className="p-8 space-y-6">
              {/* Avatar Section */}
              <div className="flex items-center gap-6">
                <Avatar className="w-24 h-24">
                  <AvatarImage
                    src={userData?.profilePicture || "/placeholder.svg"}
                    alt={userData?.fullName}
                  />
                  <AvatarFallback className="bg-primary text-primary-foreground font-bold text-xl">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">
                    {userData?.fullName}
                  </h2>
                  <p className="text-muted-foreground">{userData?.email}</p>
                  <div className="flex gap-2 mt-2">
                    <span className="inline-block px-3 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full">
                      {userData?.role}
                    </span>
                    {userData?.isApprover && (
                      <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                        Approver
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t border-border pt-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                  Employment Information
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Full Name
                    </label>
                    <Input
                      type="text"
                      value={userData?.fullName || ''}
                      disabled
                      className="bg-secondary"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Email
                    </label>
                    <Input
                      type="email"
                      value={userData?.email || ''}
                      disabled
                      className="bg-secondary"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Position
                    </label>
                    <Input
                      type="text"
                      value={userData?.position || ''}
                      disabled
                      className="bg-secondary"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Department
                    </label>
                    <Input
                      type="text"
                      value={userData?.department || ''}
                      disabled
                      className="bg-secondary"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-border pt-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                  Account Status
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Your account information is managed by your administrator.
                  Contact your HR department to request changes.
                </p>
              </div>
            </Card>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
