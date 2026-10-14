import * as functions from "firebase-functions/v2";
import * as logger from "firebase-functions/logger";
import axios from "axios";
import corsLib from "cors";
import * as admin from "firebase-admin";
import { onRequest } from "firebase-functions/https";
import nodemailer from "nodemailer";

const cors = corsLib({
  origin: [
    "http://localhost:4200",
    "https://localhost",
    "capacitor://localhost",
    "https://apt3m.com"
  ],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
});

admin.initializeApp();

const BASE = "https://2factor.in/API/V1";
const TEMPLATE = "LoginOTPTemplate"; 
const SENDER   = "APTMMM"; 

let cachedApiKey: string | null = null;
async function getApiKey(): Promise<string> {
  if (cachedApiKey) return cachedApiKey;
  const snap = await admin.firestore().doc("appConfig/otpConfig").get();
  if (!snap.exists) throw new Error("appConfig/otpConfig doc not found");
  const v = snap.get("apiKey");
  if (!v) throw new Error("apiKey missing in appConfig/otpConfig");
  cachedApiKey = String(v);
  return cachedApiKey;
}

function toE164(phone: string) {
  const digits = (phone || "").replace(/\D/g, "");
  return digits.startsWith("91") && digits.length === 12 ? `+${digits}` : `+91${digits}`;
}

// POST { phone }

export const sendOtp = onRequest(
  { region: "us-central1" },
  (req, res) => {
    cors(req, res, async () => {
      try {
        logger.info("sendOtp request received", {
          method: req.method,
          origin: req.headers.origin || "none"
        });

        // Allow POST requests only
        if (req.method !== "POST") {
          res.status(405).send("Method Not Allowed");
          return;
        }

        // Validate phone number
        const { phone } = (req.body ?? {}) as {
          phone?: string;
        };

        if (
          typeof phone !== "string" ||
          !phone.trim()
        ) {
          res.status(400).json({
            error: "phone required"
          });
          return;
        }

        // Get 2Factor credentials
        const apiKey = await getApiKey();
        const to = toE164(phone);

        // Construct 2Factor URL
        const url =
          `${BASE}/${encodeURIComponent(apiKey)}` +
          `/SMS/${encodeURIComponent(to)}` +
          `/AUTOGEN/${encodeURIComponent(TEMPLATE)}` +
          `?From=${encodeURIComponent(SENDER)}`;

        logger.info("sendOtp -> calling 2Factor", {
          toMasked: to.replace(/\d{6}$/, "******")
        });

        // Add timeout for 2Factor API
        const controller = new AbortController();

        const timeout = setTimeout(() => {
          controller.abort();
        }, 20000);

        let r: Response;
        let responseText: string;

        try {
          r = await fetch(url, {
            signal: controller.signal
          });

          responseText = await r.text();
        } finally {
          clearTimeout(timeout);
        }

        // Log provider response
        logger.info("2Factor sendOtp response", {
          status: r.status,
          ok: r.ok
        });

        // Parse provider response
        let data: any;

        try {
          data = JSON.parse(responseText);
        } catch {
          data = { raw: responseText };
        }

        // Handle provider HTTP errors
        if (!r.ok) {
          logger.error("2Factor sendOtp non-200", {
            status: r.status,
            providerStatus: data?.Status || "unknown"
          });

          res.status(502).json({
            error: "OTP provider request failed"
          });
          return;
        }

        // Handle provider-level failure
        if (data?.Status !== "Success") {
          logger.error("2Factor sendOtp rejected", {
            providerStatus: data?.Status || "unknown"
          });

          res.status(502).json({
            error: "OTP provider rejected request"
          });
          return;
        }

        logger.info("sendOtp returning success", {
          status: 200,
          origin: req.headers.origin || "none"
        });

        // Preserve existing response format
        res.status(200).json(data);
        return;

      } catch (err: any) {
        const isTimeout = err?.name === "AbortError";

        logger.error("sendOtp exception", {
          message: err?.message || String(err),
          name: err?.name || "UnknownError"
        });

        res.status(isTimeout ? 504 : 500).json({
          error: isTimeout
            ? "OTP provider timeout"
            : "sendOtp failed"
        });
        return;
      }
    });
  }
);


// POST { sessionId, otp }
// POST { sessionId, otp }


