import { jsPDF } from 'jspdf';

export interface FormField {
  id: string;
  label: string;
  type: 'text' | 'email' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox';
  required: boolean;
  placeholder?: string;
  options?: string[];
  isNote?: boolean; // New field to mark non-answerable notes
}

export interface UserRecord {
  id: string;
  email: string;
  fullName: string;
  position: string;
  department: string;
  role: 'Employee' | 'Admin';
  isApprover: boolean;
}

export interface FormTemplateData {
  name: string;
  description: string;
  category: string;
  approvers: string[];
  fields: FormField[];
  revisionNumber: string;
  notes?: string; // Optional notes section above signatures
}

/**
 * Generate a revision number based on the current date
 */
export const generateRevisionNumber = (): string => {
  const today = new Date();
  const formattedDate = today.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return `ISC LH Rev.00/ ${formattedDate}`;
};

/**
 * Load an image from a URL and convert to data URL
 */
const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
};

/**
 * Generate PDF with proper field rendering including checkboxes and notes
 */
export const generateFormPDF = async (
  formData: FormTemplateData,
  users: UserRecord[]
): Promise<jsPDF> => {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  let yPosition = margin;

  // Load and add logo
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
  const formTitle = formData.name || 'FORM TEMPLATE';
  pdf.text(formTitle.toUpperCase(), pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 12;

  // Date field
  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text('DATE:', margin, yPosition);
  pdf.setDrawColor(150, 150, 150);
  pdf.setLineWidth(0.3);
  pdf.line(margin + 20, yPosition + 1, margin + 70, yPosition + 1);
  yPosition += 12;

  // Render form fields in order (top to bottom)
  if (formData.fields && formData.fields.length > 0) {
    for (const field of formData.fields) {
      // Check if we need a new page
      if (yPosition > pageHeight - 100) {
        pdf.addPage();
        yPosition = margin;
      }

      const label = field.label;

      // Don't render isNote fields here - they were removed
      if (field.type === 'checkbox') {
        // Render checkbox properly
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(0, 0, 0);
        
        // Draw checkbox square
        const checkboxSize = 4;
        pdf.setDrawColor(100, 100, 100);
        pdf.setLineWidth(0.3);
        pdf.rect(margin, yPosition - 3, checkboxSize, checkboxSize);
        
        // Draw label next to checkbox
        pdf.text(label, margin + checkboxSize + 3, yPosition);
        
        yPosition += 8;
      } else if (field.type === 'textarea') {
        // Render textarea with multiple lines
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(0, 0, 0);
        pdf.text(`${label}:`, margin, yPosition);
        
        yPosition += 6;
        
        // Draw multiple lines for textarea
        const numLines = 4;
        pdf.setDrawColor(150, 150, 150);
        pdf.setLineWidth(0.3);
        
        for (let i = 0; i < numLines; i++) {
          pdf.line(margin, yPosition, pageWidth - margin, yPosition);
          yPosition += 6;
        }
        
        yPosition += 2;
      } else {
        // Render regular field with single line
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(0, 0, 0);
        
        const labelText = `${label}:`;
        pdf.text(labelText, margin, yPosition);
        
        const labelWidth = pdf.getTextWidth(labelText);
        const valueX = margin + labelWidth + 3;
        const lineEndX = pageWidth - margin;
        
        pdf.setDrawColor(150, 150, 150);
        pdf.setLineWidth(0.3);
        pdf.line(valueX, yPosition + 1, lineEndX, yPosition + 1);
        
        yPosition += 8;
      }
    }
  }

  // Add notes section if provided (appears before signatures)
  if (formData.notes && formData.notes.trim()) {
    yPosition += 5;
    
    // Check if we need a new page for notes
    if (yPosition > pageHeight - 120) {
      pdf.addPage();
      yPosition = margin;
    }

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(60, 60, 60);
    pdf.text('NOTES:', margin, yPosition);
    yPosition += 7;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(80, 80, 80);
    
    // Split notes into lines that fit the page width
    const notesLines = pdf.splitTextToSize(formData.notes, pageWidth - 2 * margin);
    
    for (const line of notesLines) {
      if (yPosition > pageHeight - 100) {
        pdf.addPage();
        yPosition = margin;
      }
      pdf.text(line, margin, yPosition);
      yPosition += 5;
    }
    
    yPosition += 5;
  }

  // Calculate signature section
  const approvers = formData.approvers
    .map(id => users.find(u => u.id === id))
    .filter(Boolean) as UserRecord[];
  
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
  const revisionText = formData.revisionNumber || generateRevisionNumber();
  pdf.text(revisionText, margin, footerY);

  return pdf;
};

/**
 * Convert file to Base64 string
 */
export const convertFileToBase64 = (file: File): Promise<string> => {
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

/**
 * Format file size for display
 */
export const formatFileSize = (bytes?: number): string => {
  if (!bytes) return 'Unknown size';
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
};

/**
 * Get approver names from IDs
 */
export const getApproverNames = (approverIds: string[], users: UserRecord[]): string => {
  return (
    approverIds
      .map((id) => users.find((u) => u.id === id)?.fullName)
      .filter(Boolean)
      .join(', ') || 'None'
  );
};

/**
 * Download a file from Base64 data
 */
export const downloadFile = (fileData: string, fileName: string, fileType: string): void => {
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
    throw new Error('Failed to download file');
  }
};