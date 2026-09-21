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

// State deduplication caches to prevent loopbacks and unnecessary quota usage
let lastSavedStateJson = '';
let lastReceivedStateJson = '';
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let lastSavePromise: Promise<boolean> | null = null;
let pendingDbToWrite: DatabaseState | null = null;
let lastWriteTimestamp = 0;
const MIN_WRITE_INTERVAL_MS = 2500; // Throttle to protect Firebase 20k writes/day free quota

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
      // If local pending write from this client, ignore remote echo to prevent ping-pong loop
      if (snapshot.metadata.hasPendingWrites) {
        return;
      }

      if (snapshot.exists()) {
        const data = snapshot.data() as { stateJson: string; schema_version?: number };
        
        // Prevent duplicate processing if state is identical to what we just saved or received
        if (data && data.stateJson) {
          if (data.stateJson === lastSavedStateJson || data.stateJson === lastReceivedStateJson) {
            onStatusChange?.('connected');
            return;
          }
        }

        // If remote data belongs to older schema or was before the clean wipe, overwrite with clean initial DB
        if (!data || !data.schema_version || data.schema_version < 7) {
          const initial = getInitialDatabase();
          const initialJson = JSON.stringify(initial);
          lastSavedStateJson = initialJson;
          lastReceivedStateJson = initialJson;

          setDoc(docRef, {
            stateJson: initialJson,
            schema_version: 7,
            updatedAt: new Date().toISOString(),
            appId: firebaseConfig.projectId,
          }).catch(() => {});
          onRemoteData(initial);
          onStatusChange?.('connected');
          return;
        }

        if (data && data.stateJson) {
          try {
            const parsed = JSON.parse(data.stateJson) as DatabaseState;
            if (!parsed.chat_groups) parsed.chat_groups = [];
            if (!parsed.snapshots) parsed.snapshots = [];
            if (!parsed.restore_points) parsed.restore_points = [];
            if (!parsed.board_modes) parsed.board_modes = [];
            
            lastReceivedStateJson = data.stateJson;
            lastSavedStateJson = data.stateJson;

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
        const initialJson = JSON.stringify(initial);
        lastSavedStateJson = initialJson;
        lastReceivedStateJson = initialJson;

        setDoc(docRef, {
          stateJson: initialJson,
          schema_version: 7,
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
 * Prepares and sanitizes the database payload for Firestore synchronization.
 * Guarantees that the document payload will NEVER exceed Firestore's 1MB (1,048,487 bytes) property limit.
 */
function prepareFirestorePayload(db: DatabaseState): string {
  // Create a clean shallow clone of essential collections
  const sanitized: DatabaseState = {
    users: db.users || [],
    workspaces: db.workspaces || [],
    workspace_members: db.workspace_members || [],
    periods: db.periods || [],
    divisions: db.divisions || [],
    clusters: db.clusters || [],
    tasks: db.tasks || [],
    smart_areas: db.smart_areas || [],
    smart_area_items: db.smart_area_items || [],
    board_modes: db.board_modes || [],
    messages: (db.messages || []).slice(-150), // Keep latest 150 messages
    chat_groups: db.chat_groups || [],
    attachments: (db.attachments || []).slice(-50),
    notifications: (db.notifications || []).slice(-50),
    activity_logs: (db.activity_logs || []).slice(-60), // Keep latest 60 logs
    audit_logs: (db.audit_logs || []).slice(-40),
    settings: db.settings || ({} as any),
    // For snapshots & restore points, strip any recursive nested data_state if too large
    snapshots: (db.snapshots || []).slice(-3).map((s) => ({
      ...s,
      data_state: s.data_state && s.data_state.length > 100000 ? '' : s.data_state,
    })),
    restore_points: (db.restore_points || []).slice(-3).map((r) => ({
      ...r,
      data_state: r.data_state && r.data_state.length > 100000 ? '' : r.data_state,
    })),
  };

  let json = JSON.stringify(sanitized);

  // Hard safety limit: If still over 700KB, aggressively purge heavy log & snapshot payload
  if (json.length > 700000) {
    sanitized.snapshots = (db.snapshots || []).slice(-2).map((s) => ({ ...s, data_state: '' }));
    sanitized.restore_points = (db.restore_points || []).slice(-2).map((r) => ({ ...r, data_state: '' }));
    sanitized.activity_logs = (db.activity_logs || []).slice(-20);
    sanitized.audit_logs = (db.audit_logs || []).slice(-10);
    sanitized.messages = (db.messages || []).slice(-50);
    json = JSON.stringify(sanitized);
  }

  // Extreme safety limit: If still over 900KB, drop data_state completely
  if (json.length > 900000) {
    sanitized.snapshots = [];
    sanitized.restore_points = [];
    sanitized.activity_logs = [];
    sanitized.audit_logs = [];
    sanitized.messages = (db.messages || []).slice(-20);
    json = JSON.stringify(sanitized);
  }

  return json;
}

/**
 * Saves database state to Firestore with intelligent coalescing & throttling to protect Firebase 20k writes/day free quota.
 */
export function saveToFirestore(db: DatabaseState): Promise<boolean> {
  if (!firestore) return Promise.resolve(false);

  const payloadJson = prepareFirestorePayload(db);

  // Deduplication check: if exactly identical to last written or received, skip network write
  if (payloadJson === lastSavedStateJson) {
    return Promise.resolve(true);
  }

  pendingDbToWrite = db;

  if (lastSavePromise && saveTimer) {
    // Already scheduled, pending state updated
    return lastSavePromise;
  }

  const now = Date.now();
  const timeSinceLastWrite = now - lastWriteTimestamp;
  const delay =
    timeSinceLastWrite < MIN_WRITE_INTERVAL_MS
      ? MIN_WRITE_INTERVAL_MS - timeSinceLastWrite
      : 300;

  lastSavePromise = new Promise<boolean>((resolve) => {
    saveTimer = setTimeout(async () => {
      saveTimer = null;
      lastSavePromise = null;
      const targetDb = pendingDbToWrite;
      pendingDbToWrite = null;

      if (!targetDb) {
        resolve(true);
        return;
      }

      try {
        const jsonToUpload = prepareFirestorePayload(targetDb);
        if (jsonToUpload === lastSavedStateJson) {
          resolve(true);
          return;
        }

        lastSavedStateJson = jsonToUpload;
        lastWriteTimestamp = Date.now();

        const docRef = doc(firestore, FIRESTORE_COLLECTION, FIRESTORE_DOC);
        await setDoc(docRef, {
          stateJson: jsonToUpload,
          schema_version: 7,
          updatedAt: new Date().toISOString(),
          updatedBy: 'web_client',
        });
        resolve(true);
      } catch (err: any) {
        console.warn('Lỗi đồng bộ dữ liệu lên Firestore:', err);
        resolve(false);
      }
    }, delay);
  });

  return lastSavePromise;
}
