// const detectSubdomain = (req, res, next) => {
//     const host = req.headers.host || '';
//     const parts = host.split('.');
//     const subdomain = parts.length >= 3 && parts[0] !== 'www' ? parts[0] : null;
  
//     if (!subdomain || subdomain === 'begrat' || req.path.startsWith('/admin')) {
//       req.subdomain = null;
//       return next();
//     }
  
//     req.subdomain = subdomain;
//     req.detectSubdomain = subdomain; // For index.js compatibility
//     next();
//   };
  
//   module.exports = detectSubdomain;

const db = require('../config/db');

const detectSubdomain = async (req, res, next) => {
  const host = req.headers.host || '';
  const parts = host.split('.');
  let subdomain = null;

  // Detect subdomain for *.begrat.com
  if (parts.length >= 3 && parts[0] !== 'www' && host.includes('begrat.com')) {
    subdomain = parts[0];
  }

  // Check for custom domains
  if (!host.includes('begrat.com') && !host.includes('localhost')) {
    const settings = await db.select(
      'tbl_settings',
      'tenant_id, sub_domain',
      'primary_domain_name = ?',
      [host]
    );
    if (settings.length > 0) {
      subdomain = settings[0].sub_domain;
    }
  }

  if (!subdomain || subdomain === 'begrat' || req.path.startsWith('/admin')) {
    req.subdomain = null;
    return next();
  }

  req.subdomain = subdomain;
  req.detectSubdomain = subdomain;
  next();
};

module.exports = detectSubdomain;