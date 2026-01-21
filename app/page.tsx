'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Card } from '@/components/ui/card';

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

 useEffect(() => {
  if (!loading) {
    if (user) {
      router.push('/dashboard');
    } else {
      // Use replace instead of push to prevent the user 
      // from clicking "back" into an empty state
      router.replace('/login');
    }
  }
}, [user, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Card className="p-8">
        <p className="text-muted-foreground">Loading...</p>
      </Card>
    </div>
  );
}
