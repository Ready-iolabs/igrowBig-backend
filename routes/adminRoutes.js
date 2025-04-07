const express = require("express");
const router = express.Router();
const { AdminSignup, AdminLogin, CreateUser, ResetUserPassword, SendTenantNotification,GetAllTenantUsers,GetAllTenantMessages,GetTenantSettings,UpdateTenantSettings, UpdateUserStatus } = require("../controllers/adminController");
const { authenticateAdmin } = require("../middleware/authMiddleware");

router.post("/signup", AdminSignup);
router.post("/login", AdminLogin);
router.post("/create-user", authenticateAdmin, CreateUser); // Protect admin-only actions
router.put("/user-status", authenticateAdmin, UpdateUserStatus);
router.post("/reset-user-password", authenticateAdmin, ResetUserPassword); // Protect admin-only actions
router.post("/notifications", authenticateAdmin, SendTenantNotification); // Protect notification route
router.get("/tenant-users", authenticateAdmin, GetAllTenantUsers);
router.get("/messages", authenticateAdmin, GetAllTenantMessages); // New route
router.get("/settings/:tenantId", authenticateAdmin, GetTenantSettings); // New route
router.put("/settings/:tenantId", authenticateAdmin, UpdateTenantSettings);
module.exports = router;