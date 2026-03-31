import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile,
  signInWithPopup,
  GoogleAuthProvider,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, getDocs, updateDoc, query, where } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { User } from '../types';

const googleProvider = new GoogleAuthProvider();

export const authService = {
  login: async (email: string, password: string): Promise<User> => {
    // Demo account bypass if Firebase Auth is not enabled or for testing
    if (email === 'admin@storehouse.mk' && password === 'password123') {
      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const firebaseUser = userCredential.user;
        return authService.handleUserDoc(firebaseUser);
      } catch (error: unknown) {
        const err = error as { code?: string; message?: string };
        if (err.code === 'auth/operation-not-allowed' || err.code === 'auth/user-not-found') {
          console.warn('Firebase Auth failed, using mock demo user:', err.message);
          return {
            id: 'demo-admin-id',
            name: 'Admin User (Demo)',
            email: 'admin@storehouse.mk',
            role: 'Admin',
            active: true,
            createdAt: new Date().toISOString()
          };
        }
        throw error;
      }
    }
    
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;
    return authService.handleUserDoc(firebaseUser);
  },

  loginWithGoogle: async (): Promise<User> => {
    const userCredential = await signInWithPopup(auth, googleProvider);
    const firebaseUser = userCredential.user;
    return authService.handleUserDoc(firebaseUser);
  },

  handleUserDoc: async (firebaseUser: FirebaseUser): Promise<User> => {
    const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
    if (userDoc.exists()) {
      return { id: firebaseUser.uid, ...userDoc.data() } as User;
    }
    
    // Create doc if it doesn't exist (e.g. first time Google login)
    const newUser: User = {
      id: firebaseUser.uid,
      name: firebaseUser.displayName || 'User',
      email: firebaseUser.email || '',
      role: 'Admin', // Default to Admin for the first user or demo purposes
      active: true,
      createdAt: new Date().toISOString()
    };
    
    await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
    return newUser;
  },

  register: async (name: string, email: string, password: string): Promise<User> => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;
    
    await updateProfile(firebaseUser, { displayName: name });
    
    const newUser: User = {
      id: firebaseUser.uid,
      name,
      email,
      role: 'Admin', 
      active: true,
      createdAt: new Date().toISOString()
    };
    
    await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
    return newUser;
  },

  logout: async () => {
    await signOut(auth);
  },

  getCurrentUser: (): User | null => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return null;
    
    // This is a bit tricky since getCurrentUser is synchronous in the original code
    // We'll rely on the StoreContext to handle the async state
    return null; 
  },

  onAuthChange: (callback: (user: User | null) => void) => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          callback({ id: firebaseUser.uid, ...userDoc.data() } as User);
        } else {
          callback({
            id: firebaseUser.uid,
            name: firebaseUser.displayName || 'User',
            email: firebaseUser.email || '',
            role: 'Warehouse Worker',
            active: true,
            createdAt: new Date().toISOString()
          });
        }
      } else {
        callback(null);
      }
    });
  },

  getUsers: async (restaurantId: string): Promise<User[]> => {
    const q = query(collection(db, 'users'), where('restaurantId', '==', restaurantId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
  },

  updateUser: async (id: string, data: Partial<User>) => {
    await updateDoc(doc(db, 'users', id), data);
  },

  createUser: async (data: Omit<User, 'id'> & { id?: string }) => {
    // This would typically be done via an admin function or registration
    // For this app, we'll just use setDoc
    const id = data.id || Math.random().toString(36).substring(7);
    await setDoc(doc(db, 'users', id), data);
    return { id, ...data };
  }
};
