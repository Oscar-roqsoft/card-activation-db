const express = require("express");
const app = express();
require("dotenv").config();
const cors = require("cors");
const bodyParser = require("body-parser");
const rateLimiter = require('express-rate-limit');
const xss = require('xss-clean');
const path = require('path');
const connectDB = require('./db/mongodb');

// Routes
const authRoutes = require("./app/v1/routes/auth");
// const userRoutes = require("./app/v1/routes/user");
// const pinRoutes = require("./app/v1/routes/pinRoutes");
// const cryptoRoutes = require("./app/v1/routes/cryptoRoutes");

// const balRoutes = require("./app/v1/routes/balanceRoute");
// const walletRoutes = require("./app/v1/routes/wallet");
// const cardRoutes = require("./app/v1/routes/card");
// const adminWalletRoutes = require("./app/v1/routes/adminWallet");
// const depositsRoutes = require("./app/v1/routes/deposits");
// const withdrawalRoutes = require("./app/v1/routes/withdrawal");
// const notificationRoutes = require("./app/v1/routes/notification");
// const transactionRoutes = require("./app/v1/routes/transaction");
// const uploadRoutes = require("./app/v1/routes/uploadRoutes");

// Middlewares
const notFound = require('./middlewares/not-found');
const errorHandlers = require('./middlewares/errors');

const port = process.env.PORT || 5000;

// Body parser middleware
app.use(express.json());             // For parsing application/json
app.use(express.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded


// Middleware setup
app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*",'https://web-crypto-app.onrender.com/','http://localhost:5000','http://localhost:3000');
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH");
    res.header(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization,  token"
    );
    next();
});

app.use(cors({
  allowedHeaders: ["Content-Type", "Authorization", "token"],
  origin: "*"
}));



 
// app.use(xss());
// app.use(rateLimiter({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 100 // limit each IP to 100 requests per windowMs
// }));
// app.use(bodyParser.json());
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// Routes
app.use("/api/v1/", authRoutes);
// app.use("/api/v1/user/", userRoutes);
// app.use("/api/v1/pin/", pinRoutes);
// app.use("/api/v1/crypto/", cryptoRoutes);
// app.use("/api/v1/balance/", balRoutes);
// app.use("/api/v1/wallet/", walletRoutes);
// app.use("/api/v1/card/", cardRoutes);
// app.use("/api/v1/adminWallet/", adminWalletRoutes);
// app.use("/api/v1/deposit/", depositsRoutes);
// app.use("/api/v1/withdrawal/", withdrawalRoutes);
// app.use('/uploads', express.static('uploads'));
// app.use('/api/v1/transaction/', transactionRoutes);
// app.use('/api/v1/notification/', notificationRoutes);
// app.use("/api/v1/upload", uploadRoutes);

// Error handling
app.use(notFound);
app.use(errorHandlers);

// Start server AFTER MongoDB connection
const startServer = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is not defined in the environment variables.");
    }

    await connectDB(process.env.MONGO_URI);

    app.listen(port, () => {
      console.log(`🚀 Server running on port ${port}`);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err.message);
    process.exit(1);
  }
};

startServer();

