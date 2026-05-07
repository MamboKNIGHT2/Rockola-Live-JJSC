// ⚠️ Reemplaza con los datos de tu proyecto Firebase
const firebaseConfig = {
    apiKey: "AIzaSy...",
    authDomain: "tudominio.firebaseapp.com",
    databaseURL: "https://tudominio-default-rtdb.firebaseio.com",
    projectId: "tuprojectid",
    storageBucket: "tuprojectid.appspot.com",
    messagingSenderId: "123456",
    appId: "1:123456:web:abc..."
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
