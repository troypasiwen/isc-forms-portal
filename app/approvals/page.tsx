'use client';

import { useState, useEffect, useRef } from 'react';
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
  updateDoc,
  doc,
  arrayUnion,
  Timestamp,
  getDoc,
} from 'firebase/firestore';
import { CheckCircle, XCircle, AlertCircle, Eye, X, FileText, User, AlertTriangle, PenTool, Upload, Download } from 'lucide-react';

interface FormField {
  id: string;
  label: string;
  type: string;
  required?: boolean;
}

interface ApprovalRecord {
  action: 'Approved' | 'Rejected';
  by: string;
  byName?: string;
  byPosition?: string;
  byDepartment?: string;
  signature?: string;
  timestamp: any;
  comments?: string;
}

interface ApprovalForm {
  id: string;
  formName: string;
  formTemplateId?: string;
  submittedBy: string;
  submittedByName: string;
  submittedByPosition?: string;
  submittedByDepartment?: string;
  status: string;
  submittedAt: any;
  formData: any;
  attachments?: any[];
  signature?: string;
  approvalTimeline?: ApprovalRecord[];
}

const organizeFields = (fields: FormField[]): FormField[] => {
  const orderPriority: Record<string, number> = {
    'name': 1, 'full name': 1, 'employee name': 1, 'your name': 1,
    'position': 2, 'title': 2, 'role': 2,
    'department': 3,
    'email': 4,
    'phone': 5, 'contact': 5,
    'leave type': 6, 'type of leave': 6,
    'start date': 7, 'from date': 7,
    'end date': 8, 'to date': 8, 'date from': 7, 'date to': 8,
    'number of days': 9, 'days': 9, 'total days': 9,
    'credits': 10, 'balance': 10, 'available': 10, 'remaining': 10,
    'sick leave': 11, 'vacation leave': 11,
    'reason': 50, 'purpose': 50,
    'details': 51, 'description': 51,
    'comments': 52, 'notes': 52, 'remarks': 52,
    'attachment': 60, 'medical certificate': 60,
    'acknowledge': 100, 'agree': 100, 'confirm': 100, 'certify': 100,
  };

  const getFieldPriority = (field: FormField): number => {
    const labelLower = field.label.toLowerCase();
    for (const [key, priority] of Object.entries(orderPriority)) {
      if (labelLower.includes(key)) return priority;
    }
    if (field.type === 'checkbox') return 100;
    if (field.type === 'textarea') return 50;
    if (field.type === 'date') return 15;
    return 30;
  };

  return [...fields].sort((a, b) => getFieldPriority(a) - getFieldPriority(b));
};

export default function ApprovalsPage() {
  const { user } = useAuth();
  const [approvals, setApprovals] = useState<ApprovalForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [selectedForm, setSelectedForm] = useState<ApprovalForm | null>(null);
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [hasViewedDocument, setHasViewedDocument] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState<'approve' | 'reject' | null>(null);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) return;
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setUserProfile(userDoc.data());
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    };
    fetchUserProfile();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const fetchApprovals = async () => {
      try {
        const formsRef = collection(db, 'forms');
        const approvalsQuery = query(
          formsRef,
          where('status', '==', 'Pending Approval'),
          where('assignedApprovers', 'array-contains', user.uid)
        );

        const approvalsSnap = await getDocs(approvalsQuery);
        const approvalsList = approvalsSnap.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          } as ApprovalForm))
          .filter((form) => {
            const userAlreadyApproved = form.approvalTimeline?.some(
              (record) => record.action === 'Approved' && record.by === user.uid
            );
            return !userAlreadyApproved;
          })
          .sort((a, b) => (b.submittedAt?.toDate?.() || 0) - (a.submittedAt?.toDate?.() || 0));

        setApprovals(approvalsList);
      } catch (error) {
        console.error('Error fetching approvals:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchApprovals();
  }, [user]);

  useEffect(() => {
    const fetchFormTemplate = async () => {
      if (!selectedForm?.formTemplateId) return;
      try {
        const templateDoc = await getDoc(doc(db, 'formTemplates', selectedForm.formTemplateId));
        if (templateDoc.exists()) {
          const fields = templateDoc.data().fields || [];
          setFormFields(organizeFields(fields));
        }
      } catch (error) {
        console.error('Error fetching form template:', error);
      }
    };

    if (selectedForm) {
      fetchFormTemplate();
      setHasViewedDocument(true);
    }
  }, [selectedForm]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsDrawing(true);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => setIsDrawing(false);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignature(null);
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL();
    setSignature(dataUrl);
    setShowSignatureModal(false);
  };

  const uploadSignature = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setSignature(canvas.toDataURL());
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const getFieldLabel = (fieldId: string) => {
    const field = formFields.find(f => f.id === fieldId);
    return field?.label || fieldId;
  };

  const getFieldType = (fieldId: string) => {
    const field = formFields.find(f => f.id === fieldId);
    return field?.type || 'text';
  };

  const getOrganizedFormData = () => {
    if (!selectedForm?.formData) return [];
    const formDataEntries = Object.entries(selectedForm.formData);
    const fieldPriorityMap = new Map<string, number>();
    formFields.forEach((field, index) => {
      fieldPriorityMap.set(field.id, index);
    });
    return formDataEntries.sort(([keyA], [keyB]) => {
      const priorityA = fieldPriorityMap.get(keyA) ?? 999;
      const priorityB = fieldPriorityMap.get(keyB) ?? 999;
      return priorityA - priorityB;
    });
  };

  const handleApprove = async () => {
    if (!hasViewedDocument) {
      alert('Please view the document before approving.');
      return;
    }
    if (!signature) {
      setShowSignatureModal(true);
      return;
    }
    setShowConfirmModal('approve');
  };

  const handleReject = async () => {
    if (!hasViewedDocument) {
      alert('Please view the document before rejecting.');
      return;
    }
    if (!signature) {
      setShowSignatureModal(true);
      return;
    }
    setShowConfirmModal('reject');
  };

  const confirmApprove = async () => {
    if (!selectedForm || !signature) return;
    
    setProcessing(selectedForm.id);
    try {
      const currentApprovals = selectedForm.approvalTimeline?.filter(
        (record) => record.action === 'Approved'
      ) || [];
      
      const approvedByIds = currentApprovals.map(a => a.by);
      const allApprovedByIds = [...approvedByIds, user?.uid];
      
      const formDoc = await getDoc(doc(db, 'forms', selectedForm.id));
      const assignedApprovers = formDoc.data()?.assignedApprovers || [];
      
      const allApproved = assignedApprovers.every((approverId: string) => 
        allApprovedByIds.includes(approverId)
      );
      
      const updateData: any = {
        approvalTimeline: arrayUnion({
          action: 'Approved',
          by: user?.uid,
          byName: userProfile?.fullName || user?.email,
          byPosition: userProfile?.position || '',
          byDepartment: userProfile?.department || '',
          signature: signature,
          timestamp: Timestamp.now(),
          comments: remarks.trim() || undefined,
        }),
      };
      
      if (allApproved) {
        updateData.status = 'Approved';
        updateData.approvedAt = Timestamp.now();
        updateData.fullyApprovedBy = arrayUnion(user?.uid);
      } else {
        updateData.status = 'Pending Approval';
        updateData.partiallyApprovedBy = arrayUnion(user?.uid);
      }
      
      await updateDoc(doc(db, 'forms', selectedForm.id), updateData);
      
      setApprovals((prev) => prev.filter((a) => a.id !== selectedForm.id));
      setSelectedForm(null);
      setShowConfirmModal(null);
      setHasViewedDocument(false);
      setSignature(null);
      setRemarks('');
      
      if (allApproved) {
        alert('Form has been fully approved by all required approvers!');
      } else {
        alert('Your approval has been recorded. Waiting for other approvers.');
      }
    } catch (error) {
      console.error('Error approving form:', error);
      alert('Error approving form. Please try again.');
    } finally {
      setProcessing(null);
    }
  };

  const confirmReject = async () => {
    if (!selectedForm || !signature) return;
    
    // Mandatory remarks check for rejection
    if (!remarks.trim()) {
      alert('Please provide a reason for rejecting this form.');
      return;
    }
    
    setProcessing(selectedForm.id);
    try {
      await updateDoc(doc(db, 'forms', selectedForm.id), {
        status: 'Rejected',
        rejectedAt: Timestamp.now(),
        rejectedBy: user?.uid,
        rejectionReason: remarks.trim(),
        approvalTimeline: arrayUnion({
          action: 'Rejected',
          by: user?.uid,
          byName: userProfile?.fullName || user?.email,
          byPosition: userProfile?.position || '',
          byDepartment: userProfile?.department || '',
          signature: signature,
          timestamp: Timestamp.now(),
          comments: remarks.trim(),
        }),
      });
      
      setApprovals((prev) => prev.filter((a) => a.id !== selectedForm.id));
      setSelectedForm(null);
      setShowConfirmModal(null);
      setHasViewedDocument(false);
      setSignature(null);
      setRemarks('');
      
      alert('Form has been rejected.');
    } catch (error) {
      console.error('Error rejecting form:', error);
      alert('Error rejecting form. Please try again.');
    } finally {
      setProcessing(null);
    }
  };

  const formatFieldValue = (value: any) => {
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (value === null || value === undefined || value === 'None') return 'N/A';
    if (typeof value === 'object' && value.toDate) {
      return new Date(value.toDate()).toLocaleDateString();
    }
    return String(value);
  };

  const isFullWidthField = (fieldId: string) => {
    const fieldType = getFieldType(fieldId);
    const label = getFieldLabel(fieldId).toLowerCase();
    return fieldType === 'textarea' || 
           label.includes('reason') || 
           label.includes('comment') ||
           label.includes('notes') ||
           label.includes('description') ||
           label.includes('details');
  };

  const downloadAttachment = (attachment: any) => {
    if (!attachment.data) return;
    try {
      const byteCharacters = atob(attachment.data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: attachment.type });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading attachment:', error);
      alert('Error downloading file');
    }
  };

  const getApprovalRecords = () => {
    return selectedForm?.approvalTimeline?.filter(
      (record) => record.action === 'Approved'
    ) || [];
  };

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <Sidebar />

        <main className="flex-1 md:ml-64">
          <div className="bg-white/95 backdrop-blur-sm border-b border-slate-200 shadow-sm p-4 md:p-5">
            <h1 className="text-xl font-semibold text-slate-900">
              Approvals Pending
            </h1>
            <p className="text-slate-600 mt-1 text-sm">
              Review and approve form submissions
            </p>
          </div>

          <div className="p-4 md:p-5 space-y-4">
            {loading ? (
              <Card className="p-8 text-center bg-white/80 backdrop-blur-sm shadow-lg">
                <div className="flex flex-col items-center gap-3">
                  <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-blue-600"></div>
                  <p className="text-sm text-slate-600">Loading approvals...</p>
                </div>
              </Card>
            ) : approvals.length === 0 ? (
              <Card className="p-8 text-center bg-white/80 backdrop-blur-sm shadow-lg">
                <CheckCircle className="mx-auto text-green-500 mb-3" size={40} />
                <h3 className="text-base font-semibold text-slate-900 mb-1">
                  All caught up!
                </h3>
                <p className="text-sm text-slate-600">
                  No forms pending your approval at the moment.
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                {approvals.map((approval) => (
                  <Card key={approval.id} className="p-4 border-l-4 border-l-amber-500 bg-white shadow-sm">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                      <div>
                        <p className="text-xs font-semibold text-slate-500 mb-0.5">FORM NAME</p>
                        <p className="text-sm font-bold text-slate-900">{approval.formName}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500 mb-0.5">SUBMITTED BY</p>
                        <p className="text-sm text-slate-900">{approval.submittedByName}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500 mb-0.5">SUBMISSION DATE</p>
                        <p className="text-sm text-slate-900">
                          {new Date(approval.submittedAt?.toDate?.() || Date.now()).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500 mb-0.5">STATUS</p>
                        <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full border border-amber-200">
                          Pending
                        </span>
                      </div>
                    </div>
                    <Button
                      onClick={() => setSelectedForm(approval)}
                      variant="outline"
                      className="w-full h-9 text-sm border-slate-300 hover:bg-blue-50 hover:border-blue-400"
                    >
                      <Eye size={16} className="mr-2" />
                      View Full Document
                    </Button>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </main>

        {/* Document View Modal */}
        {selectedForm && (
          <div className="fixed inset-0 md:left-64 bg-black/50 z-50 flex items-center justify-center p-4">
            <Card className="max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl bg-white">
              <div className="bg-white border-b border-slate-200 p-4 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">{selectedForm.formName}</h2>
                  <p className="text-slate-600 text-sm mt-0.5">Form Submission Document</p>
                </div>
                <Button
                  onClick={() => {
                    setSelectedForm(null);
                    setFormFields([]);
                    setRemarks('');
                  }}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                >
                  <X size={20} />
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 md:p-6">
                <div className="max-w-5xl mx-auto space-y-4">
                  {/* Approval Progress */}
                  <Card className="p-3 bg-blue-50 border border-blue-200 shadow-sm">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={18} />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-blue-900 mb-1">Multi-Approver Form</p>
                        <p className="text-xs text-blue-700">
                          This form requires approval from multiple approvers. 
                          {getApprovalRecords().length > 0 ? (
                            <> <strong>{getApprovalRecords().length}</strong> approver(s) have already approved. 
                            The form will be fully approved once all assigned approvers have reviewed it.</>
                          ) : (
                            <> This form is awaiting approval from all assigned approvers.</>
                          )}
                        </p>
                      </div>
                    </div>
                  </Card>

                  {/* Submitter Info */}
                  <Card className="p-4 bg-slate-50 border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center">
                      <User className="mr-2" size={16} />
                      Submitted By
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Name</p>
                        <p className="text-sm font-medium text-slate-900">{selectedForm.submittedByName}</p>
                      </div>
                      {selectedForm.submittedByPosition && (
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Position</p>
                          <p className="text-sm font-medium text-slate-900">{selectedForm.submittedByPosition}</p>
                        </div>
                      )}
                      {selectedForm.submittedByDepartment && (
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Department</p>
                          <p className="text-sm font-medium text-slate-900">{selectedForm.submittedByDepartment}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Submission Date</p>
                        <p className="text-sm font-medium text-slate-900">
                          {new Date(selectedForm.submittedAt?.toDate?.() || Date.now()).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </Card>

                  {/* Form Data */}
                  <div className="space-y-3">
                    <h3 className="text-base font-semibold text-slate-900 pb-2 border-b border-slate-200">
                      Form Details
                    </h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      {getOrganizedFormData().map(([key, value]: any) => {
                        const isFullWidth = isFullWidthField(key);
                        return (
                          <Card key={key} className={`p-3 bg-white border border-slate-200 shadow-sm ${isFullWidth ? 'lg:col-span-2' : ''}`}>
                            <p className="text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                              {getFieldLabel(key)}
                            </p>
                            <p className="text-sm text-slate-900 whitespace-pre-wrap">
                              {formatFieldValue(value)}
                            </p>
                          </Card>
                        );
                      })}
                    </div>
                  </div>

                  {/* Submitter Signature */}
                  {selectedForm.signature && (
                    <Card className="p-4 bg-slate-50 border border-slate-200 shadow-sm">
                      <h3 className="text-sm font-semibold text-slate-900 mb-3">Submitter's Digital Signature</h3>
                      <div className="bg-white rounded-md p-4 border border-slate-200">
                        <img src={selectedForm.signature} alt="Signature" className="max-w-xs mx-auto h-16 object-contain" />
                        <div className="text-center mt-3 pt-3 border-t border-slate-200">
                          <p className="text-sm font-semibold text-slate-900">{selectedForm.submittedByName}</p>
                          {selectedForm.submittedByPosition && (
                            <p className="text-xs text-slate-600 mt-0.5">{selectedForm.submittedByPosition}</p>
                          )}
                          {selectedForm.submittedByDepartment && (
                            <p className="text-xs text-slate-600">{selectedForm.submittedByDepartment}</p>
                          )}
                          <p className="text-xs text-slate-500 mt-2">
                            Signed on {new Date(selectedForm.submittedAt?.toDate?.() || Date.now()).toLocaleDateString('en-US', { 
                              year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>
                    </Card>
                  )}

                  {/* Previous Approvals */}
                  {getApprovalRecords().length > 0 && (
                    <Card className="p-4 bg-green-50 border border-green-200 shadow-sm">
                      <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center">
                        <CheckCircle className="mr-2 text-green-600" size={16} />
                        Previous Approvals
                      </h3>
                      <div className="space-y-3">
                        {getApprovalRecords().map((approval, index) => (
                          <div key={index} className="bg-white rounded-md p-3 border border-green-200">
                            {approval.signature && (
                              <div className="mb-3">
                                <img src={approval.signature} alt="Approver Signature" className="max-w-xs mx-auto h-14 object-contain" />
                              </div>
                            )}
                            <div className="text-center pt-2 border-t border-green-200">
                              <p className="text-sm font-semibold text-slate-900">{approval.byName || 'Unknown'}</p>
                              {approval.byPosition && (
                                <p className="text-xs text-slate-600 mt-0.5">{approval.byPosition}</p>
                              )}
                              {approval.byDepartment && (
                                <p className="text-xs text-slate-600">{approval.byDepartment}</p>
                              )}
                              <p className="text-xs text-slate-500 mt-1.5">
                                Approved on {new Date(approval.timestamp?.toDate?.() || Date.now()).toLocaleDateString('en-US', { 
                                  year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                })}
                              </p>
                              {approval.comments && (
                                <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
                                  <p className="text-xs font-medium text-blue-900">Remarks:</p>
                                  <p className="text-xs text-blue-800 italic mt-1">"{approval.comments}"</p>
                                </div>
                              )}
                              {!approval.comments && (
                                <div className="mt-2 p-2 bg-gray-50 rounded border border-gray-200">
                                  <p className="text-xs text-gray-600">No remarks</p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}

                  {/* Attachments */}
                  {selectedForm.attachments && selectedForm.attachments.length > 0 && (
                    <Card className="p-4 bg-white border border-slate-200 shadow-sm">
                      <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center">
                        <FileText className="mr-2" size={16} />
                        Attachments ({selectedForm.attachments.length})
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {selectedForm.attachments.map((attachment: any, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-md border border-slate-200">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <div className="w-10 h-10 bg-blue-100 rounded-md flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-bold text-blue-600">
                                  {attachment.name?.split('.').pop()?.toUpperCase() || 'FILE'}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-900 truncate">
                                  {attachment.name || `Attachment ${index + 1}`}
                                </p>
                                {attachment.size && (
                                  <p className="text-xs text-slate-500">
                                    {(attachment.size / 1024).toFixed(1)} KB
                                  </p>
                                )}
                              </div>
                            </div>
                            <Button onClick={() => downloadAttachment(attachment)} variant="outline" size="sm" className="ml-2 h-8 shrink-0 border-slate-300 hover:bg-blue-50 hover:border-blue-400">
                              <Download size={14} className="mr-1" />
                              Download
                            </Button>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}
                </div>
              </div>

              {/* Footer Actions */}
              <div className="bg-white border-t border-slate-200 p-4 flex gap-3">
                <Button
                  onClick={handleApprove}
                  disabled={processing === selectedForm.id}
                  className="flex-1 h-10 text-sm bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-sm"
                >
                  <CheckCircle size={16} className="mr-2" />
                  Approve Form
                </Button>
                <Button
                  onClick={handleReject}
                  disabled={processing === selectedForm.id}
                  variant="destructive"
                  className="flex-1 h-10 text-sm bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 shadow-sm"
                >
                  <XCircle size={16} className="mr-2" />
                  Reject Form
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Signature Modal */}
        {showSignatureModal && (
          <div className="fixed inset-0 md:left-64 bg-black/50 z-[60] flex items-center justify-center p-4">
            <Card className="max-w-xl w-full p-6 bg-white shadow-2xl">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-slate-900 mb-1">Add Your Signature</h3>
                <p className="text-sm text-slate-600">Draw or upload your signature to proceed</p>
              </div>

              <div className="space-y-4">
                <div className="border-2 border-dashed border-slate-300 rounded-md p-3 bg-slate-50/50">
                  <canvas
                    ref={canvasRef}
                    width={500}
                    height={150}
                    className="w-full bg-white rounded-md border border-slate-200 cursor-crosshair touch-none"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                  />
                  <p className="text-xs text-slate-500 mt-2 text-center">Draw your signature above</p>
                </div>

                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={uploadSignature}
                    className="hidden"
                    id="signature-upload"
                  />
                  <label htmlFor="signature-upload">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-9 border-2 border-dashed text-sm border-slate-300 hover:bg-blue-50 hover:border-blue-400"
                      onClick={() => document.getElementById('signature-upload')?.click()}
                    >
                      <Upload size={16} className="mr-2" />
                      Or Upload Signature Image
                    </Button>
                  </label>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button onClick={clearSignature} variant="outline" className="flex-1 h-9 text-sm border-slate-300 hover:bg-slate-50">
                    Clear
                  </Button>
                  <Button onClick={() => setShowSignatureModal(false)} variant="outline" className="flex-1 h-9 text-sm border-slate-300 hover:bg-slate-50">
                    Cancel
                  </Button>
                  <Button onClick={saveSignature} className="flex-1 h-9 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm">
                    <PenTool size={16} className="mr-2" />
                    Save Signature
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Confirmation Modal with Remarks */}
        {showConfirmModal && (
          <div className="fixed inset-0 md:left-64 bg-black/50 z-[60] flex items-center justify-center p-4">
            <Card className="max-w-md w-full p-6 bg-white shadow-2xl">
              <div className="text-center mb-6">
                <div className={`mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-4 ${
                  showConfirmModal === 'approve' ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  {showConfirmModal === 'approve' ? (
                    <CheckCircle className="text-green-600" size={28} />
                  ) : (
                    <AlertTriangle className="text-red-600" size={28} />
                  )}
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  {showConfirmModal === 'approve' ? 'Approve Form?' : 'Reject Form?'}
                </h3>
                <p className="text-sm text-slate-600 mb-4">
                  {showConfirmModal === 'approve' 
                    ? 'Are you sure you want to approve this form submission? Your signature will be added to the approval record.'
                    : 'Are you sure you want to reject this form submission? This action will be recorded in the approval timeline.'}
                </p>

                {/* Remarks Input */}
                <div className="text-left mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    {showConfirmModal === 'reject' ? (
                      <>Reason for Rejection <span className="text-red-600">*</span></>
                    ) : (
                      <>Remarks (Optional)</>
                    )}
                  </label>
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder={
                      showConfirmModal === 'reject' 
                        ? 'Please provide a reason for rejecting this form...' 
                        : 'Add any remarks or comments (optional)...'
                    }
                    className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 resize-none ${
                      showConfirmModal === 'reject' 
                        ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                        : 'border-slate-300 focus:ring-blue-500 focus:border-blue-500'
                    }`}
                    rows={4}
                    required={showConfirmModal === 'reject'}
                  />
                  {showConfirmModal === 'reject' && (
                    <p className="text-xs text-red-600 mt-1">
                      * A reason is required when rejecting a form
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => {
                    setShowConfirmModal(null);
                    setRemarks('');
                  }}
                  variant="outline"
                  className="flex-1 h-9 text-sm border-slate-300 hover:bg-slate-50"
                >
                  Cancel
                </Button>
                <Button
                  onClick={showConfirmModal === 'approve' ? confirmApprove : confirmReject}
                  disabled={processing !== null || (showConfirmModal === 'reject' && !remarks.trim())}
                  className={`flex-1 h-9 text-sm shadow-sm ${
                    showConfirmModal === 'approve' 
                      ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700' 
                      : 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700'
                  } text-white`}
                >
                  {processing ? 'Processing...' : `Yes, ${showConfirmModal === 'approve' ? 'Approve' : 'Reject'}`}
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}