        // Firebase Configuration
        const firebaseConfig = window.firebaseConfig;

        firebase.initializeApp(firebaseConfig);
        const auth = firebase.auth();
        const db = firebase.firestore();

        // Global Variables
        let currentUser = null;
        let currentUserData = null;
        let isLoginMode = true;
        let sessionStartTime = null;
        let sessionTimer = null;
        let allDoctors = [];
        let isEditingDoctor = false;
        let editingDoctorId = null;

        // Role-based navigation menus
        const adminNavigation = [
            { id: 'overview', icon: '📊', text: 'Dashboard Overview', active: true },
            { id: 'doctors', icon: '👨‍⚕️', text: 'Doctor Management' },
            { id: 'users', icon: '👥', text: 'User Management' },
            { id: 'patients', icon: '🏥', text: 'Patient Management' },
            { id: 'ot-rooms', icon: '🚪', text: 'OT Rooms' },
            { id: 'ot-schedule', icon: '🗓️', text: 'OT Schedule' },
            { id: 'analytics', icon: '📈', text: 'Analytics Dashboard' },
            { id: 'operations', icon: '⚙️', text: 'Operations Management' },
            { id: 'scheduling', icon: '📅', text: 'Scheduling System' },
            { id: 'profile', icon: '👤', text: 'Profile Settings' },
            { id: 'logs', icon: '📝', text: 'Audit Logs' }
        ];

        const userNavigation = [
            { id: 'overview', icon: '📊', text: 'Dashboard Overview', active: true },
            { id: 'profile', icon: '👤', text: 'Profile Settings' },
            { id: 'assignments', icon: '📋', text: 'View Assignments' },
            { id: 'availability', icon: '🕒', text: 'Update Availability' }
        ];

        // Initialize Application
        document.addEventListener('DOMContentLoaded', function() {
            // Auth state listener with role-based dashboard loading
            auth.onAuthStateChanged(async (user) => {
                if (user && user.emailVerified) {
                    try {
                        const userDoc = await db.collection('users').doc(user.uid).get();
                        
                        if (!userDoc.exists) {
                            console.error('❌ User profile missing in Firestore for UID:', user.uid);
                            showAuthMessage('error', 'User profile not found. Please contact support or re-register.');
                            await auth.signOut();
                            return;
                        }
                        
                        const userData = userDoc.data();
                        console.log('✅ User profile loaded:', userData);
                        
                        currentUser = user;
                        currentUserData = userData;
                        showDashboard(userData);
                        await loadInitialData();
                        startSessionManagement();
                        
                    } catch (error) {
                        console.error('Error loading user profile:', error);
                        showAuthMessage('error', 'Error loading profile: ' + error.message);
                    }
                } else if (user && !user.emailVerified) {
                    showAuthMessage('error', 'Please verify your email before accessing the dashboard.');
                    showAuth();
                } else {
                    showAuth();
                }

                loadStaffData();
    
    // Set default values for new scheduling
    const today = new Date().toISOString().split('T')[0];
    const otDateInput = document.getElementById('otScheduleDate');
    if (otDateInput) {
        otDateInput.value = today;
    }
            });

            // Event listeners
            document.getElementById('authForm').addEventListener('submit', handleAuth);
            document.getElementById('toggleLink').addEventListener('click', toggleAuthMode);
            document.getElementById('forgotPasswordLink').addEventListener('click', handleForgotPassword);
            document.getElementById('doctorForm').addEventListener('submit', handleDoctorSubmit);
            document.getElementById('profileForm').addEventListener('submit', handleProfileUpdate);
            document.getElementById('availabilityForm').addEventListener('submit', handleAvailabilityUpdate);
            document.getElementById('patientForm').addEventListener('submit', handlePatientSubmit);
            document.getElementById('otRoomForm').addEventListener('submit', handleOTRoomSubmit);
            document.getElementById('otScheduleForm').addEventListener('submit', handleOTScheduleSubmit);
        });

        function setupNavigation(navigationItems, userRole) {
    const navMenu = document.getElementById('navMenu');
    
    // Add this check:
    if (!navMenu) {
        console.error('Navigation menu element not found');
        return;
    }
    
    navMenu.innerHTML = '';
            
            // Update subtitle based on role
            document.getElementById('navSubtitle').textContent = 
                userRole === 'admin' ? 'Admin Dashboard' : 'Staff Dashboard';
            
            navigationItems.forEach(item => {
                const li = document.createElement('li');
                li.className = 'nav-item';
                
                const a = document.createElement('a');
                a.href = '#';
                a.className = 'nav-link' + (item.active ? ' active' : '');
                a.onclick = () => showSection(item.id);
                a.innerHTML = `<i>${item.icon}</i> ${item.text}`;
                
                li.appendChild(a);
                navMenu.appendChild(li);
            });
            
            // Add logout link
            const logoutLi = document.createElement('li');
            logoutLi.className = 'nav-item';
            logoutLi.style.marginTop = '2rem';
            logoutLi.style.borderTop = '1px solid rgba(255,255,255,0.1)';
            logoutLi.style.paddingTop = '1rem';
            
            const logoutA = document.createElement('a');
            logoutA.href = '#';
            logoutA.className = 'nav-link';
            logoutA.style.color = '#ff6b6b';
            logoutA.onclick = logout;
            logoutA.innerHTML = '<i>🚪</i> Secure Logout';
            
            logoutLi.appendChild(logoutA);
            navMenu.appendChild(logoutLi);
        }

        // Authentication Functions
        async function handleAuth(e) {
            e.preventDefault();
            
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            
            if (!email || !password) {
                showAuthMessage('error', 'Please fill in all required fields');
                return;
            }

            setAuthLoading(true);

            try {
                if (isLoginMode) {
                    // LOGIN ATTEMPT
                    const userCredential = await auth.signInWithEmailAndPassword(email, password);
                    if (!userCredential.user.emailVerified) {
                        showAuthMessage('error', 'Please verify your email before logging in. Check your inbox for verification link.');
                        await auth.signOut();
                        return;
                    }
                    
                    await logAdminAction('User Login', `User ${email} logged in successfully`);
                    showAuthMessage('success', 'Login successful!');
                    sessionStartTime = new Date();
                } else {
                    // REGISTRATION ATTEMPT
                    const confirmPassword = document.getElementById('confirmPassword').value;
                    const fullName = document.getElementById('fullName').value.trim();
                    const phone = document.getElementById('phone').value.trim();
                    const department = document.getElementById('department').value;
                    const role = document.getElementById('role').value;
                    
                    if (!fullName || !department) {
                        showAuthMessage('error', 'Please fill in all required fields');
                        return;
                    }
                    
                    if (password !== confirmPassword) {
                        showAuthMessage('error', 'Passwords do not match');
                        return;
                    }
                    
                    if (password.length < 6) {
                        showAuthMessage('error', 'Password must be at least 6 characters long');
                        return;
                    }
                    
                    // Create Firebase Auth user first
                    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                    const user = userCredential.user;
                    
                    try {
                        // CRITICAL: Create Firestore profile document
                        await db.collection('users').doc(user.uid).set({
                            email: email,
                            fullName: fullName,
                            phone: phone || '',
                            department: department,
                            role: role,
                            bio: '',
                            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                            emailVerified: false,
                            lastLogin: null,
                            loginHistory: []
                        });
                        
                        console.log('✅ User profile created successfully in Firestore');
                        
                        // Send email verification
                        await user.sendEmailVerification();
                        
                        showAuthMessage('success', 'Registration successful! Please check your email for verification link.');
                        toggleAuthMode(); // Switch to login mode
                        
                    } catch (firestoreError) {
                        console.error('❌ Error creating user profile:', firestoreError);
                        
                        // Clean up: Delete the auth user if Firestore creation failed
                        await user.delete();
                        
                        showAuthMessage('error', 'Registration failed. Please try again.');
                        return;
                    }
                }
            } catch (error) {
                console.error('Auth error:', error);
                let errorMessage = 'An error occurred. Please try again.';
                
                switch (error.code) {
                    case 'auth/email-already-in-use':
                        errorMessage = 'This email is already registered. Please use the login form instead or try a different email.';
                        // Automatically switch to login mode
                        if (!isLoginMode) {
                            setTimeout(() => {
                                toggleAuthMode();
                                showAuthMessage('success', 'Switched to login mode. Please enter your password to sign in.');
                            }, 2000);
                        }
                        break;
                    case 'auth/invalid-login-credentials':
                    case 'auth/user-not-found':
                    case 'auth/wrong-password':
                        errorMessage = 'Invalid email or password. Please check your credentials and try again.';
                        break;
                    case 'auth/weak-password':
                        errorMessage = 'Password is too weak. Please choose a stronger password (minimum 6 characters).';
                        break;
                    case 'auth/invalid-email':
                        errorMessage = 'Invalid email address format. Please enter a valid email.';
                        break;
                    case 'auth/too-many-requests':
                        errorMessage = 'Too many failed attempts. Please wait a few minutes before trying again.';
                        break;
                    case 'auth/network-request-failed':
                        errorMessage = 'Network error. Please check your internet connection and try again.';
                        break;
                }
                
                showAuthMessage('error', errorMessage);
            } finally {
                setAuthLoading(false);
            }
        }

        // Forgot password handler
        async function handleForgotPassword(e) {
            e.preventDefault();
            
            const email = document.getElementById('email').value.trim();
            
            if (!email) {
                showAuthMessage('error', 'Please enter your email address first');
                document.getElementById('email').focus();
                return;
            }
            
            try {
                await auth.sendPasswordResetEmail(email);
                showAuthMessage('success', 'Password reset email sent! Check your inbox and spam folder.');
            } catch (error) {
                console.error('Error sending password reset email:', error);
                
                let errorMessage = 'Error sending password reset email';
                switch (error.code) {
                    case 'auth/user-not-found':
                        errorMessage = 'No account found with this email address';
                        break;
                    case 'auth/invalid-email':
                        errorMessage = 'Invalid email address format';
                        break;
                }
                
                showAuthMessage('error', errorMessage);
            }
        }

        // Toggle login/register
        function toggleAuthMode(e) {
            if (e) e.preventDefault();
            
            isLoginMode = !isLoginMode;
            const registerFields = document.getElementById('registerFields');
            const authTitle = document.getElementById('authTitle');
            const authButtonText = document.getElementById('authButtonText');
            const toggleLink = document.getElementById('toggleLink');
            const forgotPasswordContainer = document.getElementById('forgotPasswordContainer');
            
            if (isLoginMode) {
                authTitle.textContent = 'Welcome Back to MediCore';
                authButtonText.textContent = 'Sign In Securely';
                toggleLink.textContent = 'Need an account? Register here';
                registerFields.style.display = 'none';
                forgotPasswordContainer.style.display = 'block';
            } else {
                authTitle.textContent = 'Join MediCore Platform';
                authButtonText.textContent = 'Create Account';
                toggleLink.textContent = 'Already have an account? Sign in here';
                registerFields.style.display = 'block';
                forgotPasswordContainer.style.display = 'none';
            }
            
            hideAuthMessages();
            document.getElementById('authForm').reset();
        }

        // Show/hide sections
        function showAuth() {
            document.getElementById('authContainer').style.display = 'flex';
            document.getElementById('dashboardContainer').style.display = 'none';
            hideAuthMessages();
        }

        function showDashboard(userData) {
            document.getElementById('authContainer').style.display = 'none';
            document.getElementById('dashboardContainer').style.display = 'block';
            
            // Update user info in header
            document.getElementById('userWelcome').textContent = `Welcome, ${userData.fullName || 'User'}`;
            
            // Set up role-based navigation and show appropriate sections
            if (userData.role === 'admin') {
                setupNavigation(adminNavigation, 'admin');
                showSection('overview'); // Show admin overview
            } else {
                setupNavigation(userNavigation, 'user');
                showSection('overview'); // Show user overview
            }
            
            // Update user info displays
            document.getElementById('userName').textContent = userData.fullName || '-';
            document.getElementById('userEmail').textContent = userData.email || currentUser.email;
            document.getElementById('userRole').textContent = userData.role || 'user';
            document.getElementById('userDepartment').textContent = userData.department || '-';
            document.getElementById('userStatus').textContent = currentUser.emailVerified ? 'Verified' : 'Unverified';
            
            // Load profile data into forms
            document.getElementById('editFullName').value = userData.fullName || '';
            document.getElementById('editEmail').value = userData.email || currentUser.email;
            document.getElementById('editPhone').value = userData.phone || '';
            document.getElementById('editDepartment').value = userData.department || '';
            document.getElementById('bio').value = userData.bio || '';
        }

        function showSection(sectionName) {
            // Hide all sections
            const sections = document.querySelectorAll('.content-section');
            sections.forEach(section => section.classList.remove('active'));
            
            // Show selected section
            const targetSection = document.getElementById(`section-${sectionName}`);
            if (targetSection) {
                targetSection.classList.add('active');
            }
            
            // Update navigation active state
            const links = document.querySelectorAll('.nav-link');
            links.forEach(link => link.classList.remove('active'));
            if (event && event.target) {
                event.target.classList.add('active');
            }
            
            // Update page title and breadcrumb
            const titles = {
                'overview': 'Dashboard Overview',
                'doctors': 'Doctor Management',
                'users': 'User Management',
                'patients': 'Patient Management',
                'ot-rooms': 'OT Rooms',
                'ot-schedule': 'OT Schedule',
                'analytics': 'Analytics Dashboard',
                'operations': 'Operations Management',
                'scheduling': 'Scheduling System',
                'profile': 'Profile Settings',
                'assignments': 'View Assignments',
                'availability': 'Update Availability',
                'logs': 'Audit Logs'
            };
            
            document.getElementById('pageTitle').textContent = titles[sectionName] || 'Dashboard';
            document.getElementById('breadcrumbPath').textContent = `Home › ${titles[sectionName] || 'Dashboard'}`;
            
            // Load section-specific data
            switch(sectionName) {
                case 'doctors':
                    loadDoctors();
                    break;
                case 'users':
                    loadUsers();
                    break;
                case 'patients':
                    loadPatients();
                    break;
                case 'ot-rooms':
                    console.log('📋 Loading OT Rooms section');
                    loadOTRoomsWithDebug(); // Use debug version
                    break;
                case 'ot-schedule':
                    loadOTSchedule();
                    break;
                case 'logs':
                    loadActivityLog();
                    break;
            }
        }

        // Session Management
        function startSessionManagement() {
            sessionStartTime = new Date();
            updateSessionStatus();
            
            sessionTimer = setInterval(updateSessionStatus, 60000); // Update every minute
            
            // Auto-logout after 30 minutes of inactivity
            let inactivityTimer;
            const resetInactivityTimer = () => {
                clearTimeout(inactivityTimer);
                inactivityTimer = setTimeout(() => {
                    showMessage('error', 'Session expired due to inactivity');
                    logout();
                }, 30 * 60 * 1000);
            };
            
            document.addEventListener('click', resetInactivityTimer);
            document.addEventListener('keypress', resetInactivityTimer);
            resetInactivityTimer();
        }

        function updateSessionStatus() {
            if (!sessionStartTime) return;
            
            const now = new Date();
            const duration = Math.floor((now - sessionStartTime) / 1000);
            const hours = Math.floor(duration / 3600);
            const minutes = Math.floor((duration % 3600) / 60);
            
            let statusText = '● Active Session';
            if (hours > 0) {
                statusText += ` (${hours}h ${minutes}m)`;
            } else if (minutes > 0) {
                statusText += ` (${minutes}m)`;
            }
            
            document.getElementById('sessionStatus').textContent = statusText;
            document.getElementById('loginTime').textContent = sessionStartTime.toLocaleTimeString();
            document.getElementById('sessionDuration').textContent = `${hours}h ${minutes}m`;
        }

        function extendSession() {
            showMessage('success', 'Session extended successfully!');
        }

        function endSession() {
            logout();
        }

        // Data Loading Functions
        async function loadInitialData() {
            try {
                // Load statistics (only for admin)
                if (currentUserData && currentUserData.role === 'admin') {
                    const [doctorsSnapshot, usersSnapshot] = await Promise.all([
                        db.collection('doctors').get(),
                        db.collection('users').get()
                    ]);
                    
                    document.getElementById('totalDoctors').textContent = doctorsSnapshot.size;
                    document.getElementById('totalUsers').textContent = usersSnapshot.size;
                    
                    // Load doctors for management
                    allDoctors = [];
                    doctorsSnapshot.forEach(doc => {
                        allDoctors.push({ id: doc.id, ...doc.data() });
                    });
                }
                
            } catch (error) {
                console.error('Error loading initial data:', error);
            }
        }

        async function loadDoctors() {
            try {
                const snapshot = await db.collection('doctors').orderBy('createdAt', 'desc').get();
                allDoctors = [];
                
                snapshot.forEach(doc => {
                    allDoctors.push({ id: doc.id, ...doc.data() });
                });
                
                displayDoctors(allDoctors);
                document.getElementById('totalDoctors').textContent = allDoctors.length;
                
            } catch (error) {
                console.error('Error loading doctors:', error);
                showMessage('error', 'Error loading doctors data');
            }
        }

        function displayDoctors(doctors) {
            const container = document.getElementById('doctorsContainer');
            
            if (doctors.length === 0) {
                container.innerHTML = `
                    <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-secondary);">
                        <h3>No doctors found</h3>
                        <p>Click "Add New Doctor" to get started</p>
                    </div>
                `;
                return;
            }
            
            container.innerHTML = doctors.map(doctor => createDoctorCardHTML(doctor)).join('');
        }

        function createDoctorCardHTML(doctor) {
            return `
                <div class="item-card">
                    <div class="item-header">
                        <div>
                            <div class="item-title">${doctor.name}</div>
                            <div class="item-subtitle">${capitalizeFirst(doctor.specialization)} • ${doctor.experience || 0} years</div>
                            <div style="margin-top: 0.5rem; font-size: 0.9rem; color: var(--text-secondary);">
                                📧 ${doctor.email}<br>
                                📞 ${doctor.phone}
                                ${doctor.licenseNumber ? `<br>🏥 License: ${doctor.licenseNumber}` : ''}
                                ${doctor.consultationFee ? `<br>💰 Fee: $${doctor.consultationFee}` : ''}
                            </div>
                            ${doctor.bio ? `<div style="margin-top: 0.5rem; font-style: italic; color: var(--text-secondary);">${doctor.bio}</div>` : ''}
                        </div>
                        <div class="item-actions">
                            <button class="btn btn-warning btn-sm" onclick="editDoctor('${doctor.id}')">Edit</button>
                            <button class="btn btn-danger btn-sm" onclick="deleteDoctor('${doctor.id}', '${doctor.name}')">Delete</button>
                        </div>
                    </div>
                </div>
            `;
        }

        async function loadUsers() {
            try {
                const snapshot = await db.collection('users').orderBy('createdAt', 'desc').get();
                const users = [];
                
                snapshot.forEach(doc => {
                    users.push({ id: doc.id, ...doc.data() });
                });
                
                const tableHTML = `
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Department</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${users.map(user => `
                                <tr>
                                    <td>${user.fullName || 'N/A'}</td>
                                    <td>${user.email}</td>
                                    <td>${capitalizeFirst(user.department || 'N/A')}</td>
                                    <td>${capitalizeFirst(user.role || 'user')}</td>
                                    <td>
                                        <span style="padding: 0.25rem 0.75rem; border-radius: 15px; font-size: 0.8rem; background: ${user.emailVerified ? 'rgba(39, 174, 96, 0.1); color: #27ae60' : 'rgba(231, 76, 60, 0.1); color: #e74c3c'};">
                                            ${user.emailVerified ? 'Verified' : 'Unverified'}
                                        </span>
                                    </td>
                                    <td>
                                        <button class="btn btn-warning btn-sm">Edit</button>
                                        <button class="btn btn-danger btn-sm">Remove</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
                
                document.getElementById('usersContainer').innerHTML = tableHTML;
                
            } catch (error) {
                console.error('Error loading users:', error);
            }
        }

        // Enhanced OT Rooms loading with comprehensive debugging
