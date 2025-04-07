const express = require("express");
const router = express.Router();
const { AddSubscriber, GetSubscribers } = require("../controllers/subscriberController");
const { authenticateUser } = require("../middleware/authMiddleware"); // Use authenticateUser for tenant routes

// Routes for subscribers
router.post("/", authenticateUser, AddSubscriber); // POST /api/subscribers
router.get("/", authenticateUser, GetSubscribers); // GET /api/subscribers

module.exports = router;