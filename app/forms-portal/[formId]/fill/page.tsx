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
import { ChevronLeft, Upload, Send, Download, Eye, AlertCircle, Lock, FileSignature } from 'lucide-react';
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
    // Personal information (highest priority)
    'name': 1,
    'full name': 1,
    'employee name': 1,
    'your name': 1,
    
    // Position/Department
    'position': 2,
    'title': 2,
    'role': 2,
    'department': 3,
    
    // Contact information
    'email': 4,
    'phone': 5,
    'contact': 5,
    
    // Leave/Time related
    'leave type': 6,
    'type of leave': 6,
    'start date': 7,
    'from date': 7,
    'end date': 8,
    'to date': 8,
    'date from': 7,
    'date to': 8,
    'number of days': 9,
    'days': 9,
    'total days': 9,
    
    // Credits/Balance
    'credits': 10,
    'balance': 10,
    'available': 10,
    'remaining': 10,
    'sick leave': 11,
    'vacation leave': 11,
    
    // Reason/Details (lower priority)
    'reason': 50,
    'purpose': 50,
    'details': 51,
    'description': 51,
    'comments': 52,
    'notes': 52,
    'remarks': 52,
    
    // Attachments/Additional
    'attachment': 60,
    'medical certificate': 60,
    
    // Acknowledgment checkboxes (lowest priority)
    'acknowledge': 100,
    'agree': 100,
    'confirm': 100,
    'certify': 100,
  };

  const getFieldPriority = (field: FormField): number => {
    const labelLower = field.label.toLowerCase();
    
    // Check for exact or partial matches
    for (const [key, priority] of Object.entries(orderPriority)) {
      if (labelLower.includes(key)) {
        return priority;
      }
    }
    
    // Default priorities by type
    if (field.type === 'checkbox') return 100;
    if (field.type === 'textarea') return 50;
    if (field.type === 'date') return 15;
    
    // Default middle priority
    return 30;
  };

  return [...fields].sort((a, b) => {
    const priorityA = getFieldPriority(a);
    const priorityB = getFieldPriority(b);
    return priorityA - priorityB;
  });
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

  // Fetch user's signature on mount
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

  // Auto-fill fields that match user data
  useEffect(() => {
    if (formTemplate && userData) {
      const autoFillData: Record<string, any> = {};
      
      formTemplate.fields.forEach(field => {
        const labelLower = field.label.toLowerCase();
        
        // Auto-fill name fields
        if (labelLower.includes('name') && 
            (labelLower.includes('your') || labelLower.includes('employee') || 
             labelLower.includes('full') || labelLower === 'name')) {
          autoFillData[field.id] = userData.fullName || '';
        }
        
        // Auto-fill department fields
        if (labelLower.includes('department')) {
          autoFillData[field.id] = userData.department || '';
        }
        
        // Auto-fill position/title fields
        if (labelLower.includes('position') || labelLower.includes('title') || labelLower.includes('role')) {
          autoFillData[field.id] = userData.position || '';
        }
        
        // Auto-fill email fields
        if (labelLower.includes('email') && 
            (labelLower.includes('your') || labelLower.includes('employee'))) {
          autoFillData[field.id] = userData.email || user?.email || '';
        }
      });
      
      setFormData(prev => ({ ...autoFillData, ...prev }));
    }
  }, [formTemplate, userData, user]);

  // Check if a field should be auto-filled and locked
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
            fields: data.fields ? organizeFields(data.fields) : [], // Organize fields on load
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
    setFormData((prev) => ({
      ...prev,
      [fieldId]: value,
    }));
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
    reader.onerror = () => {
      alert('Error reading file. Please try again.');
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
        <div className="flex">
          <Sidebar />
          <main className="flex-1 bg-background md:ml-64 p-6 md:p-8">
            <Card className="p-8 text-center">
              <div className="flex flex-col items-center gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
        <div className="flex">
          <Sidebar />
          <main className="flex-1 bg-background md:ml-64 p-6 md:p-8">
            <Card className="p-8 text-center">
              <AlertCircle className="mx-auto text-destructive mb-4" size={48} />
              <p className="text-destructive text-lg font-semibold">Form not found</p>
              <p className="text-muted-foreground mt-2">This form may have been deleted or you don't have access to it.</p>
              <Link href="/forms-portal">
                <Button className="mt-6 bg-primary hover:bg-primary/90">
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
      <div className="flex">
        <Sidebar />

        <main className="flex-1 bg-background md:ml-64 overflow-y-auto h-screen">
          {/* Header - Fixed */}
          <div className="sticky top-0 z-10 bg-card border-b border-border p-6 md:p-8">
            <Link href="/forms-portal" className="inline-flex items-center text-primary hover:text-primary/80 mb-4 transition-colors">
              <ChevronLeft size={20} className="mr-1" />
              Back to Forms Portal
            </Link>
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-foreground">
                  {formTemplate.name}
                </h1>
                <p className="text-muted-foreground mt-2 max-w-2xl text-base">
                  {formTemplate.description}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <span className="inline-block text-sm font-semibold px-3 py-1 bg-primary/10 text-primary rounded-full">
                    {formTemplate.category}
                  </span>
                  {requiredFieldsCount > 0 && (
                    <span className="inline-block text-sm font-medium px-3 py-1 bg-muted text-muted-foreground rounded-full">
                      {filledRequiredFields}/{requiredFieldsCount} required fields completed
                    </span>
                  )}
                </div>
              </div>
              {formTemplate.fileData && (
                <Button
                  onClick={downloadReferenceDoc}
                  variant="outline"
                  className="shrink-0"
                >
                  <Download size={18} className="mr-2" />
                  Download Reference
                </Button>
              )}
            </div>
          </div>

          {/* Form - Scrollable */}
          <div className="p-6 md:p-8 max-w-6xl mx-auto pb-20">
            {status === 'submitted' && (
              <Card className="p-6 mb-6 bg-green-50 border-green-200">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white">
                    ✓
                  </div>
                  <p className="text-green-700 font-semibold text-base">
                    Form submitted successfully! Redirecting to submissions...
                  </p>
                </div>
              </Card>
            )}

            {status === 'draft' && (
              <Card className="p-6 mb-6 bg-blue-50 border-blue-200">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white">
                    ✓
                  </div>
                  <p className="text-blue-700 font-semibold text-base">
                    Draft saved successfully! Redirecting...
                  </p>
                </div>
              </Card>
            )}

            <Card className="p-8 md:p-10 space-y-8">
              {formTemplate.fileData && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={22} />
                    <div>
                      <p className="text-base font-medium text-blue-900">Reference Document Available</p>
                      <p className="text-sm text-blue-700 mt-1">
                        A reference document is available for this form. Use the "Download Reference" button above to view the original template.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* User Info Section */}
              <div className="bg-muted/50 rounded-lg p-5 border border-border">
                <h3 className="text-base font-semibold text-foreground mb-4">Submitter Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <span className="text-sm text-muted-foreground">Name:</span>
                    <p className="font-medium text-foreground text-base">{userData?.fullName || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Department:</span>
                    <p className="font-medium text-foreground text-base">{userData?.department || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Position:</span>
                    <p className="font-medium text-foreground text-base">{userData?.position || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Signature Section */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1">
                    <FileSignature className="text-amber-600 flex-shrink-0 mt-0.5" size={22} />
                    <div className="flex-1">
                      <p className="text-base font-medium text-amber-900">Digital Signature</p>
                      {userSignature ? (
                        <div className="mt-3">
                          <div className="bg-white border-2 border-amber-300 rounded p-4 inline-block">
                            <img src={userSignature} alt="Signature" className="h-20 max-w-xs" />
                          </div>
                          <p className="text-sm text-amber-700 mt-2">
                            Signature will be added to the submitted form along with your name, position, and department.
                          </p>
                        </div>
                      ) : (
                        <p className="text-base text-amber-700 mt-2">
                          Please upload your signature. It will be added to the form upon submission.
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    onClick={() => setShowSignatureModal(true)}
                    variant="outline"
                    size="default"
                    className="shrink-0"
                  >
                    <Upload size={18} className="mr-2" />
                    {userSignature ? 'Change' : 'Upload'}
                  </Button>
                </div>
              </div>

              {/* Form Fields - Organized in 2-column grid */}
              {formTemplate.fields && formTemplate.fields.length > 0 ? (
                <div className="space-y-6">
                  <h3 className="text-xl font-semibold text-foreground pb-3 border-b-2 border-border">
                    Form Details
                  </h3>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {formTemplate.fields.map((field) => {
                      const isLocked = isAutoFilledField(field);
                      const isFullWidth = field.type === 'textarea' || 
                                         field.label.toLowerCase().includes('reason') || 
                                         field.label.toLowerCase().includes('comment') ||
                                         field.label.toLowerCase().includes('notes') ||
                                         field.label.toLowerCase().includes('description');
                      
                      return (
                        <div key={field.id} className={`space-y-3 ${isFullWidth ? 'lg:col-span-2' : ''}`}>
                          <label className="flex items-center gap-2 text-base font-semibold text-foreground">
                            {field.label}
                            {field.required && (
                              <span className="text-destructive text-lg">*</span>
                            )}
                            {isLocked && (
                              <Lock size={16} className="text-muted-foreground" />
                            )}
                          </label>

                          {field.type === 'textarea' ? (
                            <textarea
                              placeholder={field.placeholder}
                              value={formData[field.id] || ''}
                              onChange={(e) =>
                                handleInputChange(field.id, e.target.value)
                              }
                              disabled={submitting || isLocked}
                              className={`w-full px-4 py-3 text-base border border-input rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all disabled:opacity-50 ${isLocked ? 'bg-muted cursor-not-allowed' : ''}`}
                              rows={5}
                            />
                          ) : field.type === 'checkbox' ? (
                            <div className="flex items-center gap-3 p-4 border border-input rounded-lg bg-background">
                              <input
                                type="checkbox"
                                checked={formData[field.id] || false}
                                onChange={(e) =>
                                  handleInputChange(field.id, e.target.checked)
                                }
                                disabled={submitting || isLocked}
                                className="w-5 h-5 cursor-pointer disabled:opacity-50 rounded border-gray-300 text-primary focus:ring-primary focus:ring-2"
                              />
                              <span className="text-base text-foreground">
                                {field.placeholder || 'Check to confirm'}
                              </span>
                            </div>
                          ) : field.type === 'select' ? (
                            <select
                              value={formData[field.id] || ''}
                              onChange={(e) =>
                                handleInputChange(field.id, e.target.value)
                              }
                              disabled={submitting || isLocked}
                              className={`w-full px-4 py-3 text-base border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all disabled:opacity-50 ${isLocked ? 'bg-muted cursor-not-allowed' : ''}`}
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
                              onChange={(e) =>
                                handleInputChange(field.id, e.target.value)
                              }
                              disabled={submitting || isLocked}
                              className={`transition-all text-base h-12 ${isLocked ? 'bg-muted cursor-not-allowed' : ''}`}
                            />
                          )}
                          
                          {isLocked && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <Lock size={14} />
                              This field is automatically filled from your profile and cannot be edited
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
                  <p className="text-base mt-2">Please contact an administrator to set up this form.</p>
                </div>
              )}

              {/* File Upload */}
              {formTemplate.fields && formTemplate.fields.length > 0 && (
                <div className="space-y-4 pt-4">
                  <label className="block text-base font-semibold text-foreground">
                    Additional Attachments <span className="text-muted-foreground font-normal">(Optional)</span>
                  </label>
                  <div className="border-2 border-dashed border-border rounded-lg p-10 text-center hover:border-primary/50 hover:bg-primary/5 transition-all">
                    <Upload className="mx-auto text-muted-foreground mb-3" size={48} />
                    <label className="cursor-pointer">
                      <p className="text-base font-medium text-foreground mb-1">
                        Click to upload files or drag and drop
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
                    <p className="text-sm text-muted-foreground mt-2">
                      PDF, Word documents, or images (Max 5MB per file)
                    </p>
                  </div>

                  {attachments.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-base font-medium text-foreground">
                        Attached files ({attachments.length}):
                      </p>
                      {attachments.map((file: any, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-4 bg-secondary rounded-lg border border-border"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-10 h-10 bg-primary/10 rounded flex items-center justify-center flex-shrink-0">
                              <span className="text-sm font-bold text-primary">
                                {file.name.split('.').pop()?.toUpperCase()}
                              </span>
                            </div>
                            <span className="text-base text-foreground truncate">
                              {file.name}
                            </span>
                            <span className="text-sm text-muted-foreground flex-shrink-0">
                              ({(file.size / 1024).toFixed(1)} KB)
                            </span>
                          </div>
                          <button
                            onClick={() =>
                              setAttachments((prev) =>
                                prev.filter((_, i) => i !== idx)
                              )
                            }
                            disabled={submitting}
                            className="text-destructive text-base hover:underline ml-3 flex-shrink-0"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              {formTemplate.fields && formTemplate.fields.length > 0 && (
                <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-border">
                  <Button
                    onClick={handleSaveDraft}
                    disabled={submitting}
                    variant="outline"
                    className="flex-1 h-12 text-base"
                  >
                    {submitting ? 'Saving...' : 'Save as Draft'}
                  </Button>
                  <Button
                    onClick={handleSubmitForm}
                    disabled={submitting || filledRequiredFields < requiredFieldsCount || !userSignature}
                    className="flex-1 h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-base"
                  >
                    <Send size={20} className="mr-2" />
                    {submitting ? 'Submitting...' : 'Submit Form'}
                  </Button>
                </div>
              )}
            </Card>
          </div>
        </main>

        {/* Signature Upload Modal - Wider landscape format */}
        {showSignatureModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
              <div className="p-8 border-b border-border shrink-0">
                <h2 className="text-2xl font-bold text-foreground">Upload Your Signature</h2>
                <p className="text-base text-muted-foreground mt-2">
                  Upload an image of your signature. This will be saved to your profile and used for all form submissions.
                </p>
              </div>
              
              <div className="p-8 space-y-6 overflow-y-auto flex-1">
                <div className="border-2 border-dashed border-border rounded-lg p-10 text-center hover:border-primary/50 hover:bg-primary/5 transition-all">
                  <FileSignature className="mx-auto text-muted-foreground mb-4" size={56} />
                  <label className="cursor-pointer block">
                    <span className="text-base font-medium text-foreground mb-2 block">
                      Click here to select your signature image
                    </span>
                    <input
                      type="file"
                      onChange={handleSignatureUpload}
                      className="hidden"
                      accept="image/png,image/jpeg,image/jpg,image/gif"
                    />
                    <span className="inline-block mt-3 px-6 py-3 text-base bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
                      Choose File
                    </span>
                  </label>
                  <p className="text-sm text-muted-foreground mt-4">
                    Accepted formats: PNG, JPG, JPEG, GIF (Maximum file size: 2MB)
                  </p>
                </div>

                {signatureFile && (
                  <div className="bg-muted/50 rounded-lg p-6 border border-border">
                    <p className="text-base font-medium text-foreground mb-4">Signature Preview:</p>
                    <div className="bg-white border-2 border-border rounded-lg p-8 flex items-center justify-center min-h-[200px]">
                      <img 
                        src={signatureFile} 
                        alt="Signature preview" 
                        className="max-h-40 max-w-full object-contain"
                      />
                    </div>
                    <p className="text-sm text-muted-foreground mt-3">
                      This is how your signature will appear on submitted forms.
                    </p>
                  </div>
                )}

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <div className="flex gap-4">
                    <AlertCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={22} />
                    <div className="text-base text-blue-900 space-y-3">
                      <p className="font-medium">Important Information:</p>
                      <ul className="list-disc list-inside space-y-2 text-sm">
                        <li>The signature will be automatically added to all forms you submit</li>
                        <li>It will appear alongside your printed name, position, and department</li>
                        <li>You can update your signature anytime by uploading a new image</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-8 border-t border-border bg-muted/30 flex gap-4 shrink-0">
                <Button
                  onClick={() => {
                    setShowSignatureModal(false);
                    setSignatureFile(null);
                  }}
                  variant="outline"
                  className="flex-1 h-12 text-base"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveSignature}
                  disabled={!signatureFile}
                  className="flex-1 h-12 text-base bg-primary hover:bg-primary/90 disabled:opacity-50"
                >
                  <FileSignature size={20} className="mr-2" />
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