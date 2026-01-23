'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/protected-route';
import { Sidebar } from '@/components/sidebar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { ChevronLeft, Download, AlertCircle, FileText, Edit } from 'lucide-react';
import Link from 'next/link';

interface FormTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  notes?: string;
  fileData?: string;
  fileName?: string;
  fileType?: string;
}

export default function ViewFormPage() {
  const params = useParams();
  const router = useRouter();
  const formId = params.formId as string;

  const [formTemplate, setFormTemplate] = useState<FormTemplate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!formId) return;

    const fetchFormTemplate = async () => {
      try {
        const formDocRef = doc(db, 'formTemplates', formId);
        const formDocSnap = await getDoc(formDocRef);

        if (formDocSnap.exists()) {
          setFormTemplate({
            id: formDocSnap.id,
            ...formDocSnap.data(),
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

  const downloadForm = () => {
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

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
          <Sidebar />
          <main className="flex-1 md:ml-64 p-4 sm:p-6 lg:p-8">
            <Card className="p-8 text-center bg-white/80 backdrop-blur-sm shadow-lg">
              <div className="flex flex-col items-center gap-3">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
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

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <Sidebar />

        <main className="flex-1 md:ml-64 p-4 sm:p-5">
          {/* Header */}
          <div className="mb-5">
            <Link 
              href="/forms-portal" 
              className="inline-flex items-center text-slate-600 hover:text-slate-900 font-medium mb-3 transition-colors text-sm group"
            >
              <ChevronLeft size={16} className="mr-1 group-hover:-translate-x-1 transition-transform" />
              Back to Forms Portal
            </Link>
            
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h1 className="text-xl font-semibold text-slate-900">
                  {formTemplate.name}
                </h1>
                <p className="text-slate-600 mt-1 text-sm">
                  {formTemplate.description}
                </p>
                <span className="inline-block mt-2 text-xs font-medium px-3 py-1 bg-blue-50 text-blue-700 rounded-md border border-blue-100">
                  {formTemplate.category}
                </span>
              </div>
              
              <Link href={`/forms-portal/fill/${formId}`}>
                <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white h-9 text-sm">
                  <Edit size={16} className="mr-1.5" />
                  Fill Out Form
                </Button>
              </Link>
            </div>
          </div>

          {/* Notes Section */}
          {formTemplate.notes && (
            <div className="p-4 mb-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="text-amber-600 flex-shrink-0 mt-0.5" size={16} />
                <div className="flex-1">
                  <h3 className="font-medium text-amber-900 text-sm mb-1">Important Notes</h3>
                  <p className="text-amber-800 text-xs whitespace-pre-wrap leading-relaxed">
                    {formTemplate.notes}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* PDF Viewer */}
          {formTemplate.fileData ? (
            <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-slate-900">Form Preview</h2>
                <Button
                  onClick={downloadForm}
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs border-slate-300"
                >
                  <Download size={14} className="mr-1" />
                  Download
                </Button>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                <iframe
                  src={`data:${formTemplate.fileType};base64,${formTemplate.fileData}`}
                  className="w-full"
                  style={{ height: 'calc(100vh - 280px)', minHeight: '600px' }}
                  title="Form Preview"
                />
              </div>
            </div>
          ) : (
            <div className="p-8 text-center bg-white border border-slate-200 rounded-lg">
              <FileText className="mx-auto text-slate-400 mb-3" size={48} />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                No PDF Available
              </h3>
              <p className="text-slate-600 mb-4 text-sm">
                This form does not have a PDF template attached.
              </p>
              <Link href={`/forms-portal/fill/${formId}`}>
                <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white h-9 text-sm">
                  <Edit size={16} className="mr-1.5" />
                  Fill Out Form
                </Button>
              </Link>
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}