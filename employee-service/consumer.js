const amqp = require('amqplib');
const logger = require('./logger');

const QUEUE = 'employee_events';

const handleEvent = (event, data) => {
  switch (event) {
    case 'CREATED':
      logger.info(`[Consumer] Employee created — id: ${data?.id}, email: ${data?.email}`);
      break;
    case 'UPDATED':
      logger.info(`[Consumer] Employee updated — id: ${data?.id}`);
      break;
    case 'DELETED':
      logger.info(`[Consumer] Employee deleted — id: ${data?.id}`);
      break;
    default:
      logger.warn(`[Consumer] Unknown event: ${event}`);
  }
};

const startConsumer = async () => {
  const url = process.env.RABBITMQ_URL || 'amqp://rabbitmq:5672';

  const tryConnect = async (retries = 5, delay = 3000) => {
    for (let i = 0; i < retries; i++) {
      try {
        const connection = await amqp.connect(url);
        const channel    = await connection.createChannel();
        await channel.assertQueue(QUEUE, { durable: true });
        channel.prefetch(1);

        logger.info(`[Consumer] Listening on queue "${QUEUE}"…`);

        channel.consume(QUEUE, (msg) => {
          if (!msg) return;
          try {
            const { event, data } = JSON.parse(msg.content.toString());
            handleEvent(event, data);
            channel.ack(msg);
          } catch (err) {
            logger.error(`[Consumer] Failed to process message: ${err.message}`);
            channel.nack(msg, false, false); // discard malformed messages
          }
        });

        connection.on('error', (err) => logger.error(`[Consumer] Connection error: ${err.message}`));
        connection.on('close', ()    => { logger.warn('[Consumer] Connection closed — reconnecting…'); setTimeout(() => startConsumer(), 5000); });

        return; // success
      } catch (err) {
        logger.warn(`[Consumer] RabbitMQ not ready (attempt ${i + 1}/${retries}): ${err.message}`);
        if (i < retries - 1) await new Promise((r) => setTimeout(r, delay));
      }
    }
    logger.error('[Consumer] Could not connect to RabbitMQ after all retries — consumer disabled.');
  };

  await tryConnect();
};

module.exports = { startConsumer };
