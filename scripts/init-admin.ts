import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function initializeAdmin() {
  try {
    // Create admin user in Firebase Auth
    const email = 'admin@interwold.com';
    const password = 'password123';

    console.log('Creating admin user...');
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;

    // Create admin user document in Firestore
    console.log('Setting up admin user in Firestore...');
    await setDoc(doc(db, 'users', uid), {
      email,
      fullName: 'Admin User',
      position: 'System Administrator',
      department: 'Administration',
      role: 'Admin',
      isApprover: true,
      createdAt: new Date(),
    });

    console.log('✓ Admin user created successfully!');
    console.log(`User ID: ${uid}`);
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
  } catch (error: any) {
    if (error.code === 'auth/email-already-in-use') {
      console.log('Admin user already exists. Setting up Firestore document...');
      try {
        // If user exists, just ensure their Firestore document has admin role
        const userCredential = await auth.signInWithEmailAndPassword('admin@interwold.com', 'password123');
        const uid = userCredential.user.uid;
        
        await setDoc(doc(db, 'users', uid), {
          email: 'admin@interwold.com',
          fullName: 'Admin User',
          position: 'System Administrator',
          department: 'Administration',
          role: 'Admin',
          isApprover: true,
          updatedAt: new Date(),
        }, { merge: true });
        
        console.log('✓ Admin user document updated!');
      } catch (signInError) {
        console.error('Error signing in existing admin:', signInError);
      }
    } else {
      console.error('Error initializing admin:', error);
    }
  }
}

initializeAdmin();
