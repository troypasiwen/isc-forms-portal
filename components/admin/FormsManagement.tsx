'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { db } from '@/lib/firebase';
import { addDoc, collection, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import {
  Plus,
  Trash2,
  Edit2,
  Upload,
  FileText,
  Download,
  X,
  CheckCircle2,
  AlertCircle,
  Eye,
  ZoomIn,
  GripVertical,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  generateRevisionNumber,
  generateFormPDF,
  convertFileToBase64,
  formatFileSize,
  getApproverNames,
  downloadFile,
  FormField,
  UserRecord,
  FormTemplateData,
} from './FormBuilderUtils';
import { DocumentAnalyzer } from './DocumentAnalyzer';

interface FormTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  approvers: string[];
  fileData?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  fields?: FormField[];
  revisionNumber?: string;
  notes?: string;
}

interface FormsManagementProps {
  forms: FormTemplate[];
  setForms: React.Dispatch<React.SetStateAction<FormTemplate[]>>;
  users: UserRecord[];
  loading: boolean;
  currentUserId?: string;
}

export function FormsManagement({ 
  forms, 
  setForms, 
  users, 
  loading,
  currentUserId 
}: FormsManagementProps) {
  const [showFormTemplate, setShowFormTemplate] = useState(false);
  const [editingForm, setEditingForm] = useState<FormTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [showPreview, setShowPreview] = useState(false);
  const [previewPdfBlob, setPreviewPdfBlob] = useState<Blob | null>(null);
  const [draggedFieldIndex, setDraggedFieldIndex] = useState<number | null>(null);

  const [formTemplateData, setFormTemplateData] = useState<FormTemplateData>({
    name: '',
    description: '',
    category: '',
    approvers: [],
    fields: [],
    revisionNumber: '',
    notes: '',
  });

  const [newField, setNewField] = useState<FormField>({
    id: '',
    label: '',
    type: 'text',
    required: false,
    placeholder: '',
    options: [],
  });

  // Initialize revision number when creating new form
  useEffect(() => {
    if (!editingForm && !formTemplateData.revisionNumber) {
      setFormTemplateData(prev => ({
        ...prev,
        revisionNumber: generateRevisionNumber(),
      }));
    }
  }, [editingForm]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    if (!allowedTypes.includes(file.type)) {
      alert('Please select a valid document file (PDF, DOC, DOCX, XLS, XLSX)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    setSelectedFile(file);
  };

  const handleShowPreview = async () => {
    try {
      const pdf = await generateFormPDF(formTemplateData, users);
      const blob = pdf.output('blob');
      setPreviewPdfBlob(blob);
      setShowPreview(true);
    } catch (error) {
      console.error('Error generating preview:', error);
      alert('Failed to generate preview. Please try again.');
    }
  };

  const handleClosePreview = () => {
    if (window.confirm('Are you sure you want to close the preview? Your current progress will not be saved.')) {
      setShowPreview(false);
      setPreviewPdfBlob(null);
    }
  };

  const handleSaveForm = async () => {
    if (!formTemplateData.name || !formTemplateData.description || !formTemplateData.category) {
      alert('Please fill in all required fields (Name, Description, Category)');
      return;
    }

    if (formTemplateData.fields.length === 0) {
      if (!window.confirm('No form fields added. Continue anyway?')) {
        return;
      }
    }

    try {
      setSaving(true);
      setUploadingFile(!!selectedFile);

      let fileData: { 
        fileData?: string; 
        fileName?: string; 
        fileSize?: number;
        fileType?: string;
      } = {};

      if (selectedFile) {
        console.log('Converting file to Base64...');
        const base64Data = await convertFileToBase64(selectedFile);
        fileData = {
          fileData: base64Data,
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          fileType: selectedFile.type,
        };
        console.log('File converted successfully');
      }

      if (editingForm) {
        const updateData = {
          name: formTemplateData.name.trim(),
          description: formTemplateData.description.trim(),
          category: formTemplateData.category.trim(),
          approvers: formTemplateData.approvers,
          fields: formTemplateData.fields,
          revisionNumber: formTemplateData.revisionNumber || generateRevisionNumber(),
          notes: formTemplateData.notes || '',
          updatedAt: new Date().toISOString(),
          ...(selectedFile ? fileData : {}),
        };

        await updateDoc(doc(db, 'formTemplates', editingForm.id), updateData);

        setForms((prev) =>
          prev.map((f) =>
            f.id === editingForm.id
              ? { ...f, ...formTemplateData, ...fileData }
              : f
          )
        );

        alert('✓ Form updated successfully!');
      } else {
        const newFormData = {
          name: formTemplateData.name.trim(),
          description: formTemplateData.description.trim(),
          category: formTemplateData.category.trim(),
          approvers: formTemplateData.approvers,
          fields: formTemplateData.fields,
          revisionNumber: formTemplateData.revisionNumber || generateRevisionNumber(),
          notes: formTemplateData.notes || '',
          createdAt: new Date().toISOString(),
          isActive: true,
          ...fileData,
        };

        const docRef = await addDoc(collection(db, 'formTemplates'), newFormData);

        const newForm: FormTemplate = {
          id: docRef.id,
          ...formTemplateData,
          ...fileData,
        };
        setForms((prev) => [...prev, newForm]);

        alert('✓ Form created successfully!');
      }

      setShowFormTemplate(false);
      setEditingForm(null);
      setSelectedFile(null);
      setCurrentStep(1);
      setFormTemplateData({
        name: '',
        description: '',
        category: '',
        approvers: [],
        fields: [],
        revisionNumber: '',
        notes: '',
      });
    } catch (error: any) {
      console.error('Error saving form:', error);
      alert(`Error saving form: ${error.message || 'Please check console for details.'}`);
    } finally {
      setSaving(false);
      setUploadingFile(false);
    }
  };

  const handleDeleteForm = async (formId: string) => {
    if (!window.confirm('Are you sure you want to delete this form template?')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'formTemplates', formId));
      setForms((prev) => prev.filter((f) => f.id !== formId));
      alert('✓ Form deleted successfully!');
    } catch (error) {
      console.error('Error deleting form:', error);
      alert('Error deleting form. Please try again.');
    }
  };

  const openEditForm = (form: FormTemplate) => {
    setEditingForm(form);
    setFormTemplateData({
      name: form.name,
      description: form.description,
      category: form.category,
      approvers: form.approvers || [],
      fields: form.fields || [],
      revisionNumber: form.revisionNumber || generateRevisionNumber(),
      notes: form.notes || '',
    });
    setSelectedFile(null);
    setCurrentStep(1);
    setShowFormTemplate(true);
  };

  const addAdminAsApprover = () => {
    if (currentUserId) {
      if (!formTemplateData.approvers.includes(currentUserId)) {
        setFormTemplateData({
          ...formTemplateData,
          approvers: [...formTemplateData.approvers, currentUserId],
        });
      } else {
        alert('You are already added as an approver');
      }
    } else {
      alert('Unable to add yourself as approver. Please try reloading the page.');
    }
  };

  const addField = () => {
    if (!newField.label) {
      alert('Please enter a field label');
      return;
    }

    const field: FormField = {
      ...newField,
      id: `field_${Date.now()}`,
    };

    setFormTemplateData({
      ...formTemplateData,
      fields: [...formTemplateData.fields, field],
    });

    setNewField({
      id: '',
      label: '',
      type: 'text',
      required: false,
      placeholder: '',
      options: [],
    });
  };

  const removeField = (fieldId: string) => {
    setFormTemplateData({
      ...formTemplateData,
      fields: formTemplateData.fields.filter((f) => f.id !== fieldId),
    });
  };

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    setDraggedFieldIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedFieldIndex === null) return;

    const newFields = [...formTemplateData.fields];
    const [draggedField] = newFields.splice(draggedFieldIndex, 1);
    newFields.splice(dropIndex, 0, draggedField);

    setFormTemplateData({ ...formTemplateData, fields: newFields });
    setDraggedFieldIndex(null);
  };

  const canProceedToStep2 = () => {
    return formTemplateData.name && formTemplateData.description && formTemplateData.category;
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-foreground">
            Form Templates
          </h2>
          <Button
            onClick={() => {
              setEditingForm(null);
              setFormTemplateData({
                name: '',
                description: '',
                category: '',
                approvers: [],
                fields: [],
                revisionNumber: generateRevisionNumber(),
              });
              setSelectedFile(null);
              setCurrentStep(1);
              setShowFormTemplate(true);
            }}
            className="bg-primary hover:bg-primary/90"
          >
            <Plus size={18} className="mr-2" />
            Create Form
          </Button>
        </div>

        {loading ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">Loading forms...</p>
          </Card>
        ) : forms.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">
              No forms found. Create your first form template!
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {forms.map((form) => (
              <Card key={form.id} className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-foreground">
                      {form.name}
                    </h3>
                    <p className="text-xs font-semibold text-primary mt-1">
                      {form.category}
                    </p>
                    {form.revisionNumber && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {form.revisionNumber}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditForm(form)}
                      className="p-2 hover:bg-secondary rounded-lg"
                    >
                      <Edit2 size={16} className="text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => handleDeleteForm(form.id)}
                      className="p-2 hover:bg-destructive/10 rounded-lg"
                    >
                      <Trash2 size={16} className="text-destructive" />
                    </button>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground mb-4">
                  {form.description}
                </p>

                {form.fileData && (
                  <div className="mb-4 p-3 bg-secondary rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText size={16} className="text-primary" />
                      <span className="text-sm font-medium text-foreground">
                        {form.fileName}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {formatFileSize(form.fileSize)}
                      </span>
                      <button
                        onClick={() => downloadFile(form.fileData!, form.fileName!, form.fileType!)}
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        <Download size={12} />
                        Download
                      </button>
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-border">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">
                    Form Fields: {form.fields?.length || 0}
                  </p>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">
                    Approvers ({form.approvers?.length || 0}):
                  </p>
                  <p className="text-xs text-foreground">
                    {getApproverNames(form.approvers || [], users)}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showFormTemplate} onOpenChange={setShowFormTemplate}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              {editingForm ? 'Edit Form Template' : 'Create New Form Template'}
            </DialogTitle>
            <DialogDescription>
              Follow the steps below to {editingForm ? 'update' : 'create'} your form template
            </DialogDescription>
          </DialogHeader>

          {/* Progress Steps */}
          <div className="flex items-center justify-between mb-6 px-4">
            <div className="flex items-center gap-2 flex-1">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full ${currentStep >= 1 ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'}`}>
                {currentStep > 1 ? <CheckCircle2 size={18} /> : '1'}
              </div>
              <span className={`text-sm font-medium ${currentStep >= 1 ? 'text-foreground' : 'text-muted-foreground'}`}>Basic Info</span>
            </div>
            <div className="flex-1 h-0.5 bg-border mx-2" />
            <div className="flex items-center gap-2 flex-1">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full ${currentStep >= 2 ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'}`}>
                {currentStep > 2 ? <CheckCircle2 size={18} /> : '2'}
              </div>
              <span className={`text-sm font-medium ${currentStep >= 2 ? 'text-foreground' : 'text-muted-foreground'}`}>Upload & Fields</span>
            </div>
            <div className="flex-1 h-0.5 bg-border mx-2" />
            <div className="flex items-center gap-2 flex-1">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full ${currentStep >= 3 ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'}`}>
                3
              </div>
              <span className={`text-sm font-medium ${currentStep >= 3 ? 'text-foreground' : 'text-muted-foreground'}`}>Approvers</span>
            </div>
          </div>

          {/* Step Content */}
          <div className="flex-1 overflow-y-auto px-2">
            {currentStep === 1 && (
              <div className="space-y-6 p-4">
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Form Name <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="text"
                      value={formTemplateData.name}
                      onChange={(e) => setFormTemplateData({ ...formTemplateData, name: e.target.value })}
                      placeholder="e.g., Leave Request Form, Equipment Request"
                      className="text-base"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Description <span className="text-destructive">*</span>
                    </label>
                    <textarea
                      value={formTemplateData.description}
                      onChange={(e) => setFormTemplateData({ ...formTemplateData, description: e.target.value })}
                      className="w-full px-4 py-3 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent resize-none text-base"
                      placeholder="Brief description of what this form is used for..."
                      rows={4}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Category <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="text"
                      value={formTemplateData.category}
                      onChange={(e) => setFormTemplateData({ ...formTemplateData, category: e.target.value })}
                      placeholder="HR, Finance, IT, Operations, etc."
                      className="text-base"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Revision Number
                    </label>
                    <Input
                      type="text"
                      value={formTemplateData.revisionNumber}
                      onChange={(e) => setFormTemplateData({ ...formTemplateData, revisionNumber: e.target.value })}
                      placeholder="Auto-generated"
                      className="text-base bg-secondary/30"
                      readOnly
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Auto-generated on creation
                    </p>
                  </div>
                </div>

                {!canProceedToStep2() && (
                  <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <AlertCircle size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      Please fill in all required fields to continue
                    </p>
                  </div>
                )}
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-6 p-4">
                <div className="grid grid-cols-2 gap-6">
                  {/* File Upload Section */}
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Upload Form Template (Optional)
                    </label>
                    <DocumentAnalyzer
                      onFileSelect={handleFileSelect}
                      selectedFile={selectedFile}
                      onFieldsDetected={(fields) => {
                        setFormTemplateData({ ...formTemplateData, fields });
                      }}
                    />
                  </div>

                  {/* Form Fields Section */}
                  <div className="col-span-2">
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-semibold text-foreground">
                        Form Fields {formTemplateData.fields.length > 0 && `(${formTemplateData.fields.length})`}
                      </label>
                    </div>

                    {formTemplateData.fields.length > 0 && (
                      <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
                        {formTemplateData.fields.map((field, index) => (
                          <div
                            key={field.id}
                            draggable
                            onDragStart={() => handleDragStart(index)}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDrop={(e) => handleDrop(e, index)}
                            className="flex items-center gap-3 p-3 bg-secondary/50 hover:bg-secondary rounded-lg border border-border cursor-move"
                          >
                            <div className="flex-shrink-0 cursor-grab active:cursor-grabbing">
                              <GripVertical size={18} className="text-muted-foreground" />
                            </div>
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-sm font-semibold text-primary">{index + 1}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate flex items-center gap-2">
                                {field.label}
                                {field.required && <span className="text-destructive ml-1">*</span>}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Type: {field.type}
                                {field.placeholder && ` • ${field.placeholder}`}
                              </p>
                            </div>
                            <button
                              onClick={() => removeField(field.id)}
                              className="flex-shrink-0 text-destructive hover:bg-destructive/10 p-2 rounded transition-colors"
                            >
                              <X size={18} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add New Field */}
                    <div className="bg-secondary/30 border-2 border-dashed border-border rounded-lg p-4 space-y-3">
                      <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <Plus size={16} />
                        Add New Field
                      </p>

                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          placeholder="Field Label (e.g., Full Name, Email)"
                          value={newField.label}
                          onChange={(e) => setNewField({ ...newField, label: e.target.value })}
                          className="col-span-2"
                        />

                        <select
                          value={newField.type}
                          onChange={(e) => setNewField({ ...newField, type: e.target.value as any })}
                          className="px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:ring-2 focus:ring-primary"
                        >
                          <option value="text">Text</option>
                          <option value="email">Email</option>
                          <option value="textarea">Long Text</option>
                          <option value="number">Number</option>
                          <option value="date">Date</option>
                          <option value="select">Dropdown</option>
                          <option value="checkbox">Checkbox</option>
                        </select>

                        <label className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg bg-background cursor-pointer hover:bg-secondary/50">
                          <input
                            type="checkbox"
                            checked={newField.required}
                            onChange={(e) => setNewField({ ...newField, required: e.target.checked })}
                            className="w-4 h-4"
                          />
                          <span className="text-sm text-foreground">Required</span>
                        </label>

                        <Input
                          placeholder="Placeholder text (optional)"
                          value={newField.placeholder}
                          onChange={(e) => setNewField({ ...newField, placeholder: e.target.value })}
                          className="col-span-2"
                        />

                        <Button
                          type="button"
                          onClick={addField}
                          variant="outline"
                          className="col-span-2"
                        >
                          <Plus size={16} className="mr-2" />
                          Add Field
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-6 p-4">
                {/* Notes Section */}
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    Form Notes (Optional)
                  </label>
                  <p className="text-sm text-muted-foreground mb-3">
                    Add any important notes, policies, or instructions that will appear above the signature section in the PDF
                  </p>
                  <textarea
                    value={formTemplateData.notes}
                    onChange={(e) => setFormTemplateData({ ...formTemplateData, notes: e.target.value })}
                    className="w-full px-4 py-3 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent resize-none text-sm"
                    placeholder="e.g., All leave requests must be submitted at least 3 days in advance. Sick leave requires medical certificate for absences exceeding 3 days..."
                    rows={5}
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    These notes will appear in the PDF document above the signature section
                  </p>
                </div>

                {/* Approvers Section */}
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-3">
                    Assign Approvers
                  </label>
                  <p className="text-sm text-muted-foreground mb-4">
                    Select users who need to approve submissions for this form
                  </p>

                  <div className="space-y-3">
                    {currentUserId && (
                      <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-foreground">Add yourself as approver</p>
                            <p className="text-xs text-muted-foreground mt-1">Quick option to add yourself</p>
                          </div>
                          <Button
                            onClick={addAdminAsApprover}
                            variant="outline"
                            size="sm"
                            disabled={formTemplateData.approvers.includes(currentUserId)}
                          >
                            {formTemplateData.approvers.includes(currentUserId) ? 'Added' : 'Add Me'}
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="border border-border rounded-lg p-4 max-h-60 overflow-y-auto">
                      {users.filter(u => u.isApprover || u.role === 'Admin').length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No approvers available. Users must have approver permissions.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {users.filter(u => u.isApprover || u.role === 'Admin').map((user) => (
                            <label
                              key={user.id}
                              className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={formTemplateData.approvers.includes(user.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setFormTemplateData({
                                      ...formTemplateData,
                                      approvers: [...formTemplateData.approvers, user.id],
                                    });
                                  } else {
                                    setFormTemplateData({
                                      ...formTemplateData,
                                      approvers: formTemplateData.approvers.filter((id) => id !== user.id),
                                    });
                                  }
                                }}
                                className="w-4 h-4"
                              />
                              <div className="flex-1">
                                <p className="text-sm font-medium text-foreground">{user.fullName}</p>
                                <p className="text-xs text-muted-foreground">
                                  {user.position} • {user.department}
                                </p>
                              </div>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>

                    {formTemplateData.approvers.length > 0 && (
                      <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                        <p className="text-sm text-green-700 dark:text-green-300">
                          <strong>{formTemplateData.approvers.length}</strong> approver(s) selected
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-between border-t border-border pt-4 px-4">
            <Button
              variant="outline"
              onClick={() => {
                if (currentStep > 1) {
                  setCurrentStep(currentStep - 1);
                } else {
                  setShowFormTemplate(false);
                  setCurrentStep(1);
                }
              }}
            >
              {currentStep === 1 ? 'Cancel' : 'Back'}
            </Button>

            <div className="flex gap-2">
              {/* Preview Button - Show on all steps if we have basic info */}
              {canProceedToStep2() && (
                <Button
                  onClick={handleShowPreview}
                  variant="outline"
                  className="border-primary text-primary hover:bg-primary/10"
                >
                  <Eye size={18} className="mr-2" />
                  Preview Form
                </Button>
              )}

              {currentStep < 3 ? (
                <Button
                  onClick={() => setCurrentStep(currentStep + 1)}
                  disabled={currentStep === 1 && !canProceedToStep2()}
                >
                  Next Step
                </Button>
              ) : (
                <Button
                  onClick={handleSaveForm}
                  disabled={saving}
                  className="bg-primary hover:bg-primary/90"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      {uploadingFile ? 'Uploading...' : 'Saving...'}
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={18} className="mr-2" />
                      {editingForm ? 'Update Form' : 'Create Form'}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Live Preview Modal */}
      {showPreview && previewPdfBlob && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-2 md:p-4">
          <div className="bg-card rounded-lg shadow-2xl w-full h-full md:h-[95vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-3 md:p-4 border-b border-border bg-card rounded-t-lg">
              <div>
                <h3 className="text-base md:text-lg font-bold text-foreground flex items-center gap-2">
                  <ZoomIn size={20} className="text-primary" />
                  Live Form Preview
                </h3>
                <p className="text-xs md:text-sm text-muted-foreground">
                  {formTemplateData.name || 'Form Template'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleClosePreview}
                  className="p-2 hover:bg-secondary rounded-lg transition-colors"
                >
                  <X size={20} className="text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* PDF Viewer */}
            <div className="flex-1 overflow-hidden bg-gray-100">
              <iframe
                src={URL.createObjectURL(previewPdfBlob)}
                className="w-full h-full"
                title="Form Preview"
              />
            </div>

            {/* Preview Footer Info */}
            <div className="p-3 border-t border-border bg-secondary/30">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-4">
                  <span>Fields: {formTemplateData.fields.length}</span>
                  <span>Approvers: {formTemplateData.approvers.length}</span>
                </div>
                <span className="font-mono">{formTemplateData.revisionNumber}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}