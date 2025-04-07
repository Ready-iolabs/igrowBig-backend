// controllers/TemplateController.js
const db = require("../config/db");

const GetTemplates = async (req, res) => {
  try {
    const templates = await db.selectAll("tbl_templates", "id, name, description");
    const formattedTemplates = templates.map(template => ({
      id: template.id,
      name: template.name,
      description: template.description,
      route: `/template${template.id}`, // e.g., /template1, /template2, /template3
      image: "https://via.placeholder.com/1350x400", // Add image field if stored in DB
    }));
    res.json(formattedTemplates);
  } catch (err) {
    console.error("GetTemplates Error:", err);
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal Server Error" });
  }
};

module.exports = { GetTemplates };