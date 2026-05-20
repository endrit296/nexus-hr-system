const amqp   = require('amqplib');
const logger = require('./logger');
const { getRabbitMqUrl } = require('./runtimeConfig');

let hasLoggedRabbitMqDisabled = false;

const sendToQueue = async (queue, message) => {
  const rabbitMqUrl = getRabbitMqUrl();

  if (!rabbitMqUrl) {
    if (!hasLoggedRabbitMqDisabled) {
      logger.info('[Messenger] RABBITMQ_URL is not configured; event publishing disabled.');
      hasLoggedRabbitMqDisabled = true;
    }
    return false;
  }

  let connection;
  try {
    connection = await amqp.connect(rabbitMqUrl);
    const channel = await connection.createChannel();
    await channel.assertQueue(queue, { durable: true });
    channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), { persistent: true });
    await channel.close();
    logger.info(`[Messenger] Event published to "${queue}": ${message.event}`);
    return true;
  } catch (err) {
    logger.error(`[Messenger] Failed to publish to "${queue}": ${err.message}`);
    return false;
  } finally {
    if (connection) connection.close().catch(() => {});
  }
};

module.exports = { sendToQueue };
