'use client';

import React, { useEffect, useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import { ZoomIn, ZoomOut, Download, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

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

interface LiveFormPreviewProps {
  formName: string;
  fields: FormField[];
  approvers: string[];
  users: UserRecord[];
  revisionNumber: string;
}

export function LiveFormPreview({
  formName,
  fields,
  approvers,
  users,
  revisionNumber,
}: LiveFormPreviewProps) {
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [zoom, setZoom] = useState(100);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const generatePreview = async () => {
      setIsGenerating(true);
      try {
        const pdf = await generatePreviewPDF();
        const blob = pdf.output('blob');
        
        // Revoke old URL to prevent memory leaks
        if (pdfUrl) {
          URL.revokeObjectURL(pdfUrl);
        }
        
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
      } catch (error) {
        console.error('Error generating preview:', error);
      } finally {
        setIsGenerating(false);
      }
    };

    // Only generate if we have at least a form name
    if (formName) {
      generatePreview();
    }

    // Cleanup function
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [formName, fields, approvers, revisionNumber]);

  const generatePreviewPDF = async (): Promise<jsPDF> => {
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
      console.log('Logo not loaded, skipping');
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
    const formTitle = formName || 'FORM TEMPLATE';
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
    if (fields && fields.length > 0) {
      for (const field of fields) {
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
    } else {
      // Show placeholder if no fields
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(9);
      pdf.setTextColor(150, 150, 150);
      pdf.text('No form fields added yet. Add fields to see them here.', margin, yPosition);
      yPosition += 10;
      pdf.setTextColor(0, 0, 0);
    }

    // Get approver details
    const approversList = approvers
      .map(id => users.find(u => u.id === id))
      .filter(Boolean) as UserRecord[];
    
    const signatureBlockHeight = 60;
    const numSignatures = 1 + approversList.length;
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
    if (approversList.length > 0) {
      for (const [index, approver] of approversList.entries()) {
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
    } else {
      // Show placeholder if no approvers
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(9);
      pdf.setTextColor(150, 150, 150);
      pdf.text('No approvers assigned yet.', currentX + colWidth / 2, currentY + 20, { align: 'center' });
      pdf.setTextColor(0, 0, 0);
    }

    // Footer with revision number
    const footerY = pageHeight - 10;
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'normal');
    const revisionText = revisionNumber || `ISC LH Rev.00/ ${new Date().toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })}`;
    pdf.text(revisionText, margin, footerY);

    return pdf;
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 10, 150));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 10, 50));
  };

  const handleDownloadPreview = async () => {
    try {
      const pdf = await generatePreviewPDF();
      const fileName = `${formName.replace(/\s+/g, '_')}_Preview.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('Error downloading preview:', error);
    }
  };

  return (
    <div className="h-full flex flex-col bg-secondary/20 rounded-lg border border-border overflow-hidden">
      {/* Preview Header */}
      <div className="flex items-center justify-between p-3 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          <span className="text-sm font-semibold text-foreground">Live Preview</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleZoomOut}
            className="p-1.5 hover:bg-secondary rounded transition-colors"
            title="Zoom Out"
            disabled={zoom <= 50}
          >
            <ZoomOut size={14} className="text-muted-foreground" />
          </button>
          <span className="text-xs text-muted-foreground px-2 min-w-[45px] text-center">
            {zoom}%
          </span>
          <button
            onClick={handleZoomIn}
            className="p-1.5 hover:bg-secondary rounded transition-colors"
            title="Zoom In"
            disabled={zoom >= 150}
          >
            <ZoomIn size={14} className="text-muted-foreground" />
          </button>
          <div className="w-px h-4 bg-border mx-1"></div>
          <button
            onClick={handleDownloadPreview}
            className="p-1.5 hover:bg-secondary rounded transition-colors"
            title="Download Preview"
          >
            <Download size={14} className="text-primary" />
          </button>
        </div>
      </div>

      {/* Preview Content */}
      <div className="flex-1 overflow-hidden bg-gray-100 dark:bg-gray-900 relative">
        {isGenerating && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="text-sm text-muted-foreground">Generating preview...</span>
            </div>
          </div>
        )}
        
        {pdfUrl ? (
          <div className="w-full h-full overflow-auto p-4">
            <div 
              className="mx-auto bg-white shadow-lg"
              style={{ 
                width: `${zoom}%`,
                minWidth: '300px',
                maxWidth: '100%'
              }}
            >
              <iframe
                ref={iframeRef}
                src={pdfUrl}
                className="w-full"
                style={{ height: `calc(100vh - 200px)` }}
                title="Form Preview"
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center p-8">
              <Maximize2 size={48} className="mx-auto text-muted-foreground mb-4 opacity-50" />
              <p className="text-sm text-muted-foreground">
                {formName ? 'Generating preview...' : 'Enter form name to see preview'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Preview Footer Info */}
      <div className="p-2 border-t border-border bg-card">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span>Fields: {fields.length}</span>
            <span>Approvers: {approvers.length}</span>
          </div>
          <span className="font-mono text-[10px]">{revisionNumber}</span>
        </div>
      </div>
    </div>
  );
}