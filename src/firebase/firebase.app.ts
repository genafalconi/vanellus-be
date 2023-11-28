import firebase from 'firebase-admin';
import { firebaseAdminConfig } from './firebaseAdmin';

export const firebaseApp: firebase.app.App = firebase.initializeApp({
  credential: firebase.credential.cert(
    JSON.parse(JSON.stringify(firebaseAdminConfig)),
  ),
});
export const firebaseAuth: firebase.auth.Auth = firebaseApp.auth();
export const firebaseFirestore: firebase.firestore.Firestore =
  firebaseApp.firestore();