export const verifyOtp = onRequest(
  { region: "us-central1" },
  (req, res) => {
    cors(req, res, async () => {
      try {
        logger.info("verifyOtp request received", {
          method: req.method,
          origin: req.headers.origin || "none",
          contentType: req.headers["content-type"] || "none"
        });

        // Only allow POST
        if (req.method !== "POST") {
          res.status(405).json({
            error: "Method Not Allowed"
          });
          return;
        }

        // Validate request payload
        const { sessionId, otp } = (req.body ?? {}) as {
          sessionId?: unknown;
          otp?: unknown;
        };

        if (
          typeof sessionId !== "string" ||
          !sessionId.trim() ||
          typeof otp !== "string" ||
          !otp.trim()
        ) {
          logger.warn("verifyOtp invalid request payload", {
            hasSessionId:
              typeof sessionId === "string" &&
              sessionId.length > 0,
            hasOtp:
              typeof otp === "string" &&
              otp.length > 0
          });

          res.status(400).json({
            error: "sessionId and otp required"
          });
          return;
        }

        // Retrieve 2Factor API key
        const apiKey = await getApiKey();

        // Construct 2Factor verification URL
        const url =
          `${BASE}/${encodeURIComponent(apiKey)}` +
          `/SMS/VERIFY/${encodeURIComponent(sessionId)}` +
          `/${encodeURIComponent(otp)}`;

        logger.info("verifyOtp -> calling 2Factor");

        // Apply 20-second timeout
        const controller = new AbortController();

        const timeout = setTimeout(() => {
          controller.abort();
        }, 20000);

        let response: Response;
        let responseText: string;

        try {
          response = await fetch(url, {
            method: "GET",
            signal: controller.signal
          });

          responseText = await response.text();
        } finally {
          clearTimeout(timeout);
        }

        logger.info("2Factor verifyOtp response", {
          httpStatus: response.status,
          ok: response.ok
        });

        // Parse 2Factor response
        let data: any;

        try {
          data = JSON.parse(responseText);
        } catch {
          logger.error("2Factor returned invalid JSON");

          res.status(502).json({
            error: "Invalid OTP provider response"
          });
          return;
        }

        // Handle provider HTTP failures
        if (!response.ok) {
          logger.warn("2Factor verification HTTP failure", {
            httpStatus: response.status,
            providerStatus: data?.Status || "unknown"
          });

          // Preserve provider response for Angular
          res.status(400).json(data);
          return;
        }

        // Handle invalid or expired OTP
        if (data?.Status !== "Success") {
          logger.warn("2Factor OTP verification rejected", {
            providerStatus: data?.Status || "unknown"
          });

          // Preserve original provider response
          res.status(400).json(data);
          return;
        }

        // OTP verified successfully
        logger.info("verifyOtp returning success", {
          status: 200,
          origin: req.headers.origin || "none"
        });

        res.status(200).json(data);
        return;

      } catch (err: any) {
        const isTimeout = err?.name === "AbortError";

        logger.error("verifyOtp exception", {
          name: err?.name || "UnknownError",
          message: err?.message || String(err)
        });

        res.status(isTimeout ? 504 : 500).json({
          error: isTimeout
            ? "OTP verification timeout"
            : "verifyOtp failed"
        });
        return;
      }
    });
  }
);



// ==========================================================
// CONTACT FORM EMAIL
// POST { name, email, message }
// ==========================================================


