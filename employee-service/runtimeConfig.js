const getPort = () => process.env.PORT || '3002';

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

const getPublicBaseUrl = () => getGatewayUrl() || getServiceUrl();

const getRabbitMqUrl = () => process.env.RABBITMQ_URL || null;

const isGrpcEnabled = () => {
  if (typeof process.env.ENABLE_GRPC !== 'undefined') {
    return process.env.ENABLE_GRPC === 'true';
  }

  return Boolean(process.env.GRPC_PORT) || process.env.NODE_ENV !== 'production';
};

module.exports = {
  getGatewayUrl,
  getPort,
  getPublicBaseUrl,
  getRabbitMqUrl,
  getServiceUrl,
  isGrpcEnabled,
};
