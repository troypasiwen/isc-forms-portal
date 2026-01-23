import { jsPDF } from 'jspdf';
import { collection, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface ApprovedForm {
  id: string;
  formName: string;
  status: string;
  approvedAt: any;
  approvedBy: string;
  attachments: string[];
  formData: any;
  submittedBy: string;
  submittedByName: string;
  position: string;
  department: string;
  submittedAt: any;
  approvalTimeline?: ApprovalRecord[];
  fieldMapping?: { [key: string]: string };
  formTemplateId?: string;
  signature?: string;
  notes?: string;
}

interface ApprovalRecord {
  action: 'Approved' | 'Rejected' | 'Submitted';
  by: string;
  byName?: string;
  byPosition?: string;
  byDepartment?: string;
  signature?: string;
  timestamp: any;
}

interface FormField {
  id: string;
  label: string;
  type: 'text' | 'email' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox';
  required: boolean;
  placeholder?: string;
  options?: string[];
  isNote?: boolean;
}

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
 * Get form template with fields and notes
 */
const getTemplateData = async (formTemplateId: string): Promise<{ fields: FormField[], notes: string }> => {
  try {
    const templateRef = doc(db, 'formTemplates', formTemplateId);
    const templateSnap = await getDoc(templateRef);
    
    if (templateSnap.exists()) {
      const templateData = templateSnap.data();
      return {
        fields: templateData.fields || [],
        notes: templateData.notes || ''
      };
    }
  } catch (error) {
    console.error('Error fetching template data:', error);
  }
  return { fields: [], notes: '' };
};

/**
 * Generate PDF for approved form with proper field ordering and notes
 */
export const generateApprovedFormPDF = async (form: ApprovedForm): Promise<jsPDF> => {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  let yPosition = margin;

  // Load and add logo
  try {
    const logoImg = await loadImage('/isc-logo-long.jpg');
    const logoWidth = 50;
    const logoHeight = (logoImg.height / logoImg.width) * logoWidth;
    
    const canvas = document.createElement('canvas');
    canvas.width = logoImg.width;
    canvas.height = logoImg.height;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(logoImg, 0, 0);
    const logoData = canvas.toDataURL('image/png');
    
    const logoY = margin - 5; // move up by 5mm (adjust as needed)

pdf.addImage(
  logoData,
  'PNG',
  margin,
  logoY,
  logoWidth,
  Math.min(logoHeight, 30)
);

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

  yPosition = margin + 28;

  // Document title
  pdf.setTextColor(80, 80, 80);
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text(form.formName.toUpperCase(), pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 10;

  // Name and Date fields - NAME first, then DATE
  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  
  const fullName = form.submittedByName || 'N/A';
  const nameWidth = pdf.getTextWidth(fullName);
  
  // Name on the left
  pdf.text('NAME:', margin, yPosition);
  pdf.setDrawColor(150, 150, 150);
  pdf.setLineWidth(0.3);
  pdf.line(margin + 18, yPosition + 1, margin + 18 + nameWidth + 5, yPosition + 1);
  pdf.text(fullName, margin + 20, yPosition);
  
  // Date on the right side
  const dateValue = new Date(form.submittedAt?.toDate?.() || Date.now()).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const dateWidth = pdf.getTextWidth(dateValue);
  const dateStartX = pageWidth / 2 + 40;
  
  pdf.text('DATE:', dateStartX, yPosition);
  pdf.line(dateStartX + 15, yPosition + 1, dateStartX + 15 + dateWidth + 5, yPosition + 1);
  pdf.text(dateValue, dateStartX + 17, yPosition);
  yPosition += 10;

  // Get template data with fields and notes
  let templateFields: FormField[] = [];
  let templateNotes = '';
  
  if (form.formTemplateId) {
    const templateData = await getTemplateData(form.formTemplateId);
    templateFields = templateData.fields;
    templateNotes = templateData.notes;
  }

  // Render form fields in template order
  if (templateFields.length > 0 && form.formData) {
    for (const field of templateFields) {
      // Check if we need a new page
      if (yPosition > pageHeight - 70) {
        pdf.addPage();
        yPosition = margin;
      }

      // Skip note fields (they're not answerable)
      if (field.isNote) {
        continue;
      }

      const value = form.formData[field.id];
      let valueText = '';
      
      if (field.type === 'checkbox') {
        valueText = value ? 'Yes' : 'No';
      } else if (value === null || value === undefined || value === '') {
        valueText = '';
      } else {
        valueText = String(value);
      }

      if (field.type === 'checkbox') {
        // Render checkbox
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(0, 0, 0);
        
        const checkboxSize = 4;
        pdf.setDrawColor(100, 100, 100);
        pdf.setLineWidth(0.3);
        pdf.rect(margin, yPosition - 3, checkboxSize, checkboxSize);
        
        // If checked, draw an X
        if (value) {
          pdf.setDrawColor(0, 0, 0);
          pdf.setLineWidth(0.5);
          pdf.line(margin, yPosition - 3, margin + checkboxSize, yPosition - 3 + checkboxSize);
          pdf.line(margin + checkboxSize, yPosition - 3, margin, yPosition - 3 + checkboxSize);
        }
        
        pdf.text(field.label, margin + checkboxSize + 3, yPosition);
        yPosition += 6;
      } else if (field.type === 'textarea') {
        // Render textarea
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(0, 0, 0);
        pdf.text(`${field.label}:`, margin, yPosition);
        
        yPosition += 5;
        
        if (valueText && valueText.length > 0) {
          // Split text into lines
          const lines = pdf.splitTextToSize(valueText, pageWidth - 2 * margin);
          for (const line of lines) {
            if (yPosition > pageHeight - 70) {
              pdf.addPage();
              yPosition = margin;
            }
            pdf.text(line, margin, yPosition);
            yPosition += 4.5;
          }
          yPosition += 1;
        } else {
          // Draw empty lines
          const numLines = 3;
          pdf.setDrawColor(150, 150, 150);
          pdf.setLineWidth(0.3);
          
          for (let i = 0; i < numLines; i++) {
            if (yPosition > pageHeight - 70) {
              pdf.addPage();
              yPosition = margin;
            }
            pdf.line(margin, yPosition, pageWidth - margin, yPosition);
            yPosition += 4.5;
          }
          yPosition += 1;
        }
      } else {
        // Render regular field with dynamic line length
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(0, 0, 0);
        
        const labelText = `${field.label}:`;
        pdf.text(labelText, margin, yPosition);
        
        const labelWidth = pdf.getTextWidth(labelText);
        const valueX = margin + labelWidth + 3;
        
        let lineLength = 0;
        if (valueText && valueText.length > 0) {
          const valueWidth = pdf.getTextWidth(valueText);
          // Line length is just slightly longer than the text (add 5mm padding)
          lineLength = valueWidth + 5;
        } else {
          // Default line length for empty fields
          lineLength = 50;
        }
        
        const lineEndX = Math.min(valueX + lineLength, pageWidth - margin);
        
        pdf.setDrawColor(150, 150, 150);
        pdf.setLineWidth(0.3);
        pdf.line(valueX, yPosition + 1, lineEndX, yPosition + 1);
        
        if (valueText && valueText.length > 0) {
          pdf.text(valueText, valueX + 2, yPosition);
        }
        
        yPosition += 6;
      }
    }
  } else {
    // Fallback: render fields from formData without template
    if (form.formData && Object.keys(form.formData).length > 0) {
      const entries = Object.entries(form.formData).sort((a, b) => {
        const getFieldNumber = (key: string) => {
          const match = key.match(/FIELD_(\d+)/);
          return match ? parseInt(match[1]) : 999999;
        };
        return getFieldNumber(a[0]) - getFieldNumber(b[0]);
      });
      
      for (const [key, value] of entries) {
        if (yPosition > pageHeight - 70) {
          pdf.addPage();
          yPosition = margin;
        }

        let label = '';
        if (form.fieldMapping && form.fieldMapping[key]) {
          label = form.fieldMapping[key];
        } else if (!key.startsWith('FIELD_') && !key.startsWith('_')) {
          label = key
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, (str) => str.toUpperCase())
            .trim();
        } else {
          continue;
        }

        let valueText = '';
        if (typeof value === 'boolean') {
          valueText = value ? 'Yes' : 'No';
        } else if (value === null || value === undefined || value === '') {
          valueText = '';
        } else {
          valueText = String(value);
        }

        pdf.setFont('helvetica', 'normal');
        const labelText = `${label}:`;
        pdf.text(labelText, margin, yPosition);
        
        const labelWidth = pdf.getTextWidth(labelText);
        const valueX = margin + labelWidth + 3;
        
        let lineLength = 0;
        if (valueText && valueText.length > 0) {
          const valueWidth = pdf.getTextWidth(valueText);
          lineLength = valueWidth + 5;
        } else {
          lineLength = 50;
        }
        
        const lineEndX = Math.min(valueX + lineLength, pageWidth - margin);
        
        pdf.setDrawColor(150, 150, 150);
        pdf.line(valueX, yPosition + 1, lineEndX, yPosition + 1);
        
        if (valueText && valueText.length > 0) {
          pdf.text(valueText, valueX + 2, yPosition);
        }
        
        yPosition += 6;
      }
    }
  }

  // Add notes section if provided (before signatures)
  if (templateNotes && templateNotes.trim()) {
    yPosition += 2;
    
    // Check if we need a new page for notes
    if (yPosition > pageHeight - 90) {
      pdf.addPage();
      yPosition = margin;
    }

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(60, 60, 60);
    pdf.text('NOTES:', margin, yPosition);
    yPosition += 5;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(80, 80, 80);
    
    const notesLines = pdf.splitTextToSize(templateNotes, pageWidth - 2 * margin);
    
    for (const line of notesLines) {
      if (yPosition > pageHeight - 70) {
        pdf.addPage();
        yPosition = margin;
      }
      pdf.text(line, margin, yPosition);
      yPosition += 4;
    }
    
    yPosition += 3;
  }

  // Calculate signature section requirements
  const approvedRecords = form.approvalTimeline?.filter(
    (record) => record.action === 'Approved'
  ) || [];

  const signatureBlockHeight = 45;
  const numSignatures = 1 + approvedRecords.length;
  const numRows = Math.ceil(numSignatures / 2);
  const totalSignatureHeight = (numRows * signatureBlockHeight);

  const spaceAvailable = pageHeight - yPosition - 15;
  
  // Only add new page if absolutely necessary
  if (spaceAvailable < totalSignatureHeight) {
    pdf.addPage();
    yPosition = margin;
  } else {
    yPosition += 2;
  }

  // Draw signatures
  const colWidth = (pageWidth - 2 * margin - 10) / 2;
  let currentX = margin;
  let currentY = yPosition;
  let column = 0;

  const drawSignature = async (
    name: string,
    label: string,
    position: string,
    department: string,
    date: Date,
    signatureImage?: string
  ) => {
    if (signatureImage) {
      try {
        const sigWidth = colWidth - 30;
        const sigHeight = 16;
        pdf.addImage(signatureImage, 'PNG', currentX + 15, currentY + 2, sigWidth, sigHeight);
      } catch (error) {
        console.error('Error adding signature image:', error);
        pdf.setFont('helvetica', 'italic');
        pdf.setFontSize(9);
        pdf.setTextColor(0, 102, 204);
        pdf.text(name, currentX + colWidth / 2, currentY + 10, { align: 'center' });
      }
    } else {
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(9);
      pdf.setTextColor(0, 102, 204);
      pdf.text(name, currentX + colWidth / 2, currentY + 10, { align: 'center' });
    }
    
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.4);
    pdf.line(currentX + 15, currentY + 21, currentX + colWidth - 15, currentY + 21);
    
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(0, 0, 0);
    pdf.text(label, currentX + colWidth / 2, currentY + 25, { align: 'center' });
    
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'bold');
    pdf.text(name, currentX + colWidth / 2, currentY + 29, { align: 'center' });
    
    if (position) {
      pdf.setFontSize(6);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 100, 100);
      pdf.text(position, currentX + colWidth / 2, currentY + 33, { align: 'center' });
    }
    
    if (department) {
      pdf.text(department, currentX + colWidth / 2, currentY + 37, { align: 'center' });
    }
    
    pdf.setFontSize(6);
    pdf.text(
      `Date: ${date.toLocaleDateString()}`,
      currentX + colWidth / 2,
      currentY + 41,
      { align: 'center' }
    );
  };

  // Employee signature
  await drawSignature(
    form.submittedByName || 'Employee',
    'Signature of Employee',
    form.position || '',
    form.department || '',
    form.submittedAt?.toDate?.() || new Date(),
    form.signature
  );

  column++;
  currentX = margin + colWidth + 10;

  // Approver signatures
  if (approvedRecords.length > 0) {
    for (const [index, record] of approvedRecords.entries()) {
      if (column >= 2) {
        column = 0;
        currentX = margin;
        currentY += signatureBlockHeight;
      }

      const approvalLabel = index === 0 ? "Supervisor's Approval" : 
                             index === 1 ? "HR Approval" : 
                             index === 2 ? "Management Approval" :
                             `Level ${index + 1} Approval`;
      
      await drawSignature(
        record.byName || `Approver ${index + 1}`,
        approvalLabel,
        record.byPosition || '',
        record.byDepartment || '',
        record.timestamp?.toDate?.() || new Date(),
        record.signature
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
  pdf.text(
    `ISC LH Rev.00/ ${new Date().toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })}`,
    margin,
    footerY
  );

  return pdf;
};