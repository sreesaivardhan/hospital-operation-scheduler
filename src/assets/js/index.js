// ─────────────────────────────────────────────────────────────────
// MediCore OT Scheduler — Main Application Script
// Single-file, deduplicated, Phase-3 stable
// ─────────────────────────────────────────────────────────────────

// ── Firebase init ──────────────────────────────────────────────
const firebaseConfig = window.firebaseConfig;
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ── Global state ───────────────────────────────────────────────
let currentUser = null;
let currentUserData = null;
let isLoginMode = true;
let isRegistering = false;
let sessionStartTime = null;
let sessionTimer = null;
let pendingAuthMessage = null;
let allDoctors = [];
let allPatients = [];
let allOTRooms = [];
let allOTSchedules = [];
let isEditingDoctor = false;
let editingDoctorId = null;
let isEditingPatient = false;
let editingPatientId = null;
let _otStatusScheduleId = null;

const adminNavigation = [
    { id: 'overview', icon: 'fas fa-chart-pie', text: 'Dashboard Overview', active: true },
    { id: 'doctors', icon: 'fas fa-user-md', text: 'Doctor Management' },
    { id: 'users', icon: 'fas fa-users', text: 'User Management' },
    { id: 'patients', icon: 'fas fa-procedures', text: 'Patient Management' },
    { id: 'ot-rooms', icon: 'fas fa-door-open', text: 'OT Rooms' },
    { id: 'ot-schedule', icon: 'fas fa-calendar-alt', text: 'OT Schedule' },
    { id: 'appointment-management', icon: 'fas fa-calendar-check', text: 'Appointment Management' },
    { id: 'analytics', icon: 'fas fa-chart-line', text: 'Analytics Dashboard' },
    { id: 'operations', icon: 'fas fa-cogs', text: 'Operations Management' },
    { id: 'scheduling', icon: 'fas fa-calendar-check', text: 'Scheduling System' },
    { id: 'profile', icon: 'fas fa-user-cog', text: 'Profile Settings' },
    { id: 'logs', icon: 'fas fa-file-alt', text: 'Audit Logs' }
];

const userNavigation = [
    { id: 'staff-dashboard', icon: 'fas fa-chart-pie', text: 'Staff Dashboard', active: true },
    { id: 'profile', icon: 'fas fa-user-cog', text: 'Profile Settings' },
    { id: 'assignments', icon: 'fas fa-tasks', text: 'View Assignments' },
    { id: 'availability', icon: 'fas fa-clock', text: 'Update Availability' }
];

const patientNavigation = [
    { id: 'patient-dashboard', icon: 'fas fa-heartbeat', text: 'Dashboard', active: true },
    { id: 'find-doctors', icon: 'fas fa-search', text: 'Find Doctors' },
    { id: 'my-appointments', icon: 'fas fa-calendar-check', text: 'My Appointments' },
    { id: 'patient-profile', icon: 'fas fa-user', text: 'My Profile' }
];

// ── Bootstrap ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {

    auth.onAuthStateChanged(async (user) => {
        if (user) {
            try {
                let userDoc = await db.collection('users').doc(user.uid).get();
                let retries = 0;

                const isGoogleUser = user.providerData && user.providerData.some(p => p.providerId === 'google.com');

                // Race condition mitigation: Wait up to 3 seconds for handleAuth to write the document
                // Skip waiting for Google users since we never auto-create documents for them
                while (!userDoc.exists && retries < 6 && !isGoogleUser) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                    userDoc = await db.collection('users').doc(user.uid).get();
                    retries++;
                }

                let userData;
                if (!userDoc.exists) {
                    if (isGoogleUser) {
                        pendingAuthMessage = { type: 'error', text: 'Google Sign-In is restricted to existing users. Please use the registration form to create a new account.' };
                        await user.delete();
                        return;
                    } else {
                        console.log("TRACE REJECTION (Branch 1):", user.uid, userDoc.exists, userData, userData?.role, userData?.isActive);
                        pendingAuthMessage = { type: 'error', text: 'Your account is not set up in the system. Please contact an administrator.' };
                        await auth.signOut();
                        return;
                    }
                } else {
                    userData = userDoc.data();
                }

                // Sync email verification status from Auth to Firestore
                if (user.emailVerified === true && userData.emailVerified === false) {
                    await db.collection('users').doc(user.uid).update({
                        emailVerified: true,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    userData.emailVerified = true;
                }

                // Patients bypass email verification so they can login immediately
                if (userData.role !== 'patient' && !user.emailVerified) {
                    if (isRegistering) return; // Let handleAuth manage the UI and sign out cleanly

                    pendingAuthMessage = { type: 'error', text: 'Please verify your email before accessing the dashboard.' };
                    await auth.signOut();
                    return;
                }

                if (userData.isActive === false) {
                    if (isRegistering) return; // Let handleAuth manage the UI and sign out cleanly

                    if (userData.role === 'user') {
                        pendingAuthMessage = { type: 'info', text: 'Your account is pending administrator approval.' };
                    } else {
                        pendingAuthMessage = { type: 'error', text: 'Your account has been deactivated. Please contact an administrator.' };
                    }
                    await auth.signOut();
                    return;
                }

                if (userData.role === 'patient') {
                    const patientRef = db.collection('patients').doc(user.uid);
                    const patientDoc = await patientRef.get();
                    if (!patientDoc.exists) {
                        await patientRef.set({
                            uid: user.uid,
                            name: userData.fullName || '',
                            email: userData.email || user.email || '',
                            phone: userData.phone || '',
                            gender: '',
                            age: null,
                            bloodGroup: '',
                            address: '',
                            emergencyContact: '',
                            medicalHistory: '',
                            status: 'active',
                            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                        }, { merge: true });
                        console.log("TRACE: Existing patient migrated to patients collection.");
                    }
                }

                currentUser = user;
                currentUserData = userData;
                showDashboard(userData);
                await loadInitialData();
                startSessionManagement();
            } catch (err) {
                console.error('Error loading profile:', err);
                await auth.signOut();
                if (err.code === 'permission-denied' || err.message.includes('insufficient permissions')) {
                    // Note: userDoc and userData are out of scope here in the catch block if get() failed,
                    // but we log what we have to satisfy the debugging step.
                    console.log("TRACE REJECTION (Branch 2 Catch):", user.uid, "userDoc exists?", false, "userData?", undefined);
                    showAuthMessage('error', 'Your account is not set up in the system. Please contact an administrator.');
                } else {
                    showAuthMessage('error', 'A network or system error occurred while loading your profile.');
                }
            }
        } else {
            if (window.patientAppointmentsUnsubscribe) {
                window.patientAppointmentsUnsubscribe();
                window.patientAppointmentsUnsubscribe = null;
            }
            showAuth();
        }
    });

    // Event listeners – only bind if element exists
    const safe = (id, evt, fn) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(evt, fn);
    };
    safe('authForm', 'submit', handleAuth);
    safe('toggleLink', 'click', toggleAuthMode);
    safe('forgotPasswordLink', 'click', handleForgotPassword);
    safe('doctorForm', 'submit', handleDoctorSubmit);
    safe('profileForm', 'submit', handleProfileUpdate);
    safe('patientProfileForm', 'submit', handlePatientProfileUpdate);
    safe('availabilityForm', 'submit', handleAvailabilityUpdate);
    safe('patientForm', 'submit', handlePatientSubmit);
    safe('otRoomForm', 'submit', handleOTRoomSubmit);
    safe('otScheduleForm', 'submit', handleOTScheduleSubmit);
    safe('emergencyForm', 'submit', handleEmergencySubmit);
    safe('userForm', 'submit', handleUserSubmit);

    // OT schedule date default
    const otDateInput = document.getElementById('otScheduleDate');
    if (otDateInput) otDateInput.value = new Date().toISOString().split('T')[0];
});

// ── Navigation ─────────────────────────────────────────────────
function setupNavigation(items, userRole) {
    const navMenu = document.getElementById('navMenu');
    if (!navMenu) return;
    navMenu.innerHTML = '';
    const sub = document.getElementById('navSubtitle');
    if (sub) {
        if (userRole === 'admin') sub.textContent = 'Admin Dashboard';
        else if (userRole === 'patient') sub.textContent = 'Patient Portal';
        else sub.textContent = 'Staff Dashboard';
    }

    items.forEach(item => {
        const li = document.createElement('li');
        li.className = 'nav-item';
        const a = document.createElement('a');
        a.href = '#';
        a.className = 'nav-link' + (item.active ? ' active' : '');
        a.onclick = () => showSection(item.id);
        a.innerHTML = `<i class="${item.icon}"></i> ${item.text}`;
        li.appendChild(a);
        navMenu.appendChild(li);
    });

    const logoutLi = document.createElement('li');
    logoutLi.className = 'nav-item';
    logoutLi.style.cssText = 'margin-top:2rem;border-top:1px solid rgba(255,255,255,0.1);padding-top:1rem;';
    const logoutA = document.createElement('a');
    logoutA.href = '#';
    logoutA.className = 'nav-link';
    logoutA.style.color = '#ff6b6b';
    logoutA.onclick = logout;
    logoutA.innerHTML = '<i class="fas fa-sign-out-alt"></i> Secure Logout';
    logoutLi.appendChild(logoutA);
    navMenu.appendChild(logoutLi);

    // Bind universal mobile navigation events
    const mobileBtn = document.getElementById('mobileMenuBtn');
    const navOverlay = document.getElementById('navOverlay');
    const navCloseBtn = document.getElementById('navCloseBtn');

    if (mobileBtn) mobileBtn.onclick = toggleMobileSidebar;
    if (navOverlay) navOverlay.onclick = closeMobileSidebar;
    if (navCloseBtn) navCloseBtn.onclick = closeMobileSidebar;
}

function showSection(sectionName) {
    // Close mobile sidebar uniformly
    closeMobileSidebar();

    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(`section-${sectionName}`);
    if (target) target.classList.add('active');

    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    if (event && event.target && event.target.classList.contains('nav-link')) {
        event.target.classList.add('active');
    }

    const titles = {
        overview: 'Dashboard Overview', doctors: 'Doctor Management',
        users: 'User Management', patients: 'Patient Management',
        'ot-rooms': 'OT Rooms', 'ot-schedule': 'OT Schedule',
        analytics: 'Analytics Dashboard', operations: 'Operations Management',
        scheduling: 'Scheduling System', profile: 'Profile Settings',
        assignments: 'View Assignments', availability: 'Update Availability',
        logs: 'Audit Logs',
        'patient-dashboard': 'Patient Dashboard',
        'find-doctors': 'Find Doctors',
        'my-appointments': 'My Appointments',
        'patient-profile': 'My Profile',
        'staff-dashboard': 'Staff Dashboard',
        'appointment-management': 'Appointment Management'
    };
    const el = document.getElementById('pageTitle');
    if (el) el.textContent = titles[sectionName] || 'Dashboard';
    const crumb = document.getElementById('breadcrumbPath');
    if (crumb) crumb.textContent = `Home › ${titles[sectionName] || 'Dashboard'}`;

    switch (sectionName) {
        case 'doctors': loadDoctors(); break;
        case 'users': loadUsers(); break;
        case 'patients': loadPatients(); break;
        case 'ot-rooms': loadOTRooms(); break;
        case 'ot-schedule': loadOTSchedule(); break;
        case 'analytics': loadAnalytics(); break;
        case 'operations': loadOperationsManagement(); break;
        case 'scheduling': loadAdvancedSchedules(); break;
        case 'logs': loadActivityLog(); break;
        case 'find-doctors': loadPatientDoctors(); break;
        case 'patient-profile': loadPatientProfile(); break;
        case 'staff-dashboard': loadStaffDashboard(); break;
        case 'assignments': loadUserAssignments(); break;
        case 'appointment-management': loadAdminAppointments(); break;
        case 'my-appointments': loadPatientAppointments(); break;
    }
}

// ── Auth ──────────────────────────────────────────────────────
async function handleAuth(e) {
    e.preventDefault();
    const email = document.getElementById('email').value.trim().toLowerCase();
    const password = document.getElementById('password').value;
    if (!email || !password) { showAuthMessage('error', 'Please fill in all required fields'); return; }
    setAuthLoading(true);
    try {
        if (isLoginMode) {
            const cred = await auth.signInWithEmailAndPassword(email, password);
            const userDoc = await db.collection('users').doc(cred.user.uid).get();
            const userData = userDoc.exists ? userDoc.data() : null;
            if (userData && userData.role !== 'patient' && !cred.user.emailVerified) {
                showAuthMessage('error', 'Please verify your email before logging in.');
                await auth.signOut();
                return;
            }
            if (!userDoc.exists || userData.isActive === false) {
                // Let onAuthStateChanged handle the rejection/sign-out and messaging handoff
                return;
            }
            await logAdminAction('User Login', `User ${email} logged in`);
            showAuthMessage('success', 'Login successful!');
            sessionStartTime = new Date();
        } else {
            const regTypeElement = document.querySelector('input[name="registrationType"]:checked');
            const isPatient = regTypeElement && regTypeElement.value === 'patient';

            const confirmPassword = document.getElementById('confirmPassword').value;
            const fullName = document.getElementById('fullName').value.trim();
            const phone = document.getElementById('phone').value.trim();
            const department = document.getElementById('department').value;

            if (!fullName || (!isPatient && !department)) { showAuthMessage('error', 'Please fill in all required fields'); return; }
            if (password !== confirmPassword) { showAuthMessage('error', 'Passwords do not match'); return; }
            if (password.length < 6) { showAuthMessage('error', 'Password must be at least 6 characters'); return; }

            console.log("TRACE: Calling createUserWithEmailAndPassword with email:", email);
            isRegistering = true;
            const cred = await auth.createUserWithEmailAndPassword(email, password);
            console.log("TRACE: Auth user created successfully. UID:", cred.user.uid, "Email:", cred.user.email);

            try {
                const newRole = isPatient ? 'patient' : 'user';
                const isActiveState = isPatient ? true : false;

                const payload = {
                    uid: cred.user.uid, email, fullName, phone: phone || '',
                    department: isPatient ? '' : department,
                    role: newRole, bio: '',
                    isActive: isActiveState,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    emailVerified: false, lastLogin: null, loginHistory: []
                };
                console.log("TRACE: Attempting Firestore write with payload:", payload);
                await db.collection('users').doc(cred.user.uid).set(payload);

                if (isPatient) {
                    const patientPayload = {
                        uid: cred.user.uid,
                        name: fullName,
                        email: email,
                        phone: phone || '',
                        gender: '',
                        age: null,
                        bloodGroup: '',
                        address: '',
                        emergencyContact: '',
                        medicalHistory: '',
                        status: 'active',
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    };
                    await db.collection('patients').doc(cred.user.uid).set(patientPayload, { merge: true });
                    console.log("TRACE: Patient profile document created successfully!");
                }

                console.log("TRACE: Firestore write succeeded!");
                await cred.user.sendEmailVerification();

                if (!isActiveState) {
                    await auth.signOut();
                    showAuthMessage('success', 'Registration successful. Verify your email and wait for Admin approval.');
                } else {
                    showAuthMessage('success', 'Registration successful! Please verify your email.');
                }
                toggleAuthMode();
            } catch (fsErr) {
                console.error('Firestore error:', fsErr);
                await cred.user.delete();
                showAuthMessage('error', 'Registration failed. Please try again.');
            }
        }
    } catch (err) {
        console.error('Auth error:', err);
        const msgs = {
            'auth/email-already-in-use': 'Email already registered. Use login instead.',
            'auth/invalid-login-credentials': 'Invalid email or password.',
            'auth/user-not-found': 'Invalid email or password.',
            'auth/wrong-password': 'Invalid email or password.',
            'auth/weak-password': 'Password too weak (min 6 characters).',
            'auth/invalid-email': 'Invalid email address.',
            'auth/too-many-requests': 'Too many attempts. Wait a few minutes.',
            'auth/network-request-failed': 'Network error. Check your connection.'
        };
        showAuthMessage('error', msgs[err.code] || 'An error occurred. Please try again.');
    } finally {
        isRegistering = false;
        setAuthLoading(false);
    }
}

