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
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { jsPDF } from 'jspdf';

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
}

interface FormField {
  id: string;
  label: string;
  type: 'text' | 'email' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox';
  required: boolean;
  placeholder?: string;
  options?: string[];
}

interface UserRecord {
  id: string;
  email: string;
  fullName: string;
  position: string;
  department: string;
  role: 'Employee' | 'Admin';
  isApprover: boolean;
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
  const [analyzingFile, setAnalyzingFile] = useState(false);
  const [extractedText, setExtractedText] = useState('');
  const [librariesLoaded, setLibrariesLoaded] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [showPreview, setShowPreview] = useState(false);
  const [previewPdfBlob, setPreviewPdfBlob] = useState<Blob | null>(null);

  const [formTemplateData, setFormTemplateData] = useState({
    name: '',
    description: '',
    category: '',
    approvers: [] as string[],
    fields: [] as FormField[],
    revisionNumber: '',
  });

  const [newField, setNewField] = useState<FormField>({
    id: '',
    label: '',
    type: 'text',
    required: false,
    placeholder: '',
    options: [],
  });

  // Generate revision number
  const generateRevisionNumber = () => {
    const today = new Date();
    const formattedDate = today.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    return `ISC LH Rev.00/ ${formattedDate}`;
  };

  // Initialize revision number when creating new form
  useEffect(() => {
    if (!editingForm && !formTemplateData.revisionNumber) {
      setFormTemplateData(prev => ({
        ...prev,
        revisionNumber: generateRevisionNumber(),
      }));
    }
  }, [editingForm]);

  useEffect(() => {
    const loadLibraries = async () => {
      try {
        if (!(window as any).pdfjsLib) {
          const script1 = document.createElement('script');
          script1.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
          script1.async = true;
          document.head.appendChild(script1);
          
          await new Promise((resolve) => {
            script1.onload = resolve;
          });
          
          (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = 
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }

        if (!(window as any).mammoth) {
          const script2 = document.createElement('script');
          script2.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';
          script2.async = true;
          document.head.appendChild(script2);
          await new Promise((resolve) => {
            script2.onload = resolve;
          });
        }

        if (!(window as any).XLSX) {
          const script3 = document.createElement('script');
          script3.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
          script3.async = true;
          document.head.appendChild(script3);
          await new Promise((resolve) => {
            script3.onload = resolve;
          });
        }

        setLibrariesLoaded(true);
        console.log('All document processing libraries loaded successfully');
      } catch (error) {
        console.error('Error loading libraries:', error);
        setLibrariesLoaded(true);
      }
    };

    loadLibraries();
  }, []);

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
    
    if (librariesLoaded) {
      await analyzeDocument(file);
    } else {
      alert('Document analysis libraries are still loading. Please wait and try again.');
    }
  };

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = reader.result as string;
        const base64Data = base64String.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const analyzeDocument = async (file: File) => {
    setAnalyzingFile(true);
    try {
      let text = '';

      console.log('Starting analysis for:', file.name, 'Type:', file.type);

      if (file.type === 'application/pdf') {
        text = await extractTextFromPDF(file);
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        text = await extractTextFromDOCX(file);
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
                 file.type === 'application/vnd.ms-excel') {
        text = await extractTextFromXLSX(file);
      } else {
        console.warn('Unsupported file type for auto-detection');
        setAnalyzingFile(false);
        return;
      }

      console.log('Extracted text length:', text.length);
      setExtractedText(text);
      
      if (text.trim()) {
        const detectedFields = detectFormFields(text);
        console.log('Detected fields:', detectedFields);
        
        if (detectedFields.length > 0) {
          setFormTemplateData({
            ...formTemplateData,
            fields: detectedFields,
          });
          alert(`✓ Successfully detected ${detectedFields.length} form fields!`);
        } else {
          alert('No form fields detected automatically. You can add fields manually below.');
        }
      } else {
        alert('Could not extract text from document. Please add fields manually.');
      }
    } catch (error) {
      console.error('Error analyzing document:', error);
      alert('Error analyzing document: ' + (error as Error).message);
    } finally {
      setAnalyzingFile(false);
    }
  };

