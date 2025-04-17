const axios = require('axios');
const dns = require('dns').promises;
const db = require('../config/db');
const { DNS_STATUS_ENUM } = require('../config/constants');

const GODADDY_API_KEY = 'dKDJbfGMpaPY_NiLK98qrrzUYHgNXXPSzqS';
const GODADDY_API_SECRET = 'LkBbW4pjZdc2Un9Ru1VwTG';
const SERVER_IP = '139.59.3.58';

const addSubdomain = async (subdomain) => {
  try {
    const response = await axios.put(
      `https://api.godaddy.com/v1/domains/begrat.com/records/A/${subdomain}`,
      [{ data: SERVER_IP }],
      {
        headers: {
          Authorization: `sso-key ${GODADDY_API_KEY}:${GODADDY_API_SECRET}`,
        },
      }
    );
    console.log(`Subdomain ${subdomain}.begrat.com created`);
    return response.data;
  } catch (error) {
    console.error(`GoDaddy DNS Error for ${subdomain}:`, error.response?.data || error.message);
    throw new Error('Failed to create subdomain');
  }
};

const checkDomain = async (domain, expectedIP = SERVER_IP) => {
  try {
    const records = await dns.resolve(domain, 'A');
    const isValid = records.includes(expectedIP);
    return {
      status: isValid ? 'verified' : 'unverified',
      records,
    };
  } catch (error) {
    console.error(`DNS Check Error for ${domain}:`, error);
    return {
      status: 'error',
      error: error.message,
    };
  }
};

const verifyTenantDomain = async (tenantId, domain) => {
  const result = await checkDomain(domain);
  const status = DNS_STATUS_ENUM.includes(result.status) ? result.status : 'pending';

  await db.update(
    'tbl_settings',
    {
      dns_status: status,
      updated_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    },
    'tenant_id = ?',
    [tenantId]
  );

  await db.insert('tbl_domain_logs', {
    tenant_id: tenantId,
    domain,
    status,
    message: result.error || 'DNS check completed',
    created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
  });

  return result;
};

module.exports = { addSubdomain, checkDomain, verifyTenantDomain };