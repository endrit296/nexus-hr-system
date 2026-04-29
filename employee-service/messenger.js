const amqp   = require('amqplib');
const logger = require('./logger');

const sendToQueue = async (queue, message) => {
  let connection;
  try {
    connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://rabbitmq:5672');
    const channel = await connection.createChannel();
    await channel.assertQueue(queue, { durable: true });
    channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), { persistent: true });
    await channel.close();
    logger.info(`[Messenger] Event published to "${queue}": ${message.event}`);
  } catch (err) {
    logger.error(`[Messenger] Failed to publish to "${queue}": ${err.message}`);
  } finally {
    if (connection) connection.close().catch(() => {});
  }
};

module.exports = { sendToQueue };
