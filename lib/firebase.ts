import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
// ❌ REMOVED: import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyCS3AnfVD9KUSKjXVv66Ct65qtkOF_TLLQ',
  authDomain: 'isc-forms-portal.firebaseapp.com',
  projectId: 'isc-forms-portal',
  storageBucket: 'isc-forms-portal.firebasestorage.app',
  messagingSenderId: '1063664290944',
  appId: '1:1063664290944:web:7c353dbd24a9b363c32a65',
  measurementId: 'G-RQBJV6H8WH',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
// ❌ REMOVED: const storage = getStorage(app);

// Set persistence to local so user stays logged in
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error('Failed to set persistence:', error);
});

// ❌ REMOVED 'storage' from exports
export { auth, db, app };
