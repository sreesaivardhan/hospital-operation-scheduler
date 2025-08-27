# Hospital Operation Scheduler - System Architecture

## 1. System Overview
Web-based hospital operation theater scheduling system using Firebase backend.

## 2. Technology Stack
- **Frontend:** HTML5, CSS3, Vanilla JavaScript
- **Backend:** Firebase (Authentication, Firestore, Storage)
- **Database:** Cloud Firestore (NoSQL)
- **Authentication:** Firebase Auth
- **Hosting:** Firebase Hosting
- **Version Control:** Git/GitHub

## 3. Firebase Architecture

### 3.1 Firebase Services Used
- **Authentication:** User login/registration
- **Firestore:** Real-time database for all data
- **Storage:** File uploads (surgical reports, documents)
- **Hosting:** Web app deployment

### 3.2 Firestore Database Structure
hospital-scheduler/
├── doctors/
│   └── {doctorId}
│       ├── name: string
│       ├── specialty: string
│       ├── phone: string
│       ├── email: string
│       └── createdAt: timestamp
├── patients/
│   └── {patientId}
│       ├── name: string
│       ├── age: number
│       ├── phone: string
│       ├── medicalHistory: string
│       └── createdAt: timestamp
├── operationTheaters/
│   └── {otId}
│       ├── otNumber: string
│       ├── capacity: number
│       ├── equipment: string
│       └── status: string
└── operations/
└── {operationId}
├── patientId: reference
├── doctorId: reference
├── otId: reference
├── operationType: string
├── scheduledDate: string
├── scheduledTime: string
├── status: string
└── createdAt: timestamp

## 4. System Modules

### 4.1 Authentication Module (`auth/`)
- User registration and login
- Role-based access (Admin/User)
- Session management
- Password reset functionality

### 4.2 Admin Module (`admin/`)
- Doctor management (CRUD)
- Patient management (CRUD) 
- Operation scheduling
- Analytics dashboard
- System reports

### 4.3 User Module (`user/`)
- View personal schedule
- View doctor information
- Access operation details
- Profile management

### 4.4 Scheduler Module (`scheduler/`)
- OT availability checking
- Operation scheduling interface
- Schedule conflict resolution
- Real-time updates

## 5. Security Rules (Firestore)
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Admin can access all collections
    match /{document=**} {
      allow read, write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Regular users can read doctors and their operations
    match /doctors/{doctorId} {
      allow read: if request.auth != null;
    }
    
    match /operations/{operationId} {
      allow read: if request.auth != null;
    }
  }
}
```

## 6. API Functions (Firebase Functions - Future)

- Email notifications for operations
- Automated schedule reminders
- Report generation
- Data backup routines

# Hospital Operation Scheduler - Wireframes

## 1. Login Page
┌─────────────────────────────────┐
│    🏥 HOSPITAL SCHEDULER        │
├─────────────────────────────────┤
│                                 │
│    ┌─────────────────────────┐   │
│    │  📧 Email               │   │
│    │  []  │   │
│    │                        │   │
│    │  🔒 Password           │   │
│    │  []  │   │
│    │                        │   │
│    │  [    LOGIN    ]       │   │
│    │                        │   │
│    │  Don't have account?   │   │
│    │  [Register Here]       │   │
│    └─────────────────────────┘   │
│                                 │
└─────────────────────────────────┘

## 2. Admin Dashboard
┌─────────────────────────────────────────────────────────┐
│ 🏥 Hospital Scheduler    [Profile] [Logout]           │
├─────────────────────────────────────────────────────────┤
│ [👨‍⚕️Doctors] [👤Patients] [🏥OT Schedule] [📊Reports] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│ │👨‍⚕️      │ │👤       │ │🏥       │ │📋       │        │
│ │Doctors  │ │Patients │ │OT Rooms │ │Operations│       │
│ │   25    │ │   150   │ │    5    │ │    12    │       │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘        │
│                                                         │
│ Today's Operations                                      │
│ ┌─────────────────────────────────────────────────────┐ │
│ │Time │Patient    │Doctor      │OT  │Type    │Status │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │09:00│Alice J.   │Dr. Smith   │OT-1│Cardiac │Active │ │
│ │11:00│Bob K.     │Dr. Johnson │OT-2│Neuro   │Pending│ │
│ │14:00│Carol M.   │Dr. Wilson  │OT-1│General │Wait   │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘

## 3. Doctor Management
┌─────────────────────────────────────────────────────────┐
│ 🏥 Hospital Scheduler > Doctor Management               │
├─────────────────────────────────────────────────────────┤
│ [➕ Add New Doctor]              [🔍 Search: _______]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Doctors List                                            │
│ ┌─────────────────────────────────────────────────────┐ │
│ │Name         │Specialty    │Phone      │Actions      │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │Dr. Smith    │Cardiology   │123-456789 │[✏️][🗑️]    │ │
│ │Dr. Johnson  │Neurosurgery │123-456790 │[✏️][🗑️]    │ │
│ │Dr. Wilson   │General      │123-456791 │[✏️][🗑️]    │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘

## 4. OT Scheduler
┌─────────────────────────────────────────────────────────┐
│ 🏥 Hospital Scheduler > OT Scheduler                    │
├─────────────────────────────────────────────────────────┤
│ Date: [📅 2025-07-28] [Previous Day] [Next Day]        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ┌─────────┬─────────┬─────────┬─────────┬─────────┐     │
│ │Time     │OT-001   │OT-002   │OT-003   │OT-004   │     │
│ ├─────────┼─────────┼─────────┼─────────┼─────────┤     │
│ │08:00-10:00│Cardiac│  FREE   │Neuro   │  FREE   │     │
│ │         │Dr.Smith │         │Dr.Johnson│        │     │
│ ├─────────┼─────────┼─────────┼─────────┼─────────┤     │
│ │10:00-12:00│  FREE │General  │  FREE   │Cardiac  │     │
│ │         │         │Dr.Wilson│         │Dr.Smith │     │
│ ├─────────┼─────────┼─────────┼─────────┼─────────┤     │
│ │14:00-16:00│  FREE │  FREE   │Emergency│  FREE   │     │
│ │         │         │         │Dr.Johnson│        │     │
│ └─────────┴─────────┴─────────┴─────────┴─────────┘     │
│                                                         │
│ [➕ Schedule New Operation]                             │
└─────────────────────────────────────────────────────────┘