import crypto from "crypto";
import dotenv from "dotenv";
import { updateWalletBalance } from "../services/walletService.js";

dotenv.config();

/**
 * Handles incoming Flutterwave webhook events
 * Verifies Flutterwave signature before trusting the payload.
 */
export const handleFlutterwaveWebhook = async (req, res) => {
  try {
    const secretHash = process.env.FLUTTERWAVE_SECRET_HASH; // must be set in .env
    const signature = req.headers["verif-hash"];

    if (!signature || signature !== secretHash) {
      console.log("❌ Invalid webhook signature");
      return res.status(401).json({ status: "error", message: "Invalid signature" });
    }

    const event = req.body;
    console.log("✅ Flutterwave Webhook Received:", event);

    if (event.event === "charge.completed" && event.data.status === "successful") {
      const { amount, currency, customer, tx_ref, flw_ref } = event.data;

      // Extract relevant details
      const email = customer.email;
      const phone = customer.phone_number;
      const fullname = customer.name || `${customer.first_name} ${customer.last_name}`;
      const reference = tx_ref || flw_ref;

      // Update the user's wallet balance (receiver)
      await updateWalletBalance(email, amount, currency);

      console.log(`💰 Wallet updated for ${fullname} (${email}) → +${amount} ${currency}`);

      // Send acknowledgment to Flutterwave
      return res.status(200).json({ status: "success" });
    }

    // Handle other events if necessary
    console.log("⚙️ Unhandled event type:", event.event);
    return res.status(200).json({ status: "received" });
  } catch (error) {
    console.error("❌ Webhook error:", error);
    return res.status(500).json({ status: "error", message: "Server error" });
  }
};
