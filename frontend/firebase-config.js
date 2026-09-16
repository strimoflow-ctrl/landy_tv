// Landy TV Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDRWDNd9ybc6RVg0fMGrplt7xZA_HEmrB8",
    authDomain: "anime-net-a89c9.firebaseapp.com",
    databaseURL: "https://anime-net-a89c9-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "anime-net-a89c9",
    storageBucket: "anime-net-a89c9.firebasestorage.app",
    messagingSenderId: "124019902909",
    appId: "1:124019902909:web:0268a3be96e40c8dcb2ad4"
};

// Initialize Firebase
if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    const db = firebase.database();
}
