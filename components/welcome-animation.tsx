'use client';

import { useEffect, useState } from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/lib/auth-context';
import { motion, AnimatePresence } from 'framer-motion';

export function WelcomeAnimation() {
  const { userData } = useAuth();
  const [show, setShow] = useState(false);
  const [isReady, setIsReady] = useState(true); // ✅ Start as true (don't block initially)

  const initials = (userData?.fullName || 'U')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  // ✅ FIXED: Single useEffect with consistent dependencies
  useEffect(() => {
    const hasShownWelcome = sessionStorage.getItem('hasShownWelcome');
    
    // If user is logged in and hasn't seen welcome
    if (userData && !hasShownWelcome) {
      // Block the content
      setIsReady(false);
      document.documentElement.style.overflow = 'hidden';
      
      // Show animation
      setShow(true);
      sessionStorage.setItem('hasShownWelcome', 'true');
      
      // Hide animation after 4 seconds
      const timer = setTimeout(() => {
        setShow(false);
        setTimeout(() => {
          setIsReady(true);
          document.documentElement.style.overflow = '';
        }, 800);
      }, 4000);

      return () => {
        clearTimeout(timer);
        document.documentElement.style.overflow = '';
      };
    } else {
      // User is not logged in or has seen welcome - don't block
      setIsReady(true);
      document.documentElement.style.overflow = '';
    }
  }, [userData]); // ✅ Consistent dependency array

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <>
      {/* Block all content until animation is done */}
      {!isReady && userData && (
        <div className="fixed inset-0 z-[99999] bg-[#0B1437]" />
      )}

      {/* Professional Welcome Animation */}
      <AnimatePresence>
        {show && userData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[100000] flex items-center justify-center overflow-hidden bg-[#0B1437]"
          >
            {/* Subtle animated gradient overlay */}
            <motion.div
              className="absolute inset-0"
              style={{
                background: 'radial-gradient(ellipse at center, rgba(59, 130, 246, 0.15) 0%, transparent 70%)',
              }}
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.3, 0.5, 0.3],
              }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
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

            {/* Floating particles - subtle */}
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 bg-blue-400/40 rounded-full"
                initial={{
                  x: Math.random() * window.innerWidth,
                  y: window.innerHeight + 100,
                  opacity: 0,
                }}
                animate={{
                  y: -100,
                  opacity: [0, 0.6, 0],
                }}
                transition={{
                  duration: 8 + Math.random() * 4,
                  repeat: Infinity,
                  delay: Math.random() * 4,
                  ease: "linear",
                }}
              />
            ))}

            {/* Main content container */}
            <div className="relative z-10 flex flex-col items-center max-w-4xl mx-auto px-6">
              {/* Elegant expanding circle behind avatar */}
              <div className="relative mb-10">
                <motion.div
                  className="absolute inset-0 -m-32 rounded-full border border-blue-400/20"
                  initial={{ scale: 0.3, opacity: 0 }}
                  animate={{ scale: 2, opacity: [0, 0.4, 0] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut" }}
                />
                <motion.div
                  className="absolute inset-0 -m-28 rounded-full border border-blue-300/30"
                  initial={{ scale: 0.3, opacity: 0 }}
                  animate={{ scale: 1.8, opacity: [0, 0.5, 0] }}
                  transition={{ duration: 2.5, delay: 0.3, repeat: Infinity, ease: "easeOut" }}
                />

                {/* Avatar with elegant entrance */}
                <motion.div
                  initial={{ scale: 0.8, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  transition={{ 
                    duration: 0.8,
                    delay: 0.3,
                    ease: [0.22, 1, 0.36, 1]
                  }}
                >
                  <motion.div
                    animate={{ 
                      boxShadow: [
                        '0 0 40px rgba(59, 130, 246, 0.3)',
                        '0 0 60px rgba(59, 130, 246, 0.5)',
                        '0 0 40px rgba(59, 130, 246, 0.3)',
                      ]
                    }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    className="rounded-full"
                  >
                    <Avatar className="w-44 h-44 border-4 border-white/10 shadow-2xl">
                      <AvatarImage
                        src={userData.profilePicture || '/placeholder.svg'}
                        alt={userData.fullName}
                        className="object-cover"
                      />
                      <AvatarFallback className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white font-bold text-5xl">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                  </motion.div>
                </motion.div>
              </div>

              {/* Text content with professional staggered entrance */}
              <motion.div
                className="text-center space-y-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8, duration: 0.6 }}
              >
                {/* Greeting */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                >
                  <p className="text-blue-300 text-lg font-medium tracking-wide uppercase">
                    {getGreeting()}
                  </p>
                </motion.div>

                {/* Welcome message */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 1.2, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  className="space-y-2"
                >
                  <h1 className="text-white text-3xl md:text-4xl font-light tracking-tight">
                    Welcome to the
                  </h1>
                  <h2 className="text-white text-4xl md:text-5xl font-bold tracking-tight">
                    ISC Forms Portal
                  </h2>
                </motion.div>

                {/* Divider line */}
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: '120px', opacity: 1 }}
                  transition={{ delay: 1.6, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                  className="mx-auto"
                >
                  <div className="h-[2px] bg-gradient-to-r from-transparent via-blue-400 to-transparent" />
                </motion.div>

                {/* User info */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 1.8, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  className="space-y-3 pt-2"
                >
                  <p className="text-white text-3xl md:text-4xl font-semibold tracking-tight">
                    {userData.fullName}
                  </p>
                  <p className="text-blue-200 text-xl font-medium">
                    {userData.position}
                  </p>
                  <div className="pt-1">
                    <span className="inline-block px-5 py-2 bg-white/10 text-white text-sm font-medium rounded-full backdrop-blur-sm border border-white/20">
                      {userData.department}
                    </span>
                  </div>
                </motion.div>

                {/* Loading indicator */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 2.4, duration: 0.4 }}
                  className="flex items-center justify-center gap-3 pt-8"
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="w-4 h-4 border-2 border-blue-300/50 border-t-blue-300 rounded-full"
                  />
                  <span className="text-blue-200/80 text-sm font-medium tracking-wide">
                    Preparing your workspace
                  </span>
                </motion.div>
              </motion.div>

              {/* Bottom accent line */}
              <motion.div
                className="absolute bottom-12 left-1/2 transform -translate-x-1/2"
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 1 }}
                transition={{ delay: 2.8, duration: 1, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="h-[1px] w-64 bg-gradient-to-r from-transparent via-blue-400/50 to-transparent" />
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}