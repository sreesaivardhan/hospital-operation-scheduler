// addData.js using Firebase Admin SDK
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 👨‍⚕️ Add User
async function addUser() {
  const user = {
    uid: "user-001",
    email: "dr.john@hospital.com",
    fullName: "Dr. John Smith",
    role: "admin",
    hospitalId: "HSP001",
    department: "Surgery",
    phone: "+1234567890",
    isActive: true,
    profilePicture: "https://example.com/profile.jpg",
    preferences: {
      notifications: true,
      emailUpdates: true,
      theme: "light",
    },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    lastLogin: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.collection("users").doc(user.uid).set(user);
  console.log("✅ User added!");
}

// 💉 Add Operation
async function addOperation() {
  const operation = {
    patientId: "patient-001",
    doctorId: "user-001",
    operationType: "Cardiac Surgery",
    scheduledDate: new Date("2025-08-10T10:00:00"),
    duration: 180,
    operationTheater: "OT-1",
    status: "scheduled",
    priority: "high",
    notes: "Use special instruments",
    assignedStaff: ["nurse-001", "anesth-001"],
    createdBy: "user-001",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.collection("operations").add(operation);
  console.log("✅ Operation added!");
}

addUser().then(() => addOperation());
