'use client';

import { useState, useEffect } from 'react';
import { ProtectedRoute } from '@/components/protected-route';
import { Sidebar } from '@/components/sidebar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import {
  collection,
  query,
  where,
  getDocs,
  QueryConstraint,
  doc,
  getDoc,
} from 'firebase/firestore';
import {
  CheckCircle,
  Download,
  Eye,
  X,
  Clock,
  FileText,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { jsPDF } from 'jspdf';

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

export default function ApprovedFormsPage() {
  const { user, userData } = useAuth();
  const [approvedForms, setApprovedForms] = useState<ApprovedForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedForm, setSelectedForm] = useState<ApprovedForm | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchApprovedForms = async () => {
      try {
        const formsRef = collection(db, 'forms');
        const constraints: QueryConstraint[] = [
          where('status', '==', 'Approved'),
        ];

        // Non-admin users only see their own approved forms
        if (userData?.role !== 'Admin') {
          constraints.push(where('submittedBy', '==', user.uid));
        }

        const approvedQuery = query(formsRef, ...constraints);
        const approvedSnap = await getDocs(approvedQuery);
        
        // Fetch form templates to get field labels
        const formTemplatesRef = collection(db, 'formTemplates');
        const templatesSnap = await getDocs(formTemplatesRef);
        const templates = new Map();
        templatesSnap.docs.forEach(doc => {
          templates.set(doc.id, doc.data());
          templates.set(doc.data().name, doc.data()); // Also map by name
        });
        
        const approvedList = await Promise.all(
          approvedSnap.docs.map(async (docSnapshot) => {
            const formData = docSnapshot.data();
            
            console.log('Form data:', formData); // Debug log
            
            // Get the form template - try multiple ways
            let template = null;
            if (formData.formTemplateId) {
              template = templates.get(formData.formTemplateId);
            }
            if (!template && formData.formName) {
              template = templates.get(formData.formName);
            }
            
            // Create field mapping from template
            const fieldMapping: { [key: string]: string } = {};
            if (template?.fields) {
              template.fields.forEach((field: any) => {
                if (field.id && field.label) {
                  fieldMapping[field.id] = field.label;
                }
              });
            }
            
            console.log('Field mapping:', fieldMapping); // Debug log
            console.log('Submitter info:', {
              name: formData.submitterName,
              position: formData.submitterPosition,
              department: formData.submitterDepartment
            }); // Debug log
            console.log('Approval steps:', formData.approvalSteps); // Debug log
            
            return {
              id: docSnapshot.id,
              ...formData,
              fieldMapping,
            } as ApprovedForm & { fieldMapping: { [key: string]: string } };
          })
        );
        
        approvedList.sort(
          (a, b) =>
            (b.approvedAt?.toDate?.() || 0) - (a.approvedAt?.toDate?.() || 0)
        );

        setApprovedForms(approvedList);
      } catch (error) {
        console.error('Error fetching approved forms:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchApprovedForms();
  }, [user, userData]);

  const generatePDF = async (form: ApprovedForm) => {
    try {
      console.log('Generating PDF for form:', form);
      console.log('Submitter info:', {
        name: form.submittedByName,
        position: form.position,
        department: form.department
      });
      console.log('Approval timeline:', form.approvalTimeline);
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      let yPosition = margin;

      // Load the ISC logo
      const loadImage = (src: string): Promise<HTMLImageElement> => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = src;
        });
      };

      // Try to load and add logo with proper sizing
      try {
        const logoImg = await loadImage('/isc-logo-long.png');
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

      // Header - Company Info (top right)
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
      pdf.text(form.formName.toUpperCase(), pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 12;

      // Form content section
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');

      // Date field
      pdf.text('DATE:', margin, yPosition);
      pdf.setDrawColor(150, 150, 150);
      pdf.setLineWidth(0.3);
      pdf.line(margin + 20, yPosition + 1, margin + 70, yPosition + 1);
      pdf.text(
        new Date(form.submittedAt?.toDate?.() || Date.now()).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        margin + 22,
        yPosition
      );
      yPosition += 10;

      // Track starting position of form fields
      const formFieldsStartY = yPosition;

      // Display form data with field mapping
      if (form.formData && Object.keys(form.formData).length > 0) {
        const entries = Object.entries(form.formData);
        
        for (const [key, value] of entries) {
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

          pdf.setFont('helvetica', 'normal');
          const labelText = `${label}:`;
          pdf.text(labelText, margin, yPosition);
          
          const labelWidth = pdf.getTextWidth(labelText);
          const valueX = margin + labelWidth + 3;
          const lineEndX = pageWidth - margin - 50;
          
          pdf.setDrawColor(150, 150, 150);
          pdf.line(valueX, yPosition + 1, lineEndX, yPosition + 1);
          
          let valueText = '';
          if (typeof value === 'boolean') {
            valueText = value ? 'Yes' : 'No';
          } else if (value === null || value === undefined || value === '') {
            valueText = '';
          } else {
            valueText = String(value);
          }
          
          if (valueText && valueText.length > 0) {
            pdf.text(valueText, valueX + 2, yPosition);
          }
          
          yPosition += 8;
        }
      }

      // Get approved records from timeline
      const approvedRecords = form.approvalTimeline?.filter(
        (record) => record.action === 'Approved'
      ) || [];

      console.log('Approved records for PDF:', approvedRecords);

      // Calculate signature section height needed
      const signatureBlockHeight = 60;
      const numSignatures = 1 + approvedRecords.length;
      const numRows = Math.ceil(numSignatures / 2);
      const totalSignatureHeight = (numRows * signatureBlockHeight) + 10;

      // Check if signatures will fit on current page
      const spaceAvailable = pageHeight - yPosition - 20; // 20mm for footer
      
      if (spaceAvailable < totalSignatureHeight) {
        // Not enough space - add new page
        pdf.addPage();
        yPosition = margin;
      } else {
        // Enough space - add some spacing
        yPosition += 15;
      }

      // Position signatures
      const colWidth = (pageWidth - 2 * margin - 10) / 2;
      let currentX = margin;
      let currentY = yPosition;
      let column = 0;

      // Helper function to draw signature block with actual signature image
      const drawSignature = async (
        name: string,
        label: string,
        position: string,
        department: string,
        date: Date,
        signatureImage?: string
      ) => {
        // If signature image exists, draw it
        if (signatureImage) {
          try {
            const sigWidth = colWidth - 30;
            const sigHeight = 20;
            pdf.addImage(signatureImage, 'PNG', currentX + 15, currentY + 5, sigWidth, sigHeight);
          } catch (error) {
            console.error('Error adding signature image:', error);
            pdf.setFont('helvetica', 'italic');
            pdf.setFontSize(11);
            pdf.setTextColor(0, 102, 204);
            pdf.text(name, currentX + colWidth / 2, currentY + 15, { align: 'center' });
          }
        } else {
          pdf.setFont('helvetica', 'italic');
          pdf.setFontSize(11);
          pdf.setTextColor(0, 102, 204);
          pdf.text(name, currentX + colWidth / 2, currentY + 15, { align: 'center' });
        }
        
        // Signature line
        pdf.setDrawColor(0, 0, 0);
        pdf.setLineWidth(0.4);
        pdf.line(currentX + 15, currentY + 28, currentX + colWidth - 15, currentY + 28);
        
        // Label
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(0, 0, 0);
        pdf.text(label, currentX + colWidth / 2, currentY + 33, { align: 'center' });
        
        // Name (printed)
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
        
        // Date
        pdf.setFontSize(7);
        pdf.text(
          `Date: ${date.toLocaleDateString()}`,
          currentX + colWidth / 2,
          currentY + 50,
          { align: 'center' }
        );
      };

      // Get submitter signature from form
      const submitterSignature = (form as any).signature;
      console.log('Submitter signature:', submitterSignature ? 'Found' : 'Not found');

      // Employee signature
      console.log('Drawing employee signature:', form.submittedByName, form.position, form.department);
      await drawSignature(
        form.submittedByName || 'Employee',
        'Signature of Employee',
        form.position || '',
        form.department || '',
        form.submittedAt?.toDate?.() || new Date(),
        submitterSignature
      );

      column++;
      currentX = margin + colWidth + 10;

      // Approver signatures from approval timeline
      if (approvedRecords.length > 0) {
        for (const [index, record] of approvedRecords.entries()) {
          console.log(`Drawing approver ${index + 1} signature:`, record.byName, record.byPosition, record.byDepartment);
          console.log(`Approver ${index + 1} signature image:`, record.signature ? 'Found' : 'Not found');
          
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

      // Footer
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
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw error;
    }
  };

  const handleDownload = async (form: ApprovedForm) => {
    try {
      const pdf = await generatePDF(form);
      const fileName = `${form.formName.replace(/\s+/g, '_')}_${form.id}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  const handlePreview = async (form: ApprovedForm) => {
    try {
      const pdf = await generatePDF(form);
      const blob = pdf.output('blob');
      setPdfBlob(blob);
      setSelectedForm(form);
      setShowPreview(true);
    } catch (error) {
      console.error('Error generating preview:', error);
      alert('Failed to generate preview. Please try again.');
    }
  };

  const handleShowTimeline = (form: ApprovedForm) => {
    setSelectedForm(form);
    setShowTimeline(true);
  };

  return (
    <ProtectedRoute>
      <div className="flex">
        <Sidebar />

        <main className="flex-1 bg-background md:ml-64">
          <div className="bg-card border-b border-border p-6 md:p-8">
            <h1 className="text-3xl font-bold text-foreground">
              Approved Forms
            </h1>
            <p className="text-muted-foreground mt-2">
              View and download your approved forms with official signatures
            </p>
          </div>

          <div className="p-6 md:p-8 space-y-8">
            {loading ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">Loading approved forms...</p>
              </Card>
            ) : approvedForms.length === 0 ? (
              <Card className="p-12 text-center">
                <CheckCircle
                  className="mx-auto text-green-500 mb-4"
                  size={48}
                />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  No approved forms yet
                </h3>
                <p className="text-muted-foreground mb-6">
                  Your submitted forms will appear here once approved.
                </p>
                <Link href="/forms-portal">
                  <Button className="bg-primary hover:bg-primary/90">
                    Submit a Form
                  </Button>
                </Link>
              </Card>
            ) : (
              <>
                {/* Desktop View */}
                <div className="hidden md:block overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-secondary border-b border-border">
                        <th className="text-left py-4 px-6 font-semibold text-foreground">
                          Form Name
                        </th>
                        <th className="text-left py-4 px-6 font-semibold text-foreground">
                          Submitted Date
                        </th>
                        <th className="text-left py-4 px-6 font-semibold text-foreground">
                          Approved Date
                        </th>
                        <th className="text-left py-4 px-6 font-semibold text-foreground">
                          Approvals
                        </th>
                        <th className="text-right py-4 px-6 font-semibold text-foreground">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {approvedForms.map((form) => (
                        <tr
                          key={form.id}
                          className="border-b border-border hover:bg-secondary/30 transition-colors"
                        >
                          <td className="py-4 px-6 text-foreground font-medium">
                            <div className="flex items-center gap-2">
                              <FileText size={16} className="text-primary" />
                              {form.formName}
                            </div>
                          </td>
                          <td className="py-4 px-6 text-muted-foreground text-xs">
                            {new Date(
                              form.submittedAt?.toDate?.() || Date.now()
                            ).toLocaleDateString()}
                          </td>
                          <td className="py-4 px-6 text-muted-foreground text-xs">
                            {new Date(
                              form.approvedAt?.toDate?.() || Date.now()
                            ).toLocaleDateString()}
                          </td>
                          <td className="py-4 px-6">
                            <button
                              onClick={() => handleShowTimeline(form)}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-green-500/10 text-green-600 text-xs font-medium rounded-full hover:bg-green-500/20 transition-colors"
                            >
                              <CheckCircle2 size={12} />
                              {form.approvalSteps?.length || 0} approvers
                            </button>
                          </td>
                          <td className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handlePreview(form)}
                                className="p-2 hover:bg-secondary rounded-lg transition-colors"
                                title="Preview Document"
                              >
                                <Eye size={16} className="text-muted-foreground" />
                              </button>
                              <button
                                onClick={() => handleDownload(form)}
                                className="p-2 hover:bg-secondary rounded-lg transition-colors"
                                title="Download PDF"
                              >
                                <Download size={16} className="text-primary" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View */}
                <div className="md:hidden space-y-4">
                  {approvedForms.map((form) => (
                    <Card
                      key={form.id}
                      className="p-4 border-l-4 border-l-green-500"
                    >
                      <div className="mb-3">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText size={16} className="text-primary" />
                          <h3 className="font-bold text-foreground text-sm">
                            {form.formName}
                          </h3>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Submitted:{' '}
                          {new Date(
                            form.submittedAt?.toDate?.() || Date.now()
                          ).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Approved:{' '}
                          {new Date(
                            form.approvedAt?.toDate?.() || Date.now()
                          ).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="mb-3">
                        <button
                          onClick={() => handleShowTimeline(form)}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/10 text-green-600 text-xs font-medium rounded"
                        >
                          <CheckCircle2 size={12} />
                          {form.approvalSteps?.length || 0} approvers
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePreview(form)}
                          className="flex-1 bg-transparent"
                        >
                          <Eye size={14} className="mr-1" />
                          Preview
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(form)}
                          className="flex-1 text-primary"
                        >
                          <Download size={14} className="mr-1" />
                          Download
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </div>
        </main>
      </div>

      {/* PDF Preview Modal */}
      {showPreview && pdfBlob && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-2 md:p-4">
          <div className="bg-card rounded-lg shadow-2xl w-full h-full md:h-[95vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-3 md:p-4 border-b border-border bg-card rounded-t-lg">
              <div>
                <h3 className="text-base md:text-lg font-bold text-foreground">
                  Document Preview
                </h3>
                <p className="text-xs md:text-sm text-muted-foreground">
                  {selectedForm?.formName}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => selectedForm && handleDownload(selectedForm)}
                  className="bg-primary hover:bg-primary/90"
                  size="sm"
                >
                  <Download size={16} className="mr-2" />
                  Download
                </Button>
                <button
                  onClick={() => {
                    setShowPreview(false);
                    setPdfBlob(null);
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
                src={URL.createObjectURL(pdfBlob)}
                className="w-full h-full"
                title="PDF Preview"
              />
            </div>
          </div>
        </div>
      )}

      {/* Approval Timeline Drawer */}
      {showTimeline && selectedForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end md:items-center justify-end">
          <div
            className="fixed inset-0"
            onClick={() => setShowTimeline(false)}
          />
          <div className="bg-card rounded-t-2xl md:rounded-l-2xl md:rounded-tr-none w-full md:w-96 max-h-[80vh] md:max-h-full md:h-full flex flex-col relative z-10 shadow-2xl">
            {/* Drawer Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  Approval Timeline
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedForm.formName}
                </p>
              </div>
              <button
                onClick={() => setShowTimeline(false)}
                className="p-2 hover:bg-secondary rounded-lg transition-colors"
              >
                <X size={20} className="text-muted-foreground" />
              </button>
            </div>

            {/* Timeline Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Submitted */}
              <div className="relative pb-8">
                <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-border" />
                <div className="flex gap-4">
                  <div className="relative z-10 flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 border-2 border-primary">
                    <Calendar size={14} className="text-primary" />
                  </div>
                  <div className="flex-1 pt-0.5">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-foreground">
                        Submitted
                      </span>
                      <span className="text-xs px-2 py-0.5 bg-blue-500/10 text-blue-600 rounded-full">
                        Initial
                      </span>
                    </div>
                    <p className="text-sm text-foreground font-medium">
                      {selectedForm.submittedByName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedForm.position}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedForm.department}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <Clock size={12} />
                      {new Date(
                        selectedForm.submittedAt?.toDate?.() || Date.now()
                      ).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Approval Steps */}
              {selectedForm.approvalTimeline?.filter(r => r.action === 'Approved').map((record, index) => (
                <div key={index} className="relative pb-8">
                  {index < (selectedForm.approvalTimeline?.filter(r => r.action === 'Approved').length || 0) - 1 && (
                    <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-border" />
                  )}
                  <div className="flex gap-4">
                    <div className="relative z-10 flex items-center justify-center w-8 h-8 rounded-full bg-green-500/10 border-2 border-green-500">
                      <CheckCircle2 size={14} className="text-green-600" />
                    </div>
                    <div className="flex-1 pt-0.5">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-foreground">
                          Approved
                        </span>
                        <span className="text-xs px-2 py-0.5 bg-green-500/10 text-green-600 rounded-full">
                          Level {index + 1}
                        </span>
                      </div>
                      <p className="text-sm text-foreground font-medium">
                        {record.byName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {record.byPosition}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {record.byDepartment}
                      </p>
                      {record.signature && (
                        <div className="mt-2 p-2 bg-secondary/50 rounded border border-border">
                          <p className="text-xs text-muted-foreground mb-1">
                            Digital Signature:
                          </p>
                          <p className="text-sm font-signature text-primary italic">
                            {record.byName}
                          </p>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(
                          record.timestamp?.toDate?.() || Date.now()
                        ).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {/* Final Status */}
              <div className="relative">
                <div className="flex gap-4">
                  <div className="relative z-10 flex items-center justify-center w-8 h-8 rounded-full bg-green-500 border-2 border-green-600">
                    <CheckCircle size={16} className="text-white" />
                  </div>
                  <div className="flex-1 pt-0.5">
                    <span className="text-sm font-bold text-green-600">
                      Fully Approved
                    </span>
                    <p className="text-xs text-muted-foreground mt-1">
                      Document is ready for download
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-6 border-t border-border">
              <Button
                onClick={() => {
                  handleDownload(selectedForm);
                  setShowTimeline(false);
                }}
                className="w-full bg-primary hover:bg-primary/90"
              >
                <Download size={16} className="mr-2" />
                Download Official Document
              </Button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;700&display=swap');

        .font-signature {
          font-family: 'Dancing Script', cursive;
        }
      `}</style>
    </ProtectedRoute>
  );
}