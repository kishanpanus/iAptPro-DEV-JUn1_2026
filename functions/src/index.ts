import * as functions from "firebase-functions/v2";
import * as logger from "firebase-functions/logger";
import axios from "axios";
import corsLib from "cors";
import * as admin from "firebase-admin";
import { onRequest } from "firebase-functions/https";

const cors = corsLib({
  origin: [
    "http://localhost:4200",
    "https://localhost",
    "https://apt3m.com"
  ]
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
      if (req.method !== "POST") {
        res.status(405).send("Method Not Allowed");
        return;
      }

      const { phone } = (req.body ?? {}) as { phone?: string };
      if (!phone) {
        res.status(400).json({ error: "phone required" });
        return;
      }

      const apiKey = await getApiKey();
      const to = toE164(phone);

  const url =
  `${BASE}/${encodeURIComponent(apiKey)}/SMS/${encodeURIComponent(to)}` +
  `/AUTOGEN/${encodeURIComponent(TEMPLATE)}?From=${encodeURIComponent(SENDER)}`;


      logger.info("sendOtp -> calling 2Factor", { toMasked: to.replace(/\d{6}$/, "******") });

      const r = await fetch(url);
      const text = await r.text();

      let data: any;
      try { data = JSON.parse(text); } catch { data = { raw: text }; }

      if (!r.ok) {
        logger.error("2Factor sendOtp non-200", { status: r.status, data });
        res.status(400).json(data);
        return;
      }

      res.status(200).json(data); // { Status:'Success', Details:'<sessionId>' }
      return;
    }    catch (err: any) {
        logger.error("sendOtp exception", err);
        res.status(500).json({
          error: "sendOtp failed",
          details: err?.message || String(err)
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
        if (req.method !== "POST") {
          res.status(405).send("Method Not Allowed");
          return;
        }

        const { sessionId, otp } = (req.body ?? {}) as {
          sessionId?: string;
          otp?: string;
        };

        if (!sessionId || !otp) {
          res.status(400).json({
            error: "sessionId and otp required"
          });
          return;
        }

        const apiKey = await getApiKey();

        const url =
          `${BASE}/${encodeURIComponent(apiKey)}` +
          `/SMS/VERIFY/${encodeURIComponent(sessionId)}` +
          `/${encodeURIComponent(otp)}`;

        logger.info("verifyOtp -> calling 2Factor");

        const r = await fetch(url);
        const text = await r.text();

        let data: any;

        try {
          data = JSON.parse(text);
        } catch {
          data = { raw: text };
        }

        if (!r.ok) {
          logger.error("2Factor verifyOtp non-200", {
            status: r.status,
            data
          });

          res.status(400).json(data);
          return;
        }

        res.status(200).json(data);
        return;

      } catch (err: any) {
        logger.error("verifyOtp exception", err);

        res.status(500).json({
          error: "verifyOtp failed",
          details: err?.message || String(err)
        });
        return;
      }
    });
  }
);

export const createCashfreeOrder = functions.https.onRequest(
  {
    secrets: ["CASHFREE_CLIENT_ID", "CASHFREE_CLIENT_SECRET"]
  },
  (req, res) => {
    cors(req, res, async () => {
      try {
        const { orderId, orderAmount, customerName, customerEmail, customerPhone } = req.body;
        console.log("Client ID:", process.env.CASHFREE_CLIENT_ID);
        console.log("Client ID:", process.env.CASHFREE_CLIENT_SECRET);
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
