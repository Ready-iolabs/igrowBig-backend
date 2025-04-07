const db = require("../config/db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { checkTenantAuth } = require("../middleware/authMiddleware");
const { uploadToS3, deleteFromS3 } = require("../services/awsS3");

// Configure multer for temporary local storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempDir = path.join(__dirname, "../uploads/temp");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024 }, // 4MB limit for site logo
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (!extname || !mimetype) {
      return cb(new Error("Site logo must be JPEG/JPG/PNG"));
    }
    cb(null, true);
  },
}).array("files", 5);

// Add Settings
const AddSettings = async (req, res) => {
  upload(req, res, async (err) => {
    if (err) return res.status(400).json({ error: "FILE_ERROR", message: err.message });

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

    if (!checkTenantAuth(req, tenantId)) {
      return res.status(403).json({ error: "UNAUTHORIZED", message: "Unauthorized" });
    }

    try {
      // Check if settings already exist
      const existingSettings = await db.select("tbl_settings", "*", `tenant_id = ${tenantId}`);
      if (existingSettings) {
        return res.status(400).json({
          error: "SETTINGS_EXISTS",
          message: "Settings already exist for this tenant. Use update instead.",
        });
      }

      // Validation for required fields
      if (
        !domain_type ||
        !primary_domain_name ||
        !first_name ||
        !last_name ||
        !email_id ||
        !address ||
        !site_name
      ) {
        return res.status(400).json({
          error: "MISSING_FIELDS",
          message: "All required fields must be provided",
        });
      }
      if (domain_type === "sub_domain" && !sub_domain) {
        return res.status(400).json({
          error: "MISSING_SUB_DOMAIN",
          message: "Sub Domain is required when Domain Type is Sub Domain",
        });
      }

      // Compute website_link
      const website_link =
        domain_type === "sub_domain"
          ? `https://${sub_domain}.${primary_domain_name}`
          : `https://${primary_domain_name}`;

      const folder = `settings/tenant_${tenantId}`;
      const settingsData = {
        tenant_id: tenantId,
        domain_type,
        sub_domain: domain_type === "sub_domain" ? sub_domain : null,
        primary_domain_name,
        website_link,
        first_name,
        last_name,
        email_id,
        mobile: mobile || null,
        address,
        publish_on_site: publish_on_site === "true" || publish_on_site === true,
        skype: skype || null,
        site_name,
        nht_website_link: nht_website_link || null,
        nht_store_link: nht_store_link || null,
        nht_joining_link: nht_joining_link || null,
      };

      // Handle site logo upload to S3
      if (req.files && req.files.length > 0) {
        const logoFile = req.files.find((file) => file.fieldname === "site_logo");
        if (logoFile) {
          // Upload to S3
          settingsData.site_logo_url = await uploadToS3(logoFile, folder);
          const tempFilePath = logoFile.path;
          if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        }
      }

      const result = await db.insert("tbl_settings", settingsData);
      res.status(201).json({ message: "Settings added", settings_id: result.insert_id });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "SERVER_ERROR", message: "Server error" });
    }
  });
};

// Update Settings
const UpdateSettings = async (req, res) => {
  upload(req, res, async (err) => {
    if (err) return res.status(400).json({ error: "FILE_ERROR", message: err.message });

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

    if (!checkTenantAuth(req, tenantId)) {
      return res.status(403).json({ error: "UNAUTHORIZED", message: "Unauthorized" });
    }

    try {
      const existingSettings = await db.select("tbl_settings", "*", `tenant_id = ${tenantId}`);
      if (!existingSettings) {
        return res.status(404).json({
          error: "SETTINGS_NOT_FOUND",
          message: "Settings not found for this tenant",
        });
      }

      // Validation for required fields
      if (
        !domain_type ||
        !primary_domain_name ||
        !first_name ||
        !last_name ||
        !email_id ||
        !address ||
        !site_name
      ) {
        return res.status(400).json({
          error: "MISSING_FIELDS",
          message: "All required fields must be provided",
        });
      }
      if (domain_type === "sub_domain" && !sub_domain) {
        return res.status(400).json({
          error: "MISSING_SUB_DOMAIN",
          message: "Sub Domain is required when Domain Type is Sub Domain",
        });
      }

      // Compute website_link
      const website_link =
        domain_type === "sub_domain"
          ? `https://${sub_domain}.${primary_domain_name}`
          : `https://${primary_domain_name}`;

      const folder = `settings/tenant_${tenantId}`;
      const settingsData = {
        domain_type,
        sub_domain: domain_type === "sub_domain" ? sub_domain : null,
        primary_domain_name,
        website_link,
        first_name,
        last_name,
        email_id,
        mobile: mobile || null,
        address,
        publish_on_site: publish_on_site === "true" || publish_on_site === true,
        skype: skype || null,
        site_name,
        nht_website_link: nht_website_link || null,
        nht_store_link: nht_store_link || null,
        nht_joining_link: nht_joining_link || null,
      };

      // Handle site logo upload to S3
      if (req.files && req.files.length > 0) {
        const logoFile = req.files.find((file) => file.fieldname === "site_logo");
        if (logoFile) {
          // Delete old logo from S3 if exists
          if (existingSettings.site_logo_url) {
            await deleteFromS3(existingSettings.site_logo_url);
          }
          // Upload new logo to S3
          settingsData.site_logo_url = await uploadToS3(logoFile, folder);
          const tempFilePath = logoFile.path;
          if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        }
      }

      await db.update("tbl_settings", settingsData, `tenant_id = ${tenantId}`);
      res.json({ message: "Settings updated" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "SERVER_ERROR", message: "Server error" });
    }
  });
};

// Get Settings
const GetSettings = async (req, res) => {
  const { tenantId } = req.params;
  if (!checkTenantAuth(req, tenantId)) {
    return res.status(403).json({ error: "UNAUTHORIZED", message: "Unauthorized" });
  }

  try {
    const settings = await db.select("tbl_settings", "*", `tenant_id = ${tenantId}`);
    if (!settings) {
      return res.status(404).json({ error: "SETTINGS_NOT_FOUND", message: "Settings not found" });
    }
    res.json(settings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "SERVER_ERROR", message: "Server error" });
  }
};

module.exports = {
  AddSettings,
  UpdateSettings,
  GetSettings,
};