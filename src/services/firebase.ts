import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  onSnapshot,
  Firestore,
  DocumentSnapshot,
} from 'firebase/firestore';
import { DatabaseState, getInitialDatabase } from './storage';

const env = (typeof import.meta !== 'undefined' && (import.meta as any).env) || {};

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyAGV0aDgDwbeuYTopv9omsrOhxHiaKbvWs',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'my-workplace-app.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'my-workplace-app',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'my-workplace-app.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '735748443568',
  appId: env.VITE_FIREBASE_APP_ID || '1:735748443568:web:ab93a4dcde053eab3b5a75',
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || 'G-Z5X5WSJF21',
};

// Initialize Firebase App
export const firebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const firestore: Firestore = getFirestore(firebaseApp);

const FIRESTORE_COLLECTION = 'workplace_data';
const FIRESTORE_DOC = 'main_state';

/**
 * Subscribes to real-time changes from Firestore database.
 * If the document does not exist yet, initializes it with local initial database.
 */
export function subscribeToFirestore(
  onRemoteData: (data: DatabaseState) => void,
  onStatusChange?: (status: 'connected' | 'connecting' | 'error', message?: string) => void
): () => void {
  if (!firestore) {
    onStatusChange?.('error', 'Firestore chưa được khởi tạo');
    return () => {};
  }

  onStatusChange?.('connecting');

  const docRef = doc(firestore, FIRESTORE_COLLECTION, FIRESTORE_DOC);

  const unsubscribe = onSnapshot(
    docRef,
    (snapshot: DocumentSnapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as { stateJson: string };
        if (data && data.stateJson) {
          try {
            const parsed = JSON.parse(data.stateJson) as DatabaseState;
            onRemoteData(parsed);
            onStatusChange?.('connected');
          } catch (e) {
            console.error('Lỗi phân tích cú pháp dữ liệu Firestore:', e);
            onStatusChange?.('error', 'Lỗi định dạng dữ liệu');
          }
        }
      } else {
        // Document doesn't exist yet: initialize with initial db
        const initial = getInitialDatabase();
        setDoc(docRef, {
          stateJson: JSON.stringify(initial),
          updatedAt: new Date().toISOString(),
          appId: firebaseConfig.projectId,
        })
          .then(() => {
            onRemoteData(initial);
            onStatusChange?.('connected');
          })
          .catch((err) => {
            console.warn('Chưa thể ghi dữ liệu khởi tạo Firestore:', err);
            onStatusChange?.('error', err.message || 'Lỗi quyền truy cập Firestore');
          });
      }
    },
    (error) => {
      console.warn('Firestore snapshot listener error:', error);
      onStatusChange?.('error', error.message || 'Không thể kết nối Firestore');
    }
  );

  return unsubscribe;
}

/**
 * Saves database state to Firestore.
 */
export async function saveToFirestore(db: DatabaseState): Promise<void> {
  if (!firestore) return;
  try {
    const docRef = doc(firestore, FIRESTORE_COLLECTION, FIRESTORE_DOC);
    await setDoc(docRef, {
      stateJson: JSON.stringify(db),
      updatedAt: new Date().toISOString(),
      updatedBy: 'web_client',
    });
  } catch (err: any) {
    console.warn('Lỗi đồng bộ dữ liệu lên Firestore:', err);
    throw err;
  }
}