  const extractTextFromPDF = async (file: File): Promise<string> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = (window as any).pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += pageText + '\n';
      }
      
      console.log('PDF extraction successful');
      return fullText;
    } catch (error) {
      console.error('PDF extraction error:', error);
      throw new Error('Failed to extract text from PDF');
    }
  };

  const extractTextFromDOCX = async (file: File): Promise<string> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await (window as any).mammoth.extractRawText({ arrayBuffer });
      console.log('DOCX extraction successful');
      return result.value;
    } catch (error) {
      console.error('DOCX extraction error:', error);
      throw new Error('Failed to extract text from DOCX');
    }
  };

  const extractTextFromXLSX = async (file: File): Promise<string> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = (window as any).XLSX.read(arrayBuffer, { type: 'array' });
      
      let fullText = '';
      workbook.SheetNames.forEach((sheetName: string) => {
        const sheet = workbook.Sheets[sheetName];
        const csv = (window as any).XLSX.utils.sheet_to_csv(sheet);
        fullText += csv + '\n';
      });
      
      console.log('XLSX extraction successful');
      return fullText;
    } catch (error) {
      console.error('XLSX extraction error:', error);
      throw new Error('Failed to extract text from Excel file');
    }
  };

  const detectFormFields = (text: string): FormField[] => {
    const fields: FormField[] = [];
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);
    const detectedLabels = new Set<string>();

    console.log('=== FIELD DETECTION START ===');
    console.log('Total lines:', lines.length);
    console.log('Raw text preview:', text.substring(0, 500));

    const normalizeLabel = (label: string): string => {
      return label.trim()
        .replace(/\s+/g, ' ')
        .replace(/[:\s]*$/, '')
        .replace(/^[:\s]+/, '');
    };

    const addField = (label: string, type: FormField['type'], required: boolean = false) => {
      const normalized = normalizeLabel(label);
      const lowerNormalized = normalized.toLowerCase();
      
      if (detectedLabels.has(lowerNormalized) || normalized.length < 2) {
        return;
      }
      
      const noiseWords = ['notes', 'policies', 'required', 'notification', 'file', 'medical certificate', 
                          'leave type selection', 'sick leave credits', 'vacation leave credits',
                          'notes & policies'];
      if (noiseWords.some(noise => lowerNormalized === noise || lowerNormalized.includes(noise))) {
        return;
      }

      fields.push({
        id: `field_${Date.now()}_${Math.random()}`,
        label: normalized,
        type,
        required,
        placeholder: type === 'textarea' ? 'Enter details...' : `Enter ${normalized.toLowerCase()}`,
      });
      detectedLabels.add(lowerNormalized);
      console.log('✓ Added field:', normalized, '| Type:', type);
    };

    lines.forEach((line, index) => {
      console.log(`\nLine ${index}: "${line}"`);

      const bracketMatches = line.matchAll(/\[\s*\]\s*([A-Z][A-Z\s]{2,40})/g);
      for (const match of bracketMatches) {
        const label = match[1].trim();
        if (label && label.length >= 3 && label.length <= 40) {
          console.log('  → Found checkbox:', label);
          addField(label, 'checkbox', false);
        }
      }

      const underscorePattern1 = /^([A-Z][A-Z\s\/\(\)\.,']{1,60}?):\s*_{2,}/i;
      const underscoreMatch1 = line.match(underscorePattern1);
      if (underscoreMatch1) {
        const label = underscoreMatch1[1].trim();
        console.log('  → Found underscore pattern 1:', label);
        let fieldType: FormField['type'] = 'text';
        
        const lowerLabel = label.toLowerCase();
        if (lowerLabel.includes('date')) fieldType = 'date';
        else if (lowerLabel.includes('reason') || lowerLabel.includes('comment')) fieldType = 'textarea';
        else if (lowerLabel.includes('no.') || lowerLabel.includes('days') || 
                 lowerLabel.includes('credits') || lowerLabel.includes('balance') ||
                 lowerLabel.includes('total') || lowerLabel.includes('taken') ||
                 lowerLabel.includes('available') || lowerLabel.includes('remaining')) fieldType = 'number';
        else if (lowerLabel.includes('name')) fieldType = 'text';
        
        addField(label, fieldType, false);
      }

      const underscorePattern2 = /^([A-Z][A-Z\s\/\(\)\.,']{1,60}?):_{2,}/i;
      const underscoreMatch2 = line.match(underscorePattern2);
      if (underscoreMatch2 && !underscoreMatch1) {
        const label = underscoreMatch2[1].trim();
        console.log('  → Found underscore pattern 2 (no space):', label);
        let fieldType: FormField['type'] = 'text';
        
        const lowerLabel = label.toLowerCase();
        if (lowerLabel.includes('date')) fieldType = 'date';
        else if (lowerLabel.includes('reason') || lowerLabel.includes('comment')) fieldType = 'textarea';
        else if (lowerLabel.includes('no.') || lowerLabel.includes('days') || 
                 lowerLabel.includes('credits') || lowerLabel.includes('balance') ||
                 lowerLabel.includes('total') || lowerLabel.includes('taken') ||
                 lowerLabel.includes('available') || lowerLabel.includes('remaining')) fieldType = 'number';
        
        addField(label, fieldType, false);
      }

      const multiFieldPattern = /([A-Z][A-Z\s\/\(\)\.,']{2,40}?):\s*_{2,}/gi;
      const multiMatches = [...line.matchAll(multiFieldPattern)];
      if (multiMatches.length > 1) {
        multiMatches.forEach(match => {
          const label = match[1].trim();
          console.log('  → Found multi-field pattern:', label);
          let fieldType: FormField['type'] = 'text';
          
          const lowerLabel = label.toLowerCase();
          if (lowerLabel.includes('date')) fieldType = 'date';
          else if (lowerLabel.includes('no.') || lowerLabel.includes('days')) fieldType = 'number';
          
          addField(label, fieldType, false);
        });
      }

      const colonEndPattern = /^([A-Z][A-Z\s\/\(\)\.,']{2,60}?):\s*$/i;
      const colonEndMatch = line.match(colonEndPattern);
      if (colonEndMatch) {
        const label = colonEndMatch[1].trim();
        console.log('  → Found colon-end pattern:', label);
        let fieldType: FormField['type'] = 'text';
        
        const lowerLabel = label.toLowerCase();
        if (lowerLabel.includes('date')) fieldType = 'date';
        else if (lowerLabel.includes('comment') || lowerLabel.includes('notes') || lowerLabel.includes('reason')) fieldType = 'textarea';
        else if (lowerLabel.includes('number') || lowerLabel.includes('days') ||
                 lowerLabel.includes('credits') || lowerLabel.includes('balance') ||
                 lowerLabel.includes('total') || lowerLabel.includes('taken') ||
                 lowerLabel.includes('available') || lowerLabel.includes('remaining')) fieldType = 'number';
        
        addField(label, fieldType, false);
      }

      if (line.includes('____') && line.split(':').length > 2) {
        const parts = line.split(/\s{2,}/);
        parts.forEach(part => {
          const fieldMatch = part.match(/([A-Z][A-Z\s\/\(\)\.,']{2,50}?):\s*_{0,}/i);
          if (fieldMatch) {
            const label = fieldMatch[1].trim();
            console.log('  → Found spaced field:', label);
            let fieldType: FormField['type'] = 'number';
            
            const lowerLabel = label.toLowerCase();
            if (lowerLabel.includes('date')) fieldType = 'date';
            else if (lowerLabel.includes('reason') || lowerLabel.includes('comment')) fieldType = 'textarea';
            
            addField(label, fieldType, false);
          }
        });
      }
    });

    console.log('\n=== FIELD DETECTION COMPLETE ===');
    console.log('Total fields found:', fields.length);
    console.log('Fields:', fields.map(f => f.label).join(', '));
    
    return fields;
  };

  // Generate live preview PDF
  const generateLivePreviewPDF = async (): Promise<jsPDF> => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    let yPosition = margin;

    // Load logo
    const loadImage = (src: string): Promise<HTMLImageElement> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });
    };

    try {
      const logoImg = await loadImage('/isc-logo-long.jpg');
      const logoWidth = 45;
      const logoHeight = (logoImg.height / logoImg.width) * logoWidth;
      
      const canvas = document.createElement('canvas');
      canvas.width = logoImg.width;
      canvas.height = logoImg.height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(logoImg, 0, 0);
      const logoData = canvas.toDataURL('image/png');
      
      pdf.addImage(logoData, 'PNG', margin, margin, logoWidth, Math.min(logoHeight, 18));
    } catch (error) {
      console.log('Logo not loaded');
    }

    // Header - Company Info
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text('INTER-WORLD SHIPPING CORPORATION', pageWidth - margin, margin, {
      align: 'right',
    });
    
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.text('5F W. Deepz Bldg., MH Del Pilar St., Ermita, Manila', pageWidth - margin, margin + 5, {
      align: 'right',
    });
    pdf.text('Tel. No.: (02) 7090-3591', pageWidth - margin, margin + 10, {
      align: 'right',
    });
    pdf.text('www.interworldships.com', pageWidth - margin, margin + 15, {
      align: 'right',
    });

    yPosition = margin + 30;

    // Document title
    pdf.setTextColor(80, 80, 80);
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    const formTitle = formTemplateData.name || 'FORM TEMPLATE';
    pdf.text(formTitle.toUpperCase(), pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 12;

    // Form content
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');

    // Date field
    pdf.text('DATE:', margin, yPosition);
    pdf.setDrawColor(150, 150, 150);
    pdf.setLineWidth(0.3);
    pdf.line(margin + 20, yPosition + 1, margin + 70, yPosition + 1);
    pdf.text('_________________', margin + 22, yPosition);
    yPosition += 10;

    // Display form fields
    if (formTemplateData.fields && formTemplateData.fields.length > 0) {
      for (const field of formTemplateData.fields) {
        const label = field.label;
        
        pdf.setFont('helvetica', 'normal');
        const labelText = `${label}:`;
        pdf.text(labelText, margin, yPosition);
        
        const labelWidth = pdf.getTextWidth(labelText);
        const valueX = margin + labelWidth + 3;
        const lineEndX = pageWidth - margin - 50;
        
        pdf.setDrawColor(150, 150, 150);
        pdf.line(valueX, yPosition + 1, lineEndX, yPosition + 1);
        
        yPosition += 8;

        // Check if we need a new page
        if (yPosition > pageHeight - 80) {
          pdf.addPage();
          yPosition = margin;
        }
      }
    }

    // Calculate signature section
    const approvers = formTemplateData.approvers
      .map(id => users.find(u => u.id === id))
      .filter(Boolean);
    
    const signatureBlockHeight = 60;
    const numSignatures = 1 + approvers.length;
    const numRows = Math.ceil(numSignatures / 2);
    const totalSignatureHeight = (numRows * signatureBlockHeight) + 10;

    const spaceAvailable = pageHeight - yPosition - 20;
    
    if (spaceAvailable < totalSignatureHeight) {
      pdf.addPage();
      yPosition = margin;
    } else {
      yPosition += 15;
    }

    // Position signatures
    const colWidth = (pageWidth - 2 * margin - 10) / 2;
    let currentX = margin;
    let currentY = yPosition;
    let column = 0;

    const drawSignature = (
      name: string,
      label: string,
      position: string,
      department: string
    ) => {
      // Signature placeholder
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(11);
      pdf.setTextColor(0, 102, 204);
      pdf.text(name, currentX + colWidth / 2, currentY + 15, { align: 'center' });
      
      // Signature line
      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(0.4);
      pdf.line(currentX + 15, currentY + 28, currentX + colWidth - 15, currentY + 28);
      
      // Label
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(0, 0, 0);
      pdf.text(label, currentX + colWidth / 2, currentY + 33, { align: 'center' });
      
      // Name
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      pdf.text(name, currentX + colWidth / 2, currentY + 38, { align: 'center' });
      
      // Position
      if (position) {
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(100, 100, 100);
        pdf.text(position, currentX + colWidth / 2, currentY + 42, { align: 'center' });
      }
      
      // Department
      if (department) {
        pdf.text(department, currentX + colWidth / 2, currentY + 46, { align: 'center' });
      }
      
      // Date placeholder
      pdf.setFontSize(7);
      pdf.text('Date: ______________', currentX + colWidth / 2, currentY + 50, { align: 'center' });
    };

    // Employee signature
    drawSignature(
      '[Employee Name]',
      'Signature of Employee',
      '[Position]',
      '[Department]'
    );

    column++;
    currentX = margin + colWidth + 10;

    // Approver signatures
    if (approvers.length > 0) {
      for (const [index, approver] of approvers.entries()) {
        if (column >= 2) {
          column = 0;
          currentX = margin;
          currentY += signatureBlockHeight;
        }

        const approvalLabel = index === 0 ? "Supervisor's Approval" : 
                               index === 1 ? "HR Approval" : 
                               index === 2 ? "Management Approval" :
                               `Level ${index + 1} Approval`;
        
        drawSignature(
          approver.fullName,
          approvalLabel,
          approver.position,
          approver.department
        );

        column++;
        currentX = margin + colWidth + 10;
      }
    }

    // Footer with revision number
    const footerY = pageHeight - 10;
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'normal');
    const revisionText = formTemplateData.revisionNumber || generateRevisionNumber();
    pdf.text(revisionText, margin, footerY);

    return pdf;
  };

  const handleShowPreview = async () => {
    try {
      const pdf = await generateLivePreviewPDF();
      const blob = pdf.output('blob');
      setPreviewPdfBlob(blob);
      setShowPreview(true);
    } catch (error) {
      console.error('Error generating preview:', error);
      alert('Failed to generate preview. Please try again.');
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

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return 'Unknown size';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  const getApproverNames = (approverIds: string[]): string => {
    return (
      approverIds
        .map((id) => users.find((u) => u.id === id)?.fullName)
        .filter(Boolean)
        .join(', ') || 'None'
    );
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

  const downloadFile = (fileData: string, fileName: string, fileType: string) => {
    try {
      const byteCharacters = atob(fileData);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: fileType });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Error downloading file. Please try again.');
    }
  };

  const canProceedToStep2 = () => {
    return formTemplateData.name && formTemplateData.description && formTemplateData.category;
  };

  const canProceedToStep3 = () => {
    return formTemplateData.fields.length > 0 || selectedFile;
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
                    {getApproverNames(form.approvers || [])}
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

                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Status
                    </label>
                    <div className="flex items-center gap-2 px-4 py-3 border border-border rounded-lg bg-secondary/30">
                      <CheckCircle2 size={18} className="text-green-600" />
                      <span className="text-sm text-foreground">Active Template</span>
                    </div>
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
                    <p className="text-xs text-muted-foreground mb-3">
                      Upload a document (PDF, DOCX, XLSX) and we'll automatically detect form fields!
                      {!librariesLoaded && ' (Loading analysis tools...)'}
                    </p>
                    {analyzingFile && (
                      <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center gap-3">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                        <span className="text-sm text-blue-700 dark:text-blue-300">
                          Analyzing document and detecting form fields...
                        </span>
                      </div>
                    )}
                    <div className="border-2 border-dashed border-border rounded-lg p-8 text-center bg-secondary/30 hover:bg-secondary/50 transition-colors">
                      <input
                        type="file"
                        id="formFile"
                        accept=".pdf,.doc,.docx,.xls,.xlsx"
                        onChange={handleFileSelect}
                        className="hidden"
                        disabled={analyzingFile}
                      />
                      <label htmlFor="formFile" className="cursor-pointer flex flex-col items-center gap-3">
                        <Upload size={40} className="text-muted-foreground" />
                        {selectedFile ? (
                          <div className="text-sm">
                            <p className="font-semibold text-foreground text-lg">{selectedFile.name}</p>
                            <p className="text-muted-foreground mt-1">{formatFileSize(selectedFile.size)}</p>
                            {formTemplateData.fields.length > 0 && (
                              <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-full">
                                <CheckCircle2 size={14} className="text-green-600" />
                                <span className="text-xs text-green-700 dark:text-green-300 font-medium">
                                  {formTemplateData.fields.length} fields detected
                                </span>
                              </div>
                            )}
                          </div>
                        ) : editingForm?.fileData ? (
                          <div className="text-sm">
                            <p className="font-semibold text-foreground text-lg">{editingForm.fileName}</p>
                            <p className="text-xs text-muted-foreground mt-1">Click to replace file</p>
                          </div>
                        ) : (
                          <div className="text-sm">
                            <p className="font-semibold text-foreground text-lg">Click to upload document</p>
                            <p className="text-muted-foreground mt-1">PDF, DOC, DOCX, XLS, XLSX (Max 5MB)</p>
                            <p className="text-xs text-primary mt-2">
                              {librariesLoaded ? '✓ Auto-detection ready' : '⏳ Loading analysis tools...'}
                            </p>
                          </div>
                        )}
                      </label>
                    </div>
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
                          <div key={field.id} className="flex items-center gap-3 p-3 bg-secondary/50 hover:bg-secondary rounded-lg border border-border">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-sm font-semibold text-primary">{index + 1}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate">
                                {field.label}
                                {field.required && <span className="text-destructive ml-1">*</span>}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Type: {field.type} {field.placeholder && `• ${field.placeholder}`}
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
                          <span className="text-sm text-foreground">Required Field</span>
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
                  onClick={() => {
                    setShowPreview(false);
                    setPreviewPdfBlob(null);
                  }}
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