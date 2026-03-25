import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Razorpay from "razorpay";
import shortid from "shortid";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Initialize Razorpay
  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_SOQbAh2VaZaTAd",
    key_secret: process.env.RAZORPAY_SECRET || "hwkrcR1Nf3Q9WWCDGVd7eYR5",
  });

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Retail Management Store Backend is running" });
  });

  app.post("/api/razorpay", async (req, res) => {
    const { amount, currency } = req.body;

    const options = {
      amount: (amount * 100).toString(), // amount in the smallest currency unit
      currency,
      receipt: shortid.generate(),
    };

    try {
      const response = await razorpay.orders.create(options);
      res.json({
        id: response.id,
        currency: response.currency,
        amount: response.amount,
      });
    } catch (error) {
      console.error("Razorpay Error:", error);
      res.status(500).send("Error creating Razorpay order");
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
