'use client';

import { useState, useEffect } from 'react';
import { ProtectedRoute } from '@/components/protected-route';
import { Sidebar } from '@/components/sidebar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
  getDoc,
} from 'firebase/firestore';
import { FileText, Download, Trash2, Eye, Clock, CheckCircle2, XCircle, Users, AlertCircle, Search, Filter } from 'lucide-react';
import Link from 'next/link';

interface Approval {
  userId: string;
  userName: string;
  status: 'approved' | 'rejected' | 'pending';
  timestamp?: any;
  comments?: string;
}

interface Submission {
  id: string;
  formName: string;
  status: 'Draft' | 'Submitted' | 'Pending Approval' | 'Approved' | 'Rejected';
  submittedAt: any;
  createdAt: any;
  attachments: string[];
  formTemplateId: string;
  approvals?: Approval[];
  requiredApprovals?: number;
  rejectionReason?: string;
  lastUpdated?: any;
}

export default function SubmissionsPage() {
  const { user, userData } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

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
      await deleteDoc(doc(db, 'forms', submissionId));
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

  const getApprovalProgress = (submission: Submission) => {
    if (!submission.approvals || !submission.requiredApprovals) {
      return { approved: 0, required: 0, percentage: 0 };
    }

    const approved = submission.approvals.filter(a => a.status === 'approved').length;
    const required = submission.requiredApprovals;
    const percentage = (approved / required) * 100;

    return { approved, required, percentage };
  };

  const viewDetails = (submission: Submission) => {
    setSelectedSubmission(submission);
    setShowDetailsModal(true);
  };

  const filteredSubmissions = submissions.filter(submission =>
    submission.formName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    total: submissions.length,
    draft: submissions.filter(s => s.status === 'Draft').length,
    pending: submissions.filter(s => s.status === 'Pending Approval' || s.status === 'Submitted').length,
    approved: submissions.filter(s => s.status === 'Approved').length,
    rejected: submissions.filter(s => s.status === 'Rejected').length,
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

          <div className="p-6 md:p-8 space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card className="p-4">
                <div className="text-2xl font-bold text-foreground">{stats.total}</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </Card>
              <Card className="p-4">
                <div className="text-2xl font-bold text-gray-700">{stats.draft}</div>
                <div className="text-xs text-muted-foreground">Draft</div>
              </Card>
              <Card className="p-4">
                <div className="text-2xl font-bold text-yellow-700">{stats.pending}</div>
                <div className="text-xs text-muted-foreground">Pending</div>
              </Card>
              <Card className="p-4">
                <div className="text-2xl font-bold text-green-700">{stats.approved}</div>
                <div className="text-xs text-muted-foreground">Approved</div>
              </Card>
              <Card className="p-4">
                <div className="text-2xl font-bold text-red-700">{stats.rejected}</div>
                <div className="text-xs text-muted-foreground">Rejected</div>
              </Card>
            </div>

            {/* Search and Filter */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
                <input
                  type="text"
                  placeholder="Search submissions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {['All', 'Draft', 'Submitted', 'Pending Approval', 'Approved', 'Rejected'].map(
                  (status) => (
                    <button
                      key={status}
                      onClick={() => setFilter(status)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
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
            </div>

            {/* Submissions Table/Cards */}
            {loading ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">Loading submissions...</p>
              </Card>
            ) : filteredSubmissions.length === 0 ? (
              <Card className="p-12 text-center">
                <FileText className="mx-auto text-muted-foreground mb-4" size={48} />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {searchQuery ? 'No matching submissions' : 'No submissions yet'}
                </h3>
                <p className="text-muted-foreground mb-6">
                  {searchQuery ? 'Try adjusting your search' : 'Start by submitting a form from the Forms Portal'}
                </p>
                {!searchQuery && (
                  <Link href="/forms-portal">
                    <Button className="bg-primary hover:bg-primary/90">
                      Browse Forms
                    </Button>
                  </Link>
                )}
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
                          Approval Progress
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
                      {filteredSubmissions.map((submission) => {
                        const progress = getApprovalProgress(submission);
                        return (
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
                            <td className="py-4 px-6">
                              {submission.status === 'Pending Approval' || submission.status === 'Submitted' ? (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Users size={14} />
                                    <span>{progress.approved} of {progress.required} approved</span>
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                      className="bg-primary h-2 rounded-full transition-all"
                                      style={{ width: `${progress.percentage}%` }}
                                    ></div>
                                  </div>
                                </div>
                              ) : submission.status === 'Approved' ? (
                                <div className="flex items-center gap-2 text-xs text-green-700">
                                  <CheckCircle2 size={14} />
                                  <span>Fully approved</span>
                                </div>
                              ) : submission.status === 'Rejected' ? (
                                <div className="flex items-center gap-2 text-xs text-red-700">
                                  <XCircle size={14} />
                                  <span>Rejected</span>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
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
                                  onClick={() => viewDetails(submission)}
                                  className="p-2 hover:bg-secondary rounded-lg transition-colors"
                                  title="View Details"
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
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View */}
                <div className="md:hidden space-y-4">
                  {filteredSubmissions.map((submission) => {
                    const progress = getApprovalProgress(submission);
                    return (
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

                        {(submission.status === 'Pending Approval' || submission.status === 'Submitted') && (
                          <div className="mb-3 space-y-1">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Users size={12} />
                              <span>{progress.approved} of {progress.required} approved</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-primary h-2 rounded-full transition-all"
                                style={{ width: `${progress.percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        )}

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
                            onClick={() => viewDetails(submission)}
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
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </main>

        {/* Details Modal */}
        {showDetailsModal && selectedSubmission && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-border">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">
                      {selectedSubmission.formName}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Submission ID: {selectedSubmission.id}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowDetailsModal(false)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Status */}
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">Status</h3>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                      selectedSubmission.status
                    )}`}
                  >
                    {selectedSubmission.status}
                  </span>
                </div>

                {/* Approval Progress */}
                {(selectedSubmission.status === 'Pending Approval' || selectedSubmission.status === 'Submitted') && (
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-3">Approval Progress</h3>
                    {selectedSubmission.approvals && selectedSubmission.approvals.length > 0 ? (
                      <div className="space-y-3">
                        {selectedSubmission.approvals.map((approval, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                            <div className="flex items-center gap-3">
                              {approval.status === 'approved' ? (
                                <CheckCircle2 size={20} className="text-green-600" />
                              ) : approval.status === 'rejected' ? (
                                <XCircle size={20} className="text-red-600" />
                              ) : (
                                <Clock size={20} className="text-yellow-600" />
                              )}
                              <div>
                                <p className="text-sm font-medium text-foreground">{approval.userName}</p>
                                {approval.timestamp && (
                                  <p className="text-xs text-muted-foreground">
                                    {new Date(approval.timestamp.toDate()).toLocaleString()}
                                  </p>
                                )}
                              </div>
                            </div>
                            <span className="text-xs font-medium capitalize">{approval.status}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Awaiting approvals...</p>
                    )}
                  </div>
                )}

                {/* Rejection Reason */}
                {selectedSubmission.status === 'Rejected' && selectedSubmission.rejectionReason && (
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                      <AlertCircle size={16} className="text-red-600" />
                      Rejection Reason
                    </h3>
                    <p className="text-sm text-foreground bg-red-50 p-3 rounded-lg">
                      {selectedSubmission.rejectionReason}
                    </p>
                  </div>
                )}

                {/* Timestamps */}
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">Timeline</h3>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>Created: {new Date(selectedSubmission.createdAt?.toDate?.() || Date.now()).toLocaleString()}</p>
                    {selectedSubmission.submittedAt && (
                      <p>Submitted: {new Date(selectedSubmission.submittedAt.toDate()).toLocaleString()}</p>
                    )}
                    {selectedSubmission.lastUpdated && (
                      <p>Last Updated: {new Date(selectedSubmission.lastUpdated.toDate()).toLocaleString()}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-border">
                <Button
                  onClick={() => setShowDetailsModal(false)}
                  className="w-full bg-primary hover:bg-primary/90"
                >
                  Close
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}