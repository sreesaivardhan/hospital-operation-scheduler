const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const testUsers = [
  {
    email: "admin@testhospital.com",
    password: "Admin123!",
    role: "admin",
    hospitalId: "HSP001"
  },
  {
    email: "doctor@testhospital.com",
    password: "Doctor123!",
    role: "user",
    hospitalId: "HSP002"
  },
];

async function createTestUsers() {
  for (const user of testUsers) {
    try {
      const userRecord = await admin.auth().createUser({
        email: user.email,
        password: user.password,
      });

      await admin.firestore().collection("users").doc(userRecord.uid).set({
        email: user.email,
        role: user.role,
        hospitalId: user.hospitalId,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`✅ Created user: ${user.email}`);
    } catch (error) {
      console.error(`❌ Failed to create ${user.email}:`, error.message);
    }
  }
}

createTestUsers();
