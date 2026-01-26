'use client';

import { useState, useEffect } from 'react';
import { ProtectedRoute } from '@/components/protected-route';
import { Sidebar } from '@/components/sidebar';
import { TopBar } from '@/components/top-bar';
import { WelcomeAnimation } from '@/components/welcome-animation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import {
  collection,
  query,
  where,
  getDocs,
  QueryConstraint,
} from 'firebase/firestore';
import {
  BarChart3,
  FileText,
  CheckCircle,
  Clock,
  TrendingUp,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';

interface DashboardStats {
  totalSubmissions: number;
  pendingApprovals: number;
  approvedForms: number;
  recentForms: any[];
}

export default function DashboardPage() {
  const { userData, user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalSubmissions: 0,
    pendingApprovals: 0,
    approvedForms: 0,
    recentForms: [],
  });
  const [loading, setLoading] = useState(true);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger animations after welcome animation
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!user) return;

    const fetchStats = async () => {
      try {
        const constraints: QueryConstraint[] = [];

        if (userData?.role !== 'Admin') {
          constraints.push(where('submittedBy', '==', user.uid));
        }

        const submissionsRef = collection(db, 'forms');
        const submissionsQuery = query(submissionsRef, ...constraints);
        const submissionsSnap = await getDocs(submissionsQuery);
        const totalSubmissions = submissionsSnap.size;

        const recentForms = submissionsSnap.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .slice(0, 5);

        const approvedQuery = query(
          submissionsRef,
          ...[...constraints, where('status', '==', 'Approved')]
        );
        const approvedSnap = await getDocs(approvedQuery);
        const approvedForms = approvedSnap.size;

        let pendingApprovals = 0;
        if (userData?.isApprover) {
          const pendingQuery = query(
            submissionsRef,
            where('status', '==', 'Pending Approval'),
            where('assignedApprovers', 'array-contains', user.uid)
          );
          const pendingSnap = await getDocs(pendingQuery);
          pendingApprovals = pendingSnap.size;
        }

        setStats({
          totalSubmissions,
          pendingApprovals,
          approvedForms,
          recentForms,
        });
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [user, userData]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        ease: [0.22, 1, 0.36, 1],
      },
    },
  };

  const cardHoverVariants = {
    hover: {
      y: -5,
      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      transition: {
        duration: 0.3,
        ease: 'easeOut',
      },
    },
  };

  return (
    <ProtectedRoute>
      <WelcomeAnimation />
      
      <div className="flex relative overflow-hidden">
        {/* Animated background elements */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <motion.div
            className="absolute top-20 right-20 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute bottom-20 left-20 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl"
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          />
        </div>

        <Sidebar />

        <main className="flex-1 bg-background md:ml-64 relative z-10">
          <TopBar />

          {/* Page Header with animation */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="bg-gradient-to-r from-card via-card to-card/50 border-b border-border p-6 md:p-8 relative overflow-hidden"
          >
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/5 rounded-full blur-2xl" />
            
            <div className="relative z-10">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2, duration: 0.6 }}
                className="flex items-center gap-2 mb-2"
              >
                <Sparkles className="text-primary" size={24} />
                <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
              </motion.div>
              <motion.p
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3, duration: 0.6 }}
                className="text-muted-foreground"
              >
                {getGreeting()}, {userData?.position} {userData?.fullName} • {new Date().toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </motion.p>
            </div>
          </motion.div>

          {/* Content */}
          <div className="p-6 md:p-8 space-y-8">
            {/* Stats Grid with stagger animation */}
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate={isVisible ? "visible" : "hidden"}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
            >
              <motion.div variants={itemVariants} whileHover="hover">
                <motion.div variants={cardHoverVariants}>
                  <Card className="p-6 relative overflow-hidden group cursor-pointer">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="flex items-start justify-between relative z-10">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          Total Submissions
                        </p>
                        <motion.p
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.5, duration: 0.5 }}
                          className="text-3xl font-bold text-foreground mt-2"
                        >
                          {loading ? (
                            <motion.span
                              animate={{ opacity: [0.5, 1, 0.5] }}
                              transition={{ duration: 1.5, repeat: Infinity }}
                            >
                              -
                            </motion.span>
                          ) : (
                            stats.totalSubmissions
                          )}
                        </motion.p>
                      </div>
                      <motion.div
                        whileHover={{ rotate: 360, scale: 1.1 }}
                        transition={{ duration: 0.5 }}
                      >
                        <FileText className="text-primary/50 group-hover:text-primary transition-colors" size={32} />
                      </motion.div>
                    </div>
                  </Card>
                </motion.div>
              </motion.div>

              {userData?.isApprover && (
                <motion.div variants={itemVariants} whileHover="hover">
                  <motion.div variants={cardHoverVariants}>
                    <Card className="p-6 border-l-4 border-l-primary relative overflow-hidden group cursor-pointer">
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <div className="flex items-start justify-between relative z-10">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">
                            Pending Approvals
                          </p>
                          <motion.p
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.6, duration: 0.5 }}
                            className="text-3xl font-bold text-foreground mt-2"
                          >
                            {loading ? (
                              <motion.span
                                animate={{ opacity: [0.5, 1, 0.5] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                              >
                                -
                              </motion.span>
                            ) : (
                              stats.pendingApprovals
                            )}
                          </motion.p>
                        </div>
                        <motion.div
                          whileHover={{ rotate: 360, scale: 1.1 }}
                          transition={{ duration: 0.5 }}
                        >
                          <Clock className="text-primary/50 group-hover:text-primary transition-colors" size={32} />
                        </motion.div>
                      </div>
                    </Card>
                  </motion.div>
                </motion.div>
              )}

              <motion.div variants={itemVariants} whileHover="hover">
                <motion.div variants={cardHoverVariants}>
                  <Card className="p-6 relative overflow-hidden group cursor-pointer">
                    <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="flex items-start justify-between relative z-10">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          Approved Forms
                        </p>
                        <motion.p
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.7, duration: 0.5 }}
                          className="text-3xl font-bold text-foreground mt-2"
                        >
                          {loading ? (
                            <motion.span
                              animate={{ opacity: [0.5, 1, 0.5] }}
                              transition={{ duration: 1.5, repeat: Infinity }}
                            >
                              -
                            </motion.span>
                          ) : (
                            stats.approvedForms
                          )}
                        </motion.p>
                      </div>
                      <motion.div
                        whileHover={{ rotate: 360, scale: 1.1 }}
                        transition={{ duration: 0.5 }}
                      >
                        <CheckCircle className="text-primary/50 group-hover:text-green-500 transition-colors" size={32} />
                      </motion.div>
                    </div>
                  </Card>
                </motion.div>
              </motion.div>

              <motion.div variants={itemVariants} whileHover="hover">
                <motion.div variants={cardHoverVariants}>
                  <Card className="p-6 relative overflow-hidden group cursor-pointer">
                    <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="flex items-start justify-between relative z-10">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          System Status
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="w-3 h-3 rounded-full bg-green-500"
                          />
                          <p className="font-bold text-foreground">Operational</p>
                        </div>
                      </div>
                      <motion.div
                        whileHover={{ rotate: 360, scale: 1.1 }}
                        transition={{ duration: 0.5 }}
                      >
                        <TrendingUp className="text-primary/50 group-hover:text-green-500 transition-colors" size={32} />
                      </motion.div>
                    </div>
                  </Card>
                </motion.div>
              </motion.div>
            </motion.div>

            {/* Quick Actions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.6 }}
            >
              <Card className="p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl" />
                <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                  <Sparkles className="text-primary" size={20} />
                  Quick Actions
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Link href="/forms-portal">
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button className="w-full bg-primary hover:bg-primary/90 group relative overflow-hidden">
                        <motion.div
                          className="absolute inset-0 bg-white/20"
                          initial={{ x: '-100%' }}
                          whileHover={{ x: '100%' }}
                          transition={{ duration: 0.5 }}
                        />
                        <FileText size={18} className="mr-2" />
                        <span>Submit New Form</span>
                        <ArrowRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </motion.div>
                  </Link>
                  <Link href="/submissions">
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button variant="outline" className="w-full bg-transparent group">
                        <FileText size={18} className="mr-2" />
                        <span>View Submissions</span>
                        <ArrowRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </motion.div>
                  </Link>
                  {userData?.isApprover && (
                    <Link href="/approvals">
                      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <Button variant="outline" className="w-full bg-transparent group">
                          <CheckCircle size={18} className="mr-2" />
                          <span>Review Approvals</span>
                          <ArrowRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform" />
                        </Button>
                      </motion.div>
                    </Link>
                  )}
                </div>
              </Card>
            </motion.div>

            {/* Recent Activity */}
            {stats.recentForms.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.6 }}
              >
                <Card className="p-6">
                  <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                    <Clock className="text-primary" size={20} />
                    Recent Forms
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-3 px-4 font-semibold text-muted-foreground">
                            Form Name
                          </th>
                          <th className="text-left py-3 px-4 font-semibold text-muted-foreground hidden md:table-cell">
                            Status
                          </th>
                          <th className="text-left py-3 px-4 font-semibold text-muted-foreground hidden md:table-cell">
                            Date
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <AnimatePresence>
                          {stats.recentForms.map((form, index) => (
                            <motion.tr
                              key={form.id}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.9 + index * 0.1, duration: 0.4 }}
                              whileHover={{ backgroundColor: 'rgba(0,0,0,0.02)' }}
                              className="border-b border-border cursor-pointer"
                            >
                              <td className="py-4 px-4 text-foreground font-medium">
                                {form.formName}
                              </td>
                              <td className="py-4 px-4 hidden md:table-cell">
                                <motion.span
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  transition={{ delay: 1 + index * 0.1, type: "spring" }}
                                  className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                                    form.status === 'Approved'
                                      ? 'bg-green-100 text-green-700'
                                      : form.status === 'Rejected'
                                        ? 'bg-red-100 text-red-700'
                                        : 'bg-yellow-100 text-yellow-700'
                                  }`}
                                >
                                  {form.status}
                                </motion.span>
                              </td>
                              <td className="py-4 px-4 text-muted-foreground hidden md:table-cell text-xs">
                                {new Date(
                                  form.createdAt?.toDate?.() || form.createdAt
                                ).toLocaleDateString()}
                              </td>
                            </motion.tr>
                          ))}
                        </AnimatePresence>
                      </tbody>
                    </table>
                  </div>
                </Card>
              </motion.div>
            )}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}