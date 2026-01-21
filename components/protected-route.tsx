'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Card } from '@/components/ui/card';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8">
          <p className="text-muted-foreground">Loading...</p>
        </Card>
      </div>
    );
  }

  // While redirecting, don't render children
  if (!user) {
    return null;
  }

  return <>{children}</>;
}
