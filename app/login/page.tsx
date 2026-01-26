'use client';

import React from 'react';
import { useState, useEffect } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth-context';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Mail, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!loading && user) {
      sessionStorage.removeItem('hasShownWelcome');
    }
  }, [user, loading]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      sessionStorage.removeItem('hasShownWelcome');
      await signInWithEmailAndPassword(auth, email, password);
      
      // Start seamless transition
      setIsTransitioning(true);
      
      // Navigate after transition starts
      setTimeout(() => {
        router.push('/dashboard');
      }, 1800);
    } catch (err: any) {
      setError(err.message || 'Failed to login');
      setLoading(false);
    }
  };

  const handleContactIT = () => {
    window.location.href = 'https://wa.me/639467102826';
  };

  return (
    <>
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#0B1437]">
        {/* Animated background gradient - Enhanced */}
        <motion.div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at top left, rgba(70, 130, 180, 0.2) 0%, transparent 50%), radial-gradient(ellipse at bottom right, rgba(30, 58, 138, 0.15) 0%, transparent 50%)',
          }}
          animate={{
            opacity: [0.5, 0.9, 0.5],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Secondary gradient layer */}
        <motion.div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.1) 0%, transparent 60%)',
          }}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Elegant grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
          }}
        />

        {/* Animated geometric shapes */}
        <motion.div
          className="absolute top-1/4 left-1/4 w-96 h-96 border border-blue-400/10 rounded-full"
          animate={{
            scale: [1, 1.3, 1],
            rotate: [0, 180, 0],
            opacity: [0.1, 0.2, 0.1],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] border border-blue-300/8 rounded-full"
          animate={{
            scale: [1, 1.4, 1],
            rotate: [0, -180, 0],
            opacity: [0.08, 0.15, 0.08],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        />

        {/* Floating particles - more visible */}
        {isMounted && [...Array(40)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-blue-400/30 rounded-full"
            initial={{
              x: Math.random() * window.innerWidth,
              y: window.innerHeight + 100,
            }}
            animate={{
              y: -100,
              opacity: [0, 0.6, 0],
            }}
            transition={{
              duration: 10 + Math.random() * 8,
              repeat: Infinity,
              delay: Math.random() * 5,
              ease: "linear",
            }}
          />
        ))}

        {/* Subtle light beams */}
        <motion.div
          className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-blue-400/15 to-transparent"
          animate={{
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-0 right-1/3 w-px h-full bg-gradient-to-b from-transparent via-blue-300/15 to-transparent"
          animate={{
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />

        {/* Glowing orbs */}
        <motion.div
          className="absolute top-20 right-20 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-20 left-20 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.4, 1],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />

        {/* Main container - responsive split layout */}
        <div className="relative z-10 w-full max-w-4xl mx-auto px-4 py-6">
          <div className="grid lg:grid-cols-2 gap-0 bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[85vh]">
            
            {/* Left side - Blue branded section (hidden on mobile) */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="hidden lg:flex relative bg-gradient-to-br from-[#87CEEB] via-[#4682B4] to-[#1e3a8a] p-6 flex-col justify-between overflow-hidden"
            >
              {/* Wavy decorative element */}
              <div className="absolute top-0 right-0 w-64 h-64 opacity-10">
                <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#FFFFFF" d="M43.3,-76.4C56.5,-69.3,68.1,-58.1,75.6,-44.3C83.1,-30.5,86.5,-14.1,86.8,2.5C87.1,19.1,84.3,36,76.4,50.2C68.5,64.4,55.5,75.9,41,81.6C26.5,87.3,10.5,87.2,-5.8,86.4C-22.1,85.6,-38.7,84.1,-52.8,77.8C-66.9,71.5,-78.5,60.4,-84.9,46.5C-91.3,32.6,-92.5,15.9,-89.8,0.5C-87.1,-14.9,-80.5,-29.1,-71.5,-41.5C-62.5,-53.9,-51.1,-64.5,-38.1,-71.8C-25.1,-79.1,-10.6,-83.1,3.3,-88.4C17.2,-93.7,30.1,-83.5,43.3,-76.4Z" transform="translate(100 100)" />
                </svg>
              </div>

              <div className="relative z-10 flex flex-col justify-center h-full">
                {/* Logo and brand */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.6 }}
                  className="text-center mb-6"
                >
                  {/* Large ISC Logo */}
                  <div className="flex justify-center mb-4">
                    <div className="bg-white/95 backdrop-blur-sm rounded-xl p-3 shadow-2xl">
                      <img 
                        src="/isc-logo.png" 
                        alt="ISC Logo" 
                        className="w-48 h-auto object-contain"
                      />
                    </div>
                  </div>
                  
                  <h1 className="text-white text-2xl font-bold mb-2 leading-tight">
                    ISC Forms Portal
                  </h1>
                </motion.div>
              </div>

              {/* Bottom decoration */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2, duration: 0.6 }}
                className="relative z-10 text-center"
              >
                <div className="h-px bg-gradient-to-r from-transparent via-white/30 to-transparent mb-3" />
                <p className="text-blue-200 text-xs font-medium">
                  Inter-World Shipping Corporation
                </p>
                <p className="text-blue-300 text-[10px] mt-1">
                  A Member of the MaritimeCity Group of Companies
                </p>
              </motion.div>

              {/* Large decorative circle */}
              <motion.div
                className="absolute -bottom-32 -right-32 w-96 h-96 bg-white/5 rounded-full blur-3xl"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.3, 0.5, 0.3],
                }}
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
              />
            </motion.div>

            {/* Right side - Login section */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="p-6 lg:p-8 flex flex-col justify-center"
            >
              {/* Mobile logo - only shown on small screens */}
              <div className="lg:hidden mb-6 text-center">
                <div className="inline-flex items-center justify-center bg-white rounded-xl mb-3 shadow-lg p-3 border-2 border-[#4682B4]">
                  <img 
                    src="/isc-logo.png" 
                    alt="ISC Logo" 
                    className="w-40 h-auto object-contain"
                  />
                </div>
                <h2 className="text-xl font-bold text-gray-900">ISC Forms Portal</h2>
              </div>

              {/* Form header */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.6 }}
                className="mb-6"
              >
                <h2 className="hidden lg:block text-2xl font-bold text-gray-900 mb-2">
                  Sign in to your account
                </h2>
                <p className="hidden lg:block text-gray-600 text-sm">
                  Enter your credentials to access the portal
                </p>
              </motion.div>

              {/* Login Fields */}
              <div className="space-y-4">
                {/* Email Field */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.5 }}
                >
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                      <Mail size={18} />
                    </div>
                    <Input
                      type="email"
                      placeholder="your.name@isc.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                      onKeyDown={(e) => e.key === 'Enter' && handleLogin(e)}
                      disabled={loading}
                      className={`pl-11 h-11 border-2 rounded-xl transition-all duration-300 ${
                        focusedField === 'email'
                          ? 'border-[#4682B4] shadow-lg shadow-[#4682B4]/20'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    />
                  </div>
                </motion.div>

                {/* Password Field */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6, duration: 0.5 }}
                >
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                      <Lock size={18} />
                    </div>
                    <Input
                      type="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      onKeyDown={(e) => e.key === 'Enter' && handleLogin(e)}
                      disabled={loading}
                      className={`pl-11 h-11 border-2 rounded-xl transition-all duration-300 ${
                        focusedField === 'password'
                          ? 'border-[#4682B4] shadow-lg shadow-[#4682B4]/20'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    />
                  </div>
                </motion.div>

                {/* Error Message */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-xl border-2 border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                  >
                    {error}
                  </motion.div>
                )}

                {/* Submit Button */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7, duration: 0.5 }}
                >
                  <Button
                    onClick={handleLogin}
                    disabled={loading || !email || !password}
                    className="w-full h-11 bg-gradient-to-r from-[#4682B4] to-[#1e3a8a] hover:from-[#5a9fd4] hover:to-[#2a4a9a] text-white text-base font-semibold rounded-xl shadow-lg shadow-[#4682B4]/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                        />
                        Signing in...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        Sign In
                        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                      </span>
                    )}
                  </Button>
                </motion.div>
              </div>

              {/* Footer links */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8, duration: 0.5 }}
                className="mt-5 text-center"
              >
                <button
                  type="button"
                  onClick={handleContactIT}
                  className="text-sm text-[#4682B4] hover:text-[#1e3a8a] font-medium transition-colors"
                >
                  Forgot password? Contact IT Support
                </button>
              </motion.div>

              {/* Divider */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9, duration: 0.5 }}
                className="mt-5 mb-4"
              >
                <div className="h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
              </motion.div>

              {/* Trust indicators */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1, duration: 0.5 }}
                className="flex items-center justify-center gap-6 text-xs text-gray-500"
              >
                <div className="flex items-center gap-2">
                  <Lock size={12} className="text-green-600" />
                  <span>Secure Login</span>
                </div>
                <div className="w-px h-4 bg-gray-300" />
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  <span>System Online</span>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Seamless transition overlay - Original better version */}
      <AnimatePresence>
        {isTransitioning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100000] bg-[#0B1437] flex items-center justify-center"
          >
            {/* Expanding circle effect */}
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 3, opacity: 1 }}
              transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <div className="w-40 h-40 rounded-full bg-gradient-to-br from-[#4682B4] to-[#1e3a8a] blur-3xl" />
            </motion.div>

            {/* Ripple effects */}
            {[...Array(3)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute inset-0 flex items-center justify-center"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: [0, 2.5], opacity: [0.6, 0] }}
                transition={{
                  duration: 1.5,
                  delay: i * 0.2,
                  ease: "easeOut",
                }}
              >
                <div className="w-40 h-40 rounded-full border-2 border-blue-400" />
              </motion.div>
            ))}

            {/* Loading spinner */}
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="relative z-10"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 border-4 border-blue-300/30 border-t-blue-300 rounded-full"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}