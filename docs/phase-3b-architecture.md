# Phase 3B Architecture

## Objective

Integrate Razorpay payment flow into the existing appointment booking system.

## Flow

Patient
→ Book Appointment

Book Appointment
→ Create Razorpay Order

Create Razorpay Order
→ Razorpay Checkout

Razorpay Checkout
→ Payment Success

Payment Success
→ Verify Signature

Verify Signature
→ Create Payment Record

Create Payment Record
→ Confirm Appointment

Confirm Appointment
→ Visible to Doctor

Confirm Appointment
→ Visible to Admin

## Planned Collections

appointments

payments

## Planned Cloud Functions

createRazorpayOrder

verifyRazorpayPayment

## Security Goals

* Secret key never exposed to frontend
* Signature verified on backend
* Appointment only confirmed after successful verification
* Failed payments never create confirmed appointments