async function handleForgotPassword(e) {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    if (!email) { showAuthMessage('error', 'Enter your email address first'); return; }
    try {
        await auth.sendPasswordResetEmail(email);
        showAuthMessage('success', 'Password reset email sent! Check your inbox.');
    } catch (err) {
        const msgs = { 'auth/user-not-found': 'No account with this email', 'auth/invalid-email': 'Invalid email' };
        showAuthMessage('error', msgs[err.code] || 'Error sending reset email');
    }
}

async function signInWithGoogle() {
    try {
        setAuthLoading(true);
        const provider = new firebase.auth.GoogleAuthProvider();
        const result = await auth.signInWithPopup(provider);
        await logAdminAction('user_login', `Google user logged in: ${result.user.email}`);
        // onAuthStateChanged will handle the rest
    } catch (err) {
        setAuthLoading(false);
        console.error('Google Sign-In Error:', err);
        showAuthMessage('error', err.message || 'Google Sign-In failed');
    }
}

function toggleAuthMode(e) {
    if (e) e.preventDefault();
    isLoginMode = !isLoginMode;
    const registerFields = document.getElementById('registerFields');
    const authTitle = document.getElementById('authTitle');
    const authBtnText = document.getElementById('authButtonText');
    const toggleLink = document.getElementById('toggleLink');
    const forgotPw = document.getElementById('forgotPasswordContainer');
    const googleBtn = document.getElementById('googleSignInContainer');

    if (isLoginMode) {
        if (authTitle) authTitle.textContent = 'Welcome Back to MediCore';
        if (authBtnText) authBtnText.textContent = 'Sign In Securely';
        if (toggleLink) toggleLink.textContent = 'Need an account? Register here';
        if (registerFields) registerFields.style.display = 'none';
        if (forgotPw) forgotPw.style.display = 'block';
        if (googleBtn) googleBtn.style.display = 'block';

        // Remove required from department to prevent hidden validation blocking login
        const deptSelect = document.getElementById('department');
        if (deptSelect) {
            deptSelect.removeAttribute('required');
            deptSelect.removeAttribute('data-was-required');
        }
    } else {
        if (authTitle) authTitle.textContent = 'Join MediCore Platform';
        if (authBtnText) authBtnText.textContent = 'Create Account';
        if (toggleLink) toggleLink.textContent = 'Already have an account? Sign in here';
        if (registerFields) registerFields.style.display = 'block';
        if (forgotPw) forgotPw.style.display = 'none';
        if (googleBtn) googleBtn.style.display = 'none';
    }
    hideAuthMessages();
    const f = document.getElementById('authForm');
    if (f) f.reset();
}

function showAuth() {
    const a = document.getElementById('authContainer');
    const d = document.getElementById('dashboardContainer');
    if (a) a.style.display = 'flex';
    if (d) d.style.display = 'none';
    hideAuthMessages();
    setAuthLoading(false);

    if (pendingAuthMessage) {
        showAuthMessage(pendingAuthMessage.type, pendingAuthMessage.text);
        pendingAuthMessage = null;
    }
}

function showDashboard(userData) {
    const a = document.getElementById('authContainer');
    const d = document.getElementById('dashboardContainer');
    if (a) a.style.display = 'none';
    if (d) d.style.display = 'block';
    const welcome = document.getElementById('userWelcome');
    if (welcome) welcome.textContent = `Welcome, ${userData.fullName || 'User'}`;

    if (userData.role === 'admin') {
        setupNavigation(adminNavigation, 'admin');
        showSection('overview');
        loadProfileFields(userData);
    } else if (userData.role === 'patient') {
        setupNavigation(patientNavigation, 'patient');
        showSection('patient-dashboard');
        loadProfileFields(userData);
    } else {
        setupNavigation(userNavigation, 'user');
        showSection('staff-dashboard');
        loadProfileFields(userData);
    }
}

async function loadProfileFields(userData) {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
    const txt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || ''; };
    txt('userName', userData.fullName);
    txt('userEmail', userData.email || (currentUser && currentUser.email));
    txt('userRole', userData.role);
    txt('userDepartment', userData.department);
    txt('userStatus', currentUser && currentUser.emailVerified ? 'Verified' : 'Unverified');
    set('editFullName', userData.fullName);
    set('editEmail', userData.email || (currentUser && currentUser.email));
    set('editPhone', userData.phone);
    set('editDepartment', userData.department);
    set('bio', userData.bio);

    if (userData.role === 'patient') {
        txt('patientWelcomeName', userData.fullName || 'Patient');
        txt('patientWelcomeEmail', userData.email || (currentUser && currentUser.email));
        txt('patientSummaryName', userData.fullName || 'N/A');
        txt('patientSummaryEmail', userData.email || (currentUser && currentUser.email));
        txt('patientSummaryPhone', userData.phone || 'N/A');

        try {
            const pDoc = await db.collection('patients').doc(currentUser.uid).get();
            if (pDoc.exists) {
                const p = pDoc.data();
                set('patProfileName', p.name || userData.fullName);
                set('patProfileEmail', p.email || userData.email || (currentUser && currentUser.email));
                set('patProfilePhone', p.phone || userData.phone);
                set('patProfileGender', p.gender);
                set('patProfileAge', p.age);
                set('patProfileBlood', p.bloodGroup);
                set('patProfileAddress', p.address);
                set('patProfileEmergency', p.emergencyContact);
                set('patProfileHistory', p.medicalHistory);
            }
        } catch (e) {
            console.error('Failed to load patient profile:', e);
        }
    }
}

// ── Session ────────────────────────────────────────────────────
function startSessionManagement() {
    sessionStartTime = new Date();
    updateSessionStatus();
    sessionTimer = setInterval(updateSessionStatus, 60000);
    let inactivityTimer;
    const reset = () => {
        clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(() => { showMessage('error', 'Session expired'); logout(); }, 30 * 60 * 1000);
    };
    document.addEventListener('click', reset);
    document.addEventListener('keypress', reset);
    reset();
}

function updateSessionStatus() {
    if (!sessionStartTime) return;
    const secs = Math.floor((new Date() - sessionStartTime) / 1000);
    const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60);
    let txt = 'Active Session';
    if (h > 0) txt += ` (${h}h ${m}m)`; else if (m > 0) txt += ` (${m}m)`;
    const ss = document.getElementById('sessionStatus');
    const lt = document.getElementById('loginTime');
    const sd = document.getElementById('sessionDuration');
    if (ss) ss.textContent = txt;
    if (lt) lt.textContent = sessionStartTime.toLocaleTimeString();
    if (sd) sd.textContent = `${h}h ${m}m`;
}

function extendSession() { showMessage('success', 'Session extended!'); }
function endSession() { logout(); }

// ── Initial data load ─────────────────────────────────────────
async function loadInitialData() {
    try {
        if (currentUserData && currentUserData.role === 'admin') {
            // Note: If you encounter a 403 Identity Toolkit error (getProjectConfig)
            // this is often due to API key domain restrictions in Google Cloud Console
            // (e.g. blocking 127.0.0.1 or localhost:8080) or Email/Password auth being disabled.
            const [docSnap, usrSnap, otRoomsSnap, otSchedSnap, patSnap] = await Promise.all([
                db.collection('doctors').get(),
                db.collection('users').get(),
                db.collection('ot_rooms').get(),
                db.collection('ot_schedules').get(),
                db.collection('patients').get()
            ]);
            const td = document.getElementById('totalDoctors');
            const tu = document.getElementById('totalUsers');
            const tr = document.getElementById('monthlyRevenue'); // OT Rooms
            const ts = document.getElementById('totalAppointments'); // OT Schedules

            if (td) td.textContent = docSnap.size;
            if (tu) tu.textContent = usrSnap.size;
            if (tr) tr.textContent = otRoomsSnap.size;
            if (ts) ts.textContent = otSchedSnap.size;

            allOTRooms = [];
            otRoomsSnap.forEach(d => allOTRooms.push({ id: d.id, ...d.data() }));

            allPatients = [];
            patSnap.forEach(d => allPatients.push({ id: d.id, ...d.data() }));

            allOTSchedules = [];
            allDoctors = [];
            docSnap.forEach(d => allDoctors.push({ id: d.id, ...d.data() }));
        }
    } catch (err) {
        console.error('Error loading initial data:', err);
    }
}

// ── Doctor management ─────────────────────────────────────────
async function loadDoctors() {
    try {
        const snap = await db.collection('doctors').orderBy('createdAt', 'desc').get();
        allDoctors = [];
        snap.forEach(d => allDoctors.push({ id: d.id, ...d.data() }));
        displayDoctors(allDoctors);
        const td = document.getElementById('totalDoctors');
        if (td) td.textContent = allDoctors.length;
    } catch (err) {
        console.error('Error loading doctors:', err);
        showMessage('error', 'Error loading doctors data');
    }
}

