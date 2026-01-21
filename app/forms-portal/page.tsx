'use client';

import { useState, useEffect } from 'react';
import { ProtectedRoute } from '@/components/protected-route';
import { Sidebar } from '@/components/sidebar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { FileText, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface FormTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  approvers: string[];
}

export default function FormsPortalPage() {
  const [forms, setForms] = useState<FormTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');

  useEffect(() => {
    const fetchForms = async () => {
      try {
        const formsRef = collection(db, 'formTemplates');
        const formsSnap = await getDocs(formsRef);
        const formsList = formsSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as FormTemplate[];
        setForms(formsList);
      } catch (error) {
        console.error('Error fetching forms:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchForms();
  }, []);

  const categories = ['All', ...new Set(forms.map((f) => f.category))];

  const filteredForms =
    filter === 'All' ? forms : forms.filter((f) => f.category === filter);

  return (
    <ProtectedRoute>
      <div className="flex">
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content */}
        <main className="flex-1 bg-background md:ml-64">
          {/* Top Bar */}
          <div className="bg-card border-b border-border p-6 md:p-8">
            <h1 className="text-3xl font-bold text-foreground">Forms Portal</h1>
            <p className="text-muted-foreground mt-2">
              Browse and submit forms for your organization
            </p>
          </div>

          {/* Content */}
          <div className="p-6 md:p-8 space-y-8">
            {/* Filter Buttons */}
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setFilter(category)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    filter === category
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-foreground hover:bg-secondary/80'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            {/* Forms Grid */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <Card key={i} className="p-6 animate-pulse">
                    <div className="h-6 bg-muted rounded mb-4" />
                    <div className="h-4 bg-muted rounded mb-4" />
                    <div className="h-4 bg-muted rounded w-3/4" />
                  </Card>
                ))}
              </div>
            ) : filteredForms.length === 0 ? (
              <Card className="p-12 text-center">
                <FileText className="mx-auto text-muted-foreground mb-4" size={48} />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  No forms available
                </h3>
                <p className="text-muted-foreground">
                  Check back later for new forms to submit.
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredForms.map((form) => (
                  <Card key={form.id} className="p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                      <FileText className="text-primary" size={32} />
                      <span className="text-xs font-semibold px-2 py-1 bg-primary/10 text-primary rounded-full">
                        {form.category}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-foreground mb-2">
                      {form.name}
                    </h3>
                    <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
                      {form.description}
                    </p>

                    <div className="mb-4 pt-4 border-t border-border">
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        Approvers: {form.approvers?.length || 0}
                      </p>
                    </div>

                    <Link href={`/forms-portal/${form.id}/fill`}>
                      <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                        <span>Fill Out Form</span>
                        <ChevronRight size={18} className="ml-2" />
                      </Button>
                    </Link>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
