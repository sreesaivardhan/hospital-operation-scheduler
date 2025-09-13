# Hospital Operation Scheduler 🏥

A comprehensive web-based operation theater scheduling system for hospital management, built with modern web technologies and Firebase backend.

## 📋 Table of Contents
- [Project Overview](#-project-overview)
- [Features](#-features)
- [Technologies Used](#-technologies-used)
- [Prerequisites](#-prerequisites)
- [Installation & Setup](#-installation--setup)
- [Firebase Configuration](#-firebase-configuration)
- [Running the Application](#-running-the-application)
- [Testing the Application](#-testing-the-application)
- [Project Structure](#-project-structure)
- [User Roles & Permissions](#-user-roles--permissions)
- [Deployment](#-deployment)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)

## 🏥 Project Overview

This system helps hospitals efficiently manage operation theater schedules, doctor assignments, patient information, and resource allocation through an intuitive web interface. The application supports multiple user roles with different access levels and provides real-time data synchronization.

## ✨ Features

### 🔐 Authentication System
- Secure user registration and login
- Role-based access control (Admin, User, Super Admin)
- Password reset functionality
- Email verification
- Session management with auto-logout

### 👨‍⚕️ Admin Module
- **Doctor Management:** Complete CRUD operations for doctor profiles
- **Patient Management:** Patient registration, medical history, and status tracking
- **User Management:** Healthcare staff management and role assignments
- **Operation Theater Scheduling:** Dynamic OT assignment and scheduling
- **Resource Allocation:** Equipment and staff resource tracking
- **Analytics Dashboard:** Comprehensive reporting and insights
- **Audit Logs:** System activity tracking and monitoring

### 👤 User Module
- **Dashboard Overview:** Personal assignments and schedule view
- **Doctor Information:** Access to doctor profiles and specializations
- **Schedule Management:** View and update personal availability
- **Assignment Tracking:** Current and upcoming assignments
- **Profile Management:** Update personal information and preferences

### 🏥 Core Scheduling Features
- **Dynamic OT Assignment:** Intelligent room allocation based on availability
- **Multi-role Scheduling:** Surgeons, anesthesiologists, and nursing staff
- **Surgery Type Management:** Different operation categories and requirements
- **Emergency Scheduling:** Priority-based emergency operation handling
- **Schedule Modifications:** Real-time updates and conflict resolution
- **Calendar Integration:** Visual schedule management with date navigation

## 🚀 Technologies Used

- **Frontend:** HTML5, CSS3, JavaScript (ES6+)
- **Backend:** Firebase (Authentication, Firestore, Cloud Functions)
- **Database:** Firebase Firestore (NoSQL)
- **Authentication:** Firebase Authentication
- **Hosting:** Firebase Hosting
- **Version Control:** Git/GitHub
- **Package Manager:** npm
- **CSS Framework:** Custom CSS with responsive design
- **Icons:** Font Awesome 6.4.0

## 📋 Prerequisites

Before setting up the project, ensure you have the following installed:

### Required Software
- **Node.js** (v14.0.0 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js) or **yarn**
- **Git** - [Download here](https://git-scm.com/)
- **Modern Web Browser** (Chrome, Firefox, Safari, Edge)

### Required Accounts
- **Firebase Account** - [Create here](https://firebase.google.com/)
- **Google Cloud Account** (automatically created with Firebase)

### System Requirements
- **Operating System:** Windows 10/11, macOS 10.14+, or Linux
- **RAM:** Minimum 4GB (8GB recommended)
- **Storage:** At least 500MB free space
- **Internet Connection:** Required for Firebase services

## 🛠️ Installation & Setup

### Step 1: Clone the Repository
```bash
git clone https://github.com/YOUR_USERNAME/hospital-operation-scheduler.git
cd hospital-operation-scheduler
```

### Step 2: Install Dependencies
```bash
# Install main project dependencies
npm install

# Install Firebase CLI globally (if not already installed)
npm install -g firebase-tools

# Navigate to firebase-user-setup directory and install its dependencies
cd firebase-user-setup
npm install
cd ..
```

### Step 3: Verify Installation
```bash
# Check Node.js version
node --version

# Check npm version
npm --version

# Check Firebase CLI version
firebase --version
```

## 🔥 Firebase Configuration

### Step 1: Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" or "Add project"
3. Enter project name: `hospital-scheduler-2025` (or your preferred name)
4. Enable Google Analytics (optional but recommended)
5. Choose or create a Google Analytics account
6. Click "Create project"

### Step 2: Enable Firebase Services
1. **Authentication:**
   - Go to Authentication > Sign-in method
   - Enable "Email/Password" provider
   - Enable "Email link (passwordless sign-in)" if desired
   - Save changes

2. **Firestore Database:**
   - Go to Firestore Database
   - Click "Create database"
   - Choose "Start in test mode" (for development)
   - Select a location (choose closest to your users)
   - Click "Done"

3. **Firebase Hosting:**
   - Go to Hosting
   - Click "Get started"
   - Follow the setup instructions (we'll configure this later)

### Step 3: Get Firebase Configuration
1. Go to Project Settings (gear icon)
2. Scroll down to "Your apps" section
3. Click "Add app" and select "Web" (</> icon)
4. Register your app with nickname: "Hospital Scheduler Web"
5. Copy the Firebase configuration object

### Step 4: Configure Environment Variables
1. Create a `.env` file in the `src` directory:
```bash
# Create .env file
touch src/.env
```

2. Add your Firebase configuration to `src/.env`:
```env
# Firebase Configuration
FIREBASE_API_KEY=your_api_key_here
FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id
FIREBASE_MEASUREMENT_ID=your_measurement_id
```

3. Create `src/firebase-config.js`:
```javascript
// Firebase Configuration
const firebaseConfig = {
  apiKey: "your_api_key_here",
  authDomain: "your_project_id.firebaseapp.com",
  projectId: "your_project_id",
  storageBucket: "your_project_id.appspot.com",
  messagingSenderId: "your_sender_id",
  appId: "your_app_id",
  measurementId: "your_measurement_id"
};

// Initialize Firebase
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
```

### Step 5: Set Up Service Account (For Admin Functions)
1. Go to Project Settings > Service accounts
2. Click "Generate new private key"
3. Save the JSON file as `serviceAccountKey.json` in the project root
4. **⚠️ Important:** Never commit this file to version control

## 🚀 Running the Application

### Method 1: Using Firebase Hosting (Recommended)
```bash
# Login to Firebase (if not already logged in)
firebase login

# Initialize Firebase in your project (if not already done)
firebase init

# Select the following services:
# - Hosting
# - Firestore (if you want to set up security rules)

# Configure hosting:
# - Public directory: src
# - Single-page app: Yes
# - Automatic builds and deploys with GitHub: No (for now)

# Serve the application locally
firebase serve
```

The application will be available at: `http://localhost:5000`

### Method 2: Using Live Server (Alternative)
If you have VS Code with Live Server extension:
1. Open the project in VS Code
2. Right-click on `src/index.html`
3. Select "Open with Live Server"
4. The application will open at: `http://127.0.0.1:5500/src/`

### Method 3: Using Python HTTP Server
```bash
# Navigate to src directory
cd src

# Python 3
python -m http.server 8000

# Python 2 (if Python 3 is not available)
python -m SimpleHTTPServer 8000
```

The application will be available at: `http://localhost:8000`

### Method 4: Using Node.js HTTP Server
```bash
# Install http-server globally
npm install -g http-server

# Navigate to src directory
cd src

# Start server
http-server -p 8000

# Or with specific configurations
http-server -p 8000 --cors -o
```

## 🧪 Testing the Application

### Step 1: Access the Application
1. Open your web browser
2. Navigate to the local server URL (e.g., `http://localhost:5000`)
3. You should see the login/registration page

### Step 2: Create Test Users
```bash
# Navigate to firebase-user-setup directory
cd firebase-user-setup

# Run the test user creation script
node createTestUsers.js
```

This will create the following test accounts:
- **Admin User:** admin@hospital.com (Password: admin123)
- **Doctor User:** doctor@hospital.com (Password: doctor123)
- **Nurse User:** nurse@hospital.com (Password: nurse123)

### Step 3: Test Core Functionality

#### Authentication Testing:
1. **Registration:**
   - Click "Need an account? Register here"
   - Fill in the registration form
   - Submit and verify email verification works

2. **Login:**
   - Use test credentials or your registered account
   - Verify successful login and dashboard access

3. **Password Reset:**
   - Click "Forgot Password?"
   - Enter email and verify reset email is sent

#### Admin Features Testing:
1. **Doctor Management:**
   - Login as admin user
   - Navigate to "Doctor Management"
   - Add a new doctor
   - Edit existing doctor information
   - Test search and filter functionality

2. **Patient Management:**
   - Navigate to "Patient Management"
   - Add a new patient
   - Edit patient information
   - Test patient search and filtering

3. **OT Scheduling:**
   - Navigate to "OT Schedule"
   - Create a new operation schedule
   - Assign doctors and rooms
   - Test date navigation

#### User Features Testing:
1. **Dashboard Access:**
   - Login as regular user
   - Verify appropriate menu items are visible
   - Check user-specific functionality

2. **Profile Management:**
   - Navigate to "Profile Settings"
   - Update profile information
   - Test availability updates

### Step 4: Database Verification
1. Go to Firebase Console > Firestore Database
2. Verify that collections are created:
   - `users` - User profiles and roles
   - `doctors` - Doctor information
   - `patients` - Patient records
   - `otRooms` - Operation theater rooms
   - `otSchedules` - Operation schedules
   - `auditLogs` - System activity logs

## 📁 Project Structure

```
hospital-operation-scheduler/
├── 📁 src/                          # Main application source
│   ├── 📄 index.html               # Main application entry point
│   ├── 📄 firebase-config.js       # Firebase configuration
│   ├── 📄 .env                     # Environment variables
│   ├── 📁 assets/                  # Static assets
│   │   ├── 📁 css/                 # Stylesheets
│   │   ├── 📁 js/                  # JavaScript modules
│   │   └── 📁 images/              # Image assets
│   ├── 📁 auth/                    # Authentication pages
│   │   ├── 📄 login.html           # Login page
│   │   ├── 📄 register.html        # Registration page
│   │   └── 📄 auth.js              # Authentication logic
│   ├── 📁 admin/                   # Admin-specific pages
│   │   ├── 📄 dashboard.html       # Admin dashboard
│   │   ├── 📄 doctor-management.html
│   │   └── 📄 admin.js             # Admin functionality
│   ├── 📁 user/                    # User-specific pages
│   ├── 📁 scheduler/               # Scheduling components
│   └── 📁 shared/                  # Shared components
├── 📁 firebase-user-setup/         # User setup utilities
│   ├── 📄 package.json
│   ├── 📄 createTestUsers.js       # Test user creation script
│   └── 📁 src/
├── 📁 functions/                   # Firebase Cloud Functions
├── 📁 public/                      # Public hosting files
├── 📄 firebase.json                # Firebase configuration
├── 📄 .firebaserc                  # Firebase project settings
├── 📄 package.json                 # Node.js dependencies
├── 📄 serviceAccountKey.json       # Firebase service account (not in repo)
└── 📄 README.md                    # This file
```

## 👥 User Roles & Permissions

### Super Admin
- **Full System Access:** Complete control over all features
- **User Management:** Create, modify, and delete user accounts
- **System Configuration:** Modify system settings and configurations
- **Audit Access:** View all system logs and activities
- **Data Export:** Export all system data

### Admin
- **Department Management:** Manage doctors, patients, and schedules
- **OT Scheduling:** Create and modify operation schedules
- **Resource Management:** Manage OT rooms and equipment
- **Analytics Access:** View department analytics and reports
- **User Oversight:** Manage users within their department

### User (Healthcare Professional)
- **Personal Dashboard:** View personal assignments and schedules
- **Profile Management:** Update personal information and availability
- **Schedule Viewing:** Access to relevant schedules and assignments
- **Basic Reporting:** Generate personal activity reports

## 🚀 Deployment

### Deploy to Firebase Hosting
```bash
# Build the project (if you have a build process)
npm run build

# Deploy to Firebase Hosting
firebase deploy --only hosting

# Deploy specific functions (if you have cloud functions)
firebase deploy --only functions

# Deploy everything
firebase deploy
```

### Deploy to Other Platforms

#### Netlify:
1. Connect your GitHub repository to Netlify
2. Set build command: `npm run build` (if applicable)
3. Set publish directory: `src`
4. Deploy

#### Vercel:
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

## 🔧 Troubleshooting

### Common Issues and Solutions

#### 1. Firebase Connection Issues
**Problem:** "Firebase not initialized" or connection errors
**Solutions:**
- Verify `firebase-config.js` has correct configuration
- Check if Firebase project is active
- Ensure internet connection is stable
- Verify Firebase services are enabled

#### 2. Authentication Problems
**Problem:** Login/registration not working
**Solutions:**
- Check Firebase Authentication is enabled
- Verify email/password provider is enabled
- Check browser console for detailed error messages
- Clear browser cache and cookies

#### 3. Database Permission Errors
**Problem:** "Permission denied" when accessing Firestore
**Solutions:**
- Check Firestore security rules
- Verify user authentication status
- Ensure user has proper role assignments
- Review Firebase console for rule violations

#### 4. Local Server Issues
**Problem:** Application not loading locally
**Solutions:**
- Verify correct port is being used
- Check if another application is using the same port
- Try different server methods (Firebase serve, Live Server, etc.)
- Check browser console for JavaScript errors

#### 5. Missing Dependencies
**Problem:** "Module not found" errors
**Solutions:**
```bash
# Reinstall all dependencies
rm -rf node_modules package-lock.json
npm install

# Install specific missing packages
npm install firebase firebase-admin
```

#### 6. Environment Variable Issues
**Problem:** Configuration not loading
**Solutions:**
- Verify `.env` file exists in `src` directory
- Check environment variable names match exactly
- Ensure no trailing spaces in `.env` file
- Restart development server after changes

### Getting Help
- **Firebase Documentation:** [https://firebase.google.com/docs](https://firebase.google.com/docs)
- **Project Issues:** Create an issue in the GitHub repository
- **Firebase Support:** [https://firebase.google.com/support](https://firebase.google.com/support)

### Performance Optimization Tips
1. **Enable Firebase Hosting CDN** for faster loading
2. **Optimize images** in the assets folder
3. **Minify CSS and JavaScript** for production
4. **Use Firestore indexes** for complex queries
5. **Implement pagination** for large data sets

## 🤝 Contributing

### Development Workflow
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Make your changes and test thoroughly
4. Commit changes: `git commit -m "Add new feature"`
5. Push to branch: `git push origin feature/new-feature`
6. Create a Pull Request

### Code Standards
- Use consistent indentation (2 spaces)
- Follow JavaScript ES6+ standards
- Add comments for complex logic
- Test all functionality before submitting
- Follow semantic commit message format

### Testing Requirements
- Test all user flows manually
- Verify Firebase integration works
- Check responsive design on different devices
- Validate form inputs and error handling

---

## 📞 Support & Contact

For technical support or questions about this project:
- **Email:** [your-email@domain.com]
- **GitHub Issues:** [Repository Issues Page]
- **Documentation:** This README file

---

**Made with ❤️ for better healthcare management**