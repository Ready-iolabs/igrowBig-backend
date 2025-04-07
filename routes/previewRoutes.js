// // routes/tenant.js
// const express = require('express');
// const router = express.Router();
// const path = require('path');
// const db = require('../config/db');

// // Get tenant data and serve static files
// router.use('/:tenantId', async (req, res, next) => {
//   const { tenantId } = req.params;
//   try {
//     // Get tenant from database
//     const tenant = await db.select("tbl_tenants", "*", `id = ${tenantId}`);
//     if (!tenant) {
//       return res.status(404).json({ error: "TENANT_NOT_FOUND", message: "Tenant not found" });
//     }
    
//     // Determine which template to use
//     const previewTemplate = req.query.template;
//     const templateId = previewTemplate || tenant.template_id;
    
//     // Set up static file serving for the template
//     const templatePath = path.join(__dirname, '..', 'templates', `demo${templateId}`, 'dist');
//     express.static(templatePath)(req, res, next);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "SERVER_ERROR", message: "Server error" });
//   }
// });

// // Fallback to serve index.html when static middleware doesn't match
// router.get('/:tenantId', (req, res) => {
//   const { tenantId } = req.params;
//   const previewTemplate = req.query.template;
  
//   // Get tenant from database again (or use the req.tenant if you store it)
//   db.select("tbl_tenants", "*", `id = ${tenantId}`)
//     .then(tenant => {
//       if (!tenant) {
//         return res.status(404).json({ error: "TENANT_NOT_FOUND", message: "Tenant not found" });
//       }
      
//       const templateId = previewTemplate || tenant.template_id;
//       res.sendFile(path.join(__dirname, '..', 'templates', `demo${templateId}`, 'dist', 'index.html'));
//     })
//     .catch(err => {
//       console.error(err);
//       res.status(500).json({ error: "SERVER_ERROR", message: "Server error" });
//     });
// });

// module.exports = router;
const express = require('express');
const router = express.Router();
const path = require('path');

// Serve static assets (e.g., CSS, JS, images) for the template
router.use('/:templateId', (req, res, next) => {
  const { templateId } = req.params;
  const templatePath = path.join(__dirname, '..', 'templates', `demo${templateId}`, 'dist');
  console.log(`Serving static files from: ${templatePath}`);
  express.static(templatePath)(req, res, next);
});

// Serve the index.html for the template
router.get('/:templateId', (req, res) => {
  const { templateId } = req.params;
  const templatePath = path.join(__dirname, '..', 'templates', `demo${templateId}`, 'dist', 'index.html');
  console.log(`Serving index.html from: ${templatePath}`);
  res.sendFile(templatePath, (err) => {
    if (err) {
      console.error(err);
      res.status(404).json({ error: 'NOT_FOUND', message: 'Template not found' });
    }
  });
});

module.exports = router;