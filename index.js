const express = require("express");
const app = express();
const PORT = 3001;
const path = require("path");
const cron = require("node-cron");
const cors = require("cors");

const tenantRoutes = require("./routes/tenantRoutes");
const adminRoutes = require("./routes/adminRoutes");
const userRoutes = require("./routes/userRoutes");
const templateRoutes = require("./routes/templateRoutes");
const publicTenantRoutes  = require("./routes/publicTenantRoutes")
const detectSubdomain = require('./middleware/subdomain.js');
const newsletterRoutes = require("./routes/newsletterRoutes"); 

app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ✅ Routes
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/tenants", tenantRoutes);
app.use("/api/templates", templateRoutes);
app.use("/api/newsletters", newsletterRoutes); 
app.use("/api", publicTenantRoutes);
// Example route to test subdomain
app.get('/', (req, res) => {
  if (req.detectSubdomain) {
    return res.json({ message: `Welcome to ${req.detectSubdomain}'s store` });
  }
  res.json({ message: 'Welcome to Begrat' });
});
require("./cron/dnsCheck");

// ✅ Error handler for JSON parsing
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
