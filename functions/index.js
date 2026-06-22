const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const admin = require("firebase-admin");
const Razorpay = require("razorpay");

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

// Define required secrets
const razorpayKeyId = defineSecret("RAZORPAY_KEY_ID");
const razorpayKeySecret = defineSecret("RAZORPAY_KEY_SECRET");

/**
 * createRazorpayOrder
 *
 * Securely creates a Razorpay Order for a pending appointment.
 * This function validates the user, verifies appointment ownership,
 * ensures the appointment is in a valid state, and securely generates
 * the order without exposing API secrets to the frontend.
 */
exports.createRazorpayOrder = onCall({
  secrets: [razorpayKeyId, razorpayKeySecret],
  // Disable AppCheck enforcement for dev environment if needed
  enforceAppCheck: false,
}, async (request) => {
  // 1. Validate Authentication
  if (!request.auth) {
    throw new HttpsError(
        "unauthenticated",
        "You must be logged in to create a payment order.",
    );
  }

  const uid = request.auth.uid;
  const {appointmentId} = request.data;

  if (!appointmentId) {
    throw new HttpsError(
        "invalid-argument",
        "The function must be called with an 'appointmentId'.",
    );
  }

  try {
    // 2. Fetch Appointment Document
    const apptRef = admin.firestore().collection("appointments")
        .doc(appointmentId);
    const apptDoc = await apptRef.get();

    // 3. Verify appointment exists
    if (!apptDoc.exists) {
      throw new HttpsError(
          "not-found",
          "The specified appointment could not be found.",
      );
    }

    const appointment = apptDoc.data();

    // 4. Verify appointment belongs to current patient
    if (appointment.patientId !== uid) {
      throw new HttpsError(
          "permission-denied",
          "You do not have permission to access this appointment.",
      );
    }

    // 5. Verify appointment state (future-proof validation)
    const status = appointment.status;
    if (status !== "pending" && status !== "pending_payment") {
      throw new HttpsError(
          "failed-precondition",
          `Payment cannot be initiated. Appointment is currently ${status}.`,
      );
    }

    // 6. Generate Razorpay Order
    const rzp = new Razorpay({
      key_id: razorpayKeyId.value(),
      key_secret: razorpayKeySecret.value(),
    });

    // Convert ₹500 to paise (50000)
    const amountInPaise = 500 * 100;

    const options = {
      amount: amountInPaise,
      currency: "INR",
      receipt: `appt_${appointmentId}`,
    };

    const order = await rzp.orders.create(options);

    // 7. Return securely formatted response
    return {
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      appointmentId: appointmentId,
    };
  } catch (error) {
    console.error("Error creating Razorpay order:", error);

    // Pass through structured HttpsErrors
    if (error instanceof HttpsError) {
      throw error;
    }

    // Mask raw internal errors from the client
    throw new HttpsError(
        "internal",
        "An error occurred while creating the payment order.",
    );
  }
});


