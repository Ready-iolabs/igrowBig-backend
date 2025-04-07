const db = require("../config/db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const {checkTenantAuth} = require("../middleware/authMiddleware");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../../uploads");
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
}).single("image");

// Banners
const AddBanner = async (req, res) => {
  upload(req, res, async (err) => {
    if (err)
      return res.status(400).json({ error: "FILE_ERROR", message: err.message });

    const { tenantId } = req.params;
    const { text, is_active } = req.body; // Removed 'link'

    console.log('AddBanner - req.body:', req.body);
    console.log('AddBanner - req.file:', req.file);

    if (!checkTenantAuth(req, tenantId))
      return res.status(403).json({ error: "UNAUTHORIZED", message: "Unauthorized" });

    try {
      if (!req.file) // Changed from req.files to req.file
        return res.status(400).json({ error: "NO_IMAGE", message: "Banner image required" });

      const image_url = `/uploads/${req.file.filename}`; // Changed to req.file.filename
      const bannerData = {
        tenant_id: tenantId,
        image_url,
        text,
        is_active: is_active ?? true,
      };
      const result = await db.insert("tbl_banners", bannerData);
      res.status(201).json({ message: "Banner added", banner_id: result.insert_id });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "SERVER_ERROR", message: "Server error" });
    }
  });
};

const GetBanners = async (req, res) => {
  const { tenantId } = req.params;
  if (!checkTenantAuth(req, tenantId))
    return res
      .status(403)
      .json({ error: "UNAUTHORIZED", message: "Unauthorized" });

  try {
    const banners = await db.selectAll(
      "tbl_banners",
      "*",
      `tenant_id = ${tenantId}`
    );
    res.json(banners);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "SERVER_ERROR", message: "Server error" });
  }
};

const UpdateBanner = async (req, res) => {
  upload(req, res, async (err) => {
    if (err)
      return res
        .status(400)
        .json({ error: "FILE_ERROR", message: err.message });

    const { tenantId, bannerId } = req.params;
    const { text, is_active } = req.body; // Removed 'link' since you don’t want it
    if (!checkTenantAuth(req, tenantId))
      return res
        .status(403)
        .json({ error: "UNAUTHORIZED", message: "Unauthorized" });

    // Log incoming data for debugging
    console.log('req.body:', req.body);
    console.log('req.file:', req.file);

    try {
      const updateData = {};
      if (typeof text !== 'undefined') updateData.text = text;
      if (req.file) updateData.image_url = `/uploads/${req.file.filename}`;
      if (typeof is_active !== 'undefined') updateData.is_active = is_active === 'true' || is_active === true;

      if (Object.keys(updateData).length === 0) {
        return res
          .status(400)
          .json({ error: "NO_DATA", message: "No fields provided to update" });
      }

      await db.update(
        "tbl_banners",
        updateData,
        `id = ${bannerId} AND tenant_id = ${tenantId}`
      );
      res.json({ message: "Banner updated" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "SERVER_ERROR", message: "Server error" });
    }
  });
};

const DeleteBanner = async (req, res) => {
  const { tenantId, bannerId } = req.params;
  if (!checkTenantAuth(req, tenantId))
    return res
      .status(403)
      .json({ error: "UNAUTHORIZED", message: "Unauthorized" });

  try {
    const banner = await db.select(
      "tbl_banners",
      "*",
      `id = ${bannerId} AND tenant_id = ${tenantId}`
    );
    if (!banner)
      return res
        .status(404)
        .json({ error: "BANNER_NOT_FOUND", message: "Banner not found" });

    const filePath = path.join(__dirname, "../", banner.image_url);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await db.delete(
      "tbl_banners",
      `id = ${bannerId} AND tenant_id = ${tenantId}`
    );
    res.json({ message: "Banner deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "SERVER_ERROR", message: "Server error" });
  }
};

module.exports = {
  AddBanner,
  GetBanners,
  UpdateBanner,
  DeleteBanner,
};
