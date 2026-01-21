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
import { CheckCircle, Download, Eye } from 'lucide-react';
import Link from 'next/link';
import { db } from '@/lib/firebase';

interface ApprovedForm {
  id: string;
  formName: string;
  status: string;
  approvedAt: any;
  approvedBy: string;
  attachments: string[];
  formData: any;
}

export default function ApprovedFormsPage() {
  const { user, userData } = useAuth();
  const [approvedForms, setApprovedForms] = useState<ApprovedForm[]>([]);
  const [loading, setLoading] = useState(true);

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
        const approvedList = approvedSnap.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          } as ApprovedForm))
          .sort(
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

  const handleDownload = async (attachment: string) => {
    try {
      // This is a placeholder - in a real app, you'd use Firebase Storage
      console.log('Downloading:', attachment);
    } catch (error) {
      console.error('Error downloading file:', error);
    }
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
              View and download your approved forms
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
                          Approved Date
                        </th>
                        <th className="text-left py-4 px-6 font-semibold text-foreground">
                          Attachments
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
                            {form.formName}
                          </td>
                          <td className="py-4 px-6 text-muted-foreground text-xs">
                            {new Date(
                              form.approvedAt?.toDate?.() || Date.now()
                            ).toLocaleDateString()}
                          </td>
                          <td className="py-4 px-6">
                            <span className="inline-block px-3 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full">
                              {form.attachments?.length || 0} files
                            </span>
                          </td>
                          <td className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                className="p-2 hover:bg-secondary rounded-lg transition-colors"
                                title="View Details"
                              >
                                <Eye size={16} className="text-muted-foreground" />
                              </button>
                              {(form.attachments?.length || 0) > 0 && (
                                <button
                                  onClick={() =>
                                    handleDownload(form.attachments[0])
                                  }
                                  className="p-2 hover:bg-secondary rounded-lg transition-colors"
                                  title="Download"
                                >
                                  <Download
                                    size={16}
                                    className="text-primary"
                                  />
                                </button>
                              )}
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
                    <Card key={form.id} className="p-4 border-l-4 border-l-green-500">
                      <div className="mb-3">
                        <h3 className="font-bold text-foreground text-sm">
                          {form.formName}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          Approved:{' '}
                          {new Date(
                            form.approvedAt?.toDate?.() || Date.now()
                          ).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="mb-3">
                        <span className="inline-block px-2 py-1 bg-primary/10 text-primary text-xs font-medium rounded">
                          {form.attachments?.length || 0} files
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1 bg-transparent">
                          <Eye size={14} className="mr-1" />
                          View
                        </Button>
                        {(form.attachments?.length || 0) > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleDownload(form.attachments[0])
                            }
                            className="flex-1 text-primary"
                          >
                            <Download size={14} />
                          </Button>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
