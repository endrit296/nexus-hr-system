const getRequiredEnv = (name) => {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }

  return value;
};

const getPort = () => process.env.PORT || '3001';

const getMongoDbUri = () => {
  const uri = getRequiredEnv('MONGODB_URI').trim();

  if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
    throw new Error('MONGODB_URI must start with "mongodb://" or "mongodb+srv://"');
  }

  return uri;
};

const getServiceUrl = () =>
  process.env.SERVICE_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  `http://localhost:${getPort()}`;

const getGatewayUrl = () => {
  if (process.env.GATEWAY_URL) {
    return process.env.GATEWAY_URL;
  }

  if (process.env.GATEWAY_HOST) {
    const gatewayPort = process.env.GATEWAY_PORT || '8080';
    return `http://${process.env.GATEWAY_HOST}:${gatewayPort}`;
  }

  return null;
};

module.exports = { getGatewayUrl, getMongoDbUri, getPort, getRequiredEnv, getServiceUrl };
