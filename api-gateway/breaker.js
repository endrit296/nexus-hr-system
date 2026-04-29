const CircuitBreaker = require('opossum');
const axios          = require('axios');

const options = {
  timeout:                  3000,  // ms before a single call is considered failed
  errorThresholdPercentage: 50,    // open circuit when >50% of calls fail
  resetTimeout:             10000, // attempt recovery after 10 s
};

// One breaker instance per downstream service URL
const breakers = new Map();

/**
 * Returns (creating if needed) the CircuitBreaker for a given service.
 * The wrapped action does a lightweight health probe to the service root;
 * a network error (ECONNREFUSED / timeout) counts as a failure and moves
 * the breaker toward the OPEN state.  A 404 means the service is reachable
 * (it just has no root handler) and is treated as a success.
 */
const getBreakerFor = (serviceUrl) => {
  if (!breakers.has(serviceUrl)) {
    const probe = () =>
      axios.get(`${serviceUrl}/health`, {
        timeout:        2500,
        validateStatus: () => true, // never throw on HTTP status — only on network errors
      });

    const breaker = new CircuitBreaker(probe, options);

    breaker.on('open',     () => console.warn(`[CircuitBreaker] OPEN  — ${serviceUrl}`));
    breaker.on('halfOpen', () => console.info(`[CircuitBreaker] HALF-OPEN — ${serviceUrl}`));
    breaker.on('close',    () => console.info(`[CircuitBreaker] CLOSED — ${serviceUrl}`));

    breakers.set(serviceUrl, breaker);
  }
  return breakers.get(serviceUrl);
};

module.exports = { getBreakerFor };
