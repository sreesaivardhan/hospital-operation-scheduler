const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const fs = require('fs');

async function testRules() {
    console.log("Starting test...");
    let testEnv = await initializeTestEnvironment({
        projectId: 'hospital-scheduler-2025',
        firestore: {
            rules: fs.readFileSync('firestore.rules', 'utf8'),
            host: '127.0.0.1',
            port: 8081,
        },
    });

    const aliceAuth = {
        sub: 'alice123',
        email: 'alice@example.com',
        email_verified: false
    };

    const aliceContext = testEnv.authenticatedContext('alice123', aliceAuth);
    const db = aliceContext.firestore();

    const payload = {
        uid: 'alice123',
        email: 'alice@example.com',
        fullName: 'Alice Smith',
        phone: '',
        department: '',
        role: 'patient',
        bio: '',
        isActive: true,
        createdAt: require('firebase/compat/app').default.firestore.FieldValue.serverTimestamp(),
        updatedAt: require('firebase/compat/app').default.firestore.FieldValue.serverTimestamp(),
        emailVerified: false,
        lastLogin: null,
        loginHistory: []
    };

    console.log("Attempting to write to Firestore with payload:", Object.keys(payload));
    
    try {
        await assertSucceeds(db.collection('users').doc('alice123').set(payload));
        console.log("SUCCESS! The rule evaluates to TRUE.");
    } catch (e) {
        console.error("FAILED! Rule rejects the write. Error:", e.message);
    }
    
    console.log("Cleaning up...");
    await testEnv.cleanup();
    process.exit(0);
}
testRules();