async function loadOTRoomsWithDebug() {
    try {
        console.log('🔍 Starting to load OT rooms...');
        console.log('🔗 Database connection:', db ? 'Connected' : 'Not connected');
        
        // Check if container exists
        const container = document.getElementById('otRoomsContainer');
        if (!container) {
            console.error('❌ OT Rooms container not found in DOM');
            return;
        }
        console.log('✅ Container found:', container);

        // Query Firestore
        console.log('📡 Querying ot_rooms collection...');
        const snapshot = await db.collection('ot_rooms').get();
        
        console.log('📊 Query result - Empty:', snapshot.empty, 'Size:', snapshot.size);
        
        if (snapshot.empty) {
            container.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-secondary);">
                    <h3>No OT rooms found</h3>
                    <p>Click "Add New OT Room" to get started</p>
                    <button onclick="addSampleOTRoom()" class="btn btn-primary">Add Sample Room</button>
                </div>
            `;
            console.log('📝 No OT rooms found, showing empty state');
            return;
        }

        // Process documents
        allOTRooms = [];
        snapshot.forEach(doc => {
            const roomData = { id: doc.id, ...doc.data() };
            allOTRooms.push(roomData);
            console.log('🏥 Found OT Room:', roomData);
        });

        console.log(`✅ Loaded ${allOTRooms.length} OT rooms total`);
        displayOTRooms(allOTRooms);
        
    } catch (error) {
        console.error('❌ Error loading OT rooms:', error);
        showMessage('error', 'Error loading OT rooms: ' + error.message);
    }
}

// Add sample OT room for testing
async function addSampleOTRoom() {
    try {
        console.log('➕ Adding sample OT room...');
        await db.collection('ot_rooms').add({
            roomNumber: '101',
            type: 'general',
            status: 'available',
            equipment: 'Basic surgical equipment, monitors, ventilator',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log('✅ Sample OT room added successfully');
        showMessage('success', 'Sample OT room added!');
        loadOTRoomsWithDebug();
    } catch (error) {
        console.error('❌ Error adding sample OT room:', error);
        showMessage('error', 'Error adding sample room: ' + error.message);
    }
}


        async function loadActivityLog() {
            try {
                const snapshot = await db.collection('adminLogs')
                    .orderBy('timestamp', 'desc')
                    .limit(50)
                    .get();
                
                const logContainer = document.getElementById('activityLog');
                
                if (snapshot.empty) {
                    logContainer.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No audit logs found</p>';
                    return;
                }
                
                let html = '';
                snapshot.forEach(doc => {
                    const log = doc.data();
                    const timestamp = log.timestamp ? log.timestamp.toDate().toLocaleString() : 'Unknown time';
                    
                    html += `
                        <div style="padding: 10px; border-left: 4px solid #667eea; background: #f8f9fa; margin-bottom: 10px; border-radius: 5px;">
                            <div style="font-size: 12px; color: #6c757d; margin-bottom: 5px;">${timestamp}</div>
                            <div style="font-weight: 500; color: #2c3e50;">${log.action}</div>
                            <div style="font-size: 14px; color: #495057; margin-top: 5px;">${log.details}</div>
                        </div>
                    `;
                });
                
                logContainer.innerHTML = html;
                
            } catch (error) {
                console.error('Error loading activity log:', error);
            }
        }

        // Doctor Management Functions
        function openDoctorModal() {
            isEditingDoctor = false;
            editingDoctorId = null;
            document.getElementById('doctorModalTitle').textContent = 'Add New Doctor';
            document.getElementById('doctorForm').reset();
            document.getElementById('doctorModal').style.display = 'block';
        }

        function closeDoctorModal() {
            document.getElementById('doctorModal').style.display = 'none';
        }

        async function handleDoctorSubmit(e) {
            e.preventDefault();
            
            const submitBtn = document.getElementById('doctorSubmitText');
            const spinner = document.getElementById('doctorSubmitSpinner');
            
            submitBtn.style.display = 'none';
            spinner.style.display = 'inline-block';
            
            try {
                const doctorData = {
                    name: document.getElementById('doctorName').value.trim(),
                    email: document.getElementById('doctorEmail').value.trim().toLowerCase(),
                    phone: document.getElementById('doctorPhone').value.trim(),
                    specialization: document.getElementById('doctorSpecialization').value,
                    licenseNumber: document.getElementById('doctorLicense').value.trim(),
                    experience: parseInt(document.getElementById('doctorExperience').value) || 0,
                    consultationFee: parseFloat(document.getElementById('doctorFee').value) || 0,
                    status: document.getElementById('doctorStatus').value,
                    bio: document.getElementById('doctorBio').value.trim()
                };
                
                if (isEditingDoctor && editingDoctorId) {
                    await db.collection('doctors').doc(editingDoctorId).update({
                        ...doctorData,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
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
                
            } catch (error) {
                console.error('Error saving doctor:', error);
                showMessage('error', 'Error saving doctor. Please try again.');
            } finally {
                submitBtn.style.display = 'inline';
                spinner.style.display = 'none';
            }
        }

        async function editDoctor(doctorId) {
            try {
                const doctorDoc = await db.collection('doctors').doc(doctorId).get();
                if (!doctorDoc.exists) {
                    showMessage('error', 'Doctor not found');
                    return;
                }
                
                const doctor = doctorDoc.data();
                isEditingDoctor = true;
                editingDoctorId = doctorId;
                // Populate form
                document.getElementById('doctorModalTitle').textContent = 'Edit Doctor';
                document.getElementById('doctorName').value = doctor.name || '';
                document.getElementById('doctorEmail').value = doctor.email || '';
                document.getElementById('doctorPhone').value = doctor.phone || '';
                document.getElementById('doctorSpecialization').value = doctor.specialization || '';
                document.getElementById('doctorLicense').value = doctor.licenseNumber || '';
                document.getElementById('doctorExperience').value = doctor.experience || '';
                document.getElementById('doctorFee').value = doctor.consultationFee || '';
                document.getElementById('doctorStatus').value = doctor.status || 'active';
                document.getElementById('doctorBio').value = doctor.bio || '';
                
                document.getElementById('doctorModal').style.display = 'block';
                
            } catch (error) {
                console.error('Error loading doctor for edit:', error);
                showMessage('error', 'Error loading doctor data');
            }
        }

        async function deleteDoctor(doctorId, doctorName) {
            if (!confirm(`Are you sure you want to delete Dr. ${doctorName}? This action cannot be undone.`)) {
                return;
            }
            
            try {
                await db.collection('doctors').doc(doctorId).delete();
                await logAdminAction('Doctor Deleted', `Deleted doctor: ${doctorName}`);
                showMessage('success', 'Doctor deleted successfully!');
                await loadDoctors();
                await loadInitialData();
                
            } catch (error) {
                console.error('Error deleting doctor:', error);
                showMessage('error', 'Error deleting doctor');
            }
        }

        // Search and Filter Functions
        function searchDoctors() {
            const searchTerm = document.getElementById('doctorSearch').value.toLowerCase();
            const filteredDoctors = allDoctors.filter(doctor => {
                return doctor.name.toLowerCase().includes(searchTerm) ||
                       doctor.email.toLowerCase().includes(searchTerm) ||
                       doctor.specialization.toLowerCase().includes(searchTerm);
            });
            
            displayDoctors(filteredDoctors);
        }

        function filterDoctors() {
            const specializationFilter = document.getElementById('specializationFilter').value;
            const statusFilter = document.getElementById('statusFilter').value;
            
            let filteredDoctors = allDoctors;
            
            if (specializationFilter) {
                filteredDoctors = filteredDoctors.filter(doctor => 
                    doctor.specialization === specializationFilter
                );
            }
            
            if (statusFilter) {
                filteredDoctors = filteredDoctors.filter(doctor => 
                    doctor.status === statusFilter
                );
            }
            
            displayDoctors(filteredDoctors);
        }

        // Profile Management
        async function handleProfileUpdate(e) {
            e.preventDefault();
            
            if (!currentUser) {
                showMessage('error', 'No user signed in');
                return;
            }
            
            try {
                const profileData = {
                    fullName: document.getElementById('editFullName').value.trim(),
                    phone: document.getElementById('editPhone').value.trim(),
                    department: document.getElementById('editDepartment').value,
                    bio: document.getElementById('bio').value.trim(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                
                await db.collection('users').doc(currentUser.uid).update(profileData);
                await logAdminAction('Profile Updated', 'User updated their profile information');
                
                // Update current user data
                currentUserData.fullName = profileData.fullName;
                currentUserData.phone = profileData.phone;
                currentUserData.department = profileData.department;
                currentUserData.bio = profileData.bio;
                
                // Update UI
                document.getElementById('userName').textContent = profileData.fullName;
                document.getElementById('userDepartment').textContent = profileData.department;
                document.getElementById('userWelcome').textContent = `Welcome, ${profileData.fullName}`;
                
                showMessage('success', 'Profile updated successfully!');
                
            } catch (error) {
                console.error('Error updating profile:', error);
                showMessage('error', 'Error updating profile');
            }
        }

        // Availability Management
        async function handleAvailabilityUpdate(e) {
            e.preventDefault();
            
            const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
            const availabilityData = {};
            
            days.forEach(day => {
                const checkbox = document.getElementById(day);
                const startTime = document.getElementById(day + 'Start');
                const endTime = document.getElementById(day + 'End');
                
                availabilityData[day] = {
                    available: checkbox ? checkbox.checked : false,
                    startTime: startTime ? startTime.value : '09:00',
                    endTime: endTime ? endTime.value : '17:00'
                };
            });
            
            try {
                await db.collection('users').doc(currentUser.uid).update({
                    availability: availabilityData,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                await logAdminAction('Availability Updated', 'User updated their availability schedule');
                showMessage('success', 'Availability updated successfully!');
                
            } catch (error) {
                console.error('Error updating availability:', error);
                showMessage('error', 'Error updating availability');
            }
        }

        // Export Functions
        async function exportDoctors() {
            try {
                let csvContent = "Name,Email,Phone,Specialization,License,Experience,Fee,Status\n";
                
                allDoctors.forEach(doctor => {
                    const row = [
                        `"${doctor.name || ''}"`,
                        `"${doctor.email || ''}"`,
                        `"${doctor.phone || ''}"`,
                        `"${doctor.specialization || ''}"`,
                        `"${doctor.licenseNumber || ''}"`,
                        `"${doctor.experience || 0}"`,
                        `"${doctor.consultationFee || 0}"`,
                        `"${doctor.status || 'active'}"`
                    ].join(',');
                    csvContent += row + "\n";
                });
                
                const blob = new Blob([csvContent], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `hospital_doctors_${new Date().toISOString().split('T')[0]}.csv`;
                a.click();
                window.URL.revokeObjectURL(url);
                
                await logAdminAction('Data Export', 'Exported doctors data to CSV');
                showMessage('success', 'Doctors data exported successfully!');
                
            } catch (error) {
                console.error('Error exporting doctors:', error);
                showMessage('error', 'Error exporting data');
            }
        }

        // PATIENT MANAGEMENT FUNCTIONS
        window.allPatients = window.allPatients || [];
        window.isEditingPatient = window.isEditingPatient || false;
        window.editingPatientId = window.editingPatientId || null;

        async function loadPatients() {
            try {
                const snapshot = await db.collection('patients').orderBy('createdAt', 'desc').get();
                allPatients = [];
                
                snapshot.forEach(doc => {
                    allPatients.push({ id: doc.id, ...doc.data() });
                });
                
                displayPatients(allPatients);
                updatePatientStats();
                
            } catch (error) {
                console.error('Error loading patients:', error);
                showMessage('error', 'Error loading patients data');
            }
        }

        function displayPatients(patients) {
            const container = document.getElementById('patientsContainer');
            
            if (patients.length === 0) {
                container.innerHTML = `
                    <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-secondary);">
                        <h3>No patients found</h3>
                        <p>Click "Add New Patient" to get started</p>
                    </div>
                `;
                return;
            }
            
            container.innerHTML = patients.map(patient => `
                <div class="item-card">
                    <div class="item-header">
                        <div>
                            <div class="item-title">${patient.name}</div>
                            <div class="item-subtitle">${patient.age} years • ${capitalizeFirst(patient.gender)}</div>
                            <div style="margin-top: 0.5rem; font-size: 0.9rem; color: var(--text-secondary);">
                                📞 ${patient.phone}<br>
                                ${patient.email ? `📧 ${patient.email}<br>` : ''}
                                🩸 ${patient.bloodGroup || 'Unknown'}<br>
                                📍 ${patient.status ? capitalizeFirst(patient.status) : 'Outpatient'}
                            </div>
                            ${patient.medicalHistory ? `<div style="margin-top: 0.5rem; font-style: italic; color: var(--text-secondary);">Medical: ${patient.medicalHistory.substring(0, 100)}${patient.medicalHistory.length > 100 ? '...' : ''}</div>` : ''}
                        </div>
                        <div class="item-actions">
                            <button class="btn btn-primary btn-sm" onclick="viewPatientDetails('${patient.id}')">View</button>
                            <button class="btn btn-warning btn-sm" onclick="editPatient('${patient.id}')">Edit</button>
                            <button class="btn btn-danger btn-sm" onclick="deletePatient('${patient.id}', '${patient.name}')">Delete</button>
                        </div>
                    </div>
                </div>
            `).join('');
        }

        function updatePatientStats() {
            const total = allPatients.length;
            const today = new Date().toDateString();
            const todayAdmissions = allPatients.filter(p => {
                const createdAt = p.createdAt && p.createdAt.toDate ? p.createdAt.toDate() : new Date();
                return createdAt.toDateString() === today;
            }).length;
            const inpatients = allPatients.filter(p => p.status === 'inpatient').length;
            
            document.getElementById('totalPatients').textContent = total;
            document.getElementById('todayAdmissions').textContent = todayAdmissions;
            document.getElementById('currentInpatients').textContent = inpatients;
        }

        function searchPatients() {
            const searchTerm = document.getElementById('patientSearch').value.toLowerCase();
            const filteredPatients = allPatients.filter(patient => {
                return patient.name.toLowerCase().includes(searchTerm) ||
                       patient.phone.includes(searchTerm) ||
                       (patient.email && patient.email.toLowerCase().includes(searchTerm));
            });
            
            displayPatients(filteredPatients);
        }

        // Toggle sidebar open/close function
        function toggleNavigation() {
            const nav = document.getElementById('dashboardNav');
            nav.classList.toggle('open');
        }

        // Add mobile menu button dynamically
        function addMobileMenuButton() {
            if (window.innerWidth <= 768 && !document.getElementById('mobileMenuBtn')) {
                const btn = document.createElement('button');
                btn.id = 'mobileMenuBtn';
                btn.className = 'mobile-menu-btn';
                btn.innerHTML = '☰';
                btn.onclick = toggleNavigation;
                document.body.appendChild(btn);
            } else if (window.innerWidth > 768) {
                const btn = document.getElementById('mobileMenuBtn');
                if (btn) btn.remove();
            }
        }

        // Initialize on load and resize
        window.addEventListener('load', addMobileMenuButton);
        window.addEventListener('resize', addMobileMenuButton);


        function filterPatients() {
            const genderFilter = document.getElementById('genderFilter').value;
            const ageFilter = document.getElementById('ageFilter').value;
            
            let filteredPatients = allPatients;
            
            if (genderFilter) {
                filteredPatients = filteredPatients.filter(patient => 
                    patient.gender === genderFilter
                );
            }
            
            if (ageFilter) {
                filteredPatients = filteredPatients.filter(patient => {
                    const age = patient.age;
                    switch(ageFilter) {
                        case 'child': return age < 18;
                        case 'adult': return age >= 18 && age < 60;
                        case 'senior': return age >= 60;
                        default: return true;
                    }
                });
            }
            
            displayPatients(filteredPatients);
        }

        function openPatientModal() {
            isEditingPatient = false;
            editingPatientId = null;
            document.getElementById('patientModalTitle').textContent = 'Add New Patient';
            document.getElementById('patientForm').reset();
            document.getElementById('patientModal').style.display = 'block';
        }

        function closePatientModal() {
            document.getElementById('patientModal').style.display = 'none';
        }

        async function handlePatientSubmit(e) {
            e.preventDefault();
            
            const submitBtn = document.getElementById('patientSubmitText');
            const spinner = document.getElementById('patientSubmitSpinner');
            
            submitBtn.style.display = 'none';
            spinner.style.display = 'inline-block';
            
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
                        ...patientData,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
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
                
            } catch (error) {
                console.error('Error saving patient:', error);
                showMessage('error', 'Error saving patient. Please try again.');
            } finally {
                submitBtn.style.display = 'inline';
                spinner.style.display = 'none';
            }
        }

        async function editPatient(patientId) {
            try {
                const patientDoc = await db.collection('patients').doc(patientId).get();
                if (!patientDoc.exists) {
                    showMessage('error', 'Patient not found');
                    return;
                }
                
                const patient = patientDoc.data();
                isEditingPatient = true;
                editingPatientId = patientId;
                
                // Populate form
                document.getElementById('patientModalTitle').textContent = 'Edit Patient';
                document.getElementById('patientName').value = patient.name || '';
                document.getElementById('patientAge').value = patient.age || '';
                document.getElementById('patientGender').value = patient.gender || '';
                document.getElementById('patientPhone').value = patient.phone || '';
                document.getElementById('patientEmail').value = patient.email || '';
                document.getElementById('patientBloodGroup').value = patient.bloodGroup || '';
                document.getElementById('emergencyContact').value = patient.emergencyContact || '';
                document.getElementById('patientStatus').value = patient.status || 'outpatient';
                document.getElementById('patientAddress').value = patient.address || '';
                document.getElementById('medicalHistory').value = patient.medicalHistory || '';
                
                document.getElementById('patientModal').style.display = 'block';
                
            } catch (error) {
                console.error('Error loading patient for edit:', error);
                showMessage('error', 'Error loading patient data');
            }
        }

        async function deletePatient(patientId, patientName) {
            if (!confirm(`Are you sure you want to delete ${patientName}? This action cannot be undone.`)) {
                return;
            }
            
            try {
                await db.collection('patients').doc(patientId).delete();
                await logAdminAction('Patient Deleted', `Deleted patient: ${patientName}`);
                showMessage('success', 'Patient deleted successfully!');
                await loadPatients();
                
            } catch (error) {
                console.error('Error deleting patient:', error);
                showMessage('error', 'Error deleting patient');
            }
        }

        function viewPatientDetails(patientId) {
            const patient = allPatients.find(p => p.id === patientId);
            if (patient) {
                alert(`Patient Details:
                
Name: ${patient.name}
Age: ${patient.age} years
Gender: ${capitalizeFirst(patient.gender)}
Phone: ${patient.phone}
Email: ${patient.email || 'Not provided'}
Blood Group: ${patient.bloodGroup || 'Unknown'}
Status: ${capitalizeFirst(patient.status || 'outpatient')}
Emergency Contact: ${patient.emergencyContact || 'Not provided'}
Address: ${patient.address || 'Not provided'}
Medical History: ${patient.medicalHistory || 'No medical history recorded'}`);
            }
        }

        async function exportPatients() {
            try {
                let csvContent = "Name,Age,Gender,Phone,Email,Blood Group,Status,Emergency Contact,Address\n";
                
                allPatients.forEach(patient => {
                    const row = [
                        `"${patient.name || ''}"`,
                        `"${patient.age || ''}"`,
                        `"${patient.gender || ''}"`,
                        `"${patient.phone || ''}"`,
                        `"${patient.email || ''}"`,
                        `"${patient.bloodGroup || ''}"`,
                        `"${patient.status || ''}"`,
                        `"${patient.emergencyContact || ''}"`,
                        `"${(patient.address || '').replace(/"/g, '""')}"`
                    ].join(',');
                    csvContent += row + "\n";
                });
                
                const blob = new Blob([csvContent], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `hospital_patients_${new Date().toISOString().split('T')[0]}.csv`;
                a.click();
                window.URL.revokeObjectURL(url);
                
                await logAdminAction('Data Export', 'Exported patients data to CSV');
                showMessage('success', 'Patients data exported successfully!');
                
            } catch (error) {
                console.error('Error exporting patients:', error);
                showMessage('error', 'Error exporting data');
            }
        }

        // OPERATION THEATER MANAGEMENT FUNCTIONS
        window.allOTRooms = window.allOTRooms || [];
        window.allOTSchedules = window.allOTSchedules || [];

        async function loadOTRooms() {
            try {
                const snapshot = await db.collection('ot_rooms').orderBy('roomNumber').get();
                allOTRooms = [];
                
                snapshot.forEach(doc => {
                    allOTRooms.push({ id: doc.id, ...doc.data() });
                });
                
                displayOTRooms(allOTRooms);
                populateOTRoomSelects();
                
            } catch (error) {
                console.error('Error loading OT rooms:', error);
                showMessage('error', 'Error loading OT rooms data');
            }
        }

        function displayOTRooms(rooms) {
            const container = document.getElementById('otRoomsContainer');
            
            if (rooms.length === 0) {
                container.innerHTML = `
                    <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-secondary);">
                        <h3>No OT rooms found</h3>
                        <p>Click "Add New OT Room" to get started</p>
                    </div>
                `;
                return;
            }
            
            container.innerHTML = rooms.map(room => `
                <div class="item-card">
                    <div class="item-header">
                        <div>
                            <div class="item-title">OT Room ${room.roomNumber}</div>
                            <div class="item-subtitle">${capitalizeFirst(room.type)} Surgery</div>
                            <div style="margin-top: 0.5rem;">
                                <span style="padding: 0.25rem 0.75rem; border-radius: 15px; font-size: 0.8rem; background: ${getStatusColor(room.status)};">
                                    ${capitalizeFirst(room.status)}
                                </span>
                            </div>
                            ${room.equipment ? `<div style="margin-top: 0.5rem; font-size: 0.9rem; color: var(--text-secondary);">Equipment: ${room.equipment}</div>` : ''}
                        </div>
                        <div class="item-actions">
                            <button class="btn btn-warning btn-sm" onclick="editOTRoom('${room.id}')">Edit</button>
                            <button class="btn btn-danger btn-sm" onclick="deleteOTRoom('${room.id}', '${room.roomNumber}')">Delete</button>
                        </div>
                    </div>
                </div>
            `).join('');
        }

        function getStatusColor(status) {
            switch(status) {
                case 'available': return 'rgba(39, 174, 96, 0.1); color: #27ae60';
                case 'occupied': return 'rgba(231, 76, 60, 0.1); color: #e74c3c';
                case 'maintenance': return 'rgba(255, 193, 7, 0.1); color: #b45309';
                case 'cleaning': return 'rgba(52, 152, 219, 0.1); color: #2980b9';
                default: return 'rgba(149, 165, 166, 0.1); color: #7f8c8d';
            }
        }

        function openOTRoomModal() {
            document.getElementById('otRoomForm').reset();
            document.getElementById('otRoomModal').style.display = 'block';
        }

        function closeOTRoomModal() {
            document.getElementById('otRoomModal').style.display = 'none';
        }

        async function handleOTRoomSubmit(e) {
            e.preventDefault();
            
            try {
                const roomData = {
                    roomNumber: document.getElementById('otRoomNumber').value.trim(),
                    type: document.getElementById('otRoomType').value,
                    status: document.getElementById('otRoomStatus').value,
                    equipment: document.getElementById('otRoomEquipment').value.trim(),
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                
                await db.collection('ot_rooms').add(roomData);
                
                await logAdminAction('OT Room Added', `Added new OT room: ${roomData.roomNumber}`);
                showMessage('success', 'OT Room added successfully!');
                
                closeOTRoomModal();
                await loadOTRooms();
                
            } catch (error) {
                console.error('Error saving OT room:', error);
                showMessage('error', 'Error saving OT room. Please try again.');
            }
        }

        async function deleteOTRoom(roomId, roomNumber) {
            if (!confirm(`Are you sure you want to delete OT Room ${roomNumber}? This action cannot be undone.`)) {
                return;
            }
            
            try {
                await db.collection('ot_rooms').doc(roomId).delete();
                await logAdminAction('OT Room Deleted', `Deleted OT room: ${roomNumber}`);
                showMessage('success', 'OT Room deleted successfully!');
                await loadOTRooms();
                
            } catch (error) {
                console.error('Error deleting OT room:', error);
                showMessage('error', 'Error deleting OT room');
            }
        }

        function openOTScheduleModal() {
            populateScheduleSelects();
            document.getElementById('otScheduleForm').reset();
            // Set default date to today
            document.getElementById('scheduleDate').value = new Date().toISOString().split('T')[0];
            document.getElementById('otScheduleModal').style.display = 'block';
        }

        function closeOTScheduleModal() {
            document.getElementById('otScheduleModal').style.display = 'none';
        }

        function populateScheduleSelects() {
            // Populate OT Rooms
            const otRoomSelect = document.getElementById('scheduleOTRoom');
            otRoomSelect.innerHTML = '<option value="">Select OT Room</option>';
            allOTRooms.filter(room => room.status === 'available').forEach(room => {
                otRoomSelect.innerHTML += `<option value="${room.id}">OT Room ${room.roomNumber} (${capitalizeFirst(room.type)})</option>`;
            });
            
            // Populate Patients
            const patientSelect = document.getElementById('schedulePatient');
            patientSelect.innerHTML = '<option value="">Select Patient</option>';
            allPatients.forEach(patient => {
                patientSelect.innerHTML += `<option value="${patient.id}">${patient.name} (${patient.age}y, ${capitalizeFirst(patient.gender)})</option>`;
            });
            
            // Populate Surgeons (from doctors)
            const surgeonSelect = document.getElementById('scheduleSurgeon');
            surgeonSelect.innerHTML = '<option value="">Select Surgeon</option>';
            allDoctors.forEach(doctor => {
                surgeonSelect.innerHTML += `<option value="${doctor.id}">${doctor.name} (${capitalizeFirst(doctor.specialization)})</option>`;
            });
        }

        function populateOTRoomSelects() {
            // This is called when OT rooms are loaded to update any selects
            populateScheduleSelects();
        }

        async function handleOTScheduleSubmit(e) {
            e.preventDefault();
            
            try {
                const scheduleData = {
                    otRoomId: document.getElementById('scheduleOTRoom').value,
                    patientId: document.getElementById('schedulePatient').value,
                    surgeonId: document.getElementById('scheduleSurgeon').value,
                    date: document.getElementById('scheduleDate').value,
                    startTime: document.getElementById('scheduleStartTime').value,
                    endTime: document.getElementById('scheduleEndTime').value,
                    procedure: document.getElementById('scheduleProcedure').value.trim(),
                    notes: document.getElementById('scheduleNotes').value.trim(),
                    status: 'scheduled',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                
                // Check for conflicts
                const isConflict = await checkOTConflict(scheduleData.otRoomId, scheduleData.date, scheduleData.startTime, scheduleData.endTime);
                if (isConflict) {
                    showMessage('error', 'Time conflict detected! The selected OT room is already booked for this time.');
                    return;
                }
                
                await db.collection('ot_schedules').add(scheduleData);
                
                await logAdminAction('Operation Scheduled', `Scheduled operation: ${scheduleData.procedure}`);
                showMessage('success', 'Operation scheduled successfully!');
                
                closeOTScheduleModal();
                await loadOTSchedule();
                
            } catch (error) {
                console.error('Error scheduling operation:', error);
                showMessage('error', 'Error scheduling operation. Please try again.');
            }
        }

        async function checkOTConflict(roomId, date, startTime, endTime) {
            try {
                const snapshot = await db.collection('ot_schedules')
                    .where('otRoomId', '==', roomId)
                    .where('date', '==', date)
                    .get();
                
                const existingSchedules = snapshot.docs.map(doc => doc.data());
                
                return existingSchedules.some(schedule => {
                    return (startTime < schedule.endTime && endTime > schedule.startTime);
                });
                
            } catch (error) {
                console.error('Error checking OT conflict:', error);
                return false;
            }
        }

        async function loadOTSchedule() {
            const selectedDate = document.getElementById('otScheduleDate').value || new Date().toISOString().split('T')[0];
            
            try {
                const snapshot = await db.collection('ot_schedules')
                    .where('date', '==', selectedDate)
                    .orderBy('startTime')
                    .get();
                
                allOTSchedules = [];
                snapshot.forEach(doc => {
                    allOTSchedules.push({ id: doc.id, ...doc.data() });
                });
                
                await displayOTSchedule();
                
            } catch (error) {
                console.error('Error loading OT schedule:', error);
                showMessage('error', 'Error loading OT schedule');
            }
        }

        async function displayOTSchedule() {
            const container = document.getElementById('otScheduleContainer');
            
            if (allOTSchedules.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 3rem; color: var(--text-secondary);">
                        <h3>No operations scheduled for this date</h3>
                        <p>Click "Schedule Operation" to add a new operation</p>
                    </div>
                `;
                return;
            }
            
            let scheduleHTML = '<div class="schedule-table" style="overflow-x: auto;"><table class="data-table"><thead><tr><th>Time</th><th>OT Room</th><th>Patient</th><th>Surgeon</th><th>Procedure</th><th>Status</th><th>Actions</th></tr></thead><tbody>';
            
            for (const schedule of allOTSchedules) {
                const room = allOTRooms.find(r => r.id === schedule.otRoomId);
                const patient = allPatients.find(p => p.id === schedule.patientId);
                const surgeon = allDoctors.find(d => d.id === schedule.surgeonId);
                
                scheduleHTML += `
                    <tr>
                        <td>${schedule.startTime} - ${schedule.endTime}</td>
                        <td>OT ${room ? room.roomNumber : 'Unknown'}</td>
                        <td>${patient ? patient.name : 'Unknown Patient'}</td>
                        <td>${surgeon ? surgeon.name : 'Unknown Surgeon'}</td>
                        <td>${schedule.procedure}</td>
                        <td>
                            <span style="padding: 0.25rem 0.75rem; border-radius: 15px; font-size: 0.8rem; background: ${getScheduleStatusColor(schedule.status)};">
                                ${capitalizeFirst(schedule.status)}
                            </span>
                        </td>
                        <td>
                            <button class="btn btn-warning btn-sm" onclick="updateOTStatus('${schedule.id}')">Update</button>
                            <button class="btn btn-danger btn-sm" onclick="cancelOperation('${schedule.id}')">Cancel</button>
                        </td>
                    </tr>
                `;
            }
            
            scheduleHTML += '</tbody></table></div>';
            container.innerHTML = scheduleHTML;
        }

        function getScheduleStatusColor(status) {
            switch(status) {
                case 'scheduled': return 'rgba(52, 152, 219, 0.1); color: #2980b9';
                case 'in-progress': return 'rgba(255, 193, 7, 0.1); color: #b45309';
                case 'completed': return 'rgba(39, 174, 96, 0.1); color: #27ae60';
                case 'cancelled': return 'rgba(231, 76, 60, 0.1); color: #e74c3c';
                default: return 'rgba(149, 165, 166, 0.1); color: #7f8c8d';
            }
        }

        function changeOTDate(days) {
            const currentDate = new Date(document.getElementById('otScheduleDate').value || new Date());
            currentDate.setDate(currentDate.getDate() + days);
            document.getElementById('otScheduleDate').value = currentDate.toISOString().split('T')[0];
            loadOTSchedule();
        }

        async function updateOTStatus(scheduleId) {
            const newStatus = prompt('Update status to:\n1. scheduled\n2. in-progress\n3. completed\n4. cancelled\n\nEnter status:');
            
            if (newStatus && ['scheduled', 'in-progress', 'completed', 'cancelled'].includes(newStatus)) {
                try {
                    await db.collection('ot_schedules').doc(scheduleId).update({
                        status: newStatus,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    
                    showMessage('success', 'Operation status updated successfully!');
                    await loadOTSchedule();
                    
                } catch (error) {
                    console.error('Error updating operation status:', error);
                    showMessage('error', 'Error updating status');
                }
            }
        }

        async function cancelOperation(scheduleId) {
            if (!confirm('Are you sure you want to cancel this operation?')) {
                return;
            }
            
            try {
                await db.collection('ot_schedules').doc(scheduleId).update({
                    status: 'cancelled',
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                await logAdminAction('Operation Cancelled', 'Cancelled scheduled operation');
                showMessage('success', 'Operation cancelled successfully!');
                await loadOTSchedule();
                
            } catch (error) {
                console.error('Error cancelling operation:', error);
                showMessage('error', 'Error cancelling operation');
            }
        }

        // Initialize OT schedule date to today
        document.addEventListener('DOMContentLoaded', function() {
            const today = new Date().toISOString().split('T')[0];
            const otDateInput = document.getElementById('otScheduleDate');
            if (otDateInput) {
                otDateInput.value = today;
            }
        });

        // Authentication Flow Functions
        async function changePassword() {
            const currentPassword = prompt('Enter your current password:');
            const newPassword = prompt('Enter your new password (minimum 6 characters):');
            
            if (!currentPassword || !newPassword) return;
            
            if (newPassword.length < 6) {
                showMessage('error', 'New password must be at least 6 characters');
                return;
            }
            
            try {
                const credential = firebase.auth.EmailAuthProvider.credential(
                    currentUser.email,
                    currentPassword
                );
                
                await currentUser.reauthenticateWithCredential(credential);
                await currentUser.updatePassword(newPassword);
                
                await logAdminAction('Password Changed', 'User changed their password');
                showMessage('success', 'Password changed successfully!');
            } catch (error) {
                console.error('Error changing password:', error);
                showMessage('error', 'Error changing password. Check your current password.');
            }
        }

        async function resetPassword() {
            if (!currentUser) return;
            
            try {
                await auth.sendPasswordResetEmail(currentUser.email);
                showMessage('success', 'Password reset email sent!');
            } catch (error) {
                console.error('Error sending reset email:', error);
                showMessage('error', 'Error sending reset email');
            }
        }

        async function resendVerification() {
            if (!currentUser) return;
            
            try {
                await currentUser.sendEmailVerification();
                showMessage('success', 'Verification email sent!');
            } catch (error) {
                console.error('Error sending verification:', error);
                showMessage('error', 'Error sending verification email');
            }
        }

        function viewLoginHistory() {
            alert('Login history feature coming soon!');
        }

        // Additional Functions
        function contactSupport() {
            alert('Support Contact:\n\nEmail: support@hospital.com\nPhone: +1 (555) 123-4567\nHours: 24/7 Emergency Support');
        }

        function editProfile() {
            showSection('profile');
        }

        function viewAllUsers() {
            showSection('users');
        }

        function exportUsers() {
            showMessage('success', 'Users export feature coming soon!');
        }

        function manageUsers() {
            showSection('users');
        }

        function viewAnalytics() {
            showSection('analytics');
        }

        function systemSettings() {
            showMessage('success', 'System settings feature coming soon!');
        }

        function manageOperations() {
            showSection('operations');
        }

        function scheduleManagement() {
            showSection('scheduling');
        }

        function auditLogs() {
            showSection('logs');
        }

        function viewSchedule() {
            showSection('assignments');
        }

        function profileSettings() {
            showSection('profile');
        }

        function viewAssignments() {
            showSection('assignments');
        }

        function updateAvailability() {
            showSection('availability');
        }

        // Enhanced toggle function with debugging
// Enhanced sidebar toggle for all screen sizes
let sidebarOpen = true; // default: open

function toggleSidebar() {
    const nav = document.getElementById('dashboardNav');
    const main = document.querySelector('.main-content');
    const btn = document.getElementById('sidebarToggleBtn');
    sidebarOpen = !sidebarOpen;
    if (sidebarOpen) {
        nav.classList.remove('closed');
        main.classList.remove('sidebar-closed');
        btn.classList.remove('closed');
        btn.innerHTML = '‹';
        btn.title = 'Close Sidebar';
        btn.setAttribute('aria-label', 'Close sidebar');
    } else {
        nav.classList.add('closed');
        main.classList.add('sidebar-closed');
        btn.classList.add('closed');
        btn.innerHTML = '›';
        btn.title = 'Open Sidebar';
        btn.setAttribute('aria-label', 'Open sidebar');
    }
}

// Optional: set initial state on DOM load
document.addEventListener('DOMContentLoaded', function() {
    sidebarOpen = true;
    toggleSidebar(); // This will initially close it, call twice if you want to initialize open
    toggleSidebar();
});
 // Track sidebar state

function toggleSidebar() {
    console.log('🔄 Toggle sidebar called');
    
    const nav = document.getElementById('dashboardNav');
    const mainContent = document.querySelector('.main-content');
    const toggleBtn = document.getElementById('sidebarToggleBtn');
    
    if (nav && mainContent) {
        sidebarOpen = !sidebarOpen;
        
        if (sidebarOpen) {
            // Open sidebar
            nav.classList.remove('closed');
            mainContent.classList.remove('sidebar-closed');
            if (toggleBtn) {
                toggleBtn.style.left = '300px';
                toggleBtn.innerHTML = '‹';
                toggleBtn.title = 'Close Sidebar';
            }
            console.log('✅ Sidebar opened');
        } else {
            // Close sidebar
            nav.classList.add('closed');
            mainContent.classList.add('sidebar-closed');
            if (toggleBtn) {
                toggleBtn.style.left = '20px';
                toggleBtn.innerHTML = '›';
                toggleBtn.title = 'Open Sidebar';
            }
            console.log('✅ Sidebar closed');
        }
    } else {
        console.error('❌ Navigation or main content element not found');
    }
}

// Create and add the toggle button
function createSidebarToggle() {
    // Remove existing button if any
    const existingBtn = document.getElementById('sidebarToggleBtn');
    if (existingBtn) existingBtn.remove();
    
    // Create new toggle button
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'sidebarToggleBtn';
    toggleBtn.className = 'sidebar-toggle-btn';
    toggleBtn.innerHTML = '‹'; // Left arrow when sidebar is open
    toggleBtn.title = 'Close Sidebar';
    toggleBtn.onclick = toggleSidebar;
    
    // Add to body
    document.body.appendChild(toggleBtn);
    console.log('✅ Sidebar toggle button created');
}

// Initialize toggle button when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Create toggle button after a short delay to ensure DOM is ready
    setTimeout(createSidebarToggle, 500);
});

// Also create on window load as backup
window.addEventListener('load', function() {
    if (!document.getElementById('sidebarToggleBtn')) {
        createSidebarToggle();
    }
});

// Optional: Add keyboard shortcut (Ctrl+B to toggle)
document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.key === 'b') {
        e.preventDefault();
        toggleSidebar();
    }
});

        // Admin logging
        async function logAdminAction(action, details) {
            try {
                if (!currentUser) return;
                
                await db.collection('adminLogs').add({
                    userId: currentUser.uid,
                    userEmail: currentUser.email,
                    action: action,
                    details: details,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
                
            } catch (error) {
                console.error('Error logging admin action:', error);
            }
        }

        // Utility Functions
        function capitalizeFirst(str) {
            if (!str) return '';
            return str.charAt(0).toUpperCase() + str.slice(1);
        }

        function setAuthLoading(loading) {
            const button = document.getElementById('authButton');
            const buttonText = document.getElementById('authButtonText');
            const spinner = document.getElementById('authSpinner');
            
            button.disabled = loading;
            if (loading) {
                buttonText.style.display = 'none';
                spinner.style.display = 'inline-block';
            } else {
                buttonText.style.display = 'inline';
                spinner.style.display = 'none';
            }
        }

        function showAuthMessage(type, message) {
            const errorDiv = document.getElementById('authErrorMessage');
            const successDiv = document.getElementById('authSuccessMessage');
            
            hideAuthMessages();
            
            if (type === 'error') {
                errorDiv.textContent = message;
                errorDiv.style.display = 'block';
            } else {
                successDiv.textContent = message;
                successDiv.style.display = 'block';
            }
            
            setTimeout(hideAuthMessages, 5000);
        }

        function hideAuthMessages() {
            document.getElementById('authErrorMessage').style.display = 'none';
            document.getElementById('authSuccessMessage').style.display = 'none';
        }

        function showMessage(type, message) {
            // Create floating notification
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 1rem 1.5rem;
                border-radius: 15px;
                color: white;
                font-weight: 500;
                z-index: 10000;
                max-width: 400px;
                backdrop-filter: blur(10px);
                animation: slideInRight 0.3s ease;
                background: ${type === 'success' ? 'rgba(39, 174, 96, 0.9)' : 'rgba(231, 76, 60, 0.9)'};
            `;
            notification.textContent = message;
            
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.style.animation = 'slideOutRight 0.3s ease';
                setTimeout(() => {
                    if (document.body.contains(notification)) {
                        document.body.removeChild(notification);
                    }
                }, 300);
            }, 4000);
        }

        // Logout
        async function logout() {
            try {
                if (currentUser) {
                    await logAdminAction('User Logout', 'User logged out successfully');
                }
                
                await auth.signOut();
                clearInterval(sessionTimer);
                sessionStartTime = null;
                currentUser = null;
                currentUserData = null;
                showMessage('success', 'Logged out successfully!');
                
            } catch (error) {
                console.error('Error logging out:', error);
                showMessage('error', 'Error logging out');
            }
        }

        // Add CSS animations
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOutRight {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
        `;
        document.head.appendChild(style);

        // Close modals when clicking outside
        window.onclick = function(event) {
            const modals = document.querySelectorAll('.modal');
            modals.forEach(modal => {
                if (event.target === modal) {
                    modal.style.display = 'none';
                }
            });
        }

        console.log('🏥 Hospital Management System loaded successfully!');
        console.log('📧 For support: support@hospital.com');
        console.log('🔗 Version: 2.0.0 - Complete with Patient & OT Management');

                // PATIENT MANAGEMENT FUNCTIONS (NEW ADDITION)
        let allPatients = [];
        let isEditingPatient = false;
        let editingPatientId = null;

        async function loadPatients() {
            try {
                const snapshot = await db.collection('patients').orderBy('createdAt', 'desc').get();
                allPatients = [];
                
                snapshot.forEach(doc => {
                    allPatients.push({ id: doc.id, ...doc.data() });
                });
                
                displayPatients(allPatients);
                updatePatientStats();
                
            } catch (error) {
                console.error('Error loading patients:', error);
                showMessage('error', 'Error loading patients data');
            }
        }

        function displayPatients(patients) {
            const container = document.getElementById('patientsContainer');
            
            if (patients.length === 0) {
                container.innerHTML = `
                    <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-secondary);">
                        <h3>No patients found</h3>
                        <p>Click "Add New Patient" to get started</p>
                    </div>
                `;
                return;
            }
            
            container.innerHTML = patients.map(patient => `
                <div class="item-card">
                    <div class="item-header">
                        <div>
                            <div class="item-title">${patient.name}</div>
                            <div class="item-subtitle">${patient.age} years • ${capitalizeFirst(patient.gender)}</div>
                            <div style="margin-top: 0.5rem; font-size: 0.9rem; color: var(--text-secondary);">
                                📞 ${patient.phone}<br>
                                ${patient.email ? `📧 ${patient.email}<br>` : ''}
                                🩸 ${patient.bloodGroup || 'Unknown'}<br>
                                📍 ${patient.status ? capitalizeFirst(patient.status) : 'Outpatient'}
                            </div>
                            ${patient.medicalHistory ? `<div style="margin-top: 0.5rem; font-style: italic; color: var(--text-secondary);">Medical: ${patient.medicalHistory.substring(0, 100)}${patient.medicalHistory.length > 100 ? '...' : ''}</div>` : ''}
                        </div>
                        <div class="item-actions">
                            <button class="btn btn-primary btn-sm" onclick="viewPatientDetails('${patient.id}')">View</button>
                            <button class="btn btn-warning btn-sm" onclick="editPatient('${patient.id}')">Edit</button>
                            <button class="btn btn-danger btn-sm" onclick="deletePatient('${patient.id}', '${patient.name}')">Delete</button>
                        </div>
                    </div>
                </div>
            `).join('');
        }

        function updatePatientStats() {
            const total = allPatients.length;
            const today = new Date().toDateString();
            const todayAdmissions = allPatients.filter(p => {
                const createdAt = p.createdAt && p.createdAt.toDate ? p.createdAt.toDate() : new Date();
                return createdAt.toDateString() === today;
            }).length;
            const inpatients = allPatients.filter(p => p.status === 'inpatient').length;
            
            document.getElementById('totalPatients').textContent = total;
            document.getElementById('todayAdmissions').textContent = todayAdmissions;
            document.getElementById('currentInpatients').textContent = inpatients;
        }

        function searchPatients() {
            const searchTerm = document.getElementById('patientSearch').value.toLowerCase();
            const filteredPatients = allPatients.filter(patient => {
                return patient.name.toLowerCase().includes(searchTerm) ||
                       patient.phone.includes(searchTerm) ||
                       (patient.email && patient.email.toLowerCase().includes(searchTerm));
            });
            
            displayPatients(filteredPatients);
        }

        function filterPatients() {
            const genderFilter = document.getElementById('genderFilter').value;
            const ageFilter = document.getElementById('ageFilter').value;
            
            let filteredPatients = allPatients;
            
            if (genderFilter) {
                filteredPatients = filteredPatients.filter(patient => 
                    patient.gender === genderFilter
                );
            }
            
            if (ageFilter) {
                filteredPatients = filteredPatients.filter(patient => {
                    const age = patient.age;
                    switch(ageFilter) {
                        case 'child': return age < 18;
                        case 'adult': return age >= 18 && age < 60;
                        case 'senior': return age >= 60;
                        default: return true;
                    }
                });
            }
            
            displayPatients(filteredPatients);
        }

        function openPatientModal() {
            isEditingPatient = false;
            editingPatientId = null;
            document.getElementById('patientModalTitle').textContent = 'Add New Patient';
            document.getElementById('patientForm').reset();
            document.getElementById('patientModal').style.display = 'block';
        }

        function closePatientModal() {
            document.getElementById('patientModal').style.display = 'none';
        }

        async function handlePatientSubmit(e) {
            e.preventDefault();
            
            const submitBtn = document.getElementById('patientSubmitText');
            const spinner = document.getElementById('patientSubmitSpinner');
            
            submitBtn.style.display = 'none';
            spinner.style.display = 'inline-block';
            
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
                        ...patientData,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
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
                
            } catch (error) {
                console.error('Error saving patient:', error);
                showMessage('error', 'Error saving patient. Please try again.');
            } finally {
                submitBtn.style.display = 'inline';
                spinner.style.display = 'none';
            }
        }

        async function editPatient(patientId) {
            try {
                const patientDoc = await db.collection('patients').doc(patientId).get();
                if (!patientDoc.exists) {
                    showMessage('error', 'Patient not found');
                    return;
                }
                
                const patient = patientDoc.data();
                isEditingPatient = true;
                editingPatientId = patientId;
                
                // Populate form
                document.getElementById('patientModalTitle').textContent = 'Edit Patient';
                document.getElementById('patientName').value = patient.name || '';
                document.getElementById('patientAge').value = patient.age || '';
                document.getElementById('patientGender').value = patient.gender || '';
                document.getElementById('patientPhone').value = patient.phone || '';
                document.getElementById('patientEmail').value = patient.email || '';
                document.getElementById('patientBloodGroup').value = patient.bloodGroup || '';
                document.getElementById('emergencyContact').value = patient.emergencyContact || '';
                document.getElementById('patientStatus').value = patient.status || 'outpatient';
                document.getElementById('patientAddress').value = patient.address || '';
                document.getElementById('medicalHistory').value = patient.medicalHistory || '';
                
                document.getElementById('patientModal').style.display = 'block';
                
            } catch (error) {
                console.error('Error loading patient for edit:', error);
                showMessage('error', 'Error loading patient data');
            }
        }

        async function deletePatient(patientId, patientName) {
            if (!confirm(`Are you sure you want to delete ${patientName}? This action cannot be undone.`)) {
                return;
            }
            
            try {
                await db.collection('patients').doc(patientId).delete();
                await logAdminAction('Patient Deleted', `Deleted patient: ${patientName}`);
                showMessage('success', 'Patient deleted successfully!');
                await loadPatients();
                
            } catch (error) {
                console.error('Error deleting patient:', error);
                showMessage('error', 'Error deleting patient');
            }
        }

        function viewPatientDetails(patientId) {
            const patient = allPatients.find(p => p.id === patientId);
            if (patient) {
                alert(`Patient Details:
                
Name: ${patient.name}
Age: ${patient.age} years
Gender: ${capitalizeFirst(patient.gender)}
Phone: ${patient.phone}
Email: ${patient.email || 'Not provided'}
Blood Group: ${patient.bloodGroup || 'Unknown'}
Status: ${capitalizeFirst(patient.status || 'outpatient')}
Emergency Contact: ${patient.emergencyContact || 'Not provided'}
Address: ${patient.address || 'Not provided'}
Medical History: ${patient.medicalHistory || 'No medical history recorded'}`);
            }
        }

        async function exportPatients() {
            try {
                let csvContent = "Name,Age,Gender,Phone,Email,Blood Group,Status,Emergency Contact,Address\n";
                
                allPatients.forEach(patient => {
                    const row = [
                        `"${patient.name || ''}"`,
                        `"${patient.age || ''}"`,
                        `"${patient.gender || ''}"`,
                        `"${patient.phone || ''}"`,
                        `"${patient.email || ''}"`,
                        `"${patient.bloodGroup || ''}"`,
                        `"${patient.status || ''}"`,
                        `"${patient.emergencyContact || ''}"`,
                        `"${(patient.address || '').replace(/"/g, '""')}"`
                    ].join(',');
                    csvContent += row + "\n";
                });
                
                const blob = new Blob([csvContent], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `hospital_patients_${new Date().toISOString().split('T')[0]}.csv`;
                a.click();
                window.URL.revokeObjectURL(url);
                
                await logAdminAction('Data Export', 'Exported patients data to CSV');
                showMessage('success', 'Patients data exported successfully!');
                
            } catch (error) {
                console.error('Error exporting patients:', error);
                showMessage('error', 'Error exporting data');
            }
        }

        // OPERATION THEATER MANAGEMENT FUNCTIONS (NEW ADDITION)
        let allOTRooms = [];
        let allOTSchedules = [];

        async function loadOTRooms() {
            try {
                const snapshot = await db.collection('ot_rooms').orderBy('roomNumber').get();
                allOTRooms = [];
                
                snapshot.forEach(doc => {
                    allOTRooms.push({ id: doc.id, ...doc.data() });
                });
                
                displayOTRooms(allOTRooms);
                populateOTRoomSelects();
                
            } catch (error) {
                console.error('Error loading OT rooms:', error);
                showMessage('error', 'Error loading OT rooms data');
            }
        }

        function displayOTRooms(rooms) {
            const container = document.getElementById('otRoomsContainer');
            
            if (rooms.length === 0) {
                container.innerHTML = `
                    <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-secondary);">
                        <h3>No OT rooms found</h3>
                        <p>Click "Add New OT Room" to get started</p>
                    </div>
                `;
                return;
            }
            
            container.innerHTML = rooms.map(room => `
                <div class="item-card">
                    <div class="item-header">
                        <div>
                            <div class="item-title">OT Room ${room.roomNumber}</div>
                            <div class="item-subtitle">${capitalizeFirst(room.type)} Surgery</div>
                            <div style="margin-top: 0.5rem;">
                                <span style="padding: 0.25rem 0.75rem; border-radius: 15px; font-size: 0.8rem; background: ${getStatusColor(room.status)};">
                                    ${capitalizeFirst(room.status)}
                                </span>
                            </div>
                            ${room.equipment ? `<div style="margin-top: 0.5rem; font-size: 0.9rem; color: var(--text-secondary);">Equipment: ${room.equipment}</div>` : ''}
                        </div>
                        <div class="item-actions">
                            <button class="btn btn-warning btn-sm" onclick="editOTRoom('${room.id}')">Edit</button>
                            <button class="btn btn-danger btn-sm" onclick="deleteOTRoom('${room.id}', '${room.roomNumber}')">Delete</button>
                        </div>
                    </div>
                </div>
            `).join('');
        }

        function getStatusColor(status) {
            switch(status) {
                case 'available': return 'rgba(39, 174, 96, 0.1); color: #27ae60';
                case 'occupied': return 'rgba(231, 76, 60, 0.1); color: #e74c3c';
                case 'maintenance': return 'rgba(255, 193, 7, 0.1); color: #b45309';
                case 'cleaning': return 'rgba(52, 152, 219, 0.1); color: #2980b9';
                default: return 'rgba(149, 165, 166, 0.1); color: #7f8c8d';
            }
        }

        function openOTRoomModal() {
            document.getElementById('otRoomForm').reset();
            document.getElementById('otRoomModal').style.display = 'block';
        }

        function closeOTRoomModal() {
            document.getElementById('otRoomModal').style.display = 'none';
        }

        async function handleOTRoomSubmit(e) {
            e.preventDefault();
            
            try {
                const roomData = {
                    roomNumber: document.getElementById('otRoomNumber').value.trim(),
                    type: document.getElementById('otRoomType').value,
                    status: document.getElementById('otRoomStatus').value,
                    equipment: document.getElementById('otRoomEquipment').value.trim(),
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                
                await db.collection('ot_rooms').add(roomData);
                
                await logAdminAction('OT Room Added', `Added new OT room: ${roomData.roomNumber}`);
                showMessage('success', 'OT Room added successfully!');
                
                closeOTRoomModal();
                await loadOTRooms();
                
            } catch (error) {
                console.error('Error saving OT room:', error);
                showMessage('error', 'Error saving OT room. Please try again.');
            }
        }

        async function deleteOTRoom(roomId, roomNumber) {
            if (!confirm(`Are you sure you want to delete OT Room ${roomNumber}? This action cannot be undone.`)) {
                return;
            }
            
            try {
                await db.collection('ot_rooms').doc(roomId).delete();
                await logAdminAction('OT Room Deleted', `Deleted OT room: ${roomNumber}`);
                showMessage('success', 'OT Room deleted successfully!');
                await loadOTRooms();
                
            } catch (error) {
                console.error('Error deleting OT room:', error);
                showMessage('error', 'Error deleting OT room');
            }
        }

        function openOTScheduleModal() {
            populateScheduleSelects();
            document.getElementById('otScheduleForm').reset();
            // Set default date to today
            document.getElementById('scheduleDate').value = new Date().toISOString().split('T')[0];
            document.getElementById('otScheduleModal').style.display = 'block';
        }

        function closeOTScheduleModal() {
            document.getElementById('otScheduleModal').style.display = 'none';
        }

        function populateScheduleSelects() {
            // Populate OT Rooms
            const otRoomSelect = document.getElementById('scheduleOTRoom');
            otRoomSelect.innerHTML = '<option value="">Select OT Room</option>';
            allOTRooms.filter(room => room.status === 'available').forEach(room => {
                otRoomSelect.innerHTML += `<option value="${room.id}">OT Room ${room.roomNumber} (${capitalizeFirst(room.type)})</option>`;
            });
            
            // Populate Patients
            const patientSelect = document.getElementById('schedulePatient');
            patientSelect.innerHTML = '<option value="">Select Patient</option>';
            allPatients.forEach(patient => {
                patientSelect.innerHTML += `<option value="${patient.id}">${patient.name} (${patient.age}y, ${capitalizeFirst(patient.gender)})</option>`;
            });
            
            // Populate Surgeons (from doctors)
            const surgeonSelect = document.getElementById('scheduleSurgeon');
            surgeonSelect.innerHTML = '<option value="">Select Surgeon</option>';
            allDoctors.forEach(doctor => {
                surgeonSelect.innerHTML += `<option value="${doctor.id}">${doctor.name} (${capitalizeFirst(doctor.specialization)})</option>`;
            });
        }

        function populateOTRoomSelects() {
            // This is called when OT rooms are loaded to update any selects
            populateScheduleSelects();
        }

        async function handleOTScheduleSubmit(e) {
            e.preventDefault();
            
            try {
                const scheduleData = {
                    otRoomId: document.getElementById('scheduleOTRoom').value,
                    patientId: document.getElementById('schedulePatient').value,
                    surgeonId: document.getElementById('scheduleSurgeon').value,
                    date: document.getElementById('scheduleDate').value,
                    startTime: document.getElementById('scheduleStartTime').value,
                    endTime: document.getElementById('scheduleEndTime').value,
                    procedure: document.getElementById('scheduleProcedure').value.trim(),
                    notes: document.getElementById('scheduleNotes').value.trim(),
                    status: 'scheduled',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                
                // Check for conflicts
                const isConflict = await checkOTConflict(scheduleData.otRoomId, scheduleData.date, scheduleData.startTime, scheduleData.endTime);
                if (isConflict) {
                    showMessage('error', 'Time conflict detected! The selected OT room is already booked for this time.');
                    return;
                }
                
                await db.collection('ot_schedules').add(scheduleData);
                
                await logAdminAction('Operation Scheduled', `Scheduled operation: ${scheduleData.procedure}`);
                showMessage('success', 'Operation scheduled successfully!');
                
                closeOTScheduleModal();
                await loadOTSchedule();
                
            } catch (error) {
                console.error('Error scheduling operation:', error);
                showMessage('error', 'Error scheduling operation. Please try again.');
            }
        }

        async function checkOTConflict(roomId, date, startTime, endTime) {
            try {
                const snapshot = await db.collection('ot_schedules')
                    .where('otRoomId', '==', roomId)
                    .where('date', '==', date)
                    .get();
                
                const existingSchedules = snapshot.docs.map(doc => doc.data());
                
                return existingSchedules.some(schedule => {
                    return (startTime < schedule.endTime && endTime > schedule.startTime);
                });
                
            } catch (error) {
                console.error('Error checking OT conflict:', error);
                return false;
            }
        }

        async function loadOTSchedule() {
            const selectedDate = document.getElementById('otScheduleDate').value || new Date().toISOString().split('T')[0];
            
            try {
                const snapshot = await db.collection('ot_schedules')
                    .where('date', '==', selectedDate)
                    .orderBy('startTime')
                    .get();
                
                allOTSchedules = [];
                snapshot.forEach(doc => {
                    allOTSchedules.push({ id: doc.id, ...doc.data() });
                });
                
                await displayOTSchedule();
                
            } catch (error) {
                console.error('Error loading OT schedule:', error);
                showMessage('error', 'Error loading OT schedule');
            }
        }

        async function displayOTSchedule() {
            const container = document.getElementById('otScheduleContainer');
            
            if (allOTSchedules.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 3rem; color: var(--text-secondary);">
                        <h3>No operations scheduled for this date</h3>
                        <p>Click "Schedule Operation" to add a new operation</p>
                    </div>
                `;
                return;
            }
            
            let scheduleHTML = '<div class="schedule-table" style="overflow-x: auto;"><table class="data-table"><thead><tr><th>Time</th><th>OT Room</th><th>Patient</th><th>Surgeon</th><th>Procedure</th><th>Status</th><th>Actions</th></tr></thead><tbody>';
            
            for (const schedule of allOTSchedules) {
                const room = allOTRooms.find(r => r.id === schedule.otRoomId);
                const patient = allPatients.find(p => p.id === schedule.patientId);
                const surgeon = allDoctors.find(d => d.id === schedule.surgeonId);
                
                scheduleHTML += `
                    <tr>
                        <td>${schedule.startTime} - ${schedule.endTime}</td>
                        <td>OT ${room ? room.roomNumber : 'Unknown'}</td>
                        <td>${patient ? patient.name : 'Unknown Patient'}</td>
                        <td>${surgeon ? surgeon.name : 'Unknown Surgeon'}</td>
                        <td>${schedule.procedure}</td>
                        <td>
                            <span style="padding: 0.25rem 0.75rem; border-radius: 15px; font-size: 0.8rem; background: ${getScheduleStatusColor(schedule.status)};">
                                ${capitalizeFirst(schedule.status)}
                            </span>
                        </td>
                        <td>
                            <button class="btn btn-warning btn-sm" onclick="updateOTStatus('${schedule.id}')">Update</button>
                            <button class="btn btn-danger btn-sm" onclick="cancelOperation('${schedule.id}')">Cancel</button>
                        </td>
                    </tr>
                `;
            }
            
            scheduleHTML += '</tbody></table></div>';
            container.innerHTML = scheduleHTML;
        }

        function getScheduleStatusColor(status) {
            switch(status) {
                case 'scheduled': return 'rgba(52, 152, 219, 0.1); color: #2980b9';
                case 'in-progress': return 'rgba(255, 193, 7, 0.1); color: #b45309';
                case 'completed': return 'rgba(39, 174, 96, 0.1); color: #27ae60';
                case 'cancelled': return 'rgba(231, 76, 60, 0.1); color: #e74c3c';
                default: return 'rgba(149, 165, 166, 0.1); color: #7f8c8d';
            }
        }

        function changeOTDate(days) {
            const currentDate = new Date(document.getElementById('otScheduleDate').value || new Date());
            currentDate.setDate(currentDate.getDate() + days);
            document.getElementById('otScheduleDate').value = currentDate.toISOString().split('T')[0];
            loadOTSchedule();
        }

        async function updateOTStatus(scheduleId) {
            const newStatus = prompt('Update status to:\n1. scheduled\n2. in-progress\n3. completed\n4. cancelled\n\nEnter status:');
            
            if (newStatus && ['scheduled', 'in-progress', 'completed', 'cancelled'].includes(newStatus)) {
                try {
                    await db.collection('ot_schedules').doc(scheduleId).update({
                        status: newStatus,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    
                    showMessage('success', 'Operation status updated successfully!');
                    await loadOTSchedule();
                    
                } catch (error) {
                    console.error('Error updating operation status:', error);
                    showMessage('error', 'Error updating status');
                }
            }
        }

        async function cancelOperation(scheduleId) {
            if (!confirm('Are you sure you want to cancel this operation?')) {
                return;
            }
            
            try {
                await db.collection('ot_schedules').doc(scheduleId).update({
                    status: 'cancelled',
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                await logAdminAction('Operation Cancelled', 'Cancelled scheduled operation');
                showMessage('success', 'Operation cancelled successfully!');
                await loadOTSchedule();
                
            } catch (error) {
                console.error('Error cancelling operation:', error);
                showMessage('error', 'Error cancelling operation');
            }
        }

        async function handlePatientSubmit(e) {
            e.preventDefault();
            
            // Check if user is authenticated
            if (!currentUser) {
                showMessage('error', 'User not authenticated. Please log in first.');
                return;
            }
            
            console.log('Current user:', currentUser.uid); // Debug log
            
            const submitBtn = document.getElementById('patientSubmitText');
            const spinner = document.getElementById('patientSubmitSpinner');
            
            submitBtn.style.display = 'none';
            spinner.style.display = 'inline-block';
            
            try {
                const patientData = {
                    name: document.getElementById('patientName').value.trim(),
                    age: parseInt(document.getElementById('patientAge').value),
                    gender: document.getElementById('patientGender').value,
                    phone: document.getElementById('patientPhone').value.trim(),
                    email: document.getElementById('patientEmail').value.trim(),
                    bloodGroup: document.getElementById('patientBloodGroup').value,
                    emergencyContact: document.getElementById('emergencyContact').value.trim(),
                    status: document.getElementById('patientStatus').value || 'outpatient',
                    address: document.getElementById('patientAddress').value.trim(),
                    medicalHistory: document.getElementById('medicalHistory').value.trim(),
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                
                console.log('Saving patient data:', patientData); // Debug log
                
                const docRef = await db.collection('patients').add(patientData);
                console.log('Patient saved with ID:', docRef.id); // Debug log
                
                await logAdminAction('Patient Added', `Added new patient: ${patientData.name}`);
                showMessage('success', 'Patient added successfully!');
                
                closePatientModal();
                await loadPatients();
                
            } catch (error) {
                console.error('Error saving patient:', error);
                showMessage('error', 'Error saving patient: ' + error.message);
            } finally {
                submitBtn.style.display = 'inline';
                spinner.style.display = 'none';
            }
        }

        // Initialize OT schedule date to today (NEW ADDITION)
        document.addEventListener('DOMContentLoaded', function() {
            const today = new Date().toISOString().split('T')[0];
            const otDateInput = document.getElementById('otScheduleDate');
            if (otDateInput) {
                otDateInput.value = today;
            }

            // Add event listeners for new forms
            const patientForm = document.getElementById('patientForm');
            const otRoomForm = document.getElementById('otRoomForm');
            const otScheduleForm = document.getElementById('otScheduleForm');
            
            if (patientForm) {
                patientForm.addEventListener('submit', handlePatientSubmit);
            }
            
            if (otRoomForm) {
                otRoomForm.addEventListener('submit', handleOTRoomSubmit);
            }
            
            if (otScheduleForm) {
                otScheduleForm.addEventListener('submit', handleOTScheduleSubmit);
            }
        });

        // Global variables for advanced scheduling
window.allAnesthesiologists = window.allAnesthesiologists || [];
window.allNurses = window.allNurses || [];
window.surgeryTypes = [
    'cardiac', 'orthopedic', 'neurosurgery', 'general', 
    'gynecological', 'ophthalmology', 'emergency', 'elective'
];

// Load anesthesiologists and nurses data
async function loadStaffData() {
    try {
        // Load anesthesiologists
        const anesthSnapshot = await db.collection('anesthesiologists').get();
        window.allAnesthesiologists = [];
        anesthSnapshot.forEach(doc => {
            window.allAnesthesiologists.push({ id: doc.id, ...doc.data() });
        });

        // Load nurses
        const nursesSnapshot = await db.collection('nurses').get();
        window.allNurses = [];
        nursesSnapshot.forEach(doc => {
            window.allNurses.push({ id: doc.id, ...doc.data() });
        });

        console.log('✅ Staff data loaded:', {
            anesthesiologists: window.allAnesthesiologists.length,
            nurses: window.allNurses.length
        });

    } catch (error) {
        console.error('Error loading staff data:', error);
    }
}

// Enhanced schedule form population
function populateScheduleSelects() {
    // Populate OT Rooms
    const otRoomSelect = document.getElementById('scheduleOTRoom');
    if (otRoomSelect) {
        otRoomSelect.innerHTML = '<option value="">Select OT Room</option>';
        (window.allOTRooms || []).filter(room => room.status === 'available').forEach(room => {
            otRoomSelect.innerHTML += `<option value="${room.id}">OT Room ${room.roomNumber} (${capitalizeFirst(room.type)})</option>`;
        });
    }
    
    // Populate Patients
    const patientSelect = document.getElementById('schedulePatient');
    if (patientSelect) {
        patientSelect.innerHTML = '<option value="">Select Patient</option>';
        (window.allPatients || []).forEach(patient => {
            patientSelect.innerHTML += `<option value="${patient.id}">${patient.name} (${patient.age}y, ${capitalizeFirst(patient.gender)})</option>`;
        });
    }
    
    // Populate Surgeons
    const surgeonSelect = document.getElementById('scheduleSurgeon');
    const assistantSelect = document.getElementById('assistantSurgeon');
    if (surgeonSelect) {
        surgeonSelect.innerHTML = '<option value="">Select Surgeon</option>';
        assistantSelect.innerHTML = '<option value="">Select Assistant Surgeon</option>';
        allDoctors.forEach(doctor => {
            const option = `<option value="${doctor.id}">${doctor.name} (${capitalizeFirst(doctor.specialization)})</option>`;
            surgeonSelect.innerHTML += option;
            assistantSelect.innerHTML += option;
        });
    }

    // Populate Anesthesiologists
    const anesthSelect = document.getElementById('anesthesiologist');
    if (anesthSelect) {
        anesthSelect.innerHTML = '<option value="">Select Anesthesiologist</option>';
        window.allAnesthesiologists.forEach(anesth => {
            anesthSelect.innerHTML += `<option value="${anesth.id}">${anesth.name} (${anesth.specialization || 'Anesthesiologist'})</option>`;
        });
    }

    // Populate Nurses
    const scrubSelect = document.getElementById('scrubNurse');
    const circSelect = document.getElementById('circulatingNurse');
    const additionalSelect = document.getElementById('additionalNurses');
    
    if (scrubSelect) {
        scrubSelect.innerHTML = '<option value="">Select Scrub Nurse</option>';
        circSelect.innerHTML = '<option value="">Select Circulating Nurse</option>';
        additionalSelect.innerHTML = '<option value="">Select Additional Nurses</option>';
        
        window.allNurses.forEach(nurse => {
            const option = `<option value="${nurse.id}">${nurse.name} (${nurse.department || 'OR Nurse'})</option>`;
            scrubSelect.innerHTML += option;
            circSelect.innerHTML += option;
            additionalSelect.innerHTML += option;
        });
    }
}

// Enhanced conflict detection
async function detectScheduleConflicts(newSchedule) {
    try {
        const conflicts = [];
        
        // Check room conflicts
        const roomSnapshot = await db.collection('ot_schedules')
            .where('otRoomId', '==', newSchedule.otRoomId)
            .where('date', '==', newSchedule.date)
            .get();

        roomSnapshot.forEach(doc => {
            const schedule = doc.data();
            if (newSchedule.startTime < schedule.endTime && newSchedule.endTime > schedule.startTime) {
                conflicts.push({
                    type: 'room',
                    message: `OT Room conflict with existing surgery from ${schedule.startTime} to ${schedule.endTime}`,
                    scheduleId: doc.id
                });
            }
        });

        // Check surgeon conflicts
        const surgeonSnapshot = await db.collection('ot_schedules')
            .where('surgeonId', '==', newSchedule.surgeonId)
            .where('date', '==', newSchedule.date)
            .get();

        surgeonSnapshot.forEach(doc => {
            const schedule = doc.data();
            if (newSchedule.startTime < schedule.endTime && newSchedule.endTime > schedule.startTime) {
                conflicts.push({
                    type: 'surgeon',
                    message: `Surgeon conflict with existing surgery from ${schedule.startTime} to ${schedule.endTime}`,
                    scheduleId: doc.id
                });
            }
        });

        // Check anesthesiologist conflicts
        if (newSchedule.anesthesiologist && newSchedule.anesthesiologist.id) {
            const anesthSnapshot = await db.collection('ot_schedules')
                .where('anesthesiologist.id', '==', newSchedule.anesthesiologist.id)
                .where('date', '==', newSchedule.date)
                .get();

            anesthSnapshot.forEach(doc => {
                const schedule = doc.data();
                if (newSchedule.startTime < schedule.endTime && newSchedule.endTime > schedule.startTime) {
                    conflicts.push({
                        type: 'anesthesiologist',
                        message: `Anesthesiologist conflict with existing surgery from ${schedule.startTime} to ${schedule.endTime}`,
                        scheduleId: doc.id
                    });
                }
            });
        }

        return conflicts;

    } catch (error) {
        console.error('Error detecting conflicts:', error);
        return [];
    }
}

// Enhanced OT schedule submission
async function handleOTScheduleSubmit(e) {
    e.preventDefault();
    
    const submitBtn = document.getElementById('scheduleSubmitText');
    const spinner = document.getElementById('scheduleSubmitSpinner');
    
    submitBtn.style.display = 'none';
    spinner.style.display = 'inline-block';
    
    try {
        // Collect form data
        const scheduleData = {
            otRoomId: document.getElementById('scheduleOTRoom').value,
            patientId: document.getElementById('schedulePatient').value,
            surgeonId: document.getElementById('scheduleSurgeon').value,
            assistantSurgeonId: document.getElementById('assistantSurgeon').value,
            date: document.getElementById('scheduleDate').value,
            startTime: document.getElementById('scheduleStartTime').value,
            endTime: document.getElementById('scheduleEndTime').value,
            procedure: document.getElementById('scheduleProcedure').value.trim(),
            surgeryType: document.getElementById('surgeryType').value,
            priority: document.getElementById('surgeryPriority').value,
            notes: document.getElementById('scheduleNotes').value.trim(),
            
            // Anesthesia team
            anesthesiologist: {
                id: document.getElementById('anesthesiologist').value,
                name: document.getElementById('anesthesiologist').selectedOptions[0]?.text || '',
                type: document.getElementById('anesthesiaType').value
            },
            
            // Nursing team
            nurses: [
                {
                    id: document.getElementById('scrubNurse').value,
                    name: document.getElementById('scrubNurse').selectedOptions[0]?.text || '',
                    role: 'scrub'
                },
                {
                    id: document.getElementById('circulatingNurse').value,
                    name: document.getElementById('circulatingNurse').selectedOptions[0]?.text || '',
                    role: 'circulating'
                }
            ],
            
            // Pre-operative events
            preOpEvents: [
                { event: 'Patient Consent', status: document.getElementById('preOpConsent').checked ? 'completed' : 'pending', timestamp: null },
                { event: 'Patient Preparation', status: document.getElementById('preOpPrep').checked ? 'completed' : 'pending', timestamp: null },
                { event: 'Anesthesia Consultation', status: document.getElementById('preOpAnesthesia').checked ? 'completed' : 'pending', timestamp: null },
                { event: 'Lab Results Review', status: document.getElementById('preOpLabs').checked ? 'completed' : 'pending', timestamp: null }
            ],
            
            // Post-operative events
            postOpEvents: [
                { event: 'Recovery Room Transfer', status: 'pending', timestamp: null },
                { event: 'Post-Op Monitoring', status: 'pending', timestamp: null },
                { event: 'Surgical Report', status: 'pending', timestamp: null },
                { event: 'Discharge Planning', status: 'pending', timestamp: null }
            ],
            
            status: 'scheduled',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // Validate required fields
        if (!scheduleData.otRoomId || !scheduleData.patientId || !scheduleData.surgeonId || 
            !scheduleData.procedure || !scheduleData.surgeryType || !scheduleData.anesthesiologist.id) {
            throw new Error('Please fill in all required fields');
        }
        
        // Check for conflicts
        const conflicts = await detectScheduleConflicts(scheduleData);
        if (conflicts.length > 0) {
            const conflictMessages = conflicts.map(c => c.message).join('\n');
            throw new Error(`Schedule conflicts detected:\n${conflictMessages}`);
        }
        
        // Save to database
        await db.collection('ot_schedules').add(scheduleData);
        
        await logAdminAction('Advanced Operation Scheduled', `Scheduled ${scheduleData.surgeryType} operation: ${scheduleData.procedure}`);
        showMessage('success', 'Operation scheduled successfully with full team assignment!');
        
        closeOTScheduleModal();
        await loadOTSchedule();
        
    } catch (error) {
        console.error('Error scheduling operation:', error);
        showMessage('error', error.message);
    } finally {
        submitBtn.style.display = 'inline';
        spinner.style.display = 'none';
    }
}

// Functions to manage pre/post-operative events
async function updatePreOpEvent(scheduleId, eventIndex, status) {
    try {
        const doc = await db.collection('ot_schedules').doc(scheduleId).get();
        if (!doc.exists) throw new Error('Schedule not found');
        
        const schedule = doc.data();
        const preOpEvents = schedule.preOpEvents || [];
        preOpEvents[eventIndex].status = status;
        preOpEvents[eventIndex].timestamp = status === 'completed' ? new Date() : null;
        
        await db.collection('ot_schedules').doc(scheduleId).update({ preOpEvents });
        await logAdminAction('Pre-Op Event Updated', `Updated event: ${preOpEvents[eventIndex].event} to ${status}`);
        
        showMessage('success', 'Pre-operative event updated!');
        
    } catch (error) {
        console.error('Error updating pre-op event:', error);
        showMessage('error', 'Error updating pre-operative event');
    }
}

async function updatePostOpEvent(scheduleId, eventIndex, status) {
    try {
        const doc = await db.collection('ot_schedules').doc(scheduleId).get();
        if (!doc.exists) throw new Error('Schedule not found');
        
        const schedule = doc.data();
        const postOpEvents = schedule.postOpEvents || [];
        postOpEvents[eventIndex].status = status;
        postOpEvents[eventIndex].timestamp = status === 'completed' ? new Date() : null;
        
        await db.collection('ot_schedules').doc(scheduleId).update({ postOpEvents });
        await logAdminAction('Post-Op Event Updated', `Updated event: ${postOpEvents[eventIndex].event} to ${status}`);
        
        showMessage('success', 'Post-operative event updated!');
        
    } catch (error) {
        console.error('Error updating post-op event:', error);
        showMessage('error', 'Error updating post-operative event');
    }
}

// Initialize staff data when opening schedule modal
function openOTScheduleModal() {
    populateScheduleSelects();
    loadStaffData(); // Load anesthesiologists and nurses
    document.getElementById('otScheduleForm').reset();
    // Set default date to today
    document.getElementById('scheduleDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('otScheduleModal').style.display = 'block';
}

// Surgery type management
function getSurgeryTypeInfo(type) {
    const surgeryTypes = {
        'cardiac': { color: '#e74c3c', duration: 180, equipment: ['Heart-lung machine', 'ECG monitor'] },
        'orthopedic': { color: '#3498db', duration: 120, equipment: ['X-ray machine', 'Orthopedic tools'] },
        'neurosurgery': { color: '#9b59b6', duration: 240, equipment: ['Microscope', 'Neuro monitoring'] },
        'general': { color: '#2ecc71', duration: 90, equipment: ['Basic surgical tools'] },
        'gynecological': { color: '#f39c12', duration: 100, equipment: ['Gynecology tools'] },
        'ophthalmology': { color: '#1abc9c', duration: 60, equipment: ['Ophthalmic microscope'] },
        'emergency': { color: '#e67e22', duration: 120, equipment: ['Emergency tools'] },
        'elective': { color: '#95a5a6', duration: 90, equipment: ['Standard tools'] }
    };
    
    return surgeryTypes[type] || surgeryTypes['general'];
}

function openOTScheduleModal() {
    document.getElementById("otScheduleModal").style.display = "block";
}

function closeOTScheduleModal() {
    document.getElementById("otScheduleModal").style.display = "none";
}

// Example form handling (later will connect to Firebase)
document.getElementById("otScheduleForm").addEventListener("submit", function(e) {
    e.preventDefault();
    
    // Collect form data
    const data = {
        date: document.getElementById("surgeryDate").value,
        otRoom: document.getElementById("otRoom").value,
        anesthesia: document.getElementById("anesthesia").value,
        anesthesiologist: document.getElementById("anesthesiologist").value,
        surgeon: document.getElementById("surgeon").value,
        assistants: document.getElementById("assistants").value,
        nurses: document.getElementById("nurses").value,
        prePost: document.getElementById("prePost").value,
        surgicalReports: document.getElementById("surgicalReports").files.length,
        remarks: document.getElementById("remarks").value,
        resources: document.getElementById("resources").value,
    };

    console.log("New OT Schedule:", data);

    alert("OT Schedule saved (to be connected with Firebase)");
    closeOTScheduleModal();
});


// Doctor Modal
function openDoctorModal() { document.getElementById("doctorModal").style.display = "block"; }
function closeDoctorModal() { document.getElementById("doctorModal").style.display = "none"; }
document.getElementById("doctorForm").addEventListener("submit", e => {
  e.preventDefault();
  console.log("Doctor Saved:", {
    name: doctorName.value, specialization: specialization.value,
    phone: doctorPhone.value, email: doctorEmail.value, status: doctorStatus.value
  });
  alert("Doctor saved (connect to Firebase later)");
  closeDoctorModal();
});

// Patient Modal
function openPatientModal() { document.getElementById("patientModal").style.display = "block"; }
function closePatientModal() { document.getElementById("patientModal").style.display = "none"; }
document.getElementById("patientForm").addEventListener("submit", e => {
  e.preventDefault();
  console.log("Patient Saved:", {
    name: patientName.value, age: patientAge.value, gender: patientGender.value,
    phone: patientPhone.value, email: patientEmail.value, blood: patientBloodGroup.value
  });
  alert("Patient saved (connect to Firebase later)");
  closePatientModal();
});

// OT Room Modal
function openOTRoomModal() { document.getElementById("otRoomModal").style.display = "block"; }
function closeOTRoomModal() { document.getElementById("otRoomModal").style.display = "none"; }
document.getElementById("otRoomForm").addEventListener("submit", e => {
  e.preventDefault();
  console.log("OT Room Saved:", {
    roomId: roomId.value, type: roomType.value, capacity: capacity.value
  });
  alert("OT Room saved (connect to Firebase later)");
  closeOTRoomModal();
});

function logAction(action, details) {
  db.collection("logs").add({
    user: auth.currentUser ? auth.currentUser.email : "unknown",
    action: action,
    details: details,
    timestamp: new Date().toISOString()
  });
}

function logAction(action, details) {
  db.collection("logs").add({
    user: auth.currentUser ? auth.currentUser.email : "unknown",
    action: action,
    details: details,
    timestamp: new Date().toISOString()
  }).catch(err => console.error("Log failed:", err));
}

function logAction(action, details) {
  db.collection("logs").add({
    user: auth.currentUser ? auth.currentUser.email : "unknown",
    action: action,
    details: details,
    timestamp: new Date().toISOString()
  }).catch(err => console.error("Log failed:", err));
}
