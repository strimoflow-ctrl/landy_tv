// Landy TV Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyBC_EvTsMlad61GfcNGZaQb927k5FAQ0u0",
    authDomain: "landytv-27da4.firebaseapp.com",
    databaseURL: "https://landytv-27da4-default-rtdb.firebaseio.com",
    projectId: "landytv-27da4",
    storageBucket: "landytv-27da4.firebasestorage.app",
    messagingSenderId: "764869287968",
    appId: "1:764869287968:web:3722e4f83ea234052c9c45"
};

// Initialize Firebase
if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    const db = firebase.database();
}
