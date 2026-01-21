'use client';

import React, { useState, useEffect } from 'react';
import { ProtectedRoute } from '@/components/protected-route';
import { Sidebar } from '@/components/sidebar';
import { useAuth } from '@/lib/auth-context';
import { db, auth } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Users, FileText } from 'lucide-react';
import { UserManagement } from '@/components/admin/UserManagement';
import { FormsManagement } from '@/components/admin/FormsManagement';

interface UserRecord {
  id: string;
  email: string;
  password?: string;
  fullName: string;
  position: string;
  department: string;
  role: 'Employee' | 'Admin';
  isApprover: boolean;
}

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
}

export default function AdminPanelPage() {
  const { userData } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'forms'>('users');
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [forms, setForms] = useState<FormTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  // Show auth status in console
  useEffect(() => {
    console.log('=== AUTH STATUS ===');
    console.log('Current User:', auth.currentUser?.email);
    console.log('User ID:', auth.currentUser?.uid);
    console.log('Email Verified:', auth.currentUser?.emailVerified);
    console.log('UserData:', userData);
    console.log('==================');
  }, [userData]);

  // Redirect if not admin
  useEffect(() => {
    if (userData && userData.role !== 'Admin') {
      console.log('Access denied - not admin');
    }
  }, [userData]);

  // Fetch users and forms from Firebase
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Check if user is authenticated
        if (!auth.currentUser) {
          console.error('❌ No authenticated user found');
          alert('Please log in to access the admin panel');
          return;
        }

        console.log('✅ User authenticated:', auth.currentUser.email);
        console.log('🔄 Fetching data from Firestore...');

        // Fetch users
        const usersRef = collection(db, 'users');
        const usersSnap = await getDocs(usersRef);
        const usersList = usersSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as UserRecord[];
        setUsers(usersList);
        console.log('✅ Loaded users:', usersList.length);

        // Fetch forms
        const formsRef = collection(db, 'formTemplates');
        const formsSnap = await getDocs(formsRef);
        const formsList = formsSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as FormTemplate[];
        setForms(formsList);
        console.log('✅ Loaded forms:', formsList.length);
      } catch (error: any) {
        console.error('❌ Error fetching data:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        
        if (error.code === 'permission-denied') {
          alert('⚠️ PERMISSION DENIED\n\nPlease update your Firestore rules:\n\n1. Go to Firebase Console\n2. Firestore Database → Rules\n3. Set: allow read, write: if request.auth != null;\n4. Click Publish');
        } else {
          alert(`Error loading data: ${error.message}`);
        }
      } finally {
        setLoading(false);
      }
    };

    // Only fetch if we have auth user
    if (auth.currentUser) {
      fetchData();
    } else {
      console.log('⏳ Waiting for authentication...');
      // Wait a bit for auth to initialize
      const timer = setTimeout(() => {
        if (auth.currentUser) {
          fetchData();
        } else {
          console.error('❌ Authentication timeout');
          setLoading(false);
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [userData]);

  return (
    <ProtectedRoute>
      <div className="flex">
        <Sidebar />

        <main className="flex-1 bg-background md:ml-64">
          <div className="bg-card border-b border-border p-6 md:p-8">
            <h1 className="text-3xl font-bold text-foreground">Admin Panel</h1>
            <p className="text-muted-foreground mt-2">
              Manage users, forms, and approvals
            </p>
          </div>

          <div className="p-6 md:p-8">
            <div className="flex gap-4 mb-8 border-b border-border">
              <button
                onClick={() => setActiveTab('users')}
                className={`px-4 py-3 font-medium transition-colors border-b-2 ${
                  activeTab === 'users'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Users size={18} className="inline mr-2" />
                User Management
              </button>
              <button
                onClick={() => setActiveTab('forms')}
                className={`px-4 py-3 font-medium transition-colors border-b-2 ${
                  activeTab === 'forms'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <FileText size={18} className="inline mr-2" />
                Forms Management
              </button>
            </div>

            {activeTab === 'users' && (
              <UserManagement 
                users={users} 
                setUsers={setUsers} 
                loading={loading} 
              />
            )}

            {activeTab === 'forms' && (
              <FormsManagement 
                forms={forms} 
                setForms={setForms} 
                users={users}
                loading={loading}
                currentUserId={userData?.id}
              />
            )}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}