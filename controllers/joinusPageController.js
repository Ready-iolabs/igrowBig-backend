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
  limits: { fileSize: 4 * 1024 * 1024 }, // 4MB limit for banner image
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (!extname || !mimetype) {
      return cb(new Error("Join Us banner image must be JPEG/JPG/PNG"));
    }
    cb(null, true);
  },
}).single("joinus_image_banner");

// Add Join Us Page
const AddJoinUsPage = async (req, res) => {
  upload(req, res, async (err) => {
    if (err) return res.status(400).json({ error: "FILE_ERROR", message: err.message });

    const { tenantId } = req.params;
    const { image_banner_content, section_content_1, section_content_2, section_content_3 } = req.body;

    if (!checkTenantAuth(req, tenantId)) {
      return res.status(403).json({ error: "UNAUTHORIZED", message: "Unauthorized" });
    }

    try {
      const existingPage = await db.select("tbl_joinus_page", "*", `tenant_id = ${tenantId}`);

      const folder = `joinus/tenant_${tenantId}`;
      let joinusImageBannerUrl = existingPage ? existingPage.joinus_image_banner_url : null;

      if (req.file) {
        if (existingPage && existingPage.joinus_image_banner_url) {
          await deleteFromS3(existingPage.joinus_image_banner_url);
        }
        joinusImageBannerUrl = await uploadToS3(req.file, folder);
        const tempFilePath = req.file.path;
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      }

      const pageData = {
        tenant_id: tenantId,
        joinus_image_banner_url: joinusImageBannerUrl,
        image_banner_content: image_banner_content || null,
        section_content_1: section_content_1 || null,
        section_content_2: section_content_2 || null,
        section_content_3: section_content_3 || null,
      };

      let result;
      if (existingPage) {
        await db.update("tbl_joinus_page", pageData, `tenant_id = ${tenantId}`);
        result = { insert_id: existingPage.id };
      } else {
        result = await db.insert("tbl_joinus_page", pageData);
      }

      res.status(201).json({ message: "Join Us page added/updated", page_id: result.insert_id });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "SERVER_ERROR", message: "Server error" });
    }
  });
};

// Get Join Us Page
const GetJoinUsPage = async (req, res) => {
  const { tenantId } = req.params;
  if (!checkTenantAuth(req, tenantId)) {
    return res.status(403).json({ error: "UNAUTHORIZED", message: "Unauthorized" });
  }

  try {
    const page = await db.select("tbl_joinus_page", "*", `tenant_id = ${tenantId}`);
    if (!page) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Join Us page not found" });
    }
    res.json(page);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "SERVER_ERROR", message: "Server error" });
  }
};

// Update Join Us Page
const UpdateJoinUsPage = async (req, res) => {
  upload(req, res, async (err) => {
    if (err) return res.status(400).json({ error: "FILE_ERROR", message: err.message });

    const { tenantId } = req.params;
    const { image_banner_content, section_content_1, section_content_2, section_content_3 } = req.body;

    if (!checkTenantAuth(req, tenantId)) {
      return res.status(403).json({ error: "UNAUTHORIZED", message: "Unauthorized" });
    }

    try {
      const existingPage = await db.select("tbl_joinus_page", "*", `tenant_id = ${tenantId}`);
      if (!existingPage) {
        return res.status(404).json({ error: "NOT_FOUND", message: "Join Us page not found" });
      }

      const folder = `joinus/tenant_${tenantId}`;
      let joinusImageBannerUrl = existingPage.joinus_image_banner_url;

      if (req.file) {
        if (existingPage.joinus_image_banner_url) {
          await deleteFromS3(existingPage.joinus_image_banner_url);
        }
        joinusImageBannerUrl = await uploadToS3(req.file, folder);
        const tempFilePath = req.file.path;
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      }

      const updateData = {
        joinus_image_banner_url: joinusImageBannerUrl,
        image_banner_content: image_banner_content !== undefined ? image_banner_content : existingPage.image_banner_content,
        section_content_1: section_content_1 !== undefined ? section_content_1 : existingPage.section_content_1,
        section_content_2: section_content_2 !== undefined ? section_content_2 : existingPage.section_content_2,
        section_content_3: section_content_3 !== undefined ? section_content_3 : existingPage.section_content_3,
      };

      await db.update("tbl_joinus_page", updateData, `tenant_id = ${tenantId}`);
      res.json({ message: "Join Us page updated" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "SERVER_ERROR", message: "Server error" });
    }
  });
};

// Delete Join Us Page
const DeleteJoinUsPage = async (req, res) => {
  const { tenantId } = req.params;
  if (!checkTenantAuth(req, tenantId)) {
    return res.status(403).json({ error: "UNAUTHORIZED", message: "Unauthorized" });
  }

  try {
    const page = await db.select("tbl_joinus_page", "*", `tenant_id = ${tenantId}`);
    if (!page) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Join Us page not found" });
    }

    if (page.joinus_image_banner_url) {
      await deleteFromS3(page.joinus_image_banner_url);
    }

    await db.delete("tbl_joinus_page", `tenant_id = ${tenantId}`);
    res.json({ message: "Join Us page deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "SERVER_ERROR", message: "Server error" });
  }
};

module.exports = {
  AddJoinUsPage,
  GetJoinUsPage,
  UpdateJoinUsPage,
  DeleteJoinUsPage,
};