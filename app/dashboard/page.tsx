'use client';

import { useState, useEffect } from 'react';
import { ProtectedRoute } from '@/components/protected-route';
import { Sidebar } from '@/components/sidebar';
import { TopBar } from '@/components/top-bar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';

import {
  collection,
  query,
  where,
  getDocs,
  countDocuments,
  QueryConstraint,
} from 'firebase/firestore';
import {
  BarChart3,
  FileText,
  CheckCircle,
  Clock,
  TrendingUp,
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

  useEffect(() => {
    if (!user) return;

    const fetchStats = async () => {
      try {
        const constraints: QueryConstraint[] = [];

        // For employees, only show their own submissions
        if (userData?.role !== 'Admin') {
          constraints.push(where('submittedBy', '==', user.uid));
        }

        // Get total submissions
        const submissionsRef = collection(db, 'forms');
        const submissionsQuery = query(submissionsRef, ...constraints);
        const submissionsSnap = await getDocs(submissionsQuery);
        const totalSubmissions = submissionsSnap.size;

        // Get recent forms
        const recentForms = submissionsSnap.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .slice(0, 5);

        // Get approved forms count
        const approvedQuery = query(
          submissionsRef,
          ...[...constraints, where('status', '==', 'Approved')]
        );
        const approvedSnap = await getDocs(approvedQuery);
        const approvedForms = approvedSnap.size;

        // Get pending approvals (for approvers)
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

  return (
    <ProtectedRoute>
      <div className="flex">
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content */}
        <main className="flex-1 bg-background md:ml-64">
          {/* Top Bar */}
          <TopBar />

          {/* Page Header */}
          <div className="bg-card border-b border-border p-6 md:p-8">
            <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-2">
              Welcome back, {userData?.fullName}
            </p>
          </div>

          {/* Content */}
          <div className="p-6 md:p-8 space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Total Submissions
                    </p>
                    <p className="text-3xl font-bold text-foreground mt-2">
                      {loading ? '-' : stats.totalSubmissions}
                    </p>
                  </div>
                  <FileText className="text-primary/50" size={32} />
                </div>
              </Card>

              {userData?.isApprover && (
                <Card className="p-6 border-l-4 border-l-primary">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Pending Approvals
                      </p>
                      <p className="text-3xl font-bold text-foreground mt-2">
                        {loading ? '-' : stats.pendingApprovals}
                      </p>
                    </div>
                    <Clock className="text-primary/50" size={32} />
                  </div>
                </Card>
              )}

              <Card className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Approved Forms
                    </p>
                    <p className="text-3xl font-bold text-foreground mt-2">
                      {loading ? '-' : stats.approvedForms}
                    </p>
                  </div>
                  <CheckCircle className="text-primary/50" size={32} />
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      System Status
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                      <p className="font-bold text-foreground">Operational</p>
                    </div>
                  </div>
                  <TrendingUp className="text-primary/50" size={32} />
                </div>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card className="p-6">
              <h2 className="text-xl font-bold text-foreground mb-4">
                Quick Actions
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Link href="/forms-portal">
                  <Button className="w-full bg-primary hover:bg-primary/90">
                    <FileText size={18} className="mr-2" />
                    Submit New Form
                  </Button>
                </Link>
                <Link href="/submissions">
                  <Button variant="outline" className="w-full bg-transparent">
                    <FileText size={18} className="mr-2" />
                    View Submissions
                  </Button>
                </Link>
                {userData?.isApprover && (
                  <Link href="/approvals">
                    <Button variant="outline" className="w-full bg-transparent">
                      <CheckCircle size={18} className="mr-2" />
                      Review Approvals
                    </Button>
                  </Link>
                )}
              </div>
            </Card>

            {/* Recent Activity */}
            {stats.recentForms.length > 0 && (
              <Card className="p-6">
                <h2 className="text-xl font-bold text-foreground mb-4">
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
                      {stats.recentForms.map((form) => (
                        <tr
                          key={form.id}
                          className="border-b border-border hover:bg-secondary/30"
                        >
                          <td className="py-4 px-4 text-foreground font-medium">
                            {form.formName}
                          </td>
                          <td className="py-4 px-4 hidden md:table-cell">
                            <span
                              className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                                form.status === 'Approved'
                                  ? 'bg-green-100 text-green-700'
                                  : form.status === 'Rejected'
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-yellow-100 text-yellow-700'
                              }`}
                            >
                              {form.status}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-muted-foreground hidden md:table-cell text-xs">
                            {new Date(
                              form.createdAt?.toDate?.() || form.createdAt
                            ).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
