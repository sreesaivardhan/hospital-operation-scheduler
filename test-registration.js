const firebase = require('firebase/compat/app');
require('firebase/compat/auth');
require('firebase/compat/firestore');

const firebaseConfig = {
    apiKey: 'fake-api-key',
    authDomain: '127.0.0.1',
    projectId: 'hospital-scheduler-2025',
    storageBucket: 'hospital-scheduler-2025.appspot.com',
    messagingSenderId: '123456789',
    appId: '1:123456789:web:abcdef'
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

auth.useEmulator('http://127.0.0.1:9099');
db.useEmulator('127.0.0.1', 8080); // Firestore emulator port

async function testReg() {
    try {
        console.log('1. Calling createUser...');
        const cred = await auth.createUserWithEmailAndPassword('test'+Date.now()+'@example.com', 'password123');
        console.log('2. User created:', cred.user.uid, cred.user.email);
        
        console.log('3. Token Email Verification Status:', cred.user.emailVerified);
        const token = await cred.user.getIdTokenResult();
        console.log('4. Token claims email:', token.claims.email);
        
        const payload = {
            uid: cred.user.uid,
            email: cred.user.email,
            fullName: 'Test User',
            phone: '',
            department: '',
            role: 'patient',
            bio: '',
            isActive: true,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            emailVerified: false,
            lastLogin: null,
            loginHistory: []
        };
        console.log('5. Attempting Firestore Write with keys:', Object.keys(payload));
        
        await db.collection('users').doc(cred.user.uid).set(payload);
        console.log('6. Firestore write SUCCESS!');
    } catch (e) {
        console.error('ERROR:', e.message);
    }
    process.exit(0);
}
testReg();
