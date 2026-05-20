const getRequiredEnv = (name) => {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }

  return value;
};

const getPort = () => Number(process.env.PORT || 8080);

const getServiceUrl = () =>
  process.env.SERVICE_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  `http://localhost:${getPort()}`;

const DEFAULT_CORS_ORIGINS = [
  'http://localhost:5173',
  'http://localhost',
  'https://localhost',
  'https://nexus-hr-frontend.onrender.com',
];

const parseCsv = (value) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const getAllowedOrigins = () => {
  const configured = process.env.CORS_ALLOWED_ORIGINS;

  if (configured) {
    return parseCsv(configured);
  }

  return DEFAULT_CORS_ORIGINS;
};

module.exports = { getAllowedOrigins, getPort, getRequiredEnv, getServiceUrl };
