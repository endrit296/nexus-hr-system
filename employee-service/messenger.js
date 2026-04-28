const amqp = require('amqplib');

const sendToQueue = async (queue, message) => {
  try {
    // Lidhja me RabbitMQ duke përdorur emrin e shërbimit nga Docker
    const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://rabbitmq:5672');
    const channel = await connection.createChannel();
    
    // Sigurohemi që radha (queue) ekziston
    await channel.assertQueue(queue, { durable: true });
    
    // Dërgimi i mesazhit
    channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), { persistent: true });
    
    console.log(` ✅ Event u dërgua te RabbitMQ: ${message.event}`);
    
    // Mbyllim lidhjen pas pak sekondash
    setTimeout(() => connection.close(), 500);
  } catch (error) {
    console.error(' ❌ RabbitMQ Error:', error);
  }
};

module.exports = { sendToQueue };