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

// Safe localStorage access (some browsers block it)
const safeLocalStorageGet = (key: string): string | null => {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
};

const safeLocalStorageSet = (key: string, value: string): void => {
    try {
        localStorage.setItem(key, value);
    } catch {
        console.warn('localStorage not available');
    }
};

// Convert Firebase data to Room array
// Firebase can return object with numeric keys instead of array
const toArray = <T>(data: unknown): T[] => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (typeof data === 'object') {
        // Convert object with keys to array
        return Object.values(data as Record<string, T>).filter(Boolean);
    }
    return [];
};

// Remove undefined values from object (Firebase doesn't accept undefined)
const removeUndefined = (obj: any): any => {
    if (obj === null || obj === undefined) return null;
    if (Array.isArray(obj)) {
        return obj.map(removeUndefined);
    }
    if (typeof obj === 'object') {
        const cleaned: any = {};
        for (const key of Object.keys(obj)) {
            const value = obj[key];
            if (value !== undefined) {
                cleaned[key] = removeUndefined(value);
            }
        }
        return cleaned;
    }
    return obj;
};

// Normalize Room data from Firebase (convert nested objects to arrays)
const normalizeRoom = (room: any): Room => {
    if (!room) return room;

    // Explicitly preserve all critical room fields to ensure sync works correctly
    return {
        id: room.id,
        name: room.name,
        totalTeams: room.totalTeams,
        currentRound: room.currentRound || 1,
        status: room.status || 'PREPARING', // Critical: must explicitly preserve status
        feedback: room.feedback,
        winnerPhotoUrls: room.winnerPhotoUrls,
        winnerPosterUrl: room.winnerPosterUrl,
        teams: toArray(room.teams).map((team: any) => ({
            id: team.id,
            name: team.name,
            roomId: team.roomId,
            isReady: team.isReady || false,
            score: team.score || 0,
            winnings: team.winnings || 0,
            members: toArray(team.members),
            strategy: toArray(team.strategy)
        })),
        matches: toArray(room.matches).map((match: any) => ({
            id: match.id,
            teamAId: match.teamAId || '',
            teamBId: match.teamBId || '',
            teamAScore: match.teamAScore || 0,
            teamBScore: match.teamBScore || 0,
            currentRound: match.currentRound || 1,
            roundStatus: match.roundStatus || 'READY',
            turnOwner: match.turnOwner,
            pot: match.pot || 0,
            carryOver: match.carryOver || 0,
            history: toArray(match.history),
            aiHelps: match.aiHelps || {},
            aiAdvice: match.aiAdvice || {},
            winnerId: match.winnerId,
            // Round result synchronization fields
            lastRoundResult: match.lastRoundResult || undefined,
            resultConfirmed: match.resultConfirmed || {},
            lastAction: match.lastAction || undefined
        }))
    };
};

const toRoomArray = (data: unknown): Room[] => {
    const rooms = toArray<any>(data);
    return rooms.map(normalizeRoom).filter(Boolean);
};

// Save rooms to Firebase
export const saveRoomsToFirebase = async (rooms: Room[]): Promise<void> => {
    const roomsRef = getRoomsRef();
    if (roomsRef) {
        try {
            // Save as object with room IDs as keys for better Firebase compatibility
            // Remove undefined values as Firebase doesn't accept them
            const roomsObject: Record<string, any> = {};
            rooms.forEach(room => {
                roomsObject[room.id] = removeUndefined(room);
            });
            await set(roomsRef, roomsObject);
        } catch (error) {
            console.error('Error saving to Firebase:', error);
            // Fallback to localStorage
            safeLocalStorageSet('swot_game_rooms', JSON.stringify(rooms));
        }
    } else {
        // Fallback to localStorage if Firebase not configured
        safeLocalStorageSet('swot_game_rooms', JSON.stringify(rooms));
        try {
            window.dispatchEvent(new Event('storage'));
        } catch {
            // Ignore dispatch errors
        }
    }
};

// Get rooms from Firebase (one-time fetch)
export const getRoomsFromFirebase = async (): Promise<Room[]> => {
    const roomsRef = getRoomsRef();
    if (roomsRef) {
        try {
            const snapshot = await get(roomsRef);
            if (snapshot.exists()) {
                return toRoomArray(snapshot.val());
            }
            return [];
        } catch (error) {
            console.error('Error reading from Firebase:', error);
            // Fallback to localStorage
            const data = safeLocalStorageGet('swot_game_rooms');
            return data ? JSON.parse(data) : [];
        }
    } else {
        // Fallback to localStorage
        const data = safeLocalStorageGet('swot_game_rooms');
        return data ? JSON.parse(data) : [];
    }
};

// Subscribe to real-time updates
export const subscribeToRooms = (callback: (rooms: Room[]) => void): (() => void) => {
    const roomsRef = getRoomsRef();

    if (roomsRef) {
        const unsubscribe = onValue(roomsRef, (snapshot) => {
            if (snapshot.exists()) {
                const rooms = toRoomArray(snapshot.val());
                callback(rooms);
            } else {
                callback([]);
            }
        }, (error) => {
            console.error('Firebase subscription error:', error);
            // Fallback: use localStorage
            const data = safeLocalStorageGet('swot_game_rooms');
            callback(data ? JSON.parse(data) : []);
        });

        return unsubscribe;
    } else {
        // Fallback: localStorage with storage event
        const handleStorage = () => {
            const data = safeLocalStorageGet('swot_game_rooms');
            callback(data ? JSON.parse(data) : []);
        };

        // Initial load
        handleStorage();

        try {
            window.addEventListener('storage', handleStorage);
            return () => window.removeEventListener('storage', handleStorage);
        } catch {
            return () => {};
        }
    }
};

// Check if Firebase is configured
export const isFirebaseConfigured = (): boolean => {
    return Boolean(firebaseConfig.databaseURL);
};

export { initFirebase };
