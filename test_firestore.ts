import { initializeApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';
import config from './firebase-applet-config.json';
const app = initializeApp(config);
const db = initializeFirestore(app, { experimentalForceLongPolling: true }, config.firestoreDatabaseId);
console.log('Firebase initialized!', db.type);
