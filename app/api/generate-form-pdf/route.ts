import { NextRequest, NextResponse } from 'next/server';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: {
      finalY: number;
    };
  }
}

// Helper function to safely convert Firestore timestamp to Date
function toDate(timestamp: any): Date {
  if (!timestamp) return new Date();
  
  // If it's already a Date
  if (timestamp instanceof Date) return timestamp;
  
  // If it has toDate method (Firestore Timestamp)
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    return timestamp.toDate();
  }
  
  // If it has seconds property (Firestore Timestamp serialized)
  if (timestamp.seconds) {
    return new Date(timestamp.seconds * 1000);
  }
  
  // If it's a string or number
  return new Date(timestamp);
}

export async function POST(request: NextRequest) {
  try {
    const { formData } = await request.json();

    console.log('Received form data:', JSON.stringify(formData, null, 2));

    if (!formData) {
      return NextResponse.json(
        { error: 'No form data provided' },
        { status: 400 }
      );
    }

    if (formData.status !== 'Approved') {
      return NextResponse.json(
        { error: 'Only approved forms can be downloaded' },
        { status: 403 }
      );
    }

    // Create PDF
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let yPosition = margin;

    // Company Header
    doc.setFillColor(41, 128, 185); // Blue header
    doc.rect(0, 0, pageWidth, 35, 'F');

    // Company Name
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('INTER-WORLD SHIPPING CORPORATION', pageWidth / 2, 12, {
      align: 'center',
    });

    // Company Address
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('5F W. Deepz Bldg., MH Del Pilar St., Ermita, Manila', pageWidth / 2, 19, {
      align: 'center',
    });
    doc.text('Tel. No.: (02) 7090-3591', pageWidth / 2, 24, {
      align: 'center',
    });
    doc.text('www.interworldships.com', pageWidth / 2, 29, {
      align: 'center',
    });

    // Reset text color
    doc.setTextColor(0, 0, 0);
    yPosition = 45;

    // Form Reference Number (top right)
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const refDate = new Date().toLocaleDateString('en-US', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
    doc.text(`ISC LH Rev.00/ ${refDate}`, pageWidth - margin, yPosition, {
      align: 'right',
    });

    yPosition += 10;

    // Form Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(formData.formName || 'Form', pageWidth / 2, yPosition, {
      align: 'center',
    });

    yPosition += 10;

    // Status Badge
    doc.setFillColor(34, 197, 94); // Green
    doc.roundedRect(pageWidth / 2 - 20, yPosition, 40, 8, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('APPROVED', pageWidth / 2, yPosition + 5.5, {
      align: 'center',
    });

    yPosition += 15;
    doc.setTextColor(0, 0, 0);

    // Divider Line
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);

    yPosition += 10;

    // Submitted By Section
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, yPosition, pageWidth - 2 * margin, 30, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, yPosition, pageWidth - 2 * margin, 30, 'S');

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('SUBMITTED BY', margin + 5, yPosition + 7);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');

    const submittedDate = formData.createdAt ? toDate(formData.createdAt) : new Date();
    
    const submittedInfo = [
      `Name: ${formData.submittedByName || 'Unknown'}`,
      `Position: ${formData.submittedByPosition || 'N/A'}`,
      `Department: ${formData.submittedByDepartment || 'N/A'}`,
      `Date: ${submittedDate.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })}`,
    ];

    submittedInfo.forEach((info, index) => {
      doc.text(info, margin + 5, yPosition + 14 + index * 5);
    });

    yPosition += 40;

    // Form Data Section
    if (formData.formData && Object.keys(formData.formData).length > 0) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('FORM DETAILS', margin, yPosition);
      yPosition += 7;

      const formDataEntries = Object.entries(formData.formData);
      const tableData = formDataEntries.map(([key, value]) => {
        // Clean up field names - remove the timestamp suffix
        let cleanKey = key;
        if (key.includes('Field_')) {
          // Try to extract a meaningful name or just show as "Field 1", "Field 2", etc.
          const fieldMatch = key.match(/Field_(\d+)/);
          if (fieldMatch) {
            cleanKey = `Field ${fieldMatch[1]}`;
          }
        } else {
          // Format camelCase or snake_case to readable text
          cleanKey = key
            .replace(/([A-Z])/g, ' $1')
            .replace(/_/g, ' ')
            .trim()
            .toUpperCase();
        }

        // Format value
        let cleanValue = value;
        if (typeof value === 'object' && value !== null) {
          cleanValue = JSON.stringify(value);
        } else if (typeof value === 'boolean') {
          cleanValue = value ? 'Yes' : 'No';
        } else {
          cleanValue = String(value);
        }

        return [cleanKey, cleanValue];
      });

      doc.autoTable({
        startY: yPosition,
        head: [['Field', 'Value']],
        body: tableData,
        theme: 'striped',
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 9,
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [51, 65, 85],
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        margin: { left: margin, right: margin },
        columnStyles: {
          0: { cellWidth: 60, fontStyle: 'bold' },
          1: { cellWidth: 'auto' },
        },
      });

      yPosition = doc.lastAutoTable.finalY + 10;
    }

    // Check if we need a new page
    if (yPosition > pageHeight - 80) {
      doc.addPage();
      yPosition = margin;
    }

    // Approval History Section
    if (formData.approvalHistory && formData.approvalHistory.length > 0) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('APPROVAL SIGNATURES', margin, yPosition);
      yPosition += 7;

      const approvalData = formData.approvalHistory.map((approval: any, index: number) => {
        const approvedDate = approval.approvedAt ? toDate(approval.approvedAt) : new Date();
        
        return [
          String(index + 1),
          approval.approverName || 'Unknown',
          approval.approverPosition || 'N/A',
          approval.approverDepartment || 'N/A',
          approvedDate.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
        ];
      });

      doc.autoTable({
        startY: yPosition,
        head: [['#', 'Name', 'Position', 'Department', 'Approved Date/Time']],
        body: approvalData,
        theme: 'grid',
        headStyles: {
          fillColor: [34, 197, 94],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 9,
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [51, 65, 85],
        },
        margin: { left: margin, right: margin },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 35 },
          2: { cellWidth: 35 },
          3: { cellWidth: 35 },
          4: { cellWidth: 45 },
        },
      });

      yPosition = doc.lastAutoTable.finalY + 10;
    }

    // Final Approval Stamp
    if (yPosition > pageHeight - 40) {
      doc.addPage();
      yPosition = margin;
    }

    doc.setFillColor(34, 197, 94, 0.1);
    doc.roundedRect(margin, yPosition, pageWidth - 2 * margin, 25, 3, 3, 'F');
    doc.setDrawColor(34, 197, 94);
    doc.setLineWidth(1);
    doc.roundedRect(margin, yPosition, pageWidth - 2 * margin, 25, 3, 3, 'S');

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(34, 197, 94);
    doc.text('✓ FULLY APPROVED', margin + 5, yPosition + 10);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    
    const approvedDate = formData.approvedAt ? toDate(formData.approvedAt) : new Date();
    doc.text(
      `Approved on: ${approvedDate.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })}`,
      margin + 5,
      yPosition + 18
    );

    // Footer
    const totalPages = doc.internal.pages.length - 1;
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Page ${i} of ${totalPages}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
      doc.text(
        `Generated on ${new Date().toLocaleString('en-US')}`,
        pageWidth - margin,
        pageHeight - 10,
        { align: 'right' }
      );
    }

    // Generate PDF buffer
    const pdfBuffer = doc.output('arraybuffer');

    // Return PDF as response
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${(formData.formName || 'Form').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    return NextResponse.json(
      { 
        error: 'Failed to generate PDF',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}