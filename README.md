# Hospital Operation Scheduler 🏥

A comprehensive, role-based operation theater scheduling and hospital management system. Built with vanilla web technologies and Firebase, it seamlessly handles everything from patient appointment booking and doctor assignments to secure Razorpay payment processing and real-time dashboard analytics.

## Features

* Role-Based Authentication
* Doctor Management
* Patient Management
* Appointment Booking
* Conflict Detection
* Operation Theater Scheduling
* Real-Time Firestore Updates
* Razorpay Payment Integration
* Secure Payment Verification
* PDF Receipt Generation
* Responsive Mobile Design
* Admin Analytics & Management

## Tech Stack

**Frontend:**
* HTML
* CSS
* JavaScript

**Backend:**
* Firebase Authentication
* Firestore
* Cloud Functions

**Payments:**
* Razorpay

**Deployment:**
* Firebase Hosting / Netlify

## System Architecture

```text
Patient / Admin / Doctor
           ↓
       Frontend
           ↓
     Firebase Auth
           ↓
       Firestore
           ↓
    Cloud Functions
           ↓
       Razorpay
```

## Key Highlights

* Real-time appointment management
* Conflict-free scheduling
* Secure server-side payment verification
* Firestore security rules
* Responsive design
* Multi-role dashboard architecture

## Payment Workflow

Appointment Booking → Razorpay Order Creation → Razorpay Checkout → Cloud Function Verification → Firestore Update → PDF Receipt

> **Note:** Currently configured in Razorpay Test Mode. Moving to Live Mode only requires replacing Razorpay Key ID and Key Secret in Firebase Secret Manager. No code changes are required.

## Screenshots

### Admin Dashboard
![Admin Dashboard](#)

### Doctor Dashboard
![Doctor Dashboard](#)

### Patient Dashboard
![Patient Dashboard](#)

### Appointment Booking
![Appointment Booking](#)

### Payment Gateway
![Payment Gateway](#)

### Receipt Generation
![Receipt Generation](#)

## Future Improvements

* Full EHR (Electronic Health Record) Integration
* Automated SMS/Email reminders for upcoming appointments
* Comprehensive Ward and Bed Management System
* Telemedicine video-conferencing capabilities

## Author

**Name**
[GitHub](https://github.com/)
[LinkedIn](https://linkedin.com/in/)