export const sendContactEmail = onRequest(
  {
    region: "us-central1",
    secrets: ["ZOHO_EMAIL", "ZOHO_APP_PASSWORD"]
  },
  (req, res) => {
    cors(req, res, async () => {
      try {
        logger.info("sendContactEmail request received", {
          method: req.method,
          origin: req.headers.origin || "none"
        });

        // Allow POST only
        if (req.method !== "POST") {
          res.status(405).json({
            error: "Method Not Allowed"
          });
          return;
        }

        const { name, email, message } = (req.body ?? {}) as {
          name?: unknown;
          email?: unknown;
          message?: unknown;
        };

        // Validate input types
        if (
          typeof name !== "string" ||
          typeof email !== "string" ||
          typeof message !== "string" ||
          !name.trim() ||
          !email.trim() ||
          !message.trim()
        ) {
          res.status(400).json({
            error: "Name, email and message are required."
          });
          return;
        }

        const cleanName = name.trim();
        const cleanEmail = email.trim();
        const cleanMessage = message.trim();

        // Validate lengths
        if (
          cleanName.length > 100 ||
          cleanEmail.length > 254 ||
          cleanMessage.length > 5000
        ) {
          res.status(400).json({
            error: "One or more fields exceed the allowed length."
          });
          return;
        }

        // Validate email
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailPattern.test(cleanEmail)) {
          res.status(400).json({
            error: "Invalid email address."
          });
          return;
        }

        // Firebase secrets
        const zohoEmail = process.env.ZOHO_EMAIL;
        const zohoPassword = process.env.ZOHO_APP_PASSWORD;

        if (!zohoEmail || !zohoPassword) {
          logger.error("Zoho email secrets are missing");

          res.status(500).json({
            error: "Email configuration missing."
          });
          return;
        }

        // Zoho SMTP configuration
        const transporter = nodemailer.createTransport({
          host: "smtp.zoho.com",
          port: 465,
          secure: true,
          auth: {
            user: zohoEmail,
            pass: zohoPassword
          },
          connectionTimeout: 20000,
          greetingTimeout: 20000,
          socketTimeout: 30000
        });

        // Send contact email
        await transporter.sendMail({
          from: `"Apt3M Website" <${zohoEmail}>`,
          to: "support@apt3m.com",
          replyTo: cleanEmail,
          subject: `New Apt3M Contact Message - ${cleanName.replace(/[\r\n]/g, " ")}`,
          text: `
Name: ${cleanName}
Email: ${cleanEmail}

Message:
${cleanMessage}
          `,
          html: `
            <div style="font-family:Arial,sans-serif">
              <h2>New Apt3M Contact Message</h2>

              <p>
                A new message was submitted from
                the Apt3M website.
              </p>

              <hr>

              <p>
                <strong>Name:</strong>
                ${escapeHtml(cleanName)}
              </p>

              <p>
                <strong>Email:</strong>
                ${escapeHtml(cleanEmail)}
              </p>

              <p><strong>Message:</strong></p>

              <p>
                ${escapeHtml(cleanMessage).replace(/\n/g, "<br>")}
              </p>

              <hr>

              <p style="font-size:12px;color:#777">
                Sent from Apt3M Contact Form
              </p>
            </div>
          `
        });

        logger.info("Contact email sent successfully");

        res.status(200).json({
          success: true,
          message: "Message sent successfully."
        });
        return;

      } catch (error: any) {
        logger.error("sendContactEmail failed", {
          message: error?.message || String(error),
          code: error?.code || "UNKNOWN"
        });

        res.status(500).json({
          success: false,
          error: "Unable to send your message."
        });
        return;
      }
    });
  }
);

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
export const createCashfreeOrder = functions.https.onRequest(
  {
    secrets: ["CASHFREE_CLIENT_ID", "CASHFREE_CLIENT_SECRET"]
  },
  (req, res) => {
    cors(req, res, async () => {
      try {
        const { orderId, orderAmount, customerName, customerEmail, customerPhone } = req.body;
       
        const response = await axios.post(
          "https://sandbox.cashfree.com/pg/orders",
          {
            order_id: orderId,
            order_amount: orderAmount,
            order_currency: "INR",
            customer_details: {
              customer_id: customerPhone,
              customer_name: customerName,
              customer_email: customerEmail,
              customer_phone: customerPhone,
            },
          },
          {
            headers: {
              "Content-Type": "application/json",
              "x-api-version": "2022-09-01",
              "x-client-id":  process.env.CASHFREE_CLIENT_ID,
              "x-client-secret": process.env.CASHFREE_CLIENT_SECRET,
            },
          }
        );

        res.status(200).json(response.data);
      } catch (error: any) {
        logger.error("Cashfree error", error?.response?.data || error.message);
        res.status(500).send("Failed to create order");
      }
    });
  }
);

export const verifyCashfreePayment = functions.https.onRequest(
  {
    secrets: ["CASHFREE_CLIENT_ID", "CASHFREE_CLIENT_SECRET"]
  },
  (req, res) => {
    cors(req, res, async () => {
      const orderId = req.query.order_id as string;

      if (!orderId) {
        return res.status(400).send("Missing order_id");
      }
    
      try {
        const response = await axios.get(
          `https://sandbox.cashfree.com/pg/orders/${orderId}`,
          {
            headers: {
              "Content-Type": "application/json",
              "x-api-version": "2022-09-01",
              "x-client-id":  process.env.CASHFREE_CLIENT_ID,
              "x-client-secret": process.env.CASHFREE_CLIENT_SECRET,
            }
          }
        );

        return res.status(200).json({
          order_id: response.data.order_id,
          order_status: response.data.order_status,
          payment_info: response.data.payment_details?.[0] || null
        });
      } catch (error: any) {
        logger.error("Error verifying Cashfree order", error?.response?.data || error.message);
        return res.status(500).send("Failed to verify order");
      }
    });
  }
);




// import * as functions from "firebase-functions";
// import axios from "axios";
// import corsLib from "cors";

// const cors = corsLib({ origin: ["http://localhost:4200", "https://apt3m.com"] });

// export const createCashfreeOrder = functions.https.onRequest((req, res) => {
//   cors(req, res, async () => {
//     try {
//       const { orderId, orderAmount, customerName, customerEmail, customerPhone } = req.body;

//       const response = await axios.post(
//         "https://sandbox.cashfree.com/pg/orders",
//         {
//           order_id: orderId,
//           order_amount: orderAmount,
//           order_currency: "INR",
//           customer_details: {
//             customer_id: customerPhone,
//             customer_name: customerName,
//             customer_email: customerEmail,
//             customer_phone: customerPhone,
//           },
//         },
//         {
//           headers: {
//             "Content-Type": "application/json",
//             "x-api-version": "2022-09-01",
//            "x-client-id": process.env.CASHFREE_CLIENT_ID,
//             "x-client-secret": process.env.CASHFREE_CLIENT_SECRET,

//           }
//         }
//       );

//       res.status(200).json(response.data);
//     } catch (error: any) {
//       console.error("Cashfree error", error?.response?.data || error.message);
//       res.status(500).send("Failed to create order");
//     }
//   });
// });
