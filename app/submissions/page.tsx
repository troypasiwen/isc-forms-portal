'use client';

import { useState, useEffect } from 'react';
import { ProtectedRoute } from '@/components/protected-route';
import { Sidebar } from '@/components/sidebar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { db, storage } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { FileText, Download, Trash2, Eye } from 'lucide-react';
import Link from 'next/link';

interface Submission {
  id: string;
  formName: string;
  status: 'Draft' | 'Submitted' | 'Pending Approval' | 'Approved' | 'Rejected';
  submittedAt: any;
  createdAt: any;
  attachments: string[];
  formTemplateId: string;
}

export default function SubmissionsPage() {
  const { user, userData } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('All');

  useEffect(() => {
    if (!user) return;

    const fetchSubmissions = async () => {
      try {
        const submissionsRef = collection(db, 'forms');
        const constraints = [where('submittedBy', '==', user.uid)];

        if (filter !== 'All') {
          constraints.push(where('status', '==', filter));
        }

        const submissionsQuery = query(submissionsRef, ...constraints);
        const submissionsSnap = await getDocs(submissionsQuery);
        const submissionsList = submissionsSnap.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          .sort(
            (a, b) =>
              (b.submittedAt?.toDate?.() || b.createdAt?.toDate?.() || 0) -
              (a.submittedAt?.toDate?.() || a.createdAt?.toDate?.() || 0)
          ) as Submission[];

        setSubmissions(submissionsList);
      } catch (error) {
        console.error('Error fetching submissions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSubmissions();
  }, [user, filter]);

  const handleDelete = async (submissionId: string) => {
    if (!window.confirm('Are you sure you want to delete this submission?')) {
      return;
    }

    try {
      // Delete from Firestore
      await deleteDoc(doc(db, 'forms', submissionId));

      // Remove from local state
      setSubmissions((prev) =>
        prev.filter((submission) => submission.id !== submissionId)
      );
    } catch (error) {
      console.error('Error deleting submission:', error);
    }
  };

  const getStatusColor = (
    status: 'Draft' | 'Submitted' | 'Pending Approval' | 'Approved' | 'Rejected'
  ) => {
    switch (status) {
      case 'Approved':
        return 'bg-green-100 text-green-700';
      case 'Rejected':
        return 'bg-red-100 text-red-700';
      case 'Pending Approval':
      case 'Submitted':
        return 'bg-yellow-100 text-yellow-700';
      case 'Draft':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <ProtectedRoute>
      <div className="flex">
        <Sidebar />

        <main className="flex-1 bg-background md:ml-64">
          <div className="bg-card border-b border-border p-6 md:p-8">
            <h1 className="text-3xl font-bold text-foreground">
              My Submissions
            </h1>
            <p className="text-muted-foreground mt-2">
              View and manage all your form submissions
            </p>
          </div>

          <div className="p-6 md:p-8 space-y-8">
            {/* Filter Buttons */}
            <div className="flex flex-wrap gap-2">
              {['All', 'Draft', 'Submitted', 'Pending Approval', 'Approved', 'Rejected'].map(
                (status) => (
                  <button
                    key={status}
                    onClick={() => setFilter(status)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      filter === status
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-foreground hover:bg-secondary/80'
                    }`}
                  >
                    {status}
                  </button>
                )
              )}
            </div>

            {/* Submissions Table/Cards */}
            {loading ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">Loading submissions...</p>
              </Card>
            ) : submissions.length === 0 ? (
              <Card className="p-12 text-center">
                <FileText className="mx-auto text-muted-foreground mb-4" size={48} />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  No submissions yet
                </h3>
                <p className="text-muted-foreground mb-6">
                  Start by submitting a form from the Forms Portal
                </p>
                <Link href="/forms-portal">
                  <Button className="bg-primary hover:bg-primary/90">
                    Browse Forms
                  </Button>
                </Link>
              </Card>
            ) : (
              <>
                {/* Desktop View */}
                <div className="hidden md:block overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-secondary border-b border-border">
                        <th className="text-left py-4 px-6 font-semibold text-foreground">
                          Form Name
                        </th>
                        <th className="text-left py-4 px-6 font-semibold text-foreground">
                          Status
                        </th>
                        <th className="text-left py-4 px-6 font-semibold text-foreground">
                          Date
                        </th>
                        <th className="text-right py-4 px-6 font-semibold text-foreground">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {submissions.map((submission) => (
                        <tr
                          key={submission.id}
                          className="border-b border-border hover:bg-secondary/30 transition-colors"
                        >
                          <td className="py-4 px-6 text-foreground font-medium">
                            {submission.formName}
                          </td>
                          <td className="py-4 px-6">
                            <span
                              className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                                submission.status
                              )}`}
                            >
                              {submission.status}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-muted-foreground text-xs">
                            {new Date(
                              submission.submittedAt?.toDate?.() ||
                                submission.createdAt?.toDate?.() ||
                                Date.now()
                            ).toLocaleDateString()}
                          </td>
                          <td className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                className="p-2 hover:bg-secondary rounded-lg transition-colors"
                                title="View"
                              >
                                <Eye size={16} className="text-muted-foreground" />
                              </button>
                              {submission.status === 'Draft' && (
                                <button
                                  onClick={() => handleDelete(submission.id)}
                                  className="p-2 hover:bg-destructive/10 rounded-lg transition-colors"
                                  title="Delete"
                                >
                                  <Trash2
                                    size={16}
                                    className="text-destructive"
                                  />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View */}
                <div className="md:hidden space-y-4">
                  {submissions.map((submission) => (
                    <Card key={submission.id} className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="font-bold text-foreground text-sm">
                          {submission.formName}
                        </h3>
                        <span
                          className={`inline-block px-2 py-1 rounded text-xs font-medium ${getStatusColor(
                            submission.status
                          )}`}
                        >
                          {submission.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">
                        {new Date(
                          submission.submittedAt?.toDate?.() ||
                            submission.createdAt?.toDate?.() ||
                            Date.now()
                        ).toLocaleDateString()}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 bg-transparent"
                        >
                          <Eye size={14} className="mr-1" />
                          View
                        </Button>
                        {submission.status === 'Draft' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(submission.id)}
                            className="flex-1 text-destructive hover:text-destructive"
                          >
                            <Trash2 size={14} />
                          </Button>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
