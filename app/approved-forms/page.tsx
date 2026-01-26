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
import { generateApprovedFormPDF } from './approved-forms-pdf-generator';

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

export default function ApprovedFormsPage() {
  const { user, userData } = useAuth();
  const [approvedForms, setApprovedForms] = useState<ApprovedForm[]>([]);
  const [formsIApproved, setFormsIApproved] = useState<ApprovedForm[]>([]); // NEW STATE
  const [loading, setLoading] = useState(true);
  const [selectedForm, setSelectedForm] = useState<ApprovedForm | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);// MODIFIED useEffect - NOW FETCHES TWO SEPARATE DATASETS
  useEffect(() => {
    if (!user) return;

    const fetchApprovedForms = async () => {
      try {
        const formsRef = collection(db, 'forms');
        
        // Query 1: Forms I SUBMITTED that were approved
        const mySubmissionsConstraints: QueryConstraint[] = [
          where('status', '==', 'Approved'),
          where('submittedBy', '==', user.uid),
        ];
        const mySubmissionsQuery = query(formsRef, ...mySubmissionsConstraints);
        const mySubmissionsSnap = await getDocs(mySubmissionsQuery);
        
        // Query 2: Get all approved forms to check where I was an approver
        const allApprovedQuery = query(formsRef, where('status', '==', 'Approved'));
        const allApprovedSnap = await getDocs(allApprovedQuery);
        
        // Fetch form templates
        const formTemplatesRef = collection(db, 'formTemplates');
        const templatesSnap = await getDocs(formTemplatesRef);
        const templates = new Map();
        templatesSnap.docs.forEach(doc => {
          templates.set(doc.id, doc.data());
          templates.set(doc.data().name, doc.data());
        });
        
        // Process MY SUBMISSIONS
        const mySubmissionsList = await Promise.all(
          mySubmissionsSnap.docs.map(async (docSnapshot) => {
            const formData = docSnapshot.data();
            
            let template = null;
            if (formData.formTemplateId) {
              template = templates.get(formData.formTemplateId);
            }
            if (!template && formData.formName) {
              template = templates.get(formData.formName);
            }
            
            const fieldMapping: { [key: string]: string } = {};
            if (template?.fields) {
              template.fields.forEach((field: any) => {
                if (field.id && field.label) {
                  fieldMapping[field.id] = field.label;
                }
              });
            }
            
            return {
              id: docSnapshot.id,
              ...formData,
              fieldMapping,
              notes: template?.notes || '',
            } as ApprovedForm & { fieldMapping: { [key: string]: string }; notes: string };
          })
        );
        
        // Process FORMS I APPROVED
        const formsIApprovedList: ApprovedForm[] = [];
        
        for (const docSnapshot of allApprovedSnap.docs) {
          const formData = docSnapshot.data();
          
          // Skip if this is my own submission (already in first table)
          if (formData.submittedBy === user.uid) continue;
          
          // Check if I approved this form
          const approvalTimeline = formData.approvalTimeline || [];
          const iApproved = approvalTimeline.some((record: any) => 
            record.by === user.uid && record.action === 'Approved'
          );
          
          if (iApproved) {
            let template = null;
            if (formData.formTemplateId) {
              template = templates.get(formData.formTemplateId);
            }
            if (!template && formData.formName) {
              template = templates.get(formData.formName);
            }
            
            const fieldMapping: { [key: string]: string } = {};
            if (template?.fields) {
              template.fields.forEach((field: any) => {
                if (field.id && field.label) {
                  fieldMapping[field.id] = field.label;
                }
              });
            }
            
            formsIApprovedList.push({
              id: docSnapshot.id,
              ...formData,
              fieldMapping,
              notes: template?.notes || '',
            } as ApprovedForm & { fieldMapping: { [key: string]: string }; notes: string });
          }
        }
        
        // Sort both lists by approved date
        mySubmissionsList.sort(
          (a, b) =>
            (b.approvedAt?.toDate?.() || 0) - (a.approvedAt?.toDate?.() || 0)
        );
        formsIApprovedList.sort(
          (a, b) =>
            (b.approvedAt?.toDate?.() || 0) - (a.approvedAt?.toDate?.() || 0)
        );

        setApprovedForms(mySubmissionsList);
        setFormsIApproved(formsIApprovedList); // SET NEW STATE
      } catch (error) {
        console.error('Error fetching approved forms:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchApprovedForms();
  }, [user, userData]);

  const handleDownload = async (form: ApprovedForm) => {
    try {
      const pdf = await generateApprovedFormPDF(form);
      const submitterName = form.submittedByName || 'Unknown';
      const formType = form.formName || 'Form';
      const fileName = `${submitterName}-${formType}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  const handlePreview = async (form: ApprovedForm) => {
    try {
      const pdf = await generateApprovedFormPDF(form);
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
              View and download approved forms with official signatures
            </p>
          </div>{/* START OF NEW TWO-SECTION LAYOUT */}
          <div className="p-6 md:p-8 space-y-12">
            {loading ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">Loading approved forms...</p>
              </Card>
            ) : (
              <>
                {/* SECTION 1: MY APPROVED SUBMISSIONS */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-green-500/10 rounded-lg">
                      <FileText className="text-green-600" size={24} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-foreground">My Approved Submissions</h2>
                      <p className="text-sm text-muted-foreground">
                        Forms you submitted that have been fully approved ({approvedForms.length})
                      </p>
                    </div>
                  </div>

                  {approvedForms.length === 0 ? (
                    <Card className="p-12 text-center">
                      <CheckCircle className="mx-auto text-green-500 mb-4" size={48} />
                      <h3 className="text-lg font-semibold text-foreground mb-2">
                        No approved submissions yet
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
                      {/* Desktop Table */}
                      <div className="hidden md:block overflow-x-auto rounded-lg border border-border">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-secondary border-b border-border">
                              <th className="text-left py-4 px-6 font-semibold text-foreground">Form Name</th>
                              <th className="text-left py-4 px-6 font-semibold text-foreground">Submitted Date</th>
                              <th className="text-left py-4 px-6 font-semibold text-foreground">Approved Date</th>
                              <th className="text-left py-4 px-6 font-semibold text-foreground">Approvals</th>
                              <th className="text-right py-4 px-6 font-semibold text-foreground">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {approvedForms.map((form) => (
                              <tr key={form.id} className="border-b border-border hover:bg-secondary/30 transition-colors">
                                <td className="py-4 px-6 text-foreground font-medium">
                                  <div className="flex items-center gap-2">
                                    <FileText size={16} className="text-primary" />
                                    {form.formName}
                                  </div>
                                </td>
                                <td className="py-4 px-6 text-muted-foreground text-xs">
                                  {new Date(form.submittedAt?.toDate?.() || Date.now()).toLocaleDateString()}
                                </td>
                                <td className="py-4 px-6 text-muted-foreground text-xs">
                                  {new Date(form.approvedAt?.toDate?.() || Date.now()).toLocaleDateString()}
                                </td>
                                <td className="py-4 px-6">
                                  <button
                                    onClick={() => handleShowTimeline(form)}
                                    className="inline-flex items-center gap-1 px-3 py-1 bg-green-500/10 text-green-600 text-xs font-medium rounded-full hover:bg-green-500/20 transition-colors"
                                  >
                                    <CheckCircle2 size={12} />
                                    {form.approvalTimeline?.filter(r => r.action === 'Approved').length || 0} approvals
                                  </button>
                                </td>
                                <td className="py-4 px-6 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <button onClick={() => handlePreview(form)} className="p-2 hover:bg-secondary rounded-lg transition-colors" title="Preview Document">
                                      <Eye size={16} className="text-muted-foreground" />
                                    </button>
                                    <button onClick={() => handleDownload(form)} className="p-2 hover:bg-secondary rounded-lg transition-colors" title="Download PDF">
                                      <Download size={16} className="text-primary" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile Cards */}
                      <div className="md:hidden space-y-4">
                        {approvedForms.map((form) => (
                          <Card key={form.id} className="p-4 border-l-4 border-l-green-500">
                            <div className="mb-3">
                              <div className="flex items-center gap-2 mb-2">
                                <FileText size={16} className="text-primary" />
                                <h3 className="font-bold text-foreground text-sm">{form.formName}</h3>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Submitted: {new Date(form.submittedAt?.toDate?.() || Date.now()).toLocaleDateString()}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Approved: {new Date(form.approvedAt?.toDate?.() || Date.now()).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="mb-3">
                              <button onClick={() => handleShowTimeline(form)} className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/10 text-green-600 text-xs font-medium rounded">
                                <CheckCircle2 size={12} />
                                {form.approvalTimeline?.filter(r => r.action === 'Approved').length || 0} approvals
                              </button>
                            </div>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" onClick={() => handlePreview(form)} className="flex-1 bg-transparent">
                                <Eye size={14} className="mr-1" />Preview
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => handleDownload(form)} className="flex-1 text-primary">
                                <Download size={14} className="mr-1" />Download
                              </Button>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </>
                  )}
                </div>{/* SECTION 2: FORMS I APPROVED */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                      <CheckCircle2 className="text-blue-600" size={24} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-foreground">Forms I Approved</h2>
                      <p className="text-sm text-muted-foreground">
                        Forms where you acted as an approver ({formsIApproved.length})
                      </p>
                    </div>
                  </div>

                  {formsIApproved.length === 0 ? (
                    <Card className="p-12 text-center">
                      <CheckCircle2 className="mx-auto text-blue-500 mb-4" size={48} />
                      <h3 className="text-lg font-semibold text-foreground mb-2">No forms approved yet</h3>
                      <p className="text-muted-foreground">Forms you approve will appear here.</p>
                    </Card>
                  ) : (
                    <>
                      {/* Desktop Table */}
                      <div className="hidden md:block overflow-x-auto rounded-lg border border-border">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-secondary border-b border-border">
                              <th className="text-left py-4 px-6 font-semibold text-foreground">Form Name</th>
                              <th className="text-left py-4 px-6 font-semibold text-foreground">Submitter</th>
                              <th className="text-left py-4 px-6 font-semibold text-foreground">Submitted Date</th>
                              <th className="text-left py-4 px-6 font-semibold text-foreground">Approved Date</th>
                              <th className="text-left py-4 px-6 font-semibold text-foreground">Approvals</th>
                              <th className="text-right py-4 px-6 font-semibold text-foreground">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {formsIApproved.map((form) => (
                              <tr key={form.id} className="border-b border-border hover:bg-secondary/30 transition-colors">
                                <td className="py-4 px-6 text-foreground font-medium">
                                  <div className="flex items-center gap-2">
                                    <FileText size={16} className="text-primary" />
                                    {form.formName}
                                  </div>
                                </td>
                                <td className="py-4 px-6">
                                  <div>
                                    <p className="text-foreground font-medium text-sm">{form.submittedByName}</p>
                                    <p className="text-muted-foreground text-xs">{form.position}</p>
                                  </div>
                                </td>
                                <td className="py-4 px-6 text-muted-foreground text-xs">
                                  {new Date(form.submittedAt?.toDate?.() || Date.now()).toLocaleDateString()}
                                </td>
                                <td className="py-4 px-6 text-muted-foreground text-xs">
                                  {new Date(form.approvedAt?.toDate?.() || Date.now()).toLocaleDateString()}
                                </td>
                                <td className="py-4 px-6">
                                  <button onClick={() => handleShowTimeline(form)} className="inline-flex items-center gap-1 px-3 py-1 bg-green-500/10 text-green-600 text-xs font-medium rounded-full hover:bg-green-500/20 transition-colors">
                                    <CheckCircle2 size={12} />
                                    {form.approvalTimeline?.filter(r => r.action === 'Approved').length || 0} approvals
                                  </button>
                                </td>
                                <td className="py-4 px-6 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <button onClick={() => handlePreview(form)} className="p-2 hover:bg-secondary rounded-lg transition-colors" title="Preview Document">
                                      <Eye size={16} className="text-muted-foreground" />
                                    </button>
                                    <button onClick={() => handleDownload(form)} className="p-2 hover:bg-secondary rounded-lg transition-colors" title="Download PDF">
                                      <Download size={16} className="text-primary" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile Cards */}
                      <div className="md:hidden space-y-4">
                        {formsIApproved.map((form) => (
                          <Card key={form.id} className="p-4 border-l-4 border-l-blue-500">
                            <div className="mb-3">
                              <div className="flex items-center gap-2 mb-2">
                                <FileText size={16} className="text-primary" />
                                <h3 className="font-bold text-foreground text-sm">{form.formName}</h3>
                              </div>
                              <p className="text-xs text-muted-foreground">Submitter: {form.submittedByName}</p>
                              <p className="text-xs text-muted-foreground">
                                Submitted: {new Date(form.submittedAt?.toDate?.() || Date.now()).toLocaleDateString()}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Approved: {new Date(form.approvedAt?.toDate?.() || Date.now()).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="mb-3">
                              <button onClick={() => handleShowTimeline(form)} className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/10 text-green-600 text-xs font-medium rounded">
                                <CheckCircle2 size={12} />
                                {form.approvalTimeline?.filter(r => r.action === 'Approved').length || 0} approvals
                              </button>
                            </div>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" onClick={() => handlePreview(form)} className="flex-1 bg-transparent">
                                <Eye size={14} className="mr-1" />Preview
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => handleDownload(form)} className="flex-1 text-primary">
                                <Download size={14} className="mr-1" />Download
                              </Button>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </main>
      </div>

      {/* PREVIEW MODAL - KEEP AS IS */}
      {showPreview && pdfBlob && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-2 md:p-4">
          <div className="bg-card rounded-lg shadow-2xl w-full h-full md:h-[95vh] flex flex-col">
            <div className="flex items-center justify-between p-3 md:p-4 border-b border-border bg-card rounded-t-lg">
              <div>
                <h3 className="text-base md:text-lg font-bold text-foreground">Document Preview</h3>
                <p className="text-xs md:text-sm text-muted-foreground">{selectedForm?.formName}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={() => selectedForm && handleDownload(selectedForm)} className="bg-primary hover:bg-primary/90" size="sm">
                  <Download size={16} className="mr-2" />Download
                </Button>
                <button onClick={() => { setShowPreview(false); setPdfBlob(null); }} className="p-2 hover:bg-secondary rounded-lg transition-colors">
                  <X size={20} className="text-muted-foreground" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden bg-gray-100">
              <iframe src={URL.createObjectURL(pdfBlob)} className="w-full h-full" title="PDF Preview" />
            </div>
          </div>
        </div>
      )}{/* TIMELINE MODAL - KEEP AS IS */}
      {showTimeline && selectedForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end md:items-center justify-end">
          <div className="fixed inset-0" onClick={() => setShowTimeline(false)} />
          <div className="bg-card rounded-t-2xl md:rounded-l-2xl md:rounded-tr-none w-full md:w-96 max-h-[80vh] md:max-h-full md:h-full flex flex-col relative z-10 shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div>
                <h3 className="text-lg font-bold text-foreground">Approval Timeline</h3>
                <p className="text-sm text-muted-foreground mt-1">{selectedForm.formName}</p>
              </div>
              <button onClick={() => setShowTimeline(false)} className="p-2 hover:bg-secondary rounded-lg transition-colors">
                <X size={20} className="text-muted-foreground" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="relative pb-8">
                <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-border" />
                <div className="flex gap-4">
                  <div className="relative z-10 flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 border-2 border-primary">
                    <Calendar size={14} className="text-primary" />
                  </div>
                  <div className="flex-1 pt-0.5">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-foreground">Submitted</span>
                      <span className="text-xs px-2 py-0.5 bg-blue-500/10 text-blue-600 rounded-full">Initial</span>
                    </div>
                    <p className="text-sm text-foreground font-medium">{selectedForm.submittedByName}</p>
                    <p className="text-xs text-muted-foreground">{selectedForm.position}</p>
                    <p className="text-xs text-muted-foreground">{selectedForm.department}</p>
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <Clock size={12} />
                      {new Date(selectedForm.submittedAt?.toDate?.() || Date.now()).toLocaleString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              </div>

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
                        <span className="text-sm font-semibold text-foreground">Approved</span>
                        <span className="text-xs px-2 py-0.5 bg-green-500/10 text-green-600 rounded-full">Level {index + 1}</span>
                      </div>
                      <p className="text-sm text-foreground font-medium">{record.byName}</p>
                      <p className="text-xs text-muted-foreground">{record.byPosition}</p>
                      <p className="text-xs text-muted-foreground">{record.byDepartment}</p>
                      {record.signature && (
                        <div className="mt-2 p-2 bg-secondary/50 rounded border border-border">
                          <p className="text-xs text-muted-foreground mb-1">Digital Signature:</p>
                          <p className="text-sm font-signature text-primary italic">{record.byName}</p>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(record.timestamp?.toDate?.() || Date.now()).toLocaleString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              <div className="relative">
                <div className="flex gap-4">
                  <div className="relative z-10 flex items-center justify-center w-8 h-8 rounded-full bg-green-500 border-2 border-green-600">
                    <CheckCircle size={16} className="text-white" />
                  </div>
                  <div className="flex-1 pt-0.5">
                    <span className="text-sm font-bold text-green-600">Fully Approved</span>
                    <p className="text-xs text-muted-foreground mt-1">Document is ready for download</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-border">
              <Button onClick={() => { handleDownload(selectedForm); setShowTimeline(false); }} className="w-full bg-primary hover:bg-primary/90">
                <Download size={16} className="mr-2" />Download Official Document
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