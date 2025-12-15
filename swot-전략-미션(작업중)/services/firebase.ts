import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, onValue, Database, DatabaseReference } from 'firebase/database';
import { Room } from '../types';

// Firebase configuration - these will be replaced with environment variables
const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY || '',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
    databaseURL: process.env.FIREBASE_DATABASE_URL || '',
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.FIREBASE_APP_ID || ''
};

// Initialize Firebase
let app: ReturnType<typeof initializeApp> | null = null;
let database: Database | null = null;

const initFirebase = () => {
    if (!app && firebaseConfig.databaseURL) {
        try {
            app = initializeApp(firebaseConfig);
            database = getDatabase(app);
            console.log('Firebase initialized successfully');
        } catch (error) {
            console.error('Firebase initialization error:', error);
        }
    }
    return { app, database };
};

// Get rooms reference
const getRoomsRef = (): DatabaseReference | null => {
    const { database } = initFirebase();
    if (!database) return null;
    return ref(database, 'rooms');
};

// Save rooms to Firebase
export const saveRoomsToFirebase = async (rooms: Room[]): Promise<void> => {
    const roomsRef = getRoomsRef();
    if (roomsRef) {
        try {
            await set(roomsRef, rooms);
        } catch (error) {
            console.error('Error saving to Firebase:', error);
            // Fallback to localStorage
            localStorage.setItem('swot_game_rooms', JSON.stringify(rooms));
        }
    } else {
        // Fallback to localStorage if Firebase not configured
        localStorage.setItem('swot_game_rooms', JSON.stringify(rooms));
        window.dispatchEvent(new Event('storage'));
    }
};

// Get rooms from Firebase (one-time fetch)
export const getRoomsFromFirebase = async (): Promise<Room[]> => {
    const roomsRef = getRoomsRef();
    if (roomsRef) {
        try {
            const snapshot = await get(roomsRef);
            if (snapshot.exists()) {
                return snapshot.val() as Room[];
            }
            return [];
        } catch (error) {
            console.error('Error reading from Firebase:', error);
            // Fallback to localStorage
            const data = localStorage.getItem('swot_game_rooms');
            return data ? JSON.parse(data) : [];
        }
    } else {
        // Fallback to localStorage
        const data = localStorage.getItem('swot_game_rooms');
        return data ? JSON.parse(data) : [];
    }
};

// Subscribe to real-time updates
export const subscribeToRooms = (callback: (rooms: Room[]) => void): (() => void) => {
    const roomsRef = getRoomsRef();

    if (roomsRef) {
        const unsubscribe = onValue(roomsRef, (snapshot) => {
            if (snapshot.exists()) {
                callback(snapshot.val() as Room[]);
            } else {
                callback([]);
            }
        }, (error) => {
            console.error('Firebase subscription error:', error);
            // Fallback: use localStorage with polling
            const data = localStorage.getItem('swot_game_rooms');
            callback(data ? JSON.parse(data) : []);
        });

        return unsubscribe;
    } else {
        // Fallback: localStorage with storage event
        const handleStorage = () => {
            const data = localStorage.getItem('swot_game_rooms');
            callback(data ? JSON.parse(data) : []);
        };

        // Initial load
        handleStorage();

        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }
};

// Check if Firebase is configured
export const isFirebaseConfigured = (): boolean => {
    return Boolean(firebaseConfig.databaseURL);
};

export { initFirebase };
