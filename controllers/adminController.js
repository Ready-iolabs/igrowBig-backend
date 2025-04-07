require("dotenv").config();
const db = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const { sendWelcomeEmail, transporter } = require("../config/email");
const generator = require("generate-password");
const JWT_SECRET = process.env.JWT_SECRET || "123456";

// Admin Signup (unchanged)
const AdminSignup = [
  body("email").isEmail().withMessage("Please enter a valid email address"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, email, password } = req.body;

      if (!name || !email || !password) {
        return res
          .status(400)
          .json({
            error: "MISSING_FIELDS",
            message: "All fields are required",
          });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const existingAdmin = await db.select(
        "tbl_admin",
        "*",
        `email = '${normalizedEmail}'`
      );
      if (
        existingAdmin &&
        (Array.isArray(existingAdmin)
          ? existingAdmin.length > 0
          : existingAdmin)
      ) {
        return res
          .status(400)
          .json({ error: "EMAIL_EXISTS", message: "Email already exists" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const adminData = {
        name,
        email: normalizedEmail,
        password_hash: hashedPassword,
      };

      const result = await db.insert("tbl_admin", adminData);
      await sendWelcomeEmail(normalizedEmail, {
        email: normalizedEmail,
        password,
      });

      res.status(201).json({
        message: "Admin created successfully",
        admin_id: result.insert_id,
      });
    } catch (error) {
      console.error("AdminSignup Error:", error);
      if (error.code === "ER_DUP_ENTRY") {
        return res
          .status(400)
          .json({ error: "EMAIL_EXISTS", message: "Email already exists" });
      }
      res
        .status(500)
        .json({
          error: "SERVER_ERROR",
          message: "Server error",
          details: error.message,
        });
    }
  },
];

// Admin Login (unchanged)
// Backend - AdminLogin.js
const AdminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "MISSING_FIELDS",
        message: "Email and password are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const admin = await db.select(
      "tbl_admin",
      "*",
      `email = '${normalizedEmail}'`
    );

    if (!admin || (Array.isArray(admin) && admin.length === 0)) {
      return res.status(404).json({
        error: "EMAIL_NOT_FOUND",
        message: "No account found with this email",
      });
    }

    const adminData = Array.isArray(admin) ? admin[0] : admin;

    if (!(await bcrypt.compare(password, adminData.password_hash))) {
      return res.status(401).json({
        error: "INVALID_PASSWORD",
        message: "Incorrect password",
      });
    }

    const token = jwt.sign({ admin_id: adminData.id }, JWT_SECRET, {
      expiresIn: "1h",
    });

    return res.status(200).json({
      message: "Login successful",
      token,
      admin: {
        id: adminData.id,
        name: adminData.name,
        email: adminData.email,
      },
    });
  } catch (error) {
    console.error("AdminLogin Error:", error);
    return res.status(500).json({
      error: "SERVER_ERROR",
      message: "An unexpected error occurred",
      details: error.message,
    });
  }
};

// Create User (unchanged)
const CreateUser = [
  body("email").isEmail().withMessage("Please enter a valid email address"),
  body("name").notEmpty().withMessage("Name is required"),
  body("subscription_plan")
    .isIn(["yearly", "monthly"])
    .withMessage("Subscription plan must be 'yearly' or 'monthly'")
    .optional({ nullable: true }),
  body("template_id")
    .isInt({ min: 1 })
    .withMessage("Template ID must be a positive integer")
    .optional({ nullable: true }),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        name,
        email,
        subscription_plan = "yearly",
        template_id = 1,
      } = req.body;

      if (!name || !email) {
        return res
          .status(400)
          .json({
            error: "MISSING_FIELDS",
            message: "Name and email are required",
          });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const existingUser = await db.select(
        "tbl_users",
        "*",
        `email = '${normalizedEmail}'`
      );
      if (
        existingUser &&
        (Array.isArray(existingUser) ? existingUser.length > 0 : existingUser)
      ) {
        return res
          .status(400)
          .json({ error: "EMAIL_EXISTS", message: "Email already exists" });
      }

      const tenantData = {
        store_name: `${name}'s Store`,
        template_id: template_id,
        user_id: null,
        domain: `${normalizedEmail.split("@")[0]}.example.com`,
        site_title: `${name}'s Site`,
        site_description: `Store for ${name}`,
        is_live: 0,
      };

      const tenantResult = await db.insert("tbl_tenants", tenantData);
      if (
        !tenantResult ||
        !Number.isInteger(tenantResult.insert_id) ||
        tenantResult.insert_id <= 0
      ) {
        throw new Error(
          "Failed to insert tenant into tbl_tenants: Invalid or missing insert_id"
        );
      }
      const newTenantId = tenantResult.insert_id;

      const generatedPassword = generator.generate({
        length: 10,
        numbers: true,
        symbols: true,
        uppercase: true,
        lowercase: true,
      });

      const hashedPassword = await bcrypt.hash(generatedPassword, 10);
      const userData = {
        name,
        email: normalizedEmail,
        password_hash: hashedPassword,
        tenant_id: newTenantId,
        subscription_plan,
        subscription_status: "1",
        template_id: template_id, // Add template_id to user data
      };

      const userResult = await db.insert("tbl_users", userData);
      if (
        !userResult ||
        !Number.isInteger(userResult.insert_id) ||
        userResult.insert_id <= 0
      ) {
        throw new Error(
          "Failed to insert user into tbl_users: Invalid or missing insert_id"
        );
      }

      const updateResult = await db.update(
        "tbl_tenants",
        { user_id: userResult.insert_id },
        `id = ${newTenantId}`
      );
      if (!updateResult || !updateResult.affected_rows) {
        throw new Error("Failed to update tbl_tenants with user_id");
      }

      await sendWelcomeEmail(
        normalizedEmail,
        {
          name,
          email: normalizedEmail,
          password: generatedPassword,
          subscription_plan,
          subscription_status: "active",
          template_id,
        },
        true
      );

      res.status(201).json({
        message: "User created successfully",
        user_id: userResult.insert_id,
        tenant_id: newTenantId,
        template_id: template_id,
      });
    } catch (error) {
      console.error("CreateUser Error:", error);
      if (error.code === "ER_DUP_ENTRY") {
        return res
          .status(400)
          .json({ error: "EMAIL_EXISTS", message: "Email already exists" });
      }
      res
        .status(500)
        .json({
          error: "SERVER_ERROR",
          message: "Server error",
          details: error.message,
        });
    }
  },
];

const UpdateUserStatus = [
  body("user_id").isInt({ min: 1 }).withMessage("User ID must be a positive integer"),
  body("subscription_status")
    .custom((value) => [0, 1, "active", "inactive"].includes(value))
    .withMessage("Subscription status must be 0, 1, 'active', or 'inactive'"),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      if (!req.admin || !req.admin.admin_id) {
        return res.status(401).json({ error: "UNAUTHORIZED", message: "Admin authentication required" });
      }

      const { user_id, subscription_status } = req.body;

      const normalizedStatus =
        subscription_status === "active" || subscription_status === 1 ? "1" :
        subscription_status === "inactive" || subscription_status === 0 ? "0" :
        subscription_status;

      const existingUser = await db.select("tbl_users", "*", "id = ?", [user_id]);
      if (!existingUser) {
        return res.status(404).json({ error: "USER_NOT_FOUND", message: "User not found" });
      }

      const currentUser = Array.isArray(existingUser) ? existingUser[0] : existingUser;
      if (currentUser.subscription_status === normalizedStatus) {
        return res.status(200).json({
          message: `User status is already ${normalizedStatus === "1" ? "active" : "inactive"}`,
          user_id,
        });
      }

      const updateData = {
        subscription_status: normalizedStatus,
        updated_at: new Date().toISOString().slice(0, 19).replace("T", " "),
      };

      const result = await db.update("tbl_users", updateData, "id = ?", [user_id]);
      if (!result || result.affectedRows === 0) {
        return res.status(400).json({ 
          error: "UPDATE_FAILED", 
          message: "Failed to update user status. Database update did not apply." 
        });
      }

      res.status(200).json({
        message: `User status updated to ${normalizedStatus === "1" ? "active" : "inactive"}`,
        user_id,
      });
    } catch (error) {
      console.error("UpdateUserStatus Error:", error);
      res.status(500).json({ error: "SERVER_ERROR", message: "An unexpected error occurred", details: error.message });
    }
  },
];

// Reset User Password (unchanged)
const ResetUserPassword = [
  body("new_password")
    .isLength({ min: 8 })
    .withMessage("New password must be at least 8 characters long"),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { user_id, new_password, tenant_email } = req.body;

      if (!user_id || !new_password || !tenant_email) {
        return res.status(400).json({
          error: "MISSING_FIELDS",
          message: "User ID, email and new password are required",
        });
      }

      const user = await db.select(
        "tbl_users",
        "*",
        `id = ${user_id} AND email = '${tenant_email}'`
      );
      if (!user || (Array.isArray(user) && user.length === 0)) {
        return res.status(404).json({
          error: "USER_NOT_FOUND",
          message: "User not found with the provided ID and email",
        });
      }

      const userData = Array.isArray(user) ? user[0] : user;
      const hashedPassword = await bcrypt.hash(new_password, 10);
      const result = await db.update(
        "tbl_users",
        { password_hash: hashedPassword },
        `id = ${user_id} AND email = '${tenant_email}'`
      );

      if (!result || !result.affected_rows) {
        return res.status(404).json({
          error: "USER_NOT_FOUND",
          message: "User not found with the provided ID and email",
        });
      }

      // Send email with the new password
      await sendWelcomeEmail(
        tenant_email,
        {
          email: tenant_email,
          password: new_password,
          name: userData.name || "User",
          subscription_plan: userData.subscription_plan || "unknown",
          subscription_status: userData.subscription_status || "active",
        },
        true
      );

      res.json({
        message: "Password reset successfully and email sent to tenant",
      });
    } catch (error) {
      console.error("ResetUserPassword Error:", error);
      res.status(500).json({
        error: "SERVER_ERROR",
        message: "Server error",
        details: error.message,
      });
    }
  },
];

// Send Tenant Notification (unchanged)
const SendTenantNotification = [
  body("title").notEmpty().withMessage("Title is required"),
  body("message").notEmpty().withMessage("Message is required"),
  async (req, res) => {
    let notificationId = null;

    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { title, message } = req.body;

      if (!req.admin || !req.admin.admin_id) {
        return res
          .status(401)
          .json({
            error: "UNAUTHORIZED",
            message: "Admin authentication required",
          });
      }
      const adminId = req.admin.admin_id;

      const notificationData = {
        title,
        message,
        admin_id: adminId,
        status: "draft",
      };

      const notificationResult = await db.insert(
        "tbl_admin_notifications",
        notificationData
      );
      notificationId = notificationResult.insert_id;

      const tenants = await db.selectAll(
        "tbl_users",
        "email, name",
        "subscription_status = 'active'"
      );
      if (!tenants || tenants.length === 0) {
        return res
          .status(404)
          .json({
            error: "NO_TENANTS_FOUND",
            message: "No active tenants found",
          });
      }

      console.log(
        "Sending emails to:",
        tenants.map((t) => t.email)
      );

      const emailPromises = tenants.map((tenant) =>
        transporter
          .sendMail({
            from: '"iGrow Big" <hello@arbilo.com>',
            to: tenant.email,
            subject: title,
            html: `
            <h2>${title}</h2>
            <p>Dear ${tenant.name},</p>
            <p>${message}</p>
            <p>Best regards,<br>Admin Team</p>
          `,
          })
          .then((info) => {
            console.log(`Email sent to ${tenant.email}: ${info.response}`);
            return info;
          })
          .catch((error) => {
            console.error(`Failed to send email to ${tenant.email}:`, error);
            throw error;
          })
      );

      await Promise.all(emailPromises);

      await db.update(
        "tbl_admin_notifications",
        { status: "sent" },
        `id = ${notificationId}`
      );

      res.status(200).json({
        message: "Notification sent successfully to all tenants",
        notification_id: notificationId,
        recipients_count: tenants.length,
      });
    } catch (error) {
      console.error("SendTenantNotification Error:", error);

      if (notificationId) {
        await db
          .update(
            "tbl_admin_notifications",
            { status: "failed" },
            `id = ${notificationId}`
          )
          .catch((err) =>
            console.error("Failed to update notification status:", err)
          );
      }

      res.status(500).json({
        error: "SERVER_ERROR",
        message: "Failed to send notification",
        details: error.message,
      });
    }
  },
];

// Get All Tenant Users
const GetAllTenantUsers = async (req, res) => {
  try {
    if (!req.admin || !req.admin.admin_id) {
      return res
        .status(401)
        .json({
          error: "UNAUTHORIZED",
          message: "Admin authentication required",
        });
    }

    const allUsers = await db.selectAll(
      "tbl_users",
      "id, name, email, subscription_status, subscription_plan, created_at, tenant_id"
    ); // Ensure tenant_id is included

    if (!allUsers || allUsers.length === 0) {
      return res.status(200).json({
        message: "No tenant users found",
        userStats: { total: 0, active: 0, inactive: 0 },
        users: [],
      });
    }

    const userStats = {
      total: allUsers.length,
      active: allUsers.filter((user) => user.subscription_status === "active")
        .length,
      inactive: allUsers.filter(
        (user) => user.subscription_status === "inactive"
      ).length,
    };

    res.status(200).json({
      message: "Tenant users retrieved successfully",
      userStats,
      users: allUsers.map((user) => ({
        id: user.id,
        tenant_id: user.tenant_id, // Use the actual tenant_id from DB
        name: user.name,
        email: user.email,
        status: user.subscription_status || "unknown",
        plan: user.subscription_plan || "none",
        createdAt: user.created_at,
      })),
    });
  } catch (error) {
    console.error("GetAllTenantUsers Error:", error);
    res
      .status(500)
      .json({
        error: "SERVER_ERROR",
        message: "Server error",
        details: error.message,
      });
  }
};

// Get All Tenant Messages
const GetAllTenantMessages = async (req, res) => {
  try {
    if (!req.admin || !req.admin.admin_id) {
      return res
        .status(401)
        .json({
          error: "UNAUTHORIZED",
          message: "Admin authentication required",
        });
    }

    const messages = await db.selectAll(
      "tbl_admin_notifications",
      "id, title, message, admin_id, status, created_at"
    );
    if (!messages || messages.length === 0) {
      return res.status(200).json({
        message: "No tenant messages found",
        messages: [],
      });
    }

    res.status(200).json({
      message: "Tenant messages retrieved successfully",
      messages,
      total: messages.length,
    });
  } catch (error) {
    console.error("GetAllTenantMessages Error:", error);
    res
      .status(500)
      .json({
        error: "SERVER_ERROR",
        message: "Server error",
        details: error.message,
      });
  }
};

// Get Tenant Settings (Admin can fetch settings for any tenant)
const GetTenantSettings = async (req, res) => {
  try {
    if (!req.admin || !req.admin.admin_id) {
      return res
        .status(401)
        .json({
          error: "UNAUTHORIZED",
          message: "Admin authentication required",
        });
    }

    const { tenantId } = req.params;
    const settings = await db.select(
      "tbl_settings",
      "*",
      `tenant_id = ${tenantId}`
    );

    // If no settings found, return default settings
    if (!settings || (Array.isArray(settings) && settings.length === 0)) {
      const defaultSettings = {
        tenant_id: tenantId,
        domain_type: "sub_domain",
        primary_domain_name: "example.com",
        website_link: "https://example.com",
        first_name: "",
        last_name: "",
        email_id: "",
        mobile: null,
        address: "Not set",
        publish_on_site: 0,
        skype: null,
        site_name: "Default Site",
        nht_website_link: null,
        nht_store_link: null,
        nht_joining_link: null,
      };
      return res.status(200).json({
        message: "No settings found, returning default settings",
        settings: defaultSettings,
      });
    }

    const settingsData = Array.isArray(settings) ? settings[0] : settings;
    res.status(200).json({
      message: "Tenant settings retrieved successfully",
      settings: settingsData,
    });
  } catch (error) {
    console.error("GetTenantSettings Error:", error);
    res
      .status(500)
      .json({
        error: "SERVER_ERROR",
        message: "Server error",
        details: error.message,
      });
  }
};
// Update Tenant Settings (Admin can modify settings for any tenant)
const UpdateTenantSettings = [
  // Middleware to handle file upload
 

  // Validations (optional fields)
  body("domain_type").optional().notEmpty().withMessage("Domain type cannot be empty if provided"),
  body("primary_domain_name").optional().notEmpty().withMessage("Primary domain name cannot be empty if provided"),
  body("first_name").optional().notEmpty().withMessage("First name cannot be empty if provided"),
  body("last_name").optional().notEmpty().withMessage("Last name cannot be empty if provided"),
  body("email_id").optional().isEmail().withMessage("Please provide a valid email address if email is provided"),
  body("address").optional().notEmpty().withMessage("Address cannot be empty if provided"),
  body("site_name").optional().notEmpty().withMessage("Site name cannot be empty if provided"),

  async (req, res) => {
    try {
      // Check for file upload errors
      if (req.fileValidationError) {
        return res.status(400).json({ error: "FILE_ERROR", message: req.fileValidationError });
      }

      // Validate request body
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Admin authentication check
      if (!req.admin || !req.admin.admin_id) {
        return res.status(401).json({
          error: "UNAUTHORIZED",
          message: "Admin authentication required",
        });
      }

      const { tenantId } = req.params;
      const {
        domain_type,
        sub_domain,
        primary_domain_name,
        first_name,
        last_name,
        email_id,
        mobile,
        address,
        publish_on_site,
        skype,
        site_name,
        nht_website_link,
        nht_store_link,
        nht_joining_link,
      } = req.body;

      // Fetch existing settings
      const existingSettings = await db.select("tbl_settings", "*", "tenant_id = ?", [tenantId]);
      if (!existingSettings) {
        return res.status(404).json({
          error: "SETTINGS_NOT_FOUND",
          message: "Settings not found for this tenant",
        });
      }

      const currentSettings = Array.isArray(existingSettings) ? existingSettings[0] : existingSettings;

      // Validate sub_domain if domain_type is "sub_domain" and provided
      if (domain_type === "sub_domain" && sub_domain && sub_domain.trim() === "") {
        return res.status(400).json({
          error: "MISSING_SUB_DOMAIN",
          message: "Sub-domain cannot be empty when domain type is 'sub_domain'",
        });
      }

      // Compute website_link if relevant fields are provided
      const website_link =
        domain_type && primary_domain_name
          ? domain_type === "sub_domain" && sub_domain
            ? `https://${sub_domain}.${primary_domain_name}`
            : `https://${primary_domain_name}`
          : currentSettings.website_link;

      // Build settingsData with only provided fields
      const settingsData = {};
      if (domain_type !== undefined) settingsData.domain_type = domain_type;
      if (sub_domain !== undefined) settingsData.sub_domain = domain_type === "sub_domain" ? sub_domain : null;
      if (primary_domain_name !== undefined) settingsData.primary_domain_name = primary_domain_name;
      if (website_link !== undefined) settingsData.website_link = website_link;
      if (first_name !== undefined) settingsData.first_name = first_name;
      if (last_name !== undefined) settingsData.last_name = last_name;
      if (email_id !== undefined) settingsData.email_id = email_id;
      if (mobile !== undefined) settingsData.mobile = mobile || null;
      if (address !== undefined) settingsData.address = address;
      if (publish_on_site !== undefined) 
        settingsData.publish_on_site = publish_on_site === "true" || publish_on_site === true ? 1 : 0;
      if (skype !== undefined) settingsData.skype = skype || null;
      if (site_name !== undefined) settingsData.site_name = site_name;
      if (nht_website_link !== undefined) settingsData.nht_website_link = nht_website_link || null;
      if (nht_store_link !== undefined) settingsData.nht_store_link = nht_store_link || null;
      if (nht_joining_link !== undefined) settingsData.nht_joining_link = nht_joining_link || null;
      settingsData.updated_at = new Date().toISOString().slice(0, 19).replace("T", " ");

      // Handle site logo upload to S3
      if (req.files && req.files.length > 0) {
        const logoFile = req.files.find((file) => file.fieldname === "site_logo");
        if (logoFile) {
          const folder = `settings/tenant_${tenantId}`;
          // Delete old logo from S3 if it exists
          if (currentSettings.site_logo_url) {
            await deleteFromS3(currentSettings.site_logo_url);
          }
          // Upload new logo to S3
          settingsData.site_logo_url = await uploadToS3(logoFile, folder);
          const tempFilePath = logoFile.path;
          if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath); // Clean up temp file
        }
      }

      // Update settings in the database
      const result = await db.update("tbl_settings", settingsData, "tenant_id = ?", [tenantId]);
      if (!result || result.affectedRows === 0) {
        return res.status(400).json({
          error: "UPDATE_FAILED",
          message: "Failed to update settings. No changes applied.",
        });
      }

      res.status(200).json({ message: "Tenant settings updated successfully" });
    } catch (error) {
      console.error("UpdateTenantSettings Error:", error);
      res.status(500).json({
        error: "SERVER_ERROR",
        message: "An unexpected error occurred",
        details: error.message,
      });
    }
  },
];
module.exports = {
  AdminSignup,
  AdminLogin,
  CreateUser,
  ResetUserPassword,
  SendTenantNotification,
  GetAllTenantUsers,
  GetAllTenantMessages, // New controller
  GetTenantSettings, // New admin endpoint
  UpdateTenantSettings, // New admin endpoint
  UpdateUserStatus,
};
