export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api/v1',
  wsUrl: 'http://localhost:3000',
  // Cloudinary: Create free account at https://cloudinary.com/users/register/free
  // Get cloud name from dashboard, create unsigned upload preset in Settings > Upload
  cloudinaryCloudName: 'duymwzfhj',
  cloudinaryPreset: 'uploads', // Create unsigned preset in Cloudinary dashboard
  firebase: {
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "YOUR_FIREBASE_AUTH_DOMAIN",
    projectId: "YOUR_FIREBASE_PROJECT_ID",
    storageBucket: "YOUR_FIREBASE_STORAGE_BUCKET",
    messagingSenderId: "YOUR_FIREBASE_MESSAGING_SENDER_ID",
    appId: "YOUR_FIREBASE_APP_ID",
    vapidKey: "YOUR_FIREBASE_VAPID_KEY"
  }
};
