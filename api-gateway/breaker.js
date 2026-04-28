const CircuitBreaker = require('opossum');
const axios = require('axios');

const options = {
  timeout: 3000, // Nëse shërbimi s'përgjigjet për 3 sekonda, dështo
  errorThresholdPercentage: 50, // Nëse 50% e kërkesave dështojnë, hap qarkun
  resetTimeout: 10000 // Provo pas 10 sekondash a është rregulluar
};

// Funksioni që bën thirrjen reale
const breaker = new CircuitBreaker(async (config) => axios(config), options);

// Fallback: Çfarë i kthehet përdoruesit kur shërbimi është DOWN
breaker.fallback(() => ({
  data: { status: 'error', message: 'Shërbimi i punonjësve është përkohësisht jashtë funksionit (Circuit Breaker).' }
}));

module.exports = breaker;