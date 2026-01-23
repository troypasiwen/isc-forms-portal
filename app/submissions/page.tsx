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
import { FileText, Download, Trash2, Eye, Clock, CheckCircle2, XCircle, Users, AlertCircle, Search, Filter, Calendar, CheckCircle, Trash } from 'lucide-react';
import Link from 'next/link';

interface Approval {
  userId: string;
  userName: string;
  status: 'approved' | 'rejected' | 'pending';
  timestamp?: any;
  comments?: string;
}

interface ApprovalRecord {
  action: 'Approved' | 'Rejected' | 'Submitted';
  by: string;
  byName?: string;
  byPosition?: string;
  byDepartment?: string;
  signature?: string;
  timestamp: any;
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
  approvalTimeline?: ApprovalRecord[];
  submittedByName?: string;
  position?: string;
  department?: string;
}

export default function SubmissionsPage() {
  const { user, userData } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

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

  const handleClearHistory = async () => {
    const firstConfirm = window.confirm(
      `Are you sure you want to clear your submission history?\n\nThis will permanently delete ALL your submissions (${submissions.length} total).\n\nThis action cannot be undone.`
    );

    if (!firstConfirm) return;

    const secondConfirm = window.confirm(
      'FINAL CONFIRMATION: This will delete all your submission records permanently. Are you absolutely sure?'
    );

    if (!secondConfirm) return;

    setIsClearing(true);

    try {
      // Delete all submissions from database
      const deletePromises = submissions.map((submission) =>
        deleteDoc(doc(db, 'forms', submission.id))
      );

      await Promise.all(deletePromises);

      // Clear local state
      setSubmissions([]);

      alert('All submissions have been successfully deleted.');
    } catch (error) {
      console.error('Error clearing submission history:', error);
      alert('Failed to clear submission history. Please try again.');
    } finally {
      setIsClearing(false);
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
    const approvalTimeline = submission.approvalTimeline || [];
    const approved = approvalTimeline.filter((a: any) => a.action === 'Approved').length;
    const required = submission.approvals?.length || submission.requiredApprovals || 0;
    const pending = required - approved;
    const percentage = required > 0 ? (approved / required) * 100 : 0;

    return { approved, required, percentage, pending };
  };

  const viewDetails = (submission: Submission) => {
    setSelectedSubmission(submission);
    setShowDetailsModal(true);
  };

  const viewTimeline = (submission: Submission) => {
    setSelectedSubmission(submission);
    setShowTimeline(true);
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
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-foreground">
                  My Submissions
                </h1>
                <p className="text-muted-foreground mt-2">
                  View and manage all your form submissions
                </p>
              </div>
              {submissions.length > 0 && (
                <Button
                  onClick={handleClearHistory}
                  disabled={isClearing}
                  variant="outline"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                >
                  <Trash size={16} className="mr-2" />
                  {isClearing ? 'Clearing...' : 'Clear History'}
                </Button>
              )}
            </div>
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
                                <button
                                  onClick={() => viewTimeline(submission)}
                                  className="space-y-1 hover:opacity-80 transition-opacity text-left w-full"
                                >
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Users size={14} />
                                    <span>
                                      <span className="font-semibold text-primary">{progress.approved}</span> of {progress.required} approved
                                      {progress.pending > 0 && (
                                        <span className="text-yellow-600 ml-1">
                                          ({progress.pending} pending)
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                      className="bg-primary h-2 rounded-full transition-all"
                                      style={{ width: `${progress.percentage}%` }}
                                    ></div>
                                  </div>
                                </button>
                              ) : submission.status === 'Approved' ? (
                                <button
                                  onClick={() => viewTimeline(submission)}
                                  className="flex items-center gap-2 text-xs text-green-700 hover:opacity-80 transition-opacity"
                                >
                                  <CheckCircle2 size={14} />
                                  <span>Fully approved</span>
                                </button>
                              ) : submission.status === 'Rejected' ? (
                                <button
                                  onClick={() => viewTimeline(submission)}
                                  className="flex items-center gap-2 text-xs text-red-700 hover:opacity-80 transition-opacity"
                                >
                                  <XCircle size={14} />
                                  <span>Rejected</span>
                                </button>
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
                              <span>
                                <span className="font-semibold text-primary">{progress.approved}</span> of {progress.required} approved
                                {progress.pending > 0 && (
                                  <span className="text-yellow-600 ml-1">
                                    ({progress.pending} pending)
                                  </span>
                                )}
                              </span>
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
                            onClick={() => viewTimeline(submission)}
                            className="flex-1 bg-transparent"
                          >
                            <Clock size={14} className="mr-1" />
                            Timeline
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => viewDetails(submission)}
                            className="flex-1 bg-transparent"
                          >
                            <Eye size={14} className="mr-1" />
                            Details
                          </Button>
                          {submission.status === 'Draft' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(submission.id)}
                              className="text-destructive hover:text-destructive"
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
                {selectedSubmission.approvals && selectedSubmission.approvals.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center justify-between">
                      <span>
                        Approvers 
                        {(() => {
                          const approvalTimeline = selectedSubmission.approvalTimeline || [];
                          const approvedCount = approvalTimeline.filter((a: any) => a.action === 'Approved').length;
                          const totalRequired = selectedSubmission.approvals?.length || selectedSubmission.requiredApprovals || 0;
                          return ` (${approvedCount} of ${totalRequired})`;
                        })()}
                      </span>
                      {selectedSubmission.status === 'Approved' && (
                        <span className="text-xs font-normal text-green-600 flex items-center gap-1">
                          <CheckCircle2 size={14} />
                          Fully Approved
                        </span>
                      )}
                    </h3>
                    <div className="space-y-2">
                      {selectedSubmission.approvals.map((approval, index) => {
                        const approvalTimeline = selectedSubmission.approvalTimeline || [];
                        const actualApproval = approvalTimeline.find((a: any) => 
                          a.by === approval.userId && a.action === 'Approved'
                        );
                        const actualRejection = approvalTimeline.find((a: any) => 
                          a.by === approval.userId && a.action === 'Rejected'
                        );
                        
                        const displayStatus = actualApproval ? 'approved' : actualRejection ? 'rejected' : 'pending';
                        const displayTimestamp = actualApproval?.timestamp || actualRejection?.timestamp;
                        const displayComments = actualApproval?.comments || actualRejection?.comments;
                        
                        return (
                          <div 
                            key={index} 
                            className={`flex items-center justify-between p-3 rounded-lg border ${
                              displayStatus === 'approved' 
                                ? 'bg-green-50 border-green-200' 
                                : displayStatus === 'rejected'
                                ? 'bg-red-50 border-red-200'
                                : 'bg-gray-50 border-gray-200'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {displayStatus === 'approved' ? (
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                                  <CheckCircle2 size={18} className="text-green-600" />
                                </div>
                              ) : displayStatus === 'rejected' ? (
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                                  <XCircle size={18} className="text-red-600" />
                                </div>
                              ) : (
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center">
                                  <Clock size={18} className="text-yellow-600" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">
                                  {approval.userName}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {displayStatus === 'approved' 
                                    ? `Approved ${displayComments ? `with remarks: "${displayComments}"` : 'with no remarks'}` 
                                    : displayStatus === 'rejected'
                                    ? `Rejected ${displayComments ? `with remarks: "${displayComments}"` : 'with no remarks'}`
                                    : 'Pending review'}
                                  {displayTimestamp && ` • ${new Date(displayTimestamp.toDate()).toLocaleDateString()} at ${new Date(displayTimestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                </p>
                                {displayComments && (
                                  <p className="text-xs text-muted-foreground mt-1 italic">
                                    
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className={`text-xs font-semibold px-2 py-1 rounded ${
                              displayStatus === 'approved' 
                                ? 'text-green-700' 
                                : displayStatus === 'rejected'
                                ? 'text-red-700'
                                : 'text-yellow-700'
                            }`}>
                              {displayStatus === 'approved' ? '✓' : displayStatus === 'rejected' ? '✕' : '○'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Rejection Reason */}
                {selectedSubmission.status === 'Rejected' && selectedSubmission.rejectionReason && (
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                      <AlertCircle size={16} className="text-red-600" />
                      Rejection Reason
                    </h3>
                    <p className="text-sm text-foreground bg-red-50 p-3 rounded-lg border border-red-200">
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

              <div className="p-6 border-t border-border flex gap-3">
                <Button
                  onClick={() => viewTimeline(selectedSubmission)}
                  variant="outline"
                  className="flex-1"
                >
                  <Clock size={16} className="mr-2" />
                  View Timeline
                </Button>
                <Button
                  onClick={() => setShowDetailsModal(false)}
                  className="flex-1 bg-primary hover:bg-primary/90"
                >
                  Close
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Timeline Modal (from approved-forms) */}
        {showTimeline && selectedSubmission && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end md:items-center justify-end">
            <div className="fixed inset-0" onClick={() => setShowTimeline(false)} />
            <div className="bg-card rounded-t-2xl md:rounded-l-2xl md:rounded-tr-none w-full md:w-96 max-h-[80vh] md:max-h-full md:h-full flex flex-col relative z-10 shadow-2xl">
              <div className="flex items-center justify-between p-6 border-b border-border">
                <div>
                  <h3 className="text-lg font-bold text-foreground">Approval Timeline</h3>
                  <p className="text-sm text-muted-foreground mt-1">{selectedSubmission.formName}</p>
                </div>
                <button onClick={() => setShowTimeline(false)} className="p-2 hover:bg-secondary rounded-lg transition-colors">
                  <XCircle size={20} className="text-muted-foreground" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {/* Submitted Entry */}
                <div className="relative pb-8">
                  <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-border" />
                  <div className="flex gap-4">
                    <div className="relative z-10 flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 border-2 border-primary">
                      <Calendar size={14} className="text-primary" />
                    </div>
                    <div className="flex-1 pt-0.5">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-foreground">Submitted</span>
                        <span className="text-xs px-2 py-0.5 bg-blue-500/10 text-blue-600 rounded-full">Initial</span>
                      </div>
                      <p className="text-sm text-foreground font-medium">{selectedSubmission.submittedByName || userData?.name || 'You'}</p>
                      <p className="text-xs text-muted-foreground">{selectedSubmission.position || userData?.position || ''}</p>
                      <p className="text-xs text-muted-foreground">{selectedSubmission.department || userData?.department || ''}</p>
                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(selectedSubmission.submittedAt?.toDate?.() || Date.now()).toLocaleString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Approval Timeline Entries */}
                {selectedSubmission.approvalTimeline?.map((record, index) => {
                  const isLastEntry = index === (selectedSubmission.approvalTimeline?.length || 0) - 1;
                  const isApproved = record.action === 'Approved';
                  const isRejected = record.action === 'Rejected';
                  
                  return (
                    <div key={index} className="relative pb-8">
                      {!isLastEntry && (
                        <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-border" />
                      )}
                      <div className="flex gap-4">
                        <div className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                          isApproved 
                            ? 'bg-green-500/10 border-green-500' 
                            : isRejected
                            ? 'bg-red-500/10 border-red-500'
                            : 'bg-yellow-500/10 border-yellow-500'
                        }`}>
                          {isApproved ? (
                            <CheckCircle2 size={14} className="text-green-600" />
                          ) : isRejected ? (
                            <XCircle size={14} className="text-red-600" />
                          ) : (
                            <Clock size={14} className="text-yellow-600" />
                          )}
                        </div>
                        <div className="flex-1 pt-0.5">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold text-foreground">
                              {record.action === 'Approved' ? 'Approved' : record.action === 'Rejected' ? 'Rejected' : 'Pending'}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              isApproved 
                                ? 'bg-green-500/10 text-green-600' 
                                : isRejected
                                ? 'bg-red-500/10 text-red-600'
                                : 'bg-yellow-500/10 text-yellow-600'
                            }`}>
                              Level {index + 1}
                            </span>
                          </div>
                          <p className="text-sm text-foreground font-medium">{record.byName || 'Unknown'}</p>
                          {record.byPosition && (
                            <p className="text-xs text-muted-foreground">{record.byPosition}</p>
                          )}
                          {record.byDepartment && (
                            <p className="text-xs text-muted-foreground">{record.byDepartment}</p>
                          )}
                          
                          {/* Remarks Section */}
                          <div className="mt-2">
                            {record.comments ? (
                              <div className={`p-2 rounded border ${
                                isRejected 
                                  ? 'bg-red-50 border-red-200' 
                                  : 'bg-blue-50 border-blue-200'
                              }`}>
                                <p className={`text-xs font-medium mb-1 ${
                                  isRejected ? 'text-red-900' : 'text-blue-900'
                                }`}>
                                  {isApproved ? 'Approved' : 'Rejected'} with remarks:
                                </p>
                                <p className={`text-xs italic ${
                                  isRejected ? 'text-red-800' : 'text-blue-800'
                                }`}>
                                  "{record.comments}"
                                </p>
                              </div>
                            ) : (isApproved || isRejected) && (
                              <div className="p-2 bg-gray-50 rounded border border-gray-200">
                                <p className="text-xs text-gray-600">
                                  {isApproved ? 'Approved' : 'Rejected'} with no remarks
                                </p>
                              </div>
                            )}
                          </div>
                          
                          {record.signature && (
                            <div className="mt-2 p-2 bg-secondary/50 rounded border border-border">
                              <p className="text-xs text-muted-foreground mb-1">Digital Signature:</p>
                              <img 
                                src={record.signature} 
                                alt="Signature" 
                                className="max-w-[150px] h-10 object-contain bg-white p-1 rounded border border-gray-200" 
                              />
                            </div>
                          )}
                          {record.comments && (
                            <div className={`mt-2 p-2 rounded border ${
                              isRejected 
                                ? 'bg-red-50 border-red-200' 
                                : 'bg-blue-50 border-blue-200'
                            }`}>
                              <p className={`text-xs font-medium mb-1 ${
                                isRejected ? 'text-red-900' : 'text-blue-900'
                              }`}>
                                Remarks:
                              </p>
                              <p className={`text-xs italic ${
                                isRejected ? 'text-red-800' : 'text-blue-800'
                              }`}>
                                "{record.comments}"
                              </p>
                            </div>
                          )}
                          {!record.comments && (isApproved || isRejected) && (
                            <div className="mt-2 p-2 bg-gray-50 rounded border border-gray-200">
                              <p className="text-xs text-gray-600 italic">No remarks</p>
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                            <Clock size={12} />
                            {new Date(record.timestamp?.toDate?.() || Date.now()).toLocaleString('en-US', {
                              month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Final Status */}
                {selectedSubmission.status === 'Approved' && (
                  <div className="relative">
                    <div className="flex gap-4">
                      <div className="relative z-10 flex items-center justify-center w-8 h-8 rounded-full bg-green-500 border-2 border-green-600">
                        <CheckCircle size={16} className="text-white" />
                      </div>
                      <div className="flex-1 pt-0.5">
                        <span className="text-sm font-bold text-green-600">Fully Approved</span>
                        <p className="text-xs text-muted-foreground mt-1">All approvals completed</p>
                      </div>
                    </div>
                  </div>
                )}

                {selectedSubmission.status === 'Rejected' && (
                  <div className="relative">
                    <div className="flex gap-4">
                      <div className="relative z-10 flex items-center justify-center w-8 h-8 rounded-full bg-red-500 border-2 border-red-600">
                        <XCircle size={16} className="text-white" />
                      </div>
                      <div className="flex-1 pt-0.5">
                        <span className="text-sm font-bold text-red-600">Rejected</span>
                        <p className="text-xs text-muted-foreground mt-1">Form was not approved</p>
                        {selectedSubmission.rejectionReason && (
                          <div className="mt-2 p-2 bg-red-50 rounded border border-red-200">
                            <p className="text-xs font-medium text-red-900 mb-1">Reason:</p>
                            <p className="text-xs text-red-800">{selectedSubmission.rejectionReason}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {(selectedSubmission.status === 'Pending Approval' || selectedSubmission.status === 'Submitted') && (
                  <div className="relative">
                    <div className="flex gap-4">
                      <div className="relative z-10 flex items-center justify-center w-8 h-8 rounded-full bg-yellow-500/10 border-2 border-yellow-500 animate-pulse">
                        <Clock size={16} className="text-yellow-600" />
                      </div>
                      <div className="flex-1 pt-0.5">
                        <span className="text-sm font-bold text-yellow-600">Awaiting Approval</span>
                        <p className="text-xs text-muted-foreground mt-1">
                          {(() => {
                            const approvalTimeline = selectedSubmission.approvalTimeline || [];
                            const approvedCount = approvalTimeline.filter((a: any) => a.action === 'Approved').length;
                            const totalRequired = selectedSubmission.approvals?.length || selectedSubmission.requiredApprovals || 0;
                            const pendingCount = totalRequired - approvedCount;
                            return `${pendingCount} approver${pendingCount !== 1 ? 's' : ''} still reviewing`;
                          })()}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-border">
                <Button
                  onClick={() => setShowTimeline(false)}
                  className="w-full bg-primary hover:bg-primary/90"
                >
                  Close Timeline
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;700&display=swap');

        .font-signature {
          font-family: 'Dancing Script', cursive;
        }
      `}</style>
    </ProtectedRoute>
  );
}