function displayDoctors(doctors) {
    const c = document.getElementById('doctorsContainer');
    if (!c) return;
    if (doctors.length === 0) {
        c.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text-secondary);">
            <h3>No doctors found</h3><p>Click "Add New Doctor" to get started</p></div>`;
        return;
    }
    c.innerHTML = doctors.map(d => `
        <div class="item-card">
          <div class="item-header">
            <div>
              <div class="item-title">
                ${d.name}
                <span class="status-badge status-${(d.status || 'active').toLowerCase()}" style="margin-left:10px; font-size:0.8rem; padding:2px 8px; border-radius:12px; background: ${d.status === 'inactive' ? '#fdecea' : '#e6f4ea'}; color: ${d.status === 'inactive' ? '#d32f2f' : '#1e8e3e'};">${capitalizeFirst(d.status || 'active')}</span>
              </div>
              <div class="item-subtitle">${capitalizeFirst(d.specialty || d.specialization || 'Unknown')} • ${d.experience || 0} yrs</div>
              <div style="margin-top:.5rem;font-size:.9rem;color:var(--text-secondary);">
                <span style="display:block;">${d.email}</span>
                <span style="display:block;">${d.phone}</span>
                ${d.licenseNumber ? `<span style="display:block;">Lic: ${d.licenseNumber}</span>` : ''}
                ${d.consultationFee ? `<span style="display:block;">Fee: $${d.consultationFee}</span>` : ''}
              </div>
              ${d.bio ? `<div style="margin-top:.5rem;font-style:italic;color:var(--text-secondary);">${d.bio}</div>` : ''}
            </div>
            <div class="item-actions">
              <button class="btn btn-warning btn-sm" onclick="editDoctor('${d.id}')">Edit</button>
              <button class="btn btn-danger btn-sm" onclick="deleteDoctor('${d.id}','${d.name.replace(/'/g, "\\'")}')">Delete</button>
            </div>
          </div>
        </div>`).join('');
}

function openDoctorModal() {
    isEditingDoctor = false;
    editingDoctorId = null;
    const title = document.getElementById('doctorModalTitle');
    const form = document.getElementById('doctorForm');
    const modal = document.getElementById('doctorModal');
    if (title) title.textContent = 'Add New Doctor';
    if (form) form.reset();
    if (modal) modal.style.display = 'block';
}

function closeDoctorModal() {
    const m = document.getElementById('doctorModal');
    if (m) m.style.display = 'none';
}

async function handleDoctorSubmit(e) {
    e.preventDefault();
    const submitBtn = document.getElementById('doctorSubmitText');
    const spinner = document.getElementById('doctorSubmitSpinner');
    if (submitBtn) submitBtn.style.display = 'none';
    if (spinner) spinner.style.display = 'inline-block';
    try {
        const doctorData = {
            name: document.getElementById('doctorName') ? document.getElementById('doctorName').value.trim() : '',
            email: document.getElementById('doctorEmail') ? document.getElementById('doctorEmail').value.trim().toLowerCase() : '',
            phone: document.getElementById('doctorPhone') ? document.getElementById('doctorPhone').value.trim() : '',
            specialty: document.getElementById('specialization') ? document.getElementById('specialization').value.trim() : '',
            experience: document.getElementById('doctorExperience') ? (parseInt(document.getElementById('doctorExperience').value) || 0) : 0,
            status: document.getElementById('doctorStatus') ? document.getElementById('doctorStatus').value : 'active'
        };
        if (isEditingDoctor && editingDoctorId) {
            await db.collection('doctors').doc(editingDoctorId).update({
                ...doctorData, updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            await logAdminAction('Doctor Updated', `Updated doctor: ${doctorData.name}`);
            showMessage('success', 'Doctor updated successfully!');
        } else {
            await db.collection('doctors').add({
                ...doctorData,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            await logAdminAction('Doctor Added', `Added new doctor: ${doctorData.name}`);
            showMessage('success', 'Doctor added successfully!');
        }
        closeDoctorModal();
        await loadDoctors();
        await loadInitialData();
    } catch (err) {
        console.error('Error saving doctor:', err);
        showMessage('error', 'Error saving doctor. Please try again.');
    } finally {
        if (submitBtn) submitBtn.style.display = 'inline';
        if (spinner) spinner.style.display = 'none';
    }
}

async function editDoctor(doctorId) {
    try {
        const doc = await db.collection('doctors').doc(doctorId).get();
        if (!doc.exists) { showMessage('error', 'Doctor not found'); return; }
        const d = doc.data();
        isEditingDoctor = true;
        editingDoctorId = doctorId;
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
        const title = document.getElementById('doctorModalTitle');
        if (title) title.textContent = 'Edit Doctor';
        set('doctorName', d.name);
        set('doctorEmail', d.email);
        set('doctorPhone', d.phone);
        set('specialization', d.specialty || d.specialization); // Matches actual DOM id 'specialization'
        set('doctorExperience', d.experience);
        set('doctorStatus', d.status || 'active');
        const modal = document.getElementById('doctorModal');
        if (modal) modal.style.display = 'block';
    } catch (err) {
        console.error('Error loading doctor:', err);
        showMessage('error', 'Error loading doctor data');
    }
}

async function deleteDoctor(doctorId, doctorName) {
    const confirmed = await window.showConfirmation({ title: `Delete Dr. ${doctorName}?`, message: 'This action cannot be undone.', confirmText: 'Delete' });
    if (!confirmed) return;
    try {
        await db.collection('doctors').doc(doctorId).delete();
        await logAdminAction('Doctor Deleted', `Deleted doctor: ${doctorName}`);
        showMessage('success', 'Doctor deleted successfully!');
        await loadDoctors();
        await loadInitialData();
    } catch (err) {
        console.error('Error deleting doctor:', err);
        showMessage('error', 'Error deleting doctor');
    }
}

function searchDoctors() {
    const q = (document.getElementById('doctorSearch') || { value: '' }).value.toLowerCase();
    displayDoctors(allDoctors.filter(d =>
        d.name.toLowerCase().includes(q) ||
        d.email.toLowerCase().includes(q) ||
        d.specialization.toLowerCase().includes(q)
    ));
}

function filterDoctors() {
    const spec = (document.getElementById('specializationFilter') || { value: '' }).value;
    const status = (document.getElementById('statusFilter') || { value: '' }).value;
    let list = allDoctors;
    if (spec) list = list.filter(d => d.specialization === spec);
    if (status) list = list.filter(d => d.status === status);
    displayDoctors(list);
}

// ── User management ───────────────────────────────────────────
async function loadUsers() {
    try {
        const snap = await db.collection('users').orderBy('createdAt', 'desc').get();
        const users = [];
        snap.forEach(d => users.push({ id: d.id, ...d.data() }));

        const html = `
        <div class="data-table-wrapper">
          <table class="data-table">
            <thead><tr>
              <th>Name</th><th>Email</th><th>Department</th><th>Role</th><th>Status</th><th>Actions</th>
            </tr></thead>
            <tbody>
              ${users.map(u => {
            const isDeactivated = u.isActive === false;
            const statusBadge = isDeactivated
                ? '<span class="badge" style="background:rgba(231,76,60,.1);color:#e74c3c;">Deactivated</span>'
                : (u.emailVerified
                    ? '<span class="badge" style="background:rgba(39,174,96,.1);color:#27ae60;">Verified</span>'
                    : '<span class="badge" style="background:rgba(255,193,7,.1);color:#b45309;">Unverified</span>');

            const isAdmin = currentUserData && currentUserData.role === 'admin';
            const actions = isAdmin
                ? `<button class="btn btn-warning btn-sm" onclick="editUser('${u.id}')">Edit</button>
                     <button class="btn btn-danger btn-sm" onclick="deactivateUser('${u.id}','${(u.fullName || '').replace(/'/g, "\\\\'")}', ${!isDeactivated})">
                       ${isDeactivated ? 'Reactivate' : 'Deactivate'}
                     </button>`
                : `<button class="btn btn-ghost btn-sm" disabled title="Admin only">Read Only</button>`;

            return `<tr>
                 <td>${u.fullName || 'N/A'}</td>
                 <td>${u.email}</td>
                 <td>${capitalizeFirst(u.department || 'N/A')}</td>
                 <td>${capitalizeFirst(u.role || 'user')}</td>
                 <td>${statusBadge}</td>
                 <td>${actions}</td>
                </tr>`;
        }).join('')}
            </tbody>
          </table>
        </div>
        <p style="font-size:.8rem;color:var(--text-muted);margin-top:.75rem;">
          <i class="fas fa-info-circle"></i>
          Note: Creating or hard-deleting Auth Users requires Firebase Admin SDK / Cloud Functions. We use soft-deactivate here.
        </p>`;

        const c = document.getElementById('usersContainer');
        if (c) c.innerHTML = html;
    } catch (err) {
        console.error('Error loading users:', err);
        showToast('error', 'Error loading users');
    }
}

// ── User Management Functions ─────────────────────────────────
let isEditingUser = false;
let editingUserId = null;

async function editUser(userId) {
    if (!currentUserData || currentUserData.role !== 'admin') return;
    try {
        const doc = await db.collection('users').doc(userId).get();
        if (!doc.exists) return showToast('error', 'User not found');
        const u = doc.data();
        isEditingUser = true;
        editingUserId = userId;
        document.getElementById('manageUserFullName').value = u.fullName || '';
        document.getElementById('manageUserDepartment').value = u.department || '';
        document.getElementById('manageUserPhone').value = u.phone || '';
        document.getElementById('manageUserRole').value = (u.role || 'user').toLowerCase();
        document.getElementById('manageUserIsActive').value = u.isActive === false ? 'false' : 'true';
        openModal('userModal');
    } catch (err) {
        console.error('Error fetching user:', err);
        showToast('error', 'Error fetching user');
    }
}

function closeUserModal() {
    closeModal('userModal');
}

async function handleUserSubmit(e) {
    e.preventDefault();
    if (!isEditingUser || !editingUserId || !currentUserData || currentUserData.role !== 'admin') return;
    try {
        const updates = {
            fullName: document.getElementById('manageUserFullName').value.trim(),
            department: document.getElementById('manageUserDepartment').value.trim(),
            phone: document.getElementById('manageUserPhone').value.trim(),
            role: document.getElementById('manageUserRole').value.toLowerCase(),
            isActive: document.getElementById('manageUserIsActive').value === 'true',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        await db.collection('users').doc(editingUserId).update(updates);
        await logAdminAction('user_updated', `Admin updated user profile: ${updates.fullName}`, 'users', editingUserId);
        showToast('success', 'User updated successfully');
        closeUserModal();

        if (currentUser && editingUserId === currentUser.uid) {
            currentUserData = { ...currentUserData, ...updates };
            showDashboard(currentUserData);
        }
        loadUsers();
    } catch (err) {
        console.error('Error updating user:', err);
        showToast('error', 'Error updating user');
    }
}

async function deactivateUser(userId, userName, deactivate) {
    if (!currentUserData || currentUserData.role !== 'admin') return;
    const actionText = deactivate ? 'deactivate' : 'reactivate';
    const confirmed = await window.showConfirmation({ title: `Confirm ${capitalizeFirst(actionText)}`, message: `Are you sure you want to ${actionText} ${userName || 'this user'}?`, confirmText: capitalizeFirst(actionText) });
    if (!confirmed) return;

    try {
        // Firebase Admin SDK/Cloud Functions note:
        // A true production app would call a Cloud Function here to disable the Auth user via admin.auth().updateUser(uid, { disabled: true })
        await db.collection('users').doc(userId).update({
            isActive: !deactivate,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await logAdminAction(deactivate ? 'user_deactivated' : 'user_reactivated', `Admin ${actionText}d user: ${userName}`, 'users', userId);
        showToast('success', `User ${actionText}d successfully`);
        loadUsers();
    } catch (err) {
        console.error(`Error trying to ${actionText} user:`, err);
        showToast('error', `Error trying to ${actionText} user`);
    }
}

// ── Patient management ────────────────────────────────────────
async function loadPatients() {
    try {
        const snap = await db.collection('patients').orderBy('createdAt', 'desc').get();
        allPatients = [];
        snap.forEach(d => allPatients.push({ id: d.id, ...d.data() }));
        displayPatients(allPatients);
        updatePatientStats();
    } catch (err) {
        console.error('Error loading patients:', err);
        showMessage('error', 'Error loading patients data');
    }
}

function displayPatients(patients) {
    const c = document.getElementById('patientsContainer');
    if (!c) return;
    if (patients.length === 0) {
        c.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text-secondary);">
            <h3>No patients found</h3><p>Click "Add New Patient" to get started</p></div>`;
        return;
    }
    c.innerHTML = patients.map(p => `
        <div class="item-card">
          <div class="item-header">
            <div>
              <div class="item-title">${p.name}</div>
              <div class="item-subtitle">${p.age} yrs • ${capitalizeFirst(p.gender)}</div>
              <div style="margin-top:.5rem;font-size:.9rem;color:var(--text-secondary);">
                <span style="display:block;">${p.phone}</span>
                ${p.email ? `<span style="display:block;">${p.email}</span>` : ''}
                <span style="display:block;">Blood: ${p.bloodGroup || 'Unknown'}</span>
                <span style="display:block;">${capitalizeFirst(p.status || 'outpatient')}</span>
              </div>
              ${p.medicalHistory ? `<div style="margin-top:.5rem;font-style:italic;color:var(--text-secondary);">
                Medical: ${p.medicalHistory.substring(0, 100)}${p.medicalHistory.length > 100 ? '...' : ''}</div>` : ''}
            </div>
            <div class="item-actions">
              <button class="btn btn-primary btn-sm" onclick="viewPatientDetails('${p.id}')">View</button>
              <button class="btn btn-warning btn-sm" onclick="editPatient('${p.id}')">Edit</button>
              <button class="btn btn-danger btn-sm" onclick="deletePatient('${p.id}','${p.name.replace(/'/g, "\\'")}')">Delete</button>
            </div>
          </div>
        </div>`).join('');
}

function updatePatientStats() {
    const today = new Date().toDateString();
    const todayAdmissions = allPatients.filter(p => {
        const d = p.createdAt && p.createdAt.toDate ? p.createdAt.toDate() : new Date();
        return d.toDateString() === today;
    }).length;
    const inpatients = allPatients.filter(p => p.status === 'inpatient').length;
    const tp = document.getElementById('totalPatients');
    const ta = document.getElementById('todayAdmissions');
    const ci = document.getElementById('currentInpatients');
    if (tp) tp.textContent = allPatients.length;
    if (ta) ta.textContent = todayAdmissions;
    if (ci) ci.textContent = inpatients;
}

function searchPatients() {
    const q = (document.getElementById('patientSearch') || { value: '' }).value.toLowerCase();
    displayPatients(allPatients.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.phone.includes(q) ||
        (p.email && p.email.toLowerCase().includes(q))
    ));
}

function filterPatients() {
    const gender = (document.getElementById('genderFilter') || { value: '' }).value;
    const age = (document.getElementById('ageFilter') || { value: '' }).value;
    let list = allPatients;
    if (gender) list = list.filter(p => p.gender === gender);
    if (age) list = list.filter(p => {
        switch (age) {
            case 'child': return p.age < 18;
            case 'adult': return p.age >= 18 && p.age < 60;
            case 'senior': return p.age >= 60;
            default: return true;
        }
    });
    displayPatients(list);
}

function openPatientModal() {
    isEditingPatient = false;
    editingPatientId = null;
    const title = document.getElementById('patientModalTitle');
    const form = document.getElementById('patientForm');
    const modal = document.getElementById('patientModal');
    if (title) title.textContent = 'Add New Patient';
    if (form) form.reset();
    if (modal) modal.style.display = 'block';
}

function closePatientModal() {
    const m = document.getElementById('patientModal');
    if (m) m.style.display = 'none';
}

async function handlePatientSubmit(e) {
    e.preventDefault();
    const submitBtn = document.getElementById('patientSubmitText');
    const spinner = document.getElementById('patientSubmitSpinner');
    if (submitBtn) submitBtn.style.display = 'none';
    if (spinner) spinner.style.display = 'inline-block';
    try {
        const patientData = {
            name: document.getElementById('patientName').value.trim(),
            age: parseInt(document.getElementById('patientAge').value),
            gender: document.getElementById('patientGender').value,
            phone: document.getElementById('patientPhone').value.trim(),
            email: document.getElementById('patientEmail').value.trim(),
            bloodGroup: document.getElementById('patientBloodGroup').value,
            emergencyContact: document.getElementById('emergencyContact').value.trim(),
            status: document.getElementById('patientStatus').value,
            address: document.getElementById('patientAddress').value.trim(),
            medicalHistory: document.getElementById('medicalHistory').value.trim()
        };
        if (isEditingPatient && editingPatientId) {
            await db.collection('patients').doc(editingPatientId).update({
                ...patientData, updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            await logAdminAction('Patient Updated', `Updated patient: ${patientData.name}`);
            showMessage('success', 'Patient updated successfully!');
        } else {
            await db.collection('patients').add({
                ...patientData,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            await logAdminAction('Patient Added', `Added new patient: ${patientData.name}`);
            showMessage('success', 'Patient added successfully!');
        }
        closePatientModal();
        await loadPatients();
    } catch (err) {
        console.error('Error saving patient:', err);
        showMessage('error', 'Error saving patient. Please try again.');
    } finally {
        if (submitBtn) submitBtn.style.display = 'inline';
        if (spinner) spinner.style.display = 'none';
    }
}

async function editPatient(patientId) {
    try {
        const doc = await db.collection('patients').doc(patientId).get();
        if (!doc.exists) { showMessage('error', 'Patient not found'); return; }
        const p = doc.data();
        isEditingPatient = true;
        editingPatientId = patientId;
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
        const title = document.getElementById('patientModalTitle');
        if (title) title.textContent = 'Edit Patient';
        set('patientName', p.name);
        set('patientAge', p.age);
        set('patientGender', p.gender);
        set('patientPhone', p.phone);
        set('patientEmail', p.email);
        set('patientBloodGroup', p.bloodGroup);
        set('emergencyContact', p.emergencyContact);
        set('patientStatus', p.status);
        set('patientAddress', p.address);
        set('medicalHistory', p.medicalHistory);
        const modal = document.getElementById('patientModal');
        if (modal) modal.style.display = 'block';
    } catch (err) {
        console.error('Error loading patient:', err);
        showMessage('error', 'Error loading patient data');
    }
}

async function deletePatient(patientId, patientName) {
    const confirmed = await window.showConfirmation({ title: `Delete patient ${patientName}?`, message: 'This action cannot be undone.', confirmText: 'Delete' });
    if (!confirmed) return;
    try {
        await db.collection('patients').doc(patientId).delete();
        await logAdminAction('Patient Deleted', `Deleted patient: ${patientName}`);
        showMessage('success', 'Patient deleted successfully!');
        await loadPatients();
    } catch (err) {
        console.error('Error deleting patient:', err);
        showMessage('error', 'Error deleting patient');
    }
}

function viewPatientDetails(patientId) {
    const p = allPatients.find(x => x.id === patientId);
    if (!p) return;
    const modal = document.getElementById('patientDetailModal');
    const body = document.getElementById('patientDetailBody');
    if (!modal || !body) { showToast('info', `${p.name} | ${p.age}y | ${capitalizeFirst(p.gender)}`); return; }
    body.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:.875rem;"><tbody>
      ${[['Name', p.name], ['Age', p.age + ' years'], ['Gender', capitalizeFirst(p.gender)],
        ['Phone', p.phone], ['Email', p.email || '—'], ['Blood Group', p.bloodGroup || '—'],
        ['Status', capitalizeFirst(p.status || 'outpatient')],
        ['Emergency Contact', p.emergencyContact || '—'], ['Address', p.address || '—']
        ].map(([k, v]) =>
            `<tr><td style="padding:.45rem 0;font-weight:600;color:var(--text-secondary);width:42%;border-bottom:1px solid var(--border-color);">${k}</td>
             <td style="padding:.45rem 0;border-bottom:1px solid var(--border-color);">${v}</td></tr>`
        ).join('')}
      ${p.medicalHistory ? `<tr><td colspan="2" style="padding:.5rem 0;"><strong>Medical History</strong><br>
        <span style="color:var(--text-secondary);">${p.medicalHistory}</span></td></tr>` : ''}
    </tbody></table>`;
    modal.style.display = 'block';
}

async function exportPatients() {
    try {
        let csv = 'Name,Age,Gender,Phone,Email,Blood Group,Status,Emergency Contact,Address\n';
        allPatients.forEach(p => {
            csv += [p.name, p.age, p.gender, p.phone, p.email || '', p.bloodGroup || '', p.status || '',
            p.emergencyContact || '', (p.address || '').replace(/"/g, '""')
            ].map(v => `"${v}"`).join(',') + '\n';
        });
        const a = Object.assign(document.createElement('a'), {
            href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
            download: `patients_${new Date().toISOString().split('T')[0]}.csv`
        });
        a.click();
        URL.revokeObjectURL(a.href);
        await logAdminAction('Data Export', 'Exported patients CSV');
        showMessage('success', 'Patients exported!');
    } catch (err) {
        showMessage('error', 'Error exporting patients');
    }
}

// ── OT Rooms ──────────────────────────────────────────────────
async function loadOTRooms() {
    try {
        const snap = await db.collection('ot_rooms').get();
        allOTRooms = [];
        snap.forEach(d => allOTRooms.push({ id: d.id, ...d.data() }));
        displayOTRooms(allOTRooms);
    } catch (err) {
        console.error('Error loading OT rooms:', err);
        showMessage('error', 'Error loading OT rooms: ' + err.message);
    }
}

function displayOTRooms(rooms) {
    const c = document.getElementById('otRoomsContainer');
    if (!c) return;
    if (rooms.length === 0) {
        c.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text-secondary);">
            <h3>No OT rooms found</h3><p>Click "Add New OT Room" to get started</p>
            <button onclick="addSampleOTRoom()" class="btn btn-primary" style="margin-top:1rem;">Add Sample Room</button>
            </div>`;
        return;
    }
    c.innerHTML = rooms.map(r => `
        <div class="item-card">
          <div class="item-header">
            <div>
              <div class="item-title">OT Room ${r.roomNumber}</div>
              <div class="item-subtitle">${capitalizeFirst(r.type)} Surgery</div>
              <div style="margin-top:.5rem;">
                <span style="padding:.25rem .75rem;border-radius:15px;font-size:.8rem;background:${getStatusColor(r.status)};">
                  ${capitalizeFirst(r.status)}</span>
              </div>
              ${r.equipment ? `<div style="margin-top:.5rem;font-size:.9rem;color:var(--text-secondary);">Equipment: ${r.equipment}</div>` : ''}
            </div>
            <div class="item-actions">
              <button class="btn btn-warning btn-sm" onclick="editOTRoom('${r.id}')">Edit</button>
              <button class="btn btn-danger btn-sm" onclick="deleteOTRoom('${r.id}','${r.roomNumber}')">Delete</button>
            </div>
          </div>
        </div>`).join('');
}

function getStatusColor(status) {
    const m = {
        available: 'rgba(39,174,96,.1);color:#27ae60', occupied: 'rgba(231,76,60,.1);color:#e74c3c',
        maintenance: 'rgba(255,193,7,.1);color:#b45309', cleaning: 'rgba(52,152,219,.1);color:#2980b9'
    };
    return m[status] || 'rgba(149,165,166,.1);color:#7f8c8d';
}

function openOTRoomModal() {
    const form = document.getElementById('otRoomForm');
    const modal = document.getElementById('otRoomModal');
    if (form) form.reset();
    if (modal) modal.style.display = 'block';
}

function closeOTRoomModal() {
    const m = document.getElementById('otRoomModal');
    if (m) {
        m.style.display = 'none';
        delete m._editId;
    }
}

async function handleOTRoomSubmit(e) {
    e.preventDefault();
    try {
        const modal = document.getElementById('otRoomModal');
        const editId = modal ? modal._editId : null;

        const roomData = {
            roomNumber: document.getElementById('otRoomNumber').value.trim(),
            type: document.getElementById('otRoomType').value,
            status: document.getElementById('otRoomStatus').value,
            equipment: document.getElementById('otRoomEquipment').value.trim(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (editId) {
            await db.collection('ot_rooms').doc(editId).update(roomData);
            await logAdminAction('OT Room Updated', `Updated OT room: ${roomData.roomNumber}`);
            showMessage('success', 'OT Room updated successfully!');
        } else {
            roomData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('ot_rooms').add(roomData);
            await logAdminAction('OT Room Added', `Added OT room: ${roomData.roomNumber}`);
            showMessage('success', 'OT Room added successfully!');
        }

        closeOTRoomModal();
        await loadOTRooms();
    } catch (err) {
        console.error('Error saving OT room:', err);
        showMessage('error', 'Error saving OT room. Please try again.');
    }
}

async function editOTRoom(roomId) {
    try {
        const doc = await db.collection('ot_rooms').doc(roomId).get();
        if (!doc.exists) { showMessage('error', 'OT Room not found'); return; }
        const r = doc.data();
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
        set('otRoomNumber', r.roomNumber);
        set('otRoomType', r.type);
        set('otRoomStatus', r.status);
        set('otRoomEquipment', r.equipment);
        // Repurpose the existing modal for edit (no separate edit modal needed)
        const modal = document.getElementById('otRoomModal');
        if (modal) {
            // Mark as editing
            modal._editId = roomId;
            modal.style.display = 'block';
        }
    } catch (err) {
        console.error('Error loading OT room:', err);
        showMessage('error', 'Error loading OT room data');
    }
}

async function deleteOTRoom(roomId, roomNumber) {
    const confirmed = await window.showConfirmation({ title: `Delete OT Room ${roomNumber}?`, message: 'This action cannot be undone.', confirmText: 'Delete' });
    if (!confirmed) return;
    try {
        await db.collection('ot_rooms').doc(roomId).delete();
        await logAdminAction('OT Room Deleted', `Deleted OT room: ${roomNumber}`);
        showMessage('success', 'OT Room deleted successfully!');
        await loadOTRooms();
    } catch (err) {
        console.error('Error deleting OT room:', err);
        showMessage('error', 'Error deleting OT room');
    }
}

async function addSampleOTRoom() {
    try {
        await db.collection('ot_rooms').add({
            roomNumber: '101', type: 'general', status: 'available',
            equipment: 'Basic surgical equipment, monitors, ventilator',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showMessage('success', 'Sample OT room added!');
        loadOTRooms();
    } catch (err) {
        showMessage('error', 'Error adding sample room: ' + err.message);
    }
}

// ── OT Schedule ───────────────────────────────────────────────
function openOTScheduleModal() {
    populateScheduleSelects();
    const form = document.getElementById('otScheduleForm');
    if (form) {
        form.reset();
        delete form.dataset.editId;
    }
    const title = document.getElementById('otScheduleModalTitle');
    if (title) title.textContent = 'Schedule Operation';

    const dateEl = document.getElementById('scheduleDate');
    if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];
    const modal = document.getElementById('otScheduleModal');
    if (modal) modal.style.display = 'block';
}

function closeOTScheduleModal() {
    const m = document.getElementById('otScheduleModal');
    if (m) m.style.display = 'none';
}

function populateScheduleSelects() {
    // OT Rooms select
    const otRoomSelect = document.getElementById('scheduleOTRoom');
    if (otRoomSelect) {
        otRoomSelect.innerHTML = '<option value="">Select OT Room</option>';
        allOTRooms.filter(r => r.status === 'available').forEach(r => {
            otRoomSelect.innerHTML += `<option value="${r.id}">OT Room ${r.roomNumber} (${capitalizeFirst(r.type)})</option>`;
        });
    }
    // Patients select
    const patientSelect = document.getElementById('schedulePatient');
    if (patientSelect) {
        patientSelect.innerHTML = '<option value="">Select Patient</option>';
        allPatients.forEach(p => {
            patientSelect.innerHTML += `<option value="${p.id}">${p.name} (${p.age}y, ${capitalizeFirst(p.gender)})</option>`;
        });
    }
    // Surgeon select
    const surgeonSelect = document.getElementById('scheduleSurgeon');
    if (surgeonSelect) {
        surgeonSelect.innerHTML = '<option value="">Select Surgeon</option>';
        allDoctors.forEach(d => {
            const spec = d.specialization || d.specialty || '';
            const specText = spec ? ` (${capitalizeFirst(spec)})` : '';
            surgeonSelect.innerHTML += `<option value="${d.id}">${d.name || 'Unknown Doctor'}${specText}</option>`;
        });
    }
}

function populateOTRoomSelects() { populateScheduleSelects(); }

async function handleOTScheduleSubmit(e) {
    e.preventDefault();
    if (!currentUserData || currentUserData.role !== 'admin') return;
    try {
        const form = document.getElementById('otScheduleForm');
        const editId = form.dataset.editId;

        const scheduleData = {
            otRoomId: document.getElementById('scheduleOTRoom').value,
            patientId: document.getElementById('schedulePatient').value,
            surgeonId: document.getElementById('scheduleSurgeon').value,
            date: document.getElementById('scheduleDate').value,
            startTime: document.getElementById('scheduleStartTime').value,
            endTime: document.getElementById('scheduleEndTime').value,
            procedure: document.getElementById('scheduleProcedure').value.trim(),
            notes: document.getElementById('scheduleNotes').value.trim(),
            anesthesiologist: document.getElementById('scheduleAnesthesiologist').value.trim(),
            nurses: document.getElementById('scheduleNurses').value.trim(),
            priority: document.getElementById('schedulePriority').value
        };

        const roomConflict = await checkOTConflict(scheduleData.otRoomId, scheduleData.date, scheduleData.startTime, scheduleData.endTime, editId);
        if (roomConflict) { showMessage('error', 'Time conflict! OT room already booked for this time.'); return; }

        const doctorConflict = await checkDoctorConflict(scheduleData.surgeonId, scheduleData.date, scheduleData.startTime, scheduleData.endTime, editId);
        if (doctorConflict) { showMessage('error', 'Time conflict! Surgeon is already booked for this time.'); return; }

        if (editId) {
            scheduleData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('ot_schedules').doc(editId).update(scheduleData);
            await logAdminAction('operation_updated', `Updated schedule: ${scheduleData.procedure}`, 'ot_schedules', editId);
            showMessage('success', 'Operation updated successfully!');
        } else {
            scheduleData.status = 'scheduled';
            scheduleData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            const docRef = await db.collection('ot_schedules').add(scheduleData);
            await logAdminAction('operation_created', `Scheduled: ${scheduleData.procedure}`, 'ot_schedules', docRef.id);
            showMessage('success', 'Operation scheduled successfully!');
        }
        closeOTScheduleModal();
        await loadOTSchedule();
        if (document.getElementById('section-scheduling').classList.contains('active')) {
            loadAdvancedSchedules();
        }
        if (document.getElementById('section-operations').classList.contains('active')) {
            loadOperationsManagement();
        }
    } catch (err) {
        console.error('Error scheduling operation:', err);
        showMessage('error', 'Error scheduling operation. Please try again.');
    }
}

async function checkOTConflict(roomId, date, startTime, endTime, excludeId = null) {
    try {
        const snap = await db.collection('ot_schedules')
            .where('otRoomId', '==', roomId).where('date', '==', date).get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }))
            .filter(s => s.id !== excludeId && s.status !== 'cancelled')
            .some(s => startTime < s.endTime && endTime > s.startTime);
    } catch (err) { return false; }
}

async function checkDoctorConflict(surgeonId, date, startTime, endTime, excludeId = null) {
    try {
        const snap = await db.collection('ot_schedules')
            .where('surgeonId', '==', surgeonId).where('date', '==', date).get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }))
            .filter(s => s.id !== excludeId && s.status !== 'cancelled')
            .some(s => startTime < s.endTime && endTime > s.startTime);
    } catch (err) { return false; }
}

async function loadOTSchedule() {
    const dateEl = document.getElementById('otScheduleDate');
    const selectedDate = (dateEl && dateEl.value) || new Date().toISOString().split('T')[0];
    try {
        const snap = await db.collection('ot_schedules')
            .where('date', '==', selectedDate).orderBy('startTime').get();
        allOTSchedules = [];
        snap.forEach(d => allOTSchedules.push({ id: d.id, ...d.data() }));
        displayOTSchedule();
    } catch (err) {
        console.error('Error loading OT schedule:', err);
        showMessage('error', 'Error loading OT schedule');
    }
}

function displayOTSchedule() {
    const c = document.getElementById('otScheduleContainer');
    if (!c) return;
    if (allOTSchedules.length === 0) {
        c.innerHTML = `<div style="text-align:center;padding:3rem;color:var(--text-secondary);">
            <h3>No operations scheduled for this date</h3>
            <p>Click "Schedule Operation" to add a new operation</p></div>`;
        return;
    }
    let html = `<div style="overflow-x:auto;"><table class="data-table">
        <thead><tr><th>Time</th><th>OT Room</th><th>Patient</th><th>Surgeon</th><th>Procedure</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>`;
    allOTSchedules.forEach(s => {
        const room = allOTRooms.find(r => r.id === s.otRoomId);
        const patient = allPatients.find(p => p.id === s.patientId);
        const surgeon = allDoctors.find(d => d.id === s.surgeonId);
        const roomName = room ? room.roomNumber : (s.otRoomId ? 'ID:' + s.otRoomId.slice(0, 4) : 'Unknown');
        const patName = patient ? patient.name : 'Unknown Patient';
        const docName = surgeon ? surgeon.name : 'Unknown Surgeon';
        const emergencyMarker = s.priority === 'emergency' ? ' <span class="badge badge-danger">Emergency</span>' : '';
        html += `<tr>
            <td>${s.startTime || '?'} - ${s.endTime || '?'}</td>
            <td>OT ${roomName}</td>
            <td>${patName}</td>
            <td>${docName}</td>
            <td>${s.procedure || '-'}${emergencyMarker}</td>
            <td><span style="padding:.25rem .75rem;border-radius:15px;font-size:.8rem;background:${getScheduleStatusColor(s.status)};">
                ${capitalizeFirst(s.status)}</span></td>
            <td>
              <button class="btn btn-warning btn-sm" onclick="updateOTStatus('${s.id}')">Update</button>
              <button class="btn btn-danger btn-sm" onclick="cancelOperation('${s.id}')">Cancel</button>
            </td>
          </tr>`;
    });
    html += '</tbody></table></div>';
    c.innerHTML = html;
}

function getScheduleStatusColor(status) {
    const m = {
        scheduled: 'rgba(52,152,219,.1);color:#2980b9', 'in-progress': 'rgba(255,193,7,.1);color:#b45309',
        completed: 'rgba(39,174,96,.1);color:#27ae60', cancelled: 'rgba(231,76,60,.1);color:#e74c3c'
    };
    return m[status] || 'rgba(149,165,166,.1);color:#7f8c8d';
}

function changeOTDate(days) {
    const dateEl = document.getElementById('otScheduleDate');
    if (!dateEl) return;
    const d = new Date(dateEl.value || new Date());
    d.setDate(d.getDate() + days);
    dateEl.value = d.toISOString().split('T')[0];
    loadOTSchedule();
}

