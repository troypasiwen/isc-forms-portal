'use client';

import React from 'react';
import { useState, useEffect } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/lib/auth-context';
import { motion } from 'framer-motion';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
  if (!loading && !user) {
    router.replace('/login');
  }
}, [user, loading, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  const handleContactIT = () => {
    window.location.href = 'https://wa.me/639467102826';
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4">
      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/login-bg.jpg')" }}
      />

      {/* Overlay */}
      <div className="absolute inset-0 bg-blue-900/55" />

      {/* Login Modal */}
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          duration: 0.5,
          ease: [0.22, 1, 0.36, 1], // smooth enterprise easing
        }}
        className="relative z-10 w-full max-w-md"
      >
        <Card className="shadow-2xl border border-blue-200 bg-white overflow-hidden">
          {/* Top Accent */}
          <div className="h-2 bg-gradient-to-r from-blue-700 to-blue-400" />

          <div className="p-8">
            {/* Header */}
            <div className="mb-8 text-center">
              <img
                src="/isc-logo.png"
                alt="ISC Logo"
                className="mx-auto mb-4 h-14 w-auto"
              />

              <h1 className="text-2xl font-semibold text-blue-900 leading-tight">
                Inter-World Shipping Corporation
              </h1>

              <p className="mt-2 text-sm text-gray-600">
                Forms Portal
              </p>

              {/* Authorized Label */}
              <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-1 text-xs font-medium text-blue-800 border border-blue-200">
                Authorized Personnel Only
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">
                  Email Address
                </label>
                <Input
                  type="email"
                  placeholder="position@isc.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="border-gray-300 focus-visible:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">
                  Password
                </label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="border-gray-300 focus-visible:ring-blue-600"
                />
              </div>

              {error && (
                <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading || !email || !password}
                className="w-full h-11 bg-blue-700 hover:bg-blue-800 text-white text-base font-medium"
              >
                {loading ? 'Signing in…' : 'Sign In'}
              </Button>
            </form>

            {/* Footer Actions */}
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={handleContactIT}
                className="text-sm text-blue-700 hover:text-blue-900 underline-offset-4 hover:underline"
              >
                Forgot password? Contact IT Support
              </button>
            </div>

            {/* Version / Build */}
            <div className="mt-8 text-center text-xs text-gray-500">
              Version 1.0.0 • Build 2026.01
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
