import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

// Mock browser globals for Firebase client SDK in Node
if (typeof global.window === 'undefined') {
  (global as unknown as { window: unknown }).window = global;
}
if (typeof global.navigator === 'undefined') {
  (global as unknown as { navigator: unknown }).navigator = { userAgent: 'node' };
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function createDemoUser() {
  const email = 'admin@storehouse.mk';
  const password = 'password123';
  const name = 'Admin User';

  console.log(`Attempting to create demo user: ${email}...`);

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    await setDoc(doc(db, 'users', user.uid), {
      id: user.uid,
      name,
      email,
      role: 'Admin',
      active: true,
      createdAt: new Date().toISOString()
    });

    console.log('Demo user created successfully!');
  } catch (error) {
    const err = error as { code?: string; message?: string };
    if (err.code === 'auth/email-already-in-use') {
      console.log('User already exists, attempting to sign in...');
      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Ensure the doc exists
        await setDoc(doc(db, 'users', user.uid), {
          id: user.uid,
          name,
          email,
          role: 'Admin',
          active: true,
          createdAt: new Date().toISOString()
        }, { merge: true });
        
        console.log('Signed in and doc verified successfully!');
      } catch (signInError) {
        const sErr = signInError as { message?: string };
        console.error('Error signing in:', sErr.message);
      }
    } else {
      console.error('Error creating user:', err.message);
      if (err.code === 'auth/operation-not-allowed') {
        console.error('CRITICAL: Email/Password authentication is not enabled in Firebase Console.');
      }
    }
  }
}

createDemoUser().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
