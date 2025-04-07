const express = require("express");
const app = express();
const PORT = 3001;
const path = require("path");
const cron = require("node-cron");
const cors = require("cors");

const tenantRoutes = require("./routes/tenantRoutes");
const adminRoutes = require("./routes/adminRoutes")
const userRoutes = require("./routes/userRoutes");
const templateRoutes = require("./routes/templateRoutes");
const previewRoutes = require("./routes/previewRoutes");
const subscriberRoutes = require("./routes/subscriberRoutes");



app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json()); // Parse JSON bodies
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Routes
app.use("/api/users", userRoutes);
app.use('/api/admin', adminRoutes);
app.use("/api/tenants", tenantRoutes);
app.use("/api/templates", templateRoutes);
app.use("/api/preview", previewRoutes);
app.use("/api/subscribers", subscriberRoutes);



// Error-handling middleware for JSON parsing errors
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    console.error("Invalid JSON payload:", err.message);
    return res.status(400).json({
      error: "INVALID_JSON",
      message: "Invalid JSON format in request body",
    });
  }
  next(err);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});