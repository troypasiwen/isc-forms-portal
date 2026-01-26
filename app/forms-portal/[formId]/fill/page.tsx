'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/protected-route';
import { Sidebar } from '@/components/sidebar';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';
import {
  doc,
  getDoc,
  collection,
  addDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { 
  ChevronLeft, 
  Upload, 
  Send, 
  Download, 
  Eye, 
  AlertCircle, 
  Lock, 
  FileSignature,
  FileText,
  Check,
  X
} from 'lucide-react';
import Link from 'next/link';

interface FormField {
  id: string;
  label: string;
  type: 'text' | 'email' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox';
  required: boolean;
  placeholder?: string;
  options?: string[];
}

interface FormTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  notes?: string;
  approvers: string[];
  fields: FormField[];
  fileData?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
}

// Smart field ordering function
const organizeFields = (fields: FormField[]): FormField[] => {
  const orderPriority: Record<string, number> = {
    'name': 1, 'full name': 1, 'employee name': 1, 'your name': 1,
    'position': 2, 'title': 2, 'role': 2,
    'department': 3,
    'email': 4,
    'phone': 5, 'contact': 5,
    'leave type': 6, 'type of leave': 6,
    'start date': 7, 'from date': 7,
    'end date': 8, 'to date': 8,
    'number of days': 9, 'days': 9, 'total days': 9,
    'credits': 10, 'balance': 10,
    'reason': 50, 'purpose': 50,
    'details': 51, 'description': 51,
    'comments': 52, 'notes': 52,
    'acknowledge': 100, 'agree': 100,
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

export default function FillFormPage() {
  const params = useParams();
  const router = useRouter();
  const { user, userData } = useAuth();
  const formId = params.formId as string;

  const [formTemplate, setFormTemplate] = useState<FormTemplate | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [attachments, setAttachments] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'draft' | 'submitted'>('idle');
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signatureFile, setSignatureFile] = useState<any>(null);
  const [userSignature, setUserSignature] = useState<string | null>(null);
  const [hasAgreed, setHasAgreed] = useState(false);

  // Fetch user's signature
  useEffect(() => {
    const fetchUserSignature = async () => {
      if (!user) return;
      try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists() && userDocSnap.data().signature) {
          setUserSignature(userDocSnap.data().signature);
        }
      } catch (error) {
        console.error('Error fetching signature:', error);
      }
    };
    fetchUserSignature();
  }, [user]);

  // Auto-fill fields
  useEffect(() => {
    if (formTemplate && userData) {
      const autoFillData: Record<string, any> = {};
      
      formTemplate.fields.forEach(field => {
        const labelLower = field.label.toLowerCase();
        
        if (labelLower.includes('name') && 
            (labelLower.includes('your') || labelLower.includes('employee') || 
             labelLower.includes('full') || labelLower === 'name')) {
          autoFillData[field.id] = userData.fullName || '';
        }
        
        if (labelLower.includes('department')) {
          autoFillData[field.id] = userData.department || '';
        }
        
        if (labelLower.includes('position') || labelLower.includes('title') || labelLower.includes('role')) {
          autoFillData[field.id] = userData.position || '';
        }
        
        if (labelLower.includes('email') && 
            (labelLower.includes('your') || labelLower.includes('employee'))) {
          autoFillData[field.id] = userData.email || user?.email || '';
        }
      });
      
      setFormData(prev => ({ ...autoFillData, ...prev }));
    }
  }, [formTemplate, userData, user]);

  const isAutoFilledField = (field: FormField): boolean => {
    const labelLower = field.label.toLowerCase();
    return (
      (labelLower.includes('name') && 
       (labelLower.includes('your') || labelLower.includes('employee') || 
        labelLower.includes('full') || labelLower === 'name')) ||
      labelLower.includes('department') ||
      labelLower.includes('position') || 
      labelLower.includes('title') || 
      labelLower.includes('role') ||
      (labelLower.includes('email') && 
       (labelLower.includes('your') || labelLower.includes('employee')))
    );
  };

  useEffect(() => {
    if (!formId) return;

    const fetchFormTemplate = async () => {
      try {
        const formDocRef = doc(db, 'formTemplates', formId);
        const formDocSnap = await getDoc(formDocRef);

        if (formDocSnap.exists()) {
          const data = formDocSnap.data();
          setFormTemplate({
            id: formDocSnap.id,
            ...data,
            fields: data.fields ? organizeFields(data.fields) : [],
          } as FormTemplate);
        }
      } catch (error) {
        console.error('Error fetching form template:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFormTemplate();
  }, [formId]);

  const handleInputChange = (fieldId: string, value: any) => {
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      
      const oversizedFiles = files.filter(f => f.size > 5 * 1024 * 1024);
      if (oversizedFiles.length > 0) {
        alert(`The following files exceed 5MB:\n${oversizedFiles.map(f => f.name).join('\n')}`);
        return;
      }
      
      files.forEach((file) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result as string;
          setAttachments((prev) => [
            ...prev,
            { name: file.name, data: base64.split(',')[1], type: file.type, size: file.size } as any,
          ]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 2 * 1024 * 1024) {
      alert('Signature file must be less than 2MB');
      e.target.value = '';
      return;
    }

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (PNG, JPG, etc.)');
      e.target.value = '';
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setSignatureFile(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSignature = async () => {
    if (!signatureFile || !user) return;
    
    try {
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, {
        signature: signatureFile,
        signatureUpdatedAt: Timestamp.now(),
      });
      
      setUserSignature(signatureFile);
      setShowSignatureModal(false);
      setSignatureFile(null);
      alert('Signature saved successfully!');
    } catch (error) {
      console.error('Error saving signature:', error);
      alert('Error saving signature. Please try again.');
    }
  };

  const downloadReferenceDoc = () => {
    if (!formTemplate?.fileData) return;

    try {
      const byteCharacters = atob(formTemplate.fileData);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: formTemplate.fileType });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = formTemplate.fileName || 'form-template.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Error downloading file');
    }
  };

  const handleSaveDraft = async () => {
    if (!user || !formTemplate) return;
    setSubmitting(true);

    try {
      const draftData = {
        formTemplateId: formId,
        formName: formTemplate.name,
        submittedBy: user.uid,
        submittedByName: userData?.fullName || 'Unknown',
        department: userData?.department,
        position: userData?.position,
        status: 'Draft',
        formData,
        attachments: attachments.map((f: any) => ({
          name: f.name,
          data: f.data,
          type: f.type,
          size: f.size,
        })),
        signature: userSignature,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      await addDoc(collection(db, 'forms'), draftData);
      setStatus('draft');
      setTimeout(() => {
        router.push('/submissions');
      }, 1500);
    } catch (error) {
      console.error('Error saving draft:', error);
      alert('Error saving draft. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitForm = async () => {
    if (!user || !formTemplate) return;

    const missingFields = formTemplate.fields
      .filter((f) => f.required && !formData[f.id])
      .map((f) => f.label);

    if (missingFields.length > 0) {
      alert(`Please fill in the following required fields:\n\n${missingFields.join('\n')}`);
      return;
    }

    if (!userSignature) {
      alert('Please upload your signature before submitting the form.');
      return;
    }

    if (!hasAgreed) {
      alert('Please confirm that you have read and understood the form requirements.');
      return;
    }

    setSubmitting(true);

    try {
      const submissionData = {
        formTemplateId: formId,
        formName: formTemplate.name,
        formCategory: formTemplate.category,
        submittedBy: user.uid,
        submittedByName: userData?.fullName || 'Unknown',
        submittedByEmail: userData?.email || user.email,
        department: userData?.department,
        position: userData?.position,
        signature: userSignature,
        status: 'Pending Approval',
        formData,
        attachments: attachments.map((f: any) => ({
          name: f.name,
          data: f.data,
          type: f.type,
          size: f.size,
        })),
        assignedApprovers: formTemplate.approvers,
        submittedAt: Timestamp.now(),
        createdAt: Timestamp.now(),
        approvalTimeline: [
          {
            action: 'Submitted',
            by: user.uid,
            byName: userData?.fullName,
            timestamp: Timestamp.now(),
          },
        ],
      };

      const docRef = await addDoc(collection(db, 'forms'), submissionData);

      for (const approverId of formTemplate.approvers) {
        await addDoc(collection(db, 'notifications'), {
          recipientId: approverId,
          type: 'form_submitted',
          title: `New form submission: ${formTemplate.name}`,
          message: `${userData?.fullName} submitted a form for approval`,
          formId: docRef.id,
          createdAt: Timestamp.now(),
          read: false,
        });
      }

      setStatus('submitted');
      setTimeout(() => {
        router.push('/submissions');
      }, 1500);
    } catch (error) {
      console.error('Error submitting form:', error);
      alert('Error submitting form. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
          <Sidebar />
          <main className="flex-1 md:ml-64 p-4 sm:p-6 lg:p-8">
            <Card className="p-8 text-center bg-white/80 backdrop-blur-sm shadow-lg">
              <div className="flex flex-col items-center gap-3">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                <p className="text-muted-foreground">Loading form...</p>
              </div>
            </Card>
          </main>
        </div>
      </ProtectedRoute>
    );
  }

  if (!formTemplate) {
    return (
      <ProtectedRoute>
        <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
          <Sidebar />
          <main className="flex-1 md:ml-64 p-4 sm:p-6 lg:p-8">
            <Card className="p-8 text-center bg-white/80 backdrop-blur-sm shadow-lg">
              <AlertCircle className="mx-auto text-destructive mb-4" size={48} />
              <p className="text-destructive text-lg font-semibold">Form not found</p>
              <Link href="/forms-portal">
                <Button className="mt-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md">
                  Back to Forms Portal
                </Button>
              </Link>
            </Card>
          </main>
        </div>
      </ProtectedRoute>
    );
  }

  const requiredFieldsCount = formTemplate.fields?.filter(f => f.required).length || 0;
  const filledRequiredFields = formTemplate.fields?.filter(f => f.required && formData[f.id]).length || 0;

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <Sidebar />

        <main className="flex-1 md:ml-64 overflow-y-auto">
          {/* Header - Sticky */}
          <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-slate-200 shadow-sm p-4 sm:p-5">
            <Link 
              href="/forms-portal" 
              className="inline-flex items-center text-slate-600 hover:text-slate-900 mb-3 transition-colors text-sm font-medium group"
            >
              <ChevronLeft size={16} className="mr-1 group-hover:-translate-x-1 transition-transform" />
              Back to Forms Portal
            </Link>
            
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div className="flex-1">
                <h1 className="text-xl font-semibold text-slate-900">
                  {formTemplate.name}
                </h1>
                <p className="text-slate-600 mt-1 text-sm">
                  {formTemplate.description}
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium px-3 py-1 bg-blue-50 text-blue-700 rounded-md border border-blue-100">
                  {formTemplate.category}
                </span>
                {requiredFieldsCount > 0 && (
                  <span className="text-xs font-medium px-3 py-1 bg-slate-100 text-slate-600 rounded-md">
                    {filledRequiredFields}/{requiredFieldsCount} required
                  </span>
                )}
                {formTemplate.fileData && (
                  <>
                    <Link href={`/forms-portal/view/${formId}`}>
                      <Button variant="outline" size="sm" className="h-8 text-xs border-slate-300">
                        <Eye size={14} className="mr-1" />
                        View
                      </Button>
                    </Link>
                    <Button
                      onClick={downloadReferenceDoc}
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs border-slate-300"
                    >
                      <Download size={14} className="mr-1" />
                      Download
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Form Content */}
          <div className="p-4 sm:p-5 max-w-5xl mx-auto pb-16">
            {status === 'submitted' && (
              <div className="p-4 mb-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="flex-shrink-0 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white">
                    <Check size={14} />
                  </div>
                  <p className="text-green-700 font-medium text-sm">
                    Form submitted successfully! Redirecting...
                  </p>
                </div>
              </div>
            )}

            {status === 'draft' && (
              <div className="p-4 mb-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="flex-shrink-0 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-white">
                    <Check size={14} />
                  </div>
                  <p className="text-blue-700 font-medium text-sm">
                    Draft saved successfully! Redirecting...
                  </p>
                </div>
              </div>
            )}

            {/* Notes Section */}
            {formTemplate.notes && (
              <div className="p-4 mb-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="text-amber-600 flex-shrink-0 mt-0.5" size={16} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-amber-900 text-sm mb-1">Important Notes</p>
                    <p className="text-amber-800 text-xs leading-relaxed whitespace-pre-wrap">
                      {formTemplate.notes}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="p-5 space-y-6 bg-white border border-slate-200 rounded-lg shadow-sm">
              {/* User Info Section */}
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Submitter Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <span className="text-xs text-slate-500">Name</span>
                    <p className="font-medium text-slate-900 text-sm">{userData?.fullName || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Department</span>
                    <p className="font-medium text-slate-900 text-sm">{userData?.department || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Position</span>
                    <p className="font-medium text-slate-900 text-sm">{userData?.position || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Signature Section */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2 flex-1">
                    <FileSignature className="text-blue-600 flex-shrink-0 mt-0.5" size={16} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-blue-900">Digital Signature Required</p>
                      {userSignature ? (
                        <div className="mt-2">
                          <div className="bg-white border border-blue-200 rounded p-2 inline-block">
                            <img src={userSignature} alt="Signature" className="h-12 max-w-[200px]" />
                          </div>
                          <p className="text-xs text-blue-700 mt-1">
                            Signature will be attached to submission
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-blue-700 mt-1">
                          Upload your signature to enable submission
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    onClick={() => setShowSignatureModal(true)}
                    variant="outline"
                    size="sm"
                    className="shrink-0 h-8 text-xs border-blue-300 hover:bg-blue-100"
                  >
                    <Upload size={14} className="mr-1" />
                    {userSignature ? 'Change' : 'Upload'}
                  </Button>
                </div>
              </div>

              {/* Form Fields */}
              {formTemplate.fields && formTemplate.fields.length > 0 ? (
                <div className="space-y-5">
                  <h3 className="text-sm font-semibold text-slate-900 pb-2 border-b border-slate-200">
                    Fill Out Form
                  </h3>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {formTemplate.fields.map((field) => {
                      const isLocked = isAutoFilledField(field);
                      const isFullWidth = field.type === 'textarea' || 
                                         field.label.toLowerCase().includes('reason') || 
                                         field.label.toLowerCase().includes('comment') ||
                                         field.label.toLowerCase().includes('notes') ||
                                         field.label.toLowerCase().includes('description');
                      
                      return (
                        <div key={field.id} className={`space-y-2 ${isFullWidth ? 'lg:col-span-2' : ''}`}>
                          <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                            {field.label}
                            {field.required && (
                              <span className="text-red-500">*</span>
                            )}
                            {isLocked && (
                              <Lock size={12} className="text-blue-500" />
                            )}
                          </label>

                          {field.type === 'textarea' ? (
                            <textarea
                              placeholder={field.placeholder}
                              value={formData[field.id] || ''}
                              onChange={(e) => handleInputChange(field.id, e.target.value)}
                              disabled={submitting || isLocked}
                              className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${isLocked ? 'bg-slate-50 border-slate-200 cursor-not-allowed' : 'border-slate-300 bg-white'} disabled:opacity-50`}
                              rows={4}
                            />
                          ) : field.type === 'checkbox' ? (
                            <div className="flex items-center gap-2 p-3 border border-slate-300 rounded-md bg-white">
                              <input
                                type="checkbox"
                                checked={formData[field.id] || false}
                                onChange={(e) => handleInputChange(field.id, e.target.checked)}
                                disabled={submitting || isLocked}
                                className="w-4 h-4 cursor-pointer disabled:opacity-50 rounded border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-2"
                              />
                              <span className="text-sm text-slate-700">
                                {field.placeholder || 'Check to confirm'}
                              </span>
                            </div>
                          ) : field.type === 'select' ? (
                            <select
                              value={formData[field.id] || ''}
                              onChange={(e) => handleInputChange(field.id, e.target.value)}
                              disabled={submitting || isLocked}
                              className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${isLocked ? 'bg-slate-50 border-slate-200 cursor-not-allowed' : 'border-slate-300 bg-white'} disabled:opacity-50`}
                            >
                              <option value="">Select an option</option>
                              {field.options?.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <Input
                              type={field.type}
                              placeholder={field.placeholder}
                              value={formData[field.id] || ''}
                              onChange={(e) => handleInputChange(field.id, e.target.value)}
                              disabled={submitting || isLocked}
                              className={`transition-all text-sm h-10 ${isLocked ? 'bg-slate-50 border-slate-200 cursor-not-allowed' : 'border-slate-300'}`}
                            />
                          )}
                          
                          {isLocked && (
                            <p className="text-xs text-blue-600 flex items-center gap-1">
                              <Lock size={10} />
                              Auto-filled from profile
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <AlertCircle className="mx-auto mb-3" size={48} />
                  <p className="font-medium text-lg">No fields defined for this form yet.</p>
                </div>
              )}

              {/* File Upload */}
              {formTemplate.fields && formTemplate.fields.length > 0 && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-slate-700">
                    Attachments <span className="text-slate-500 font-normal text-xs">(Optional)</span>
                  </label>
                  <div className="border-2 border-dashed border-slate-300 rounded-lg p-5 text-center hover:border-blue-400 hover:bg-blue-50/30 transition-all cursor-pointer">
                    <Upload className="mx-auto text-slate-400 mb-2" size={24} />
                    <label className="cursor-pointer">
                      <p className="text-sm font-medium text-slate-700">
                        Click to upload or drag and drop
                      </p>
                      <input
                        type="file"
                        multiple
                        onChange={handleFileUpload}
                        disabled={submitting}
                        className="hidden"
                        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                      />
                    </label>
                    <p className="text-xs text-slate-500 mt-1">
                      PDF, Word, or Images (Max 5MB)
                    </p>
                  </div>

                  {attachments.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-slate-700">
                        Attached ({attachments.length}):
                      </p>
                      {attachments.map((file: any, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 bg-slate-50 rounded-md border border-slate-200"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-bold text-blue-600">
                                {file.name.split('.').pop()?.toUpperCase()}
                              </span>
                            </div>
                            <span className="text-sm text-slate-700 truncate">
                              {file.name}
                            </span>
                            <span className="text-xs text-slate-500 flex-shrink-0">
                              ({(file.size / 1024).toFixed(1)} KB)
                            </span>
                          </div>
                          <button
                            onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                            disabled={submitting}
                            className="text-red-600 hover:text-red-700 ml-2 flex-shrink-0"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Agreement Checkbox */}
              {formTemplate.fields && formTemplate.fields.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={hasAgreed}
                      onChange={(e) => setHasAgreed(e.target.checked)}
                      disabled={submitting}
                      className="w-4 h-4 mt-0.5 cursor-pointer rounded border-blue-300 text-blue-600 focus:ring-blue-500 focus:ring-2"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-900 mb-1">
                        I certify that:
                      </p>
                      <ul className="space-y-0.5 text-xs text-blue-800">
                        <li>• All information provided is true and accurate</li>
                        <li>• I have read and understood the requirements{formTemplate.notes ? ' and notes' : ''}</li>
                        <li>• My digital signature is legally binding</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {formTemplate.fields && formTemplate.fields.length > 0 && (
                <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-200">
                  <Button
                    onClick={handleSaveDraft}
                    disabled={submitting}
                    variant="outline"
                    className="flex-1 h-10 text-sm border-slate-300"
                  >
                    {submitting ? 'Saving...' : 'Save as Draft'}
                  </Button>
                  <Button
                    onClick={handleSubmitForm}
                    disabled={submitting || filledRequiredFields < requiredFieldsCount || !userSignature || !hasAgreed}
                    className="flex-1 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send size={16} className="mr-1.5" />
                    {submitting ? 'Submitting...' : 'Submit Form'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Signature Upload Modal */}
        {showSignatureModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col">
              <div className="p-5 border-b border-slate-200 shrink-0">
                <h2 className="text-lg font-semibold text-slate-900">
                  Upload Signature
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  This will be saved to your profile for all submissions.
                </p>
              </div>
              
              <div className="p-5 space-y-4 overflow-y-auto flex-1">
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-blue-400 hover:bg-blue-50/30 transition-all">
                  <FileSignature className="mx-auto text-blue-600 mb-3" size={40} />
                  <label className="cursor-pointer block">
                    <span className="text-sm font-medium text-slate-700 mb-2 block">
                      Select your signature image
                    </span>
                    <input
                      type="file"
                      onChange={handleSignatureUpload}
                      className="hidden"
                      accept="image/png,image/jpeg,image/jpg,image/gif"
                    />
                    <span className="inline-block mt-2 px-4 py-2 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-md hover:from-blue-700 hover:to-indigo-700 transition-colors">
                      Choose File
                    </span>
                  </label>
                  <p className="text-xs text-slate-500 mt-3">
                    PNG, JPG, JPEG, GIF (Max 2MB)
                  </p>
                </div>

                {signatureFile && (
                  <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <p className="text-sm font-medium text-slate-700 mb-3">Preview:</p>
                    <div className="bg-white border border-slate-200 rounded-lg p-4 flex items-center justify-center min-h-[150px]">
                      <img 
                        src={signatureFile} 
                        alt="Signature preview" 
                        className="max-h-32 max-w-full object-contain"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="p-5 border-t border-slate-200 bg-slate-50 flex gap-3 shrink-0">
                <Button
                  onClick={() => {
                    setShowSignatureModal(false);
                    setSignatureFile(null);
                  }}
                  variant="outline"
                  className="flex-1 h-10 text-sm"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveSignature}
                  disabled={!signatureFile}
                  className="flex-1 h-10 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white disabled:opacity-50"
                >
                  <FileSignature size={16} className="mr-1.5" />
                  Save Signature
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}