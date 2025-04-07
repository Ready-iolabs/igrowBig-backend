// subscriberController.js
const db = require("../config/db");
const { body, validationResult } = require("express-validator");
const { transporter } = require("../config/email");

const AddSubscriber = [
  body("name").notEmpty().withMessage("Name is required"),
  body("email").isEmail().withMessage("Please enter a valid email address"),
  body("message").optional().isString().withMessage("Message must be a string"),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, email, message } = req.body;
      const tenantId = req.user.tenant_id; // Assuming tenant_id comes from JWT middleware

      const normalizedEmail = email.trim().toLowerCase();

      // Check if subscriber already exists for this tenant
      const existingSubscriber = await db.select(
        "tbl_subscribers",
        "*",
        `email = '${normalizedEmail}' AND tenant_id = ${tenantId}`
      );
      if (existingSubscriber && (Array.isArray(existingSubscriber) ? existingSubscriber.length > 0 : existingSubscriber)) {
        return res.status(400).json({ error: "EMAIL_EXISTS", message: "This email is already subscribed" });
      }

      const subscriberData = {
        tenant_id: tenantId,
        name,
        email: normalizedEmail,
        message: message || null,
      };

      const result = await db.insert("tbl_subscribers", subscriberData);

      // Optional: Send confirmation email to subscriber
      await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: normalizedEmail,
        subject: "Subscription Confirmation",
        html: `
          <h2>Welcome, ${name}!</h2>
          <p>Thank you for subscribing to our updates!</p>
          ${message ? `<p>Your message: ${message}</p>` : ""}
          <p>Best regards,<br>The Team</p>
        `,
      });

      res.status(201).json({
        message: "Subscriber added successfully",
        subscriber_id: result.insert_id,
      });
    } catch (error) {
      console.error("AddSubscriber Error:", error);
      if (error.code === "ER_DUP_ENTRY") {
        return res.status(400).json({ error: "EMAIL_EXISTS", message: "This email is already subscribed" });
      }
      res.status(500).json({ error: "SERVER_ERROR", message: "Server error", details: error.message });
    }
  },
];

const GetSubscribers = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id; // Assuming tenant_id comes from JWT middleware

    const subscribers = await db.selectAll(
      "tbl_subscribers",
      "id, name, email, message, subscribed_at, status",
      `tenant_id = ${tenantId}`
    );

    if (!subscribers || subscribers.length === 0) {
      return res.status(404).json({ error: "NO_SUBSCRIBERS_FOUND", message: "No subscribers found" });
    }

    res.status(200).json({
      message: "Subscribers retrieved successfully",
      subscribers,
      total: subscribers.length,
    });
  } catch (error) {
    console.error("GetSubscribers Error:", error);
    res.status(500).json({ error: "SERVER_ERROR", message: "Server error", details: error.message });
  }
};

module.exports = { AddSubscriber, GetSubscribers };