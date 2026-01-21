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
            // Filter out forms where current user has already approved
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
      // Get current approvers who have already approved
      const currentApprovals = selectedForm.approvalTimeline?.filter(
        (record) => record.action === 'Approved'
      ) || [];
      
      const approvedByIds = currentApprovals.map(a => a.by);
      const allApprovedByIds = [...approvedByIds, user?.uid];
      
      // Get all required approvers from the form template
      const formDoc = await getDoc(doc(db, 'forms', selectedForm.id));
      const assignedApprovers = formDoc.data()?.assignedApprovers || [];
      
      // Check if all approvers have approved
      const allApproved = assignedApprovers.every((approverId: string) => 
        allApprovedByIds.includes(approverId)
      );
      
      // Update status based on whether all have approved
      const updateData: any = {
        approvalTimeline: arrayUnion({
          action: 'Approved',
          by: user?.uid,
          byName: userProfile?.fullName || user?.email,
          byPosition: userProfile?.position || '',
          byDepartment: userProfile?.department || '',
          signature: signature,
          timestamp: Timestamp.now(),
        }),
      };
      
      if (allApproved) {
        // All approvers have approved - mark as fully approved
        updateData.status = 'Approved';
        updateData.approvedAt = Timestamp.now();
        updateData.fullyApprovedBy = arrayUnion(user?.uid);
      } else {
        // Partial approval - keep status as Pending Approval
        updateData.status = 'Pending Approval';
        updateData.partiallyApprovedBy = arrayUnion(user?.uid);
      }
      
      await updateDoc(doc(db, 'forms', selectedForm.id), updateData);
      
      setApprovals((prev) => prev.filter((a) => a.id !== selectedForm.id));
      setSelectedForm(null);
      setShowConfirmModal(null);
      setHasViewedDocument(false);
      setSignature(null);
      
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
    setProcessing(selectedForm.id);
    try {
      // If any approver rejects, the entire form is rejected
      await updateDoc(doc(db, 'forms', selectedForm.id), {
        status: 'Rejected',
        rejectedAt: Timestamp.now(),
        rejectedBy: user?.uid,
        approvalTimeline: arrayUnion({
          action: 'Rejected',
          by: user?.uid,
          byName: userProfile?.fullName || user?.email,
          byPosition: userProfile?.position || '',
          byDepartment: userProfile?.department || '',
          signature: signature,
          timestamp: Timestamp.now(),
        }),
      });
      
      setApprovals((prev) => prev.filter((a) => a.id !== selectedForm.id));
      setSelectedForm(null);
      setShowConfirmModal(null);
      setHasViewedDocument(false);
      setSignature(null);
      
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
      <div className="flex min-h-screen bg-background">
        <Sidebar />

        <main className="flex-1 md:ml-64">
          <div className="bg-card border-b border-border p-6 md:p-8">
            <h1 className="text-3xl font-bold text-foreground">
              Approvals Pending
            </h1>
            <p className="text-muted-foreground mt-2 text-base">
              Review and approve form submissions
            </p>
          </div>

          <div className="p-6 md:p-8 space-y-8">
            {loading ? (
              <Card className="p-8 text-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-muted border-t-primary"></div>
                  <p className="text-muted-foreground">Loading approvals...</p>
                </div>
              </Card>
            ) : approvals.length === 0 ? (
              <Card className="p-12 text-center">
                <CheckCircle className="mx-auto text-green-500 mb-4" size={48} />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  All caught up!
                </h3>
                <p className="text-muted-foreground">
                  No forms pending your approval at the moment.
                </p>
              </Card>
            ) : (
              <div className="space-y-4">
                {approvals.map((approval) => (
                  <Card key={approval.id} className="p-6 border-l-4 border-l-yellow-500">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">FORM NAME</p>
                        <p className="text-lg font-bold text-foreground">{approval.formName}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">SUBMITTED BY</p>
                        <p className="text-base text-foreground">{approval.submittedByName}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">SUBMISSION DATE</p>
                        <p className="text-base text-foreground">
                          {new Date(approval.submittedAt?.toDate?.() || Date.now()).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">STATUS</p>
                        <span className="inline-block px-3 py-1 bg-yellow-100 text-yellow-700 text-sm font-medium rounded-full">
                          Pending
                        </span>
                      </div>
                    </div>
                    <Button
                      onClick={() => setSelectedForm(approval)}
                      variant="outline"
                      className="w-full h-11 text-base"
                    >
                      <Eye size={18} className="mr-2" />
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
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <Card className="max-w-7xl w-full max-h-[95vh] overflow-hidden flex flex-col">
              <div className="bg-card border-b border-border p-8 flex justify-between items-center">
                <div>
                  <h2 className="text-3xl font-bold text-foreground">{selectedForm.formName}</h2>
                  <p className="text-muted-foreground text-base mt-2">Form Submission Document</p>
                </div>
                <Button
                  onClick={() => {
                    setSelectedForm(null);
                    setFormFields([]);
                  }}
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10"
                >
                  <X size={24} />
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 md:p-10">
                <div className="max-w-6xl mx-auto space-y-8">
                  {/* Approval Progress */}
                  <Card className="p-6 bg-blue-50 border-2 border-blue-200">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={22} />
                      <div className="flex-1">
                        <p className="text-base font-medium text-blue-900 mb-2">Multi-Approver Form</p>
                        <p className="text-sm text-blue-700">
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
                  <Card className="p-8 bg-muted/30">
                    <h3 className="text-xl font-semibold text-foreground mb-6 flex items-center">
                      <User className="mr-2" size={24} />
                      Submitted By
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground uppercase mb-2">Name</p>
                        <p className="text-base font-medium text-foreground">{selectedForm.submittedByName}</p>
                      </div>
                      {selectedForm.submittedByPosition && (
                        <div>
                          <p className="text-sm font-semibold text-muted-foreground uppercase mb-2">Position</p>
                          <p className="text-base font-medium text-foreground">{selectedForm.submittedByPosition}</p>
                        </div>
                      )}
                      {selectedForm.submittedByDepartment && (
                        <div>
                          <p className="text-sm font-semibold text-muted-foreground uppercase mb-2">Department</p>
                          <p className="text-base font-medium text-foreground">{selectedForm.submittedByDepartment}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground uppercase mb-2">Submission Date</p>
                        <p className="text-base font-medium text-foreground">
                          {new Date(selectedForm.submittedAt?.toDate?.() || Date.now()).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </Card>

                  {/* Form Data */}
                  <div className="space-y-6">
                    <h3 className="text-2xl font-bold text-foreground pb-3 border-b-2 border-border">
                      Form Details
                    </h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {getOrganizedFormData().map(([key, value]: any) => {
                        const isFullWidth = isFullWidthField(key);
                        return (
                          <Card key={key} className={`p-6 ${isFullWidth ? 'lg:col-span-2' : ''}`}>
                            <p className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
                              {getFieldLabel(key)}
                            </p>
                            <p className="text-base text-foreground whitespace-pre-wrap leading-relaxed">
                              {formatFieldValue(value)}
                            </p>
                          </Card>
                        );
                      })}
                    </div>
                  </div>

                  {/* Submitter Signature */}
                  {selectedForm.signature && (
                    <Card className="p-8 bg-amber-50 border-2 border-amber-200">
                      <h3 className="text-xl font-semibold text-foreground mb-6">Submitter's Digital Signature</h3>
                      <div className="bg-white rounded-lg p-8 border-2 border-dashed border-amber-300">
                        <img src={selectedForm.signature} alt="Signature" className="max-w-md mx-auto h-24 object-contain" />
                        <div className="text-center mt-6 pt-6 border-t-2 border-amber-200">
                          <p className="text-base font-semibold text-foreground">{selectedForm.submittedByName}</p>
                          {selectedForm.submittedByPosition && (
                            <p className="text-base text-muted-foreground mt-1">{selectedForm.submittedByPosition}</p>
                          )}
                          {selectedForm.submittedByDepartment && (
                            <p className="text-sm text-muted-foreground">{selectedForm.submittedByDepartment}</p>
                          )}
                          <p className="text-sm text-muted-foreground mt-3">
                            Digitally signed on {new Date(selectedForm.submittedAt?.toDate?.() || Date.now()).toLocaleDateString('en-US', { 
                              year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>
                    </Card>
                  )}

                  {/* Previous Approvals */}
                  {getApprovalRecords().length > 0 && (
                    <Card className="p-8 bg-green-50 border-2 border-green-200">
                      <h3 className="text-xl font-semibold text-foreground mb-6 flex items-center">
                        <CheckCircle className="mr-2 text-green-600" size={24} />
                        Approved By
                      </h3>
                      <div className="space-y-6">
                        {getApprovalRecords().map((approval, index) => (
                          <div key={index} className="bg-white rounded-lg p-8 border-2 border-green-200">
                            {approval.signature && (
                              <img src={approval.signature} alt="Approver Signature" className="max-w-md mx-auto h-24 object-contain mb-6" />
                            )}
                            <div className="text-center pt-6 border-t-2 border-green-200">
                              <p className="text-base font-semibold text-foreground">{approval.byName || 'Unknown'}</p>
                              {approval.byPosition && (
                                <p className="text-base text-muted-foreground mt-1">{approval.byPosition}</p>
                              )}
                              {approval.byDepartment && (
                                <p className="text-sm text-muted-foreground">{approval.byDepartment}</p>
                              )}
                              <p className="text-sm text-muted-foreground mt-3">
                                Approved on {new Date(approval.timestamp?.toDate?.() || Date.now()).toLocaleDateString('en-US', { 
                                  year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                })}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}

                  {/* Attachments */}
                  {selectedForm.attachments && selectedForm.attachments.length > 0 && (
                    <Card className="p-8">
                      <h3 className="text-xl font-semibold text-foreground mb-6 flex items-center">
                        <FileText className="mr-2" size={24} />
                        Attachments ({selectedForm.attachments.length})
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {selectedForm.attachments.map((attachment: any, index) => (
                          <div key={index} className="flex items-center justify-between p-5 bg-secondary/30 rounded-lg border border-border">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                                <span className="text-sm font-bold text-primary">
                                  {attachment.name?.split('.').pop()?.toUpperCase() || 'FILE'}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-base font-medium text-foreground truncate">
                                  {attachment.name || `Attachment ${index + 1}`}
                                </p>
                                {attachment.size && (
                                  <p className="text-sm text-muted-foreground">
                                    {(attachment.size / 1024).toFixed(1)} KB
                                  </p>
                                )}
                              </div>
                            </div>
                            <Button onClick={() => downloadAttachment(attachment)} variant="outline" size="sm" className="ml-3 shrink-0">
                              <Download size={16} className="mr-2" />
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
              <div className="bg-card border-t border-border p-8 flex gap-4">
                <Button
                  onClick={handleApprove}
                  disabled={processing === selectedForm.id}
                  className="flex-1 h-14 text-base bg-green-600 hover:bg-green-700 text-white"
                >
                  <CheckCircle size={22} className="mr-2" />
                  Approve Form
                </Button>
                <Button
                  onClick={handleReject}
                  disabled={processing === selectedForm.id}
                  variant="destructive"
                  className="flex-1 h-14 text-base"
                >
                  <XCircle size={22} className="mr-2" />
                  Reject Form
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Signature Modal */}
        {showSignatureModal && (
          <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
            <Card className="max-w-2xl w-full p-8">
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-foreground mb-2">Add Your Signature</h3>
                <p className="text-base text-muted-foreground">Draw or upload your signature to proceed with approval/rejection</p>
              </div>

              <div className="space-y-6">
                <div className="border-2 border-dashed border-border rounded-lg p-4 bg-muted/30">
                  <canvas
                    ref={canvasRef}
                    width={600}
                    height={200}
                    className="w-full bg-white rounded-lg border border-border cursor-crosshair touch-none"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                  />
                  <p className="text-sm text-muted-foreground mt-3 text-center">Draw your signature above</p>
                </div>

                {/* Upload option */}
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
                      className="w-full h-12 border-2 border-dashed"
                      onClick={() => document.getElementById('signature-upload')?.click()}
                    >
                      <Upload size={18} className="mr-2" />
                      Or Upload Signature Image
                    </Button>
                  </label>
                </div>

                {/* Action buttons */}
                <div className="flex gap-3 pt-4">
                  <Button onClick={clearSignature} variant="outline" className="flex-1 h-12">
                    Clear
                  </Button>
                  <Button onClick={() => setShowSignatureModal(false)} variant="outline" className="flex-1 h-12">
                    Cancel
                  </Button>
                  <Button onClick={saveSignature} className="flex-1 h-12 bg-primary hover:bg-primary/90">
                    <PenTool size={18} className="mr-2" />
                    Save Signature
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Confirmation Modal */}
        {showConfirmModal && (
          <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
            <Card className="max-w-lg w-full p-8">
              <div className="text-center mb-8">
                <div className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-6 ${
                  showConfirmModal === 'approve' ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  {showConfirmModal === 'approve' ? (
                    <CheckCircle className="text-green-600" size={40} />
                  ) : (
                    <AlertTriangle className="text-red-600" size={40} />
                  )}
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-3">
                  {showConfirmModal === 'approve' ? 'Approve Form?' : 'Reject Form?'}
                </h3>
                <p className="text-base text-muted-foreground leading-relaxed">
                  {showConfirmModal === 'approve' 
                    ? 'Are you sure you want to approve this form submission? Your signature will be added to the approval record.'
                    : 'Are you sure you want to reject this form submission? This action will be recorded in the approval timeline.'}
                </p>
              </div>

              <div className="flex gap-4">
                <Button
                  onClick={() => setShowConfirmModal(null)}
                  variant="outline"
                  className="flex-1 h-12 text-base"
                >
                  Cancel
                </Button>
                <Button
                  onClick={showConfirmModal === 'approve' ? confirmApprove : confirmReject}
                  disabled={processing !== null}
                  className={`flex-1 h-12 text-base ${
                    showConfirmModal === 'approve' 
                      ? 'bg-green-600 hover:bg-green-700' 
                      : 'bg-red-600 hover:bg-red-700'
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