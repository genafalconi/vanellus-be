import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

export const firebaseAdminConfig = {
  type: process.env.TYPE,
  project_id: process.env.PROJECT_ID,
  private_key_id: process.env.PRIVATE_KEY_ID,
  private_key: process.env.PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.CLIENT_EMAIL,
  client_id: process.env.CLIENT_ID,
  auth_uri: process.env.AUTH_URI,
  token_uri: process.env.TOKEN_URI,
  auth_provider_x509_cert_url: process.env.AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.CLIENT_X509_CERT_URL,
  universe_domain: process.env.UNIVERSE_DOMAIN,
};

export const firebaseClientConfig = {
  apiKey: process.env.CLIENT_API_KEY,
  authDomain: process.env.CLIENT_AUTH_DOMAIN,
  projectId: process.env.CLIENT_PROJECT_ID,
  storageBucket: process.env.CLIENT_STORAGE_BUCKET,
  messagingSenderId: process.env.CLIENT_MESSAGING_SENDER_ID,
  appId: process.env.CLIENT_APP_ID,
  measurementId: process.env.CLIENT_MEASUREMENT_ID,
};
