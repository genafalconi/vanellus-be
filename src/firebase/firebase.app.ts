import firebase from 'firebase-admin';
import { firebaseAdminConfig } from './firebaseAdmin';
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { firebaseClientConfig } from './firebaseAdmin';

// Server
export const firebaseApp: firebase.app.App = firebase.initializeApp({
  credential: firebase.credential.cert(
    JSON.parse(JSON.stringify(firebaseAdminConfig)),
  ),
});
export const firebaseAuth: firebase.auth.Auth = firebaseApp.auth();
export const firebaseFirestore: firebase.firestore.Firestore =
  firebaseApp.firestore();

// Client
export const firebaseClientApp: FirebaseApp =
  initializeApp(firebaseClientConfig);
export const firebaseClientAuth = getAuth(firebaseClientApp);