async function updateOTStatus(scheduleId) {
    if (!currentUserData || currentUserData.role !== 'admin') return;
    _otStatusScheduleId = scheduleId;
    const modal = document.getElementById('otStatusModal');
    if (!modal) { showToast('error', 'Status modal not found'); return; }
    modal.style.display = 'block';
    const saveBtn = document.getElementById('otStatusSaveBtn');
    if (saveBtn) {
        saveBtn.onclick = async function () {
            const newStatus = document.getElementById('otStatusSelect').value;
            modal.style.display = 'none';
            try {
                await db.collection('ot_schedules').doc(_otStatusScheduleId).update({
                    status: newStatus, updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                await logAdminAction('operation_status_updated', `Status to ${newStatus}`, 'ot_schedules', _otStatusScheduleId);
                showToast('success', 'Operation status updated!');
                await loadOTSchedule();
                if (document.getElementById('section-scheduling').classList.contains('active')) {
                    loadAdvancedSchedules();
                }
            } catch (err) {
                console.error('Error updating status:', err);
                showToast('error', 'Error updating status');
            }
        };
    }
}

async function cancelOperation(scheduleId) {
    if (!currentUserData || currentUserData.role !== 'admin') return;
    const confirmed = await window.showConfirmation({ title: 'Cancel this operation?', message: 'It will be marked as cancelled.', confirmText: 'Cancel Operation' });
    if (!confirmed) return;
    try {
        await db.collection('ot_schedules').doc(scheduleId).update({
            status: 'cancelled', updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await logAdminAction('schedule_cancelled', 'Cancelled scheduled operation', 'ot_schedules', scheduleId);
        showMessage('success', 'Operation cancelled.');
        await loadOTSchedule();
        if (document.getElementById('section-scheduling').classList.contains('active')) {
            loadAdvancedSchedules();
        }
    } catch (err) {
        console.error('Error cancelling operation:', err);
        showMessage('error', 'Error cancelling operation');
    }
}

// ── Activity Log ──────────────────────────────────────────────
async function loadActivityLog() {
    try {
        const snap = await db.collection('adminLogs').orderBy('timestamp', 'desc').limit(50).get();
        const logC = document.getElementById('activityLog');
        const empty = document.getElementById('logsEmptyState');
        if (snap.empty) { if (empty) empty.style.display = 'flex'; return; }
        if (empty) empty.style.display = 'none';
        let html = '';
        snap.forEach(doc => {
            const log = doc.data();
            const ts = log.timestamp ? log.timestamp.toDate().toLocaleString() : 'Unknown time';
            const actionStr = (log.action || 'Action').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            const userStr = log.userEmail ? `<span style="color:var(--text-secondary); margin-left:0.5rem;"><i class="fas fa-user" style="font-size:0.75rem;"></i> ${log.userEmail}</span>` : '';
            const targetAttr = (log.entityType && log.entityId) ? ` title="Target: ${log.entityType}:${log.entityId}" style="cursor:help;"` : '';

            html += `<div class="audit-entry">
                <div class="audit-time">${ts}${userStr}</div>
                <div class="audit-action"><span${targetAttr}>${actionStr}</span></div>
                <div class="audit-detail">${log.details}</div></div>`;
        });
        if (logC) logC.innerHTML = (empty ? empty.outerHTML : '') + html;
        const embedded = logC && logC.querySelector('#logsEmptyState');
        if (embedded) embedded.style.display = 'none';
    } catch (err) {
        console.error('Error loading activity log:', err);
    }
}

// ── Profile / Availability ────────────────────────────────────
async function handleProfileUpdate(e) {
    e.preventDefault();
    if (!currentUser) { showMessage('error', 'No user signed in'); return; }
    try {
        const data = {
            fullName: document.getElementById('editFullName').value.trim(),
            phone: document.getElementById('editPhone').value.trim(),
            department: document.getElementById('editDepartment').value,
            bio: document.getElementById('bio').value.trim(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        await db.collection('users').doc(currentUser.uid).update(data);
        await logAdminAction('Profile Updated', 'User updated their profile');
        currentUserData.fullName = data.fullName;
        currentUserData.phone = data.phone;
        currentUserData.department = data.department;
        currentUserData.bio = data.bio;
        const un = document.getElementById('userName');
        const ud = document.getElementById('userDepartment');
        const uw = document.getElementById('userWelcome');
        if (un) un.textContent = data.fullName;
        if (ud) ud.textContent = data.department;
        if (uw) uw.textContent = `Welcome, ${data.fullName}`;
        showMessage('success', 'Profile updated successfully!');
    } catch (err) {
        console.error('Error updating profile:', err);
        showMessage('error', 'Error updating profile');
    }
}

async function handleAvailabilityUpdate(e) {
    e.preventDefault();
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const data = {};
    days.forEach(day => {
        const cb = document.getElementById(day);
        const s = document.getElementById(day + 'Start');
        const en = document.getElementById(day + 'End');
        data[day] = {
            available: cb ? cb.checked : false,
            startTime: s ? s.value : '09:00',
            endTime: en ? en.value : '17:00'
        };
    });
    try {
        await db.collection('users').doc(currentUser.uid).update({
            availability: data, updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await logAdminAction('Availability Updated', 'User updated availability schedule');
        showMessage('success', 'Availability updated successfully!');
    } catch (err) {
        console.error('Error updating availability:', err);
        showMessage('error', 'Error updating availability');
    }
}

// ── Export ────────────────────────────────────────────────────
async function exportDoctors() {
    try {
        let csv = 'Name,Email,Phone,Specialization,License,Experience,Fee,Status\n';
        allDoctors.forEach(d => {
            csv += [d.name, d.email, d.phone, d.specialization, d.licenseNumber || '',
            d.experience || 0, d.consultationFee || 0, d.status || 'active']
                .map(v => `"${v}"`).join(',') + '\n';
        });
        const a = Object.assign(document.createElement('a'), {
            href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
            download: `doctors_${new Date().toISOString().split('T')[0]}.csv`
        });
        a.click();
        URL.revokeObjectURL(a.href);
        await logAdminAction('Data Export', 'Exported doctors CSV');
        showMessage('success', 'Doctors exported!');
    } catch (err) {
        showMessage('error', 'Error exporting doctors');
    }
}

// ── Auth helpers ──────────────────────────────────────────────
function setAuthLoading(loading) {
    const btn = document.getElementById('authButton');
    const txt = document.getElementById('authButtonText');
    const spin = document.getElementById('authSpinner');
    if (!btn) return;
    btn.disabled = loading;
    if (txt) txt.style.display = loading ? 'none' : 'inline';
    if (spin) spin.style.display = loading ? 'inline-block' : 'none';
}

function showAuthMessage(type, message) {
    const err = document.getElementById('authErrorMessage');
    const suc = document.getElementById('authSuccessMessage');
    hideAuthMessages();
    if (type === 'error') { if (err) { err.textContent = message; err.style.display = 'block'; } }
    else { if (suc) { suc.textContent = message; suc.style.display = 'block'; } }
    setTimeout(hideAuthMessages, 5000);
}

function hideAuthMessages() {
    const err = document.getElementById('authErrorMessage');
    const suc = document.getElementById('authSuccessMessage');
    if (err) err.style.display = 'none';
    if (suc) suc.style.display = 'none';
}

// ─────────────────────────────────────────────────────────────────
// SHARED HELPERS — all exported to window so onclick= in HTML works
// ─────────────────────────────────────────────────────────────────

function capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function showToast(type, message, duration) {
    duration = duration || 4000;
    const icons = { success: 'fa-check-circle', error: 'fa-times-circle', info: 'fa-info-circle', warning: 'fa-exclamation-triangle' };
    const container = document.getElementById('toastContainer');
    if (!container) {
        // Fallback: floating div if toastContainer not in DOM
        const n = document.createElement('div');
        n.style.cssText = `position:fixed;top:20px;right:20px;padding:1rem 1.5rem;border-radius:12px;
            color:#fff;font-weight:500;z-index:20000;max-width:380px;
            background:${type === 'success' ? 'rgba(39,174,96,.95)' : 'rgba(231,76,60,.95)'};`;
        n.textContent = message;
        document.body.appendChild(n);
        setTimeout(() => n.remove(), duration);
        return;
    }
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.innerHTML = `<i class="fas ${icons[type] || 'fa-bell'}"></i><span>${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideOutRight .28s ease forwards';
        setTimeout(() => toast.remove(), 280);
    }, duration);
}

// MediCore universal notification system
window.showNotification = showToast;

function showMessage(type, message) {
    showToast(type === 'success' ? 'success' : 'error', message);
}

async function logAdminAction(action, details, entityType = null, entityId = null, metadata = null) {
    try {
        if (!currentUser) return;
        const logData = {
            userId: currentUser.uid,
            userEmail: currentUser.email,
            action,
            details: details || '',
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (entityType) logData.entityType = entityType;
        if (entityId) logData.entityId = entityId;
        if (metadata) logData.metadata = metadata;

        await db.collection('adminLogs').add(logData);
    } catch (err) {
        console.error('Error logging admin action:', err);
    }
}

window.showConfirmation = function ({ title, message, confirmText = 'Confirm', cancelText = 'Cancel', onConfirm, onCancel }) {
    return new Promise(resolve => {
        const modal = document.getElementById('confirmModal');
        if (!modal) {
            const res = window.confirm(title + '\n' + message);
            if (res && onConfirm) onConfirm();
            if (!res && onCancel) onCancel();
            resolve(res);
            return;
        }
        const t = document.getElementById('confirmTitle');
        const m = document.getElementById('confirmMessage');
        const okBtn = document.getElementById('confirmOkBtn');
        const cancelBtn = document.getElementById('confirmCancelBtn');
        if (t) t.textContent = title || 'Confirm Action';
        if (m) m.textContent = message || '';
        if (okBtn) okBtn.textContent = confirmText;
        if (cancelBtn) cancelBtn.textContent = cancelText;
        modal.style.display = 'flex';
        window._confirmResolve = function (result) {
            modal.style.display = 'none';
            if (result && onConfirm) onConfirm();
            if (!result && onCancel) onCancel();
            resolve(result);
        };
    });
}

// openModal / closeModal generic helpers — used by legacy onclick= in HTML
function openModal(modalId) {
    if (modalId === 'emergencyModal') {
        showToast('warning', 'Emergency Protocol — contact the on-call team immediately.', 6000);
        return;
    }
    const m = document.getElementById(modalId);
    if (m) m.style.display = 'block';
    else showToast('info', `${modalId} not available`);
}

function closeModal(modalId) {
    const m = document.getElementById(modalId);
    if (m) m.style.display = 'none';
}

// ── Sidebar ───────────────────────────────────────────────────
let sidebarOpen = true;

function toggleSidebar() {
    const nav = document.getElementById('dashboardNav');
    const main = document.querySelector('.main-content');
    const btn = document.getElementById('sidebarToggleBtn');
    if (!nav) return;
    sidebarOpen = !sidebarOpen;
    if (sidebarOpen) {
        nav.classList.remove('closed');
        if (main) main.classList.remove('sidebar-closed');
        if (btn) { btn.classList.remove('closed'); btn.innerHTML = '‹'; btn.title = 'Close Sidebar'; }
    } else {
        nav.classList.add('closed');
        if (main) main.classList.add('sidebar-closed');
        if (btn) { btn.classList.add('closed'); btn.innerHTML = '›'; btn.title = 'Open Sidebar'; }
    }
}

// Mobile sidebar toggle (hamburger button)
function toggleMobileSidebar() {
    const nav = document.getElementById('dashboardNav');
    const overlay = document.getElementById('navOverlay');
    if (!nav) return;
    const isOpen = nav.classList.toggle('open');
    if (overlay) overlay.classList.toggle('open', isOpen);
    document.body.classList.toggle('mobile-nav-open', isOpen);
}

function closeMobileSidebar() {
    const nav = document.getElementById('dashboardNav');
    const overlay = document.getElementById('navOverlay');
    if (nav) nav.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
    document.body.classList.remove('mobile-nav-open');
}

// Sidebar toggle button creation
function createSidebarToggle() {
    if (document.getElementById('sidebarToggleBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'sidebarToggleBtn';
    btn.className = 'sidebar-toggle-btn';
    btn.innerHTML = '‹';
    btn.title = 'Close Sidebar';
    btn.onclick = toggleSidebar;
    document.body.appendChild(btn);
}

document.addEventListener('DOMContentLoaded', () => setTimeout(createSidebarToggle, 100));
window.addEventListener('load', () => { if (!document.getElementById('sidebarToggleBtn')) createSidebarToggle(); });
document.addEventListener('keydown', e => { if (e.ctrlKey && e.key === 'b') { e.preventDefault(); toggleSidebar(); } });

// ── Placeholder stubs ─────────────────────────────────────────
function changePassword() { showToast('info', 'Use "Reset Password" to receive a reset link by email.'); }
async function resetPassword() {
    if (!currentUser) return;
    try {
        await auth.sendPasswordResetEmail(currentUser.email);
        showMessage('success', 'Password reset email sent!');
    } catch (err) { showMessage('error', 'Error sending reset email'); }
}
async function resendVerification() {
    if (!currentUser) return;
    try {
        await currentUser.sendEmailVerification();
        showMessage('success', 'Verification email sent!');
    } catch (err) { showMessage('error', 'Error sending verification email'); }
}
function contactSupport() { showToast('info', 'Support: support@hospital.com | +1 (555) 123-4567'); }
function editProfile() { showSection('profile'); }
function viewAllUsers() { showSection('users'); }
function manageUsers() { showSection('users'); }
async function loadAnalytics() {
    if (!currentUserData || currentUserData.role !== 'admin') return;
    try {
        const stats = { docs: allDoctors.length, pats: allPatients.length, rooms: allOTRooms.length };
        const schedSnap = await db.collection('ot_schedules').get();
        let totalScheds = 0;
        const roomCount = {};
        const statusCount = {};

        const txt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

        const todayStr = new Date().toISOString().split('T')[0];
        let todayCount = 0;
        let upcomingCount = 0;

        schedSnap.forEach(d => {
            const s = d.data();
            totalScheds++;
            if (s.date === todayStr) todayCount++;
            if (s.date > todayStr) upcomingCount++;

            const room = allOTRooms.find(r => r.id === s.otRoomId);
            const roomName = room ? 'OT ' + room.roomNumber : 'Unknown';
            roomCount[roomName] = (roomCount[roomName] || 0) + 1;
            statusCount[s.status] = (statusCount[s.status] || 0) + 1;
        });

        txt('analyticsTotalDoctors', stats.docs);
        txt('analyticsTotalPatients', stats.pats);
        txt('analyticsTotalRooms', stats.rooms);
        txt('analyticsTotalSchedules', totalScheds);
        txt('analyticsTodaySchedules', todayCount);
        txt('analyticsUpcomingSchedules', upcomingCount);

        let roomHtml = '<table class="data-table"><thead><tr><th>Room</th><th>Total Operations</th></tr></thead><tbody>';
        Object.entries(roomCount).sort((a, b) => b[1] - a[1]).forEach(([r, c]) => {
            roomHtml += `<tr><td>${r}</td><td>${c}</td></tr>`;
        });
        roomHtml += '</tbody></table>';
        document.getElementById('analyticsRoomStats').innerHTML = roomHtml;

        let statusHtml = '<table class="data-table"><thead><tr><th>Status</th><th>Count</th></tr></thead><tbody>';
        Object.entries(statusCount).forEach(([s, c]) => {
            statusHtml += `<tr><td>${capitalizeFirst(s)}</td><td>${c}</td></tr>`;
        });
        statusHtml += '</tbody></table>';
        document.getElementById('analyticsStatusStats').innerHTML = statusHtml;
    } catch (err) {
        console.error('Error loading analytics:', err);
        showToast('error', 'Error loading analytics');
    }
}

async function loadAdvancedSchedules() {
    if (!currentUserData || currentUserData.role !== 'admin') return;
    try {
        const dateFilter = document.getElementById('schedFilterDate').value;
        const statusFilter = document.getElementById('schedFilterStatus').value;
        const roomFilter = document.getElementById('schedFilterRoom').value;

        const roomSelect = document.getElementById('schedFilterRoom');
        if (roomSelect && roomSelect.options.length <= 1) {
            allOTRooms.forEach(r => {
                const opt = document.createElement('option');
                opt.value = r.id;
                opt.textContent = `OT Room ${r.roomNumber}`;
                roomSelect.appendChild(opt);
            });
        }

        const snap = await db.collection('ot_schedules').orderBy('startTime').get();
        let schedules = [];
        snap.forEach(d => schedules.push({ id: d.id, ...d.data() }));

        if (dateFilter) schedules = schedules.filter(s => s.date === dateFilter);
        if (roomFilter) schedules = schedules.filter(s => s.otRoomId === roomFilter);
        if (statusFilter) schedules = schedules.filter(s => s.status === statusFilter);

        let html = `<div style="overflow-x:auto;"><table class="data-table">
            <thead><tr><th>Date</th><th>Time</th><th>Room</th><th>Patient</th><th>Surgeon</th><th>Procedure</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>`;
        schedules.forEach(s => {
            const room = allOTRooms.find(r => r.id === s.otRoomId);
            const patient = allPatients.find(p => p.id === s.patientId);
            const surgeon = allDoctors.find(d => d.id === s.surgeonId);

            const roomName = room ? room.roomNumber : (s.otRoomId ? 'ID:' + s.otRoomId.slice(0, 4) : 'Unknown');
            const patName = patient ? patient.name : 'Unknown Patient';
            const docName = surgeon ? surgeon.name : 'Unknown Surgeon';
            const emergencyMarker = s.priority === 'emergency' ? ' <span class="badge badge-danger">Emergency</span>' : '';

            html += `<tr>
                <td>${s.date || 'No Date'}</td>
                <td>${s.startTime || '?'} - ${s.endTime || '?'}</td>
                <td>OT ${roomName}</td>
                <td>${patName}</td>
                <td>${docName}</td>
                <td>${s.procedure || '-'}${emergencyMarker}</td>
                <td><span style="padding:.25rem .75rem;border-radius:15px;font-size:.8rem;background:${getScheduleStatusColor(s.status)};">
                    ${capitalizeFirst(s.status)}</span></td>
                <td>
                    <button class="btn btn-warning btn-sm" onclick="editSchedule('${s.id}')">Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="cancelOperation('${s.id}')">Cancel</button>
                </td>
            </tr>`;
        });
        html += '</tbody></table></div>';
        const container = document.getElementById('advancedSchedulesContainer');
        if (container) container.innerHTML = html;
    } catch (err) {
        console.error('Error loading schedules:', err);
        showToast('error', 'Error loading schedules');
    }
}

function clearSchedFilters() {
    document.getElementById('schedFilterDate').value = '';
    document.getElementById('schedFilterStatus').value = '';
    document.getElementById('schedFilterRoom').value = '';
    loadAdvancedSchedules();
}

async function editSchedule(scheduleId) {
    if (!currentUserData || currentUserData.role !== 'admin') return;
    populateScheduleSelects();
    try {
        const doc = await db.collection('ot_schedules').doc(scheduleId).get();
        if (!doc.exists) return;
        const s = doc.data();
        document.getElementById('scheduleOTRoom').value = s.otRoomId;
        document.getElementById('schedulePatient').value = s.patientId;
        document.getElementById('scheduleSurgeon').value = s.surgeonId;
        document.getElementById('scheduleDate').value = s.date;
        document.getElementById('scheduleStartTime').value = s.startTime;
        document.getElementById('scheduleEndTime').value = s.endTime;
        document.getElementById('scheduleProcedure').value = s.procedure;
        document.getElementById('scheduleNotes').value = s.notes || '';
        document.getElementById('scheduleAnesthesiologist').value = s.anesthesiologist || '';
        document.getElementById('scheduleNurses').value = s.nurses || '';
        document.getElementById('schedulePriority').value = s.priority || 'normal';

        document.getElementById('otScheduleForm').dataset.editId = scheduleId;
        document.getElementById('otScheduleModalTitle').textContent = 'Edit Operation';

        const modal = document.getElementById('otScheduleModal');
        if (modal) modal.style.display = 'block';
    } catch (err) {
        console.error('Error fetching schedule:', err);
        showToast('error', 'Error fetching schedule');
    }
}

function viewAnalytics() { loadAnalytics(); showSection('analytics'); }

async function deleteOperation(scheduleId) {
    if (!currentUserData || currentUserData.role !== 'admin') return;
    const confirmed = await window.showConfirmation({ title: 'Delete Operation', message: 'This will permanently delete this operation. Are you sure?', confirmText: 'Delete' });
    if (!confirmed) return;
    try {
        await db.collection('ot_schedules').doc(scheduleId).delete();
        await logAdminAction('operation_deleted', 'Admin deleted operation record', 'ot_schedules', scheduleId);
        showMessage('success', 'Operation deleted successfully.');
        if (document.getElementById('section-operations').classList.contains('active')) loadOperationsManagement();
        if (document.getElementById('section-scheduling').classList.contains('active')) loadAdvancedSchedules();
        loadOTSchedule();
        loadAnalytics();
    } catch (err) {
        console.error('Error deleting operation:', err);
        showMessage('error', 'Error deleting operation.');
    }
}

async function loadOperationsManagement() {
    if (!currentUserData || currentUserData.role !== 'admin') return;
    try {
        const snap = await db.collection('ot_schedules').orderBy('startTime').get();
        let schedules = [];
        snap.forEach(d => schedules.push({ id: d.id, ...d.data() }));

        let html = `<div style="overflow-x:auto;"><table class="data-table">
            <thead><tr><th>Date & Time</th><th>Patient</th><th>Surgeon</th><th>Procedure</th><th>Anesthesia/Nurses</th><th>Priority</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>`;
        schedules.forEach(s => {
            const patient = allPatients.find(p => p.id === s.patientId);
            const surgeon = allDoctors.find(d => d.id === s.surgeonId);
            const patName = patient ? patient.name : 'Unknown Patient';
            const docName = surgeon ? surgeon.name : 'Unknown Surgeon';

            const staffStr = [s.anesthesiologist, s.nurses].filter(Boolean).join(' / ') || 'Unassigned';
            const priorityBadge = s.priority === 'emergency' ? '<span class="badge badge-danger">Emergency</span>' :
                (s.priority === 'urgent' ? '<span class="badge badge-warning">Urgent</span>' : 'Normal');

            html += `<tr>
                <td>${s.date || 'No Date'}<br><small>${s.startTime || '?'} - ${s.endTime || '?'}</small></td>
                <td>${patName}</td>
                <td>${docName}</td>
                <td>${s.procedure || '-'}</td>
                <td>${staffStr}</td>
                <td>${priorityBadge}</td>
                <td><span style="padding:.25rem .75rem;border-radius:15px;font-size:.8rem;background:${getScheduleStatusColor(s.status)};">${capitalizeFirst(s.status)}</span></td>
                <td>
                    <button class="btn btn-warning btn-sm" onclick="editSchedule('${s.id}')">Edit</button>
                    <button class="btn btn-ghost btn-sm" onclick="cancelOperation('${s.id}')">Cancel</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteOperation('${s.id}')">Delete</button>
                </td>
            </tr>`;
        });
        html += '</tbody></table></div>';
        const container = document.getElementById('operationsContainer');
        if (container) container.innerHTML = html;
    } catch (err) {
        console.error('Error loading operations:', err);
        showToast('error', 'Error loading operations');
    }
}

function openEmergencyModal() {
    if (!currentUserData || currentUserData.role !== 'admin') return;

    // Populate dropdowns
    const patientSel = document.getElementById('emPatient');
    const surgeonSel = document.getElementById('emSurgeon');
    const roomSel = document.getElementById('emOTRoom');

    if (patientSel) {
        patientSel.innerHTML = '<option value="">Select Patient</option>';
        allPatients.forEach(p => patientSel.innerHTML += `<option value="${p.id}">${p.name}</option>`);
    }
    if (surgeonSel) {
        surgeonSel.innerHTML = '<option value="">Unknown / TBA</option>';
        allDoctors.forEach(d => surgeonSel.innerHTML += `<option value="${d.id}">${d.name}</option>`);
    }
    if (roomSel) {
        roomSel.innerHTML = '<option value="">Select OT Room</option>';
        allOTRooms.forEach(r => roomSel.innerHTML += `<option value="${r.id}">OT Room ${r.roomNumber}</option>`);
    }

    const form = document.getElementById('emergencyForm');
    if (form) form.reset();

    const modal = document.getElementById('emergencyModal');
    if (modal) modal.style.display = 'block';
}

function closeEmergencyModal() {
    const modal = document.getElementById('emergencyModal');
    if (modal) modal.style.display = 'none';
}

async function handleEmergencySubmit(e) {
    e.preventDefault();
    if (!currentUserData || currentUserData.role !== 'admin') return;
    try {
        const scheduleData = {
            otRoomId: document.getElementById('emOTRoom').value,
            patientId: document.getElementById('emPatient').value,
            surgeonId: document.getElementById('emSurgeon').value || null,
            date: new Date().toISOString().split('T')[0],
            startTime: new Date().toTimeString().split(' ')[0].slice(0, 5), // Current time HH:MM
            endTime: '23:59', // Block rest of day roughly
            procedure: document.getElementById('emProcedure').value.trim(),
            notes: document.getElementById('emNotes').value.trim(),
            priority: document.getElementById('emPriority').value,
            status: 'scheduled',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        // Attempt room conflict validation
        const roomConflict = await checkOTConflict(scheduleData.otRoomId, scheduleData.date, scheduleData.startTime, scheduleData.endTime);
        if (roomConflict) {
            const confirmed = await window.showConfirmation({ title: 'Room Conflict Detected', message: 'The selected OT room is already booked. Proceed with emergency override?', confirmText: 'Override' });
            if (!confirmed) return;
        }

        if (scheduleData.surgeonId) {
            const docConflict = await checkDoctorConflict(scheduleData.surgeonId, scheduleData.date, scheduleData.startTime, scheduleData.endTime);
            if (docConflict) {
                const confirmed = await window.showConfirmation({ title: 'Surgeon Conflict Detected', message: 'The selected surgeon is already booked. Proceed with emergency override?', confirmText: 'Override' });
                if (!confirmed) return;
            }
        }

        const docRef = await db.collection('ot_schedules').add(scheduleData);
        await logAdminAction('emergency_case_created', `Emergency: ${scheduleData.procedure}`, 'ot_schedules', docRef.id);
        showMessage('success', 'Emergency case created successfully!');

        closeEmergencyModal();
        if (document.getElementById('section-operations').classList.contains('active')) {
            loadOperationsManagement();
        }
        if (document.getElementById('section-scheduling').classList.contains('active')) {
            loadAdvancedSchedules();
        }
    } catch (err) {
        console.error('Error creating emergency case:', err);
        showMessage('error', 'Error creating emergency case');
    }
}

function scheduleManagement() { loadAdvancedSchedules(); showSection('scheduling'); }
function auditLogs() { showSection('logs'); }
function profileSettings() { showSection('profile'); }
function viewAssignments() { showSection('assignments'); }
function updateAvailability() { showSection('availability'); }

// Removed legacy staff data function
// ── Window onclick: close modals by clicking backdrop ─────────
window.onclick = function (event) {
    document.querySelectorAll('.modal').forEach(modal => {
        if (event.target === modal) modal.style.display = 'none';
    });
};

// ── Inject keyframe animations ────────────────────────────────
(function () {
    const s = document.createElement('style');
    s.textContent = `
        @keyframes slideInRight  { from{transform:translateX(100%);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes slideOutRight { from{transform:translateX(0);opacity:1}    to{transform:translateX(100%);opacity:0} }
        @keyframes slideUp       { from{transform:translateY(12px);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes fadeIn        { from{opacity:0} to{opacity:1} }
    `;
    document.head.appendChild(s);
})();

// ── Explicit window exports (for onclick= in HTML) ───────────────
// This guarantees they are accessible even if bundlers change scope.
window.capitalizeFirst = capitalizeFirst;
window.showToast = showToast;
window.showMessage = showMessage;
window.showConfirm = function (title, message) { return window.showConfirmation({ title, message }); };
window.logAdminAction = logAdminAction;
window.openModal = openModal;
window.closeModal = closeModal;
window.showSection = showSection;
window.logout = logout;
window.toggleSidebar = toggleSidebar;
window.toggleMobileSidebar = toggleMobileSidebar;
window.closeMobileSidebar = closeMobileSidebar;
window.openDoctorModal = openDoctorModal;
window.closeDoctorModal = closeDoctorModal;
window.editDoctor = editDoctor;
window.deleteDoctor = deleteDoctor;
window.searchDoctors = searchDoctors;
window.filterDoctors = filterDoctors;
window.exportDoctors = exportDoctors;
window.openPatientModal = openPatientModal;
window.closePatientModal = closePatientModal;
window.editPatient = editPatient;
window.deletePatient = deletePatient;
window.viewPatientDetails = viewPatientDetails;
window.searchPatients = searchPatients;
window.filterPatients = filterPatients;
window.exportPatients = exportPatients;
window.openOTRoomModal = openOTRoomModal;
window.closeOTRoomModal = closeOTRoomModal;
window.editOTRoom = editOTRoom;
window.deleteOTRoom = deleteOTRoom;
window.addSampleOTRoom = addSampleOTRoom;
window.openOTScheduleModal = openOTScheduleModal;
window.closeOTScheduleModal = closeOTScheduleModal;
window.updateOTStatus = updateOTStatus;
window.cancelOperation = cancelOperation;
window.changeOTDate = changeOTDate;
window.changePassword = changePassword;
window.resetPassword = resetPassword;
window.resendVerification = resendVerification;
window.contactSupport = contactSupport;
window.editProfile = editProfile;
window.extendSession = extendSession;
window.endSession = endSession;
window.viewAllUsers = viewAllUsers;
window.manageUsers = manageUsers;
function manageOperations() { showSection('operations'); }

window.viewAnalytics = viewAnalytics;
window.manageOperations = manageOperations;
window.scheduleManagement = scheduleManagement;
window.auditLogs = auditLogs;
window.profileSettings = profileSettings;
window.viewAssignments = viewAssignments;
window.updateAvailability = updateAvailability;
window.loadAnalytics = loadAnalytics;
window.loadOperationsManagement = loadOperationsManagement;
window.loadAdvancedSchedules = loadAdvancedSchedules;
window.clearSchedFilters = clearSchedFilters;
window.editSchedule = editSchedule;
window.handleOTScheduleSubmit = handleOTScheduleSubmit;
window.loadOTSchedule = loadOTSchedule;
window.openEmergencyModal = openEmergencyModal;
window.closeEmergencyModal = closeEmergencyModal;
window.handleEmergencySubmit = handleEmergencySubmit;
window.deleteOperation = deleteOperation;

// User Management
window.editUser = editUser;
window.closeUserModal = closeUserModal;
window.deactivateUser = deactivateUser;
window.signInWithGoogle = signInWithGoogle;

// ── Logout ─────────────────────────────────────────────────────
async function logout() {
    try {
        if (currentUser) await logAdminAction('User Logout', 'User logged out');
        await auth.signOut();
        clearInterval(sessionTimer);
        sessionStartTime = null;
        currentUser = null;
        currentUserData = null;
        showMessage('success', 'Logged out successfully!');
    } catch (err) {
        console.error('Error logging out:', err);
        showMessage('error', 'Error logging out');
    }
}
// Re-export logout after definition
window.logout = logout;

// ── Patient Portal Functions ──────────────────────────────────────────
async function loadPatientProfile() {
    // Already populated by loadProfileFields
}
window.loadPatientProfile = loadPatientProfile;

async function handlePatientProfileUpdate(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const origText = btn.textContent;
    btn.textContent = 'Saving...'; btn.disabled = true;
    try {
        const updatedName = document.getElementById('patProfileName').value.trim();
        const payload = {
            name: updatedName,
            phone: document.getElementById('patProfilePhone').value.trim(),
            gender: document.getElementById('patProfileGender').value,
            age: document.getElementById('patProfileAge').value ? parseInt(document.getElementById('patProfileAge').value, 10) : null,
            bloodGroup: document.getElementById('patProfileBlood').value,
            address: document.getElementById('patProfileAddress').value.trim(),
            emergencyContact: document.getElementById('patProfileEmergency').value.trim(),
            medicalHistory: document.getElementById('patProfileHistory').value.trim(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        await db.collection('patients').doc(currentUser.uid).update(payload);

        // Sync with users collection
        await db.collection('users').doc(currentUser.uid).update({
            fullName: updatedName,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Update local session
        currentUserData.fullName = updatedName;

        showMessage('success', 'Profile updated successfully!');

        // Update dashboard snapshot UI
        const pDoc = await db.collection('patients').doc(currentUser.uid).get();
        if (pDoc.exists) {
            const p = pDoc.data();
            document.getElementById('patientSummaryName').textContent = p.name || 'N/A';
            document.getElementById('patientSummaryPhone').textContent = p.phone || 'N/A';
            document.getElementById('patientWelcomeName').textContent = p.name || 'Patient';
        }
    } catch (err) {
        console.error('Error updating patient profile:', err);
        showMessage('error', 'Failed to update profile.');
    } finally {
        btn.textContent = origText; btn.disabled = false;
    }
}
window.handlePatientProfileUpdate = handlePatientProfileUpdate;

async function loadPatientDoctors() {
    const container = document.getElementById('patientDoctorsList');
    if (!container) return;
    try {
        const snap = await db.collection('doctors').orderBy('name').get();
        if (snap.empty) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-user-md"></i><h3>No Doctors Available</h3><p>Check back later.</p></div>';
            return;
        }
        let html = '';
        snap.forEach(doc => {
            const d = doc.data();
            if (d.status === 'inactive') return; // Hide inactive doctors from patients
            const fee = d.consultationFee ? `₹${d.consultationFee}` : '₹500';
            const exp = d.experience ? `${d.experience} years exp.` : 'Experience not specified';
            const spec = d.specialty || d.specialization || 'General Medicine';
            const statusLabel = d.status ? (d.status.charAt(0).toUpperCase() + d.status.slice(1)) : 'Active';
            html += `
            <div class="item-card">
                <div class="item-header">
                    <div>
                        <div class="item-title">${d.name}</div>
                        <div class="item-subtitle">${spec} • ${exp}</div>
                    </div>
                    <div style="text-align: right;">
                        <span class="badge" style="background: rgba(41,128,185,0.1); color: #2980b9; margin-bottom: 5px; display: inline-block;">${fee}</span><br>
                        <span class="badge" style="background: rgba(39,174,96,0.1); color: #27ae60; display: inline-block;">${statusLabel}</span>
                    </div>
                </div>
                <button class="btn btn-primary btn-sm" onclick="openAppointmentModal('${doc.id}', '${(d.name || '').replace(/'/g, "\\'")}', '${d.email || ''}', '${spec.replace(/'/g, "\\'")}')" style="margin-top: 15px; width: 100%;"><i class="fas fa-calendar-plus"></i> Book Appointment</button>
            </div>`;
        });
        container.innerHTML = html;
    } catch (err) {
        console.error('Error loading patient doctors:', err);
        container.innerHTML = '<p style="padding:1rem;color:red;">Error loading doctors.</p>';
    }
}
window.loadPatientDoctors = loadPatientDoctors;
// ── Staff Portal Functions ──────────────────────────────────────────────
async function loadStaffDashboard() {
    if (!currentUser || !currentUserData || currentUserData.role !== 'user') return;

    document.getElementById('staffWelcomeName').textContent = currentUserData.fullName || 'Staff Member';

    try {
        const todayStr = new Date().toISOString().split('T')[0];

        // Find if this staff member is linked to a doctor profile
        const doctorSnap = await db.collection('doctors').where('email', '==', currentUser.email).limit(1).get();
        if (doctorSnap.empty) {
            document.getElementById('staffAssignmentsCount').textContent = "0";
            document.getElementById('staffTodayCases').textContent = "0";
            document.getElementById('staffCompletedCases').textContent = "0";
            const recentContainer = document.getElementById('staffRecentAssignments');
            recentContainer.innerHTML = '<div class="empty-state"><i class="fas fa-user-md"></i><h3>No Doctor Profile Linked</h3><p>Your account is not linked to any active doctor profile.</p></div>';
            return;
        }

        const snap = await db.collection('appointments').where('doctorEmail', '==', currentUser.email).get();
        let myAssignmentsCount = 0;
        let todayCasesCount = 0;
        let completedCasesCount = 0;
        let recentAssignmentsHTML = '';
        let counter = 0;

        let appointments = [];
        snap.forEach(doc => {
            const data = doc.data();
            appointments.push({ id: doc.id, ...data });
        });

        // sort descending by date
        appointments.sort((a, b) => b.appointmentDate.localeCompare(a.appointmentDate));

        appointments.forEach(data => {
            myAssignmentsCount++;
            if (data.appointmentDate === todayStr) todayCasesCount++;
            if (data.status === 'completed') completedCasesCount++;

            // Add to recent assignments (limit 5)
            if (counter < 5) {
                const statusColors = {
                    pending: '#f39c12',
                    confirmed: '#007bff',
                    completed: '#28a745',
                    cancelled: '#dc3545'
                };
                const color = statusColors[data.status] || '#6c757d';
                recentAssignmentsHTML += `
                <div class="item-card" style="margin-bottom: 10px;">
                    <div class="item-header">
                        <div>
                            <div class="item-title">Patient: ${data.patientName}</div>
                            <div class="item-subtitle">${data.appointmentDate} | ${data.appointmentTime}</div>
                        </div>
                        <span class="badge" style="background: ${color}20; color: ${color};">${data.status.toUpperCase()}</span>
                    </div>
                </div>`;
                counter++;
            }
        });

        document.getElementById('staffAssignmentsCount').textContent = myAssignmentsCount;
        document.getElementById('staffTodayCases').textContent = todayCasesCount;
        document.getElementById('staffCompletedCases').textContent = completedCasesCount;

        const recentContainer = document.getElementById('staffRecentAssignments');
        if (myAssignmentsCount > 0) {
            recentContainer.innerHTML = recentAssignmentsHTML;
            recentContainer.classList.remove('empty-state');
        } else {
            recentContainer.innerHTML = '<div class="empty-state"><h3>No Appointments</h3><p>You have no recent appointments.</p></div>';
            recentContainer.classList.add('empty-state');
        }

    } catch (err) {
        console.error("Error loading staff dashboard", err);
    }
}
window.loadStaffDashboard = loadStaffDashboard;

async function loadUserAssignments() {
    const container = document.getElementById('assignmentsList');
    if (!container) return;

    try {
        const doctorSnap = await db.collection('doctors').where('email', '==', currentUser.email).limit(1).get();
        if (doctorSnap.empty) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-user-md"></i><h3>No Doctor Profile Linked</h3><p>Your account is not linked to any active doctor profile.</p></div>';
            return;
        }

        const snap = await db.collection('appointments').where('doctorEmail', '==', currentUser.email).get();
        let html = '';

        let appointments = [];
        snap.forEach(doc => {
            const data = doc.data();
            appointments.push({ id: doc.id, ...data });
        });

        appointments.sort((a, b) => {
            const dateA = a.appointmentDate || '';
            const dateB = b.appointmentDate || '';
            if (dateA !== dateB) return dateA.localeCompare(dateB);
            const timeA = a.appointmentTime || '';
            const timeB = b.appointmentTime || '';
            return timeA.localeCompare(timeB);
        });

        appointments.forEach(data => {
            const statusColors = {
                pending: { bg: '#fff3cd', text: '#856404' },
                confirmed: { bg: '#cce5ff', text: '#004085' },
                completed: { bg: '#d4edda', text: '#155724' },
                cancelled: { bg: '#f8d7da', text: '#721c24' }
            };
            const colors = statusColors[data.status] || { bg: '#e2e3e5', text: '#383d41' };
            html += `
            <div class="item-card">
                <div class="item-header">
                    <div>
                        <div class="item-title">Patient: ${data.patientName}</div>
                        <div class="item-subtitle">${data.appointmentDate} | ${data.appointmentTime}</div>
                    </div>
                    <span style="padding: 6px 12px; border-radius: 15px; font-size: 12px; font-weight: 500; background: ${colors.bg}; color: ${colors.text};">${data.status.toUpperCase()}</span>
                </div>
                <div style="margin-top: 10px; font-size: 0.9rem; color: #666;">
                    <strong>Patient Email:</strong> ${data.patientEmail || 'N/A'} <br>
                    <strong>Notes:</strong> ${data.notes || 'None'}
                </div>
            </div>`;
        });

        if (html === '') {
            container.innerHTML = '<div class="empty-state"><h3>No Appointments Found</h3><p>You have no current appointments.</p></div>';
        } else {
            container.innerHTML = html;
        }
    } catch (err) {
        console.error("Error loading user assignments", err);
        container.innerHTML = '<p style="color:red">Error loading assignments.</p>';
    }
}
window.loadUserAssignments = loadUserAssignments;

console.log('MediCore OT Scheduler loaded. Version 3.1 – stable.');

// ── Auth UI Helpers ──────────────────────────────────────────────────
window.togglePasswordVisibility = function (inputId, iconId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    if (input && icon) {
        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            input.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    }
};

window.toggleDepartmentField = function () {
    const regTypeElement = document.querySelector('input[name="registrationType"]:checked');
    const container = document.getElementById('departmentContainer');
    const deptSelect = document.getElementById('department');
    if (regTypeElement && container && deptSelect) {
        if (regTypeElement.value === 'staff') {
            container.style.display = 'block';
            deptSelect.setAttribute('required', 'true');
        } else {
            container.style.display = 'none';
            deptSelect.removeAttribute('required');
        }
    }
};

// ── Patient Appointments ──────────────────────────────────────────────
window.openAppointmentModal = function (doctorId, doctorName, doctorEmail, doctorSpecialization) {
    document.getElementById('apptDoctorId').value = doctorId;
    document.getElementById('apptDoctorName').value = doctorName;
    document.getElementById('apptDoctorEmail').value = doctorEmail;
    document.getElementById('apptDoctorSpecialization').value = doctorSpecialization;
    document.getElementById('apptDate').value = '';
    document.getElementById('apptTime').value = '';
    document.getElementById('apptNotes').value = '';

    const todayStr = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('apptDate');
    const timeInput = document.getElementById('apptTime');

    if (dateInput) {
        dateInput.min = todayStr;
        if (!dateInput.value || dateInput.value < todayStr) {
            dateInput.value = todayStr;
        }
    }

    // Add real-time time validation
    if (dateInput && timeInput && !window._apptTimeValidationBound) {
        window._apptTimeValidationBound = true;
        const validateTime = () => {
            if (!dateInput.value || !timeInput.value) return;
            const now = new Date();
            // Get local date accurately adjusting for timezone offset
            const currentTodayStr = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
            const currentTimeStr = now.toTimeString().slice(0, 5);

            if (dateInput.value === currentTodayStr && timeInput.value <= currentTimeStr) {
                showNotification('warning', 'Please select a future time.');
                timeInput.value = '';
            }
        };
        dateInput.addEventListener('change', validateTime);
        timeInput.addEventListener('change', validateTime);
    }

    document.getElementById('appointmentModal').style.display = 'block';
};

window.closeAppointmentModal = function () {
    document.getElementById('appointmentModal').style.display = 'none';
};

window.handleAppointmentSubmit = async function (e) {
    e.preventDefault();
    if (!currentUser || !currentUserData || currentUserData.role !== 'patient') return;

    const btn = document.getElementById('apptSubmitBtn');
    btn.disabled = true;
    btn.textContent = 'Booking...';

    const doctorId = document.getElementById('apptDoctorId').value;
    const doctorName = document.getElementById('apptDoctorName').value;
    const doctorEmail = document.getElementById('apptDoctorEmail').value;
    const doctorSpecialization = document.getElementById('apptDoctorSpecialization').value;
    const appointmentDate = document.getElementById('apptDate').value;
    const appointmentTime = document.getElementById('apptTime').value;
    const notes = document.getElementById('apptNotes').value.trim();

    const now = new Date();
    // Get local date accurately adjusting for timezone offset
    const todayStr = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    const currentTimeStr = now.toTimeString().slice(0, 5);

    if (appointmentDate < todayStr) {
        showNotification('warning', 'Appointments must be booked for future dates.');
        btn.disabled = false;
        btn.textContent = 'Book Appointment';
        return;
    }

    if (appointmentDate === todayStr && appointmentTime <= currentTimeStr) {
        showNotification('warning', 'Please select a future time.');
        btn.disabled = false;
        btn.textContent = 'Book Appointment';
        return;
    }

    try {
        const appointmentId = `${doctorId}_${appointmentDate}_${appointmentTime.replace(':', '')}`;

        // Proceed to create appointment
        await db.collection('appointments').doc(appointmentId).set({
            patientId: currentUser.uid,
            patientName: currentUserData.fullName,
            patientEmail: currentUserData.email || '',
            doctorId: doctorId,
            doctorName: doctorName,
            doctorEmail: doctorEmail,
            doctorSpecialization: doctorSpecialization,
            appointmentDate: appointmentDate,
            appointmentTime: appointmentTime,
            status: 'pending',
            notes: notes,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showNotification('success', 'Appointment booked successfully!');
        closeAppointmentModal();
        if (window.loadPatientAppointments) {
            showSection('my-appointments');
        }
    } catch (err) {
        if (err.code === 'permission-denied') {
            showNotification('error', 'This time slot is already booked. Please choose a different time.');
        } else {
            console.error("Error booking appointment", err);
            showNotification('error', 'Failed to book appointment. Check console for details.');
        }
    } finally {
        btn.disabled = false;
        btn.textContent = 'Book Appointment';
    }
};

window.patientAppointmentsUnsubscribe = null;

async function loadPatientAppointments() {
    if (!currentUser || !currentUserData || currentUserData.role !== 'patient') return;

    const container = document.getElementById('patientAppointmentsContainer');
    if (!container) return;

    if (window.patientAppointmentsUnsubscribe) return;
    container.innerHTML = '<p style="padding:1rem;">Loading appointments...</p>';

    try {
        window.patientAppointmentsUnsubscribe = db.collection('appointments')
            .where('patientId', '==', currentUser.uid)
            .onSnapshot(snap => {
                let appointments = [];
                snap.forEach(doc => appointments.push({ id: doc.id, ...doc.data() }));

                if (appointments.length === 0) {
                    container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar-times"></i>
                    <h3>No appointments booked yet.</h3>
                    <p>You have not booked any appointments with our hospital.</p>
                    <button class="btn btn-primary" style="margin-top: 1rem;" onclick="showSection('find-doctors')">Browse Doctors</button>
                </div>
            `;
                    return;
                }

                appointments.sort((a, b) => {
                    const dateA = a.appointmentDate || '';
                    const dateB = b.appointmentDate || '';
                    if (dateA !== dateB) return dateA.localeCompare(dateB);
                    const timeA = a.appointmentTime || '';
                    const timeB = b.appointmentTime || '';
                    return timeA.localeCompare(timeB);
                });

                let upcomingHtml = '';
                let completedHtml = '';
                let cancelledHtml = '';

                appointments.forEach(data => {
                    const statusColors = {
                        pending: { bg: '#fff3cd', text: '#856404' },
                        confirmed: { bg: '#cce5ff', text: '#004085' },
                        completed: { bg: '#d4edda', text: '#155724' },
                        cancelled: { bg: '#f8d7da', text: '#721c24' }
                    };
                    const colors = statusColors[data.status] || { bg: '#e2e3e5', text: '#383d41' };
                    let payNowBtn = '';
                    let paymentStatusBadge = '';
                    
                    if (data.paymentStatus === 'paid') {
                        paymentStatusBadge = `<span class="badge" style="background: #d4edda; color: #155724; display: inline-block; margin-right: 5px;">PAID</span>`;
                    } else if (data.status === 'pending') {
                        payNowBtn = `<button class="btn btn-sm btn-primary" style="margin-top: 10px;" onclick="window.initiateAppointmentPayment('${data.id}')">Pay Now (₹500)</button>`;
                    }

                    const card = `
                <div class="item-card" style="margin-bottom: 1rem;">
                    <div class="item-header">
                        <div>
                            <div class="item-title">Dr. ${data.doctorName}</div>
                            <div class="item-subtitle">${data.doctorSpecialization}</div>
                        </div>
                        <div style="text-align: right;">
                            ${paymentStatusBadge}<span class="badge" style="background: ${colors.bg}; color: ${colors.text}; display: inline-block;">${data.status.toUpperCase()}</span>
                        </div>
                    </div>
                    <div style="margin-top: 10px; font-size: 0.95rem;">
                        <strong>Date:</strong> ${data.appointmentDate} <br>
                        <strong>Time:</strong> ${data.appointmentTime} <br>
                        <strong>Notes:</strong> ${data.notes || 'None'}
                    </div>
                    ${payNowBtn}
                </div>
            `;

                    if (data.status === 'pending' || data.status === 'confirmed') upcomingHtml += card;
                    else if (data.status === 'completed') completedHtml += card;
                    else if (data.status === 'cancelled') cancelledHtml += card;
                });

                let finalHtml = '';
                if (upcomingHtml) {
                    finalHtml += '<h3 style="margin: 1.5rem 0 1rem 0;">Upcoming</h3>' + upcomingHtml;
                }
                if (completedHtml) {
                    finalHtml += '<h3 style="margin: 1.5rem 0 1rem 0;">Completed</h3>' + completedHtml;
                }
                if (cancelledHtml) {
                    finalHtml += '<h3 style="margin: 1.5rem 0 1rem 0;">Cancelled</h3>' + cancelledHtml;
                }

                container.innerHTML = finalHtml;

                // Update stats on dashboard if we are loading patient appointments
                const dashUpcoming = document.getElementById('patientUpcomingAppointments');
                const dashCompleted = document.getElementById('patientCompletedAppointments');

                if (dashUpcoming && dashCompleted) {
                    dashUpcoming.textContent = (upcomingHtml.match(/<div class="item-card"/g) || []).length;
                    dashCompleted.textContent = (completedHtml.match(/<div class="item-card"/g) || []).length;
                }

            }, err => {
                console.error("Error in appointments listener", err);
                container.innerHTML = '<p style="color:red">Error loading appointments.</p>';
            });
    } catch (err) {
        console.error("Error setting up patient appointments listener", err);
    }
};

window.initiateAppointmentPayment = async function (appointmentId) {
    try {
        if (!currentUser) {
            showNotification('error', 'Please login to make a payment.');
            return;
        }

        showNotification('info', 'Initializing secure payment...');

        const createRazorpayOrder = firebase.functions().httpsCallable('createRazorpayOrder');
        const response = await createRazorpayOrder({ appointmentId });
        const data = response.data;

        if (!data.success) {
            throw new Error(data.error || 'Failed to create payment order.');
        }

        const options = {
            key: "rzp_test_T4nIn7QJLlRMOb",
            amount: data.amount,
            currency: data.currency,
            name: "MediCore Hospital",
            description: "Appointment Booking Fee",
            order_id: data.orderId,
            handler: async function (response) {
                try {
                    showNotification("info", "Verifying payment...");
                    const verifyRazorpayPayment = firebase.functions().httpsCallable('verifyRazorpayPayment');
                    const verifyResponse = await verifyRazorpayPayment({
                        appointmentId: appointmentId,
                        razorpay_payment_id: response.razorpay_payment_id,
                        razorpay_order_id: response.razorpay_order_id,
                        razorpay_signature: response.razorpay_signature
                    });
                    
                    if (verifyResponse.data.success) {
                        showNotification("success", "Payment verified successfully!");
                        // Real-time listener will automatically refresh the appointments list
                    } else {
                        throw new Error("Verification failed on server.");
                    }
                } catch (err) {
                    console.error("Payment Verification Error:", err);
                    showNotification("error", "Payment verification failed.");
                }
            },
            prefill: {
                name: currentUserData.fullName || currentUser.email,
                email: currentUser.email
            },
            theme: {
                color: "#1890ff"
            }
        };

        const rzp = new window.Razorpay(options);

        rzp.on('payment.failed', function (response) {
            console.error("Payment Failed:", response.error);
            showNotification("error", "Payment failed. Please try again.");
        });

        rzp.open();

    } catch (err) {
        console.error("Error initiating payment:", err);
        showNotification('error', err.message || 'Error initiating payment.');
    }
};

// ── Admin Appointments ──────────────────────────────────────────────
async function loadAdminAppointments() {
    if (!currentUser || !currentUserData || currentUserData.role !== 'admin') return;

    const container = document.getElementById('adminAppointmentsContainer');
    const statusFilter = document.getElementById('adminApptFilterStatus').value;
    if (!container) return;

    try {
        container.innerHTML = '<p style="padding:1rem;">Loading appointments...</p>';

        let query = db.collection('appointments');
        if (statusFilter) {
            query = query.where('status', '==', statusFilter);
        }

        const snap = await query.get();
        let appointments = [];
        snap.forEach(doc => appointments.push({ id: doc.id, ...doc.data() }));

        appointments.sort((a, b) => {
            const dateA = a.appointmentDate || '';
            const dateB = b.appointmentDate || '';
            if (dateA !== dateB) return dateA.localeCompare(dateB);
            const timeA = a.appointmentTime || '';
            const timeB = b.appointmentTime || '';
            return timeA.localeCompare(timeB);
        });

        if (appointments.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-calendar-times"></i><h3>No Appointments Found</h3><p>There are no appointments matching your criteria.</p></div>';
            return;
        }

        let html = '';
        appointments.forEach(data => {
            const statusColors = {
                pending: { bg: '#fff3cd', text: '#856404' },
                confirmed: { bg: '#cce5ff', text: '#004085' },
                completed: { bg: '#d4edda', text: '#155724' },
                cancelled: { bg: '#f8d7da', text: '#721c24' }
            };
            const colors = statusColors[data.status] || { bg: '#e2e3e5', text: '#383d41' };

            // Generate valid actions based on current status
            let actionsHtml = '';
            if (data.status === 'pending') {
                actionsHtml = `
                    <button class="btn btn-sm btn-success" onclick="updateAppointmentStatus('${data.id}', 'confirmed')">Confirm</button>
                    <button class="btn btn-sm btn-danger" onclick="updateAppointmentStatus('${data.id}', 'cancelled')">Cancel</button>
                `;
            } else if (data.status === 'confirmed') {
                actionsHtml = `
                    <button class="btn btn-sm btn-primary" onclick="updateAppointmentStatus('${data.id}', 'completed')">Mark Completed</button>
                    <button class="btn btn-sm btn-danger" onclick="updateAppointmentStatus('${data.id}', 'cancelled')">Cancel</button>
                `;
            }

            html += `
            <div class="item-card" style="margin-bottom: 1rem;">
                <div class="item-header">
                    <div>
                        <div class="item-title">Patient: ${data.patientName} | Dr. ${data.doctorName}</div>
                        <div class="item-subtitle">${data.appointmentDate} | ${data.appointmentTime}</div>
                    </div>
                    <div style="text-align: right;">
                        <span class="badge" style="background: ${colors.bg}; color: ${colors.text}; display: inline-block;">${data.status.toUpperCase()}</span>
                    </div>
                </div>
                <div style="margin-top: 10px; font-size: 0.95rem; display: flex; justify-content: space-between; align-items:flex-end; flex-wrap: wrap; gap: 1rem;">
                    <div>
                        <strong>Patient Email:</strong> ${data.patientEmail} <br>
                        <strong>Doctor Email:</strong> ${data.doctorEmail} <br>
                        <strong>Notes:</strong> ${data.notes || 'None'}
                    </div>
                    <div style="display:flex; gap:0.5rem;">
                        ${actionsHtml}
                    </div>
                </div>
            </div>`;
        });

        container.innerHTML = html;

    } catch (err) {
        console.error("Error loading admin appointments", err);
        container.innerHTML = '<p style="color:red">Error loading appointments.</p>';
    }
};

window.loadPatientAppointments = loadPatientAppointments;
window.loadAdminAppointments = loadAdminAppointments;

window.updateAppointmentStatus = async function (appointmentId, newStatus) {
    if (!currentUser || !currentUserData || currentUserData.role !== 'admin') return;
    const confirmed = await window.showConfirmation({ title: 'Confirm Status Change', message: `Are you sure you want to change the status to ${newStatus}?`, confirmText: 'Update' });
    if (!confirmed) return;

    try {
        // Fetch existing appointment data first to generate human-readable logs
        const apptDoc = await db.collection('appointments').doc(appointmentId).get();
        if (!apptDoc.exists) {
            showNotification('error', 'Appointment not found.');
            return;
        }
        const apptData = apptDoc.data();
        const oldStatus = apptData.status;

        await db.collection('appointments').doc(appointmentId).update({
            status: newStatus,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Log action with structured metadata and human-readable string
        if (window.logAdminAction) {
            let actionTitle = 'Appointment Status Updated';
            if (oldStatus === 'pending' && newStatus === 'confirmed') actionTitle = 'Appointment Confirmed';
            else if (oldStatus === 'confirmed' && newStatus === 'completed') actionTitle = 'Appointment Completed';
            else if (oldStatus === 'pending' && newStatus === 'cancelled') actionTitle = 'Appointment Cancelled';

            // Format date and time
            const [yyyy, mm, dd] = apptData.appointmentDate.split('-');
            const dateObj = new Date(yyyy, mm - 1, dd);
            const dateStr = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, ' '); // 23 Jun 2026

            let [hour, min] = apptData.appointmentTime.split(':');
            const ampm = hour >= 12 ? 'PM' : 'AM';
            const hour12 = (hour % 12) || 12;
            const timeStr = `${hour12.toString().padStart(2, '0')}:${min} ${ampm}`;

            const detailsStr = `Patient: ${apptData.patientName}\nDoctor: ${apptData.doctorName}\nDate: ${dateStr}\nTime: ${timeStr}\n\nStatus:\n${capitalizeFirst(oldStatus)} → ${capitalizeFirst(newStatus)}`;

            const metadata = {
                actionType: "appointment_status_updated",
                patientName: apptData.patientName,
                doctorName: apptData.doctorName,
                appointmentDate: apptData.appointmentDate,
                appointmentTime: apptData.appointmentTime,
                previousStatus: oldStatus,
                newStatus: newStatus
            };

            logAdminAction(actionTitle, detailsStr, 'appointments', appointmentId, metadata);
        }
        loadAdminAppointments();
    } catch (err) {
        console.error("Error updating appointment status", err);
        showNotification('error', 'Failed to update status. Check console for details.');
    }
};
// ── Global Observer for Hidden Required Fields ─────────────────
function initializeHiddenFieldsObserver() {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                const el = mutation.target;
                const isHidden = window.getComputedStyle(el).display === 'none';
                el.querySelectorAll('input, select, textarea').forEach(input => {
                    if (isHidden) {
                        if (input.hasAttribute('required')) {
                            input.setAttribute('data-was-required', 'true');
                            input.removeAttribute('required');
                        }
                    } else {
                        if (input.hasAttribute('data-was-required')) {
                            input.setAttribute('required', 'required');
                            input.removeAttribute('data-was-required');
                        }
                    }
                });
            }
        });
    });

    document.querySelectorAll('.modal, .content-section, #registerFields').forEach(el => {
        observer.observe(el, { attributes: true, attributeFilter: ['style'] });
        // Initial pass
        if (window.getComputedStyle(el).display === 'none') {
            el.querySelectorAll('input, select, textarea').forEach(input => {
                if (input.hasAttribute('required')) {
                    input.setAttribute('data-was-required', 'true');
                    input.removeAttribute('required');
                }
            });
        }
    });
}
document.addEventListener('DOMContentLoaded', initializeHiddenFieldsObserver);
