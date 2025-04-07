const db = require("../config/db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const {checkTenantAuth} = require("../middleware/authMiddleware");

const { promisify } = require("util");


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../uploads");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) return cb(null, true);
    cb(new Error("Only JPEG/JPG/PNG images allowed"));
  },
}).array("files", 2);

// Site Info
const UpdateSiteInfo = async (req, res) => {
  upload(req, res, async (err) => {
    if (err)
      return res
        .status(400)
        .json({ error: "FILE_ERROR", message: err.message });

    const { tenantId } = req.params;
    const { contact_email, contact_phone, social_links } = req.body;
    if (!checkTenantAuth(req, tenantId))
      return res
        .status(403)
        .json({ error: "UNAUTHORIZED", message: "Unauthorized" });

    try {
      const updateData = {};
      if (req.files && req.files.length > 0) {
        const logoFile = req.files.find((file) => file.fieldname === "logo");
        const faviconFile = req.files.find(
          (file) => file.fieldname === "favicon"
        );
        if (logoFile) updateData.logo_url = `/uploads/${logoFile.filename}`;
        if (faviconFile)
          updateData.favicon_url = `/uploads/${faviconFile.filename}`;
      }
      if (contact_email) updateData.contact_email = contact_email;
      if (contact_phone) updateData.contact_phone = contact_phone;
      if (social_links) updateData.social_links = JSON.stringify(social_links);

      const existingInfo = await db.select(
        "tbl_site_info",
        "*",
        `tenant_id = ${tenantId}`
      );
      if (existingInfo) {
        await db.update("tbl_site_info", updateData, `tenant_id = ${tenantId}`);
        res.json({ message: "Site info updated" });
      } else {
        updateData.tenant_id = tenantId;
        const result = await db.insert("tbl_site_info", updateData);
        res.status(201).json({
          message: "Site info created",
          site_info_id: result.insert_id,
        });
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "SERVER_ERROR", message: "Server error" });
    }
  });
};

const GetSiteInfo = async (req, res) => {
  const { tenantId } = req.params;
  if (!checkTenantAuth(req, tenantId))
    return res
      .status(403)
      .json({ error: "UNAUTHORIZED", message: "Unauthorized" });

  try {
    const siteInfo = await db.select(
      "tbl_site_info",
      "*",
      `tenant_id = ${tenantId}`
    );
    if (!siteInfo)
      return res
        .status(404)
        .json({ error: "SITE_INFO_NOT_FOUND", message: "Site info not found" });
    res.json(siteInfo);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "SERVER_ERROR", message: "Server error" });
  }
};

module.exports = {
  UpdateSiteInfo,
  GetSiteInfo,
};
