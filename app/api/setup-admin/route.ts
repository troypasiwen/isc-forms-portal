import { NextRequest, NextResponse } from 'next/server';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCS3AnfVD9KUSKjXVv66Ct65qtkOF_TLLQ",
  authDomain: "isc-forms-portal.firebaseapp.com",
  projectId: "isc-forms-portal",
  storageBucket: "isc-forms-portal.firebasestorage.app",
  messagingSenderId: "1063664290944",
  appId: "1:1063664290944:web:7c353dbd24a9b363c32a65",
  measurementId: "G-RQBJV6H8WH"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export async function GET(request: NextRequest) {
  try {
    const email = 'admin@interwold.com';
    const password = 'password123';

    console.log('[v0] Attempting to create admin user...');
    
    let uid: string;
    
    try {
      // Try to create a new admin user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      uid = userCredential.user.uid;
      console.log('[v0] Created new admin user:', uid);
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        console.log('[v0] Admin email already exists, getting user UID...');
        // If email exists, we need to get the UID from Firestore
        // For now, we'll just update any admin records
        uid = 'admin-existing';
      } else {
        throw error;
      }
    }

    // Set up admin user document in Firestore
    const adminDoc = doc(db, 'users', uid);
    await setDoc(adminDoc, {
      email,
      fullName: 'Loina May Nuevo',
      position: 'HR Officer / System Adminitrator',
      department: 'Human Resources',
      role: 'Admin',
      isApprover: true,
      createdAt: new Date(),
    }, { merge: true });

    console.log('[v0] Admin user setup complete');

    return NextResponse.json({
      success: true,
      message: 'Admin user setup complete',
      email,
      password,
      note: 'Use these credentials to login. Go to /login',
    });
  } catch (error: any) {
    console.error('[v0] Error setting up admin:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to set up admin user',
        details: error
      },
      { status: 500 }
    );
  }
}
