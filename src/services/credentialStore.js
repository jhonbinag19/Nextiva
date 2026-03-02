const { Redis } = require('@upstash/redis');
const logger = require('../utils/logger');

let redis = null;

/**
 * Initialize Redis client lazily (only when first needed).
 * Requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars.
 */
const getRedis = () => {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    return null;
  }

  redis = new Redis({ url, token });
  return redis;
};

/**
 * Build the Redis key for a location's Thrio credentials.
 * @param {string} locationId
 * @returns {string}
 */
const credKey = (locationId) => `thrio_creds:${locationId}`;

/**
 * Store Thrio credentials for a location.
 * @param {string} locationId
 * @param {Object} credentials - { username, password }
 * @param {string} [ghlApiKey] - Optional GHL API key to store alongside
 * @returns {Object} { success: boolean, message?: string }
 */
const storeCredentials = async (locationId, { username, password }, ghlApiKey = null) => {
  const client = getRedis();
  if (!client) {
    return { success: false, message: 'Redis not configured (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN)' };
  }

  try {
    const payload = { username, password, locationId };
    if (ghlApiKey) {
      payload.ghlApiKey = ghlApiKey;
    }
    payload.updatedAt = new Date().toISOString();

    await client.set(credKey(locationId), JSON.stringify(payload));
    logger.info('Stored Thrio credentials in Redis for location:', locationId);
    return { success: true };
  } catch (error) {
    logger.error('Failed to store credentials in Redis:', error.message);
    return { success: false, message: error.message };
  }
};

/**
 * Retrieve stored Thrio credentials for a location.
 * @param {string} locationId
 * @returns {Object} { success: boolean, credentials?: { username, password, locationId, ghlApiKey? } }
 */
const getCredentials = async (locationId) => {
  const client = getRedis();
  if (!client) {
    return { success: false, message: 'Redis not configured' };
  }

  try {
    const raw = await client.get(credKey(locationId));
    if (!raw) {
      return { success: false, message: 'No credentials found for this location' };
    }

    const credentials = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!credentials.username || !credentials.password) {
      return { success: false, message: 'Stored credentials are incomplete' };
    }

    return { success: true, credentials };
  } catch (error) {
    logger.error('Failed to retrieve credentials from Redis:', error.message);
    return { success: false, message: error.message };
  }
};

/**
 * Delete stored credentials for a location.
 * @param {string} locationId
 * @returns {Object} { success: boolean }
 */
const deleteCredentials = async (locationId) => {
  const client = getRedis();
  if (!client) {
    return { success: false, message: 'Redis not configured' };
  }

  try {
    await client.del(credKey(locationId));
    return { success: true };
  } catch (error) {
    logger.error('Failed to delete credentials from Redis:', error.message);
    return { success: false, message: error.message };
  }
};

/**
 * Check if Redis is available and configured.
 * @returns {boolean}
 */
const isAvailable = () => {
  return !!getRedis();
};

module.exports = {
  storeCredentials,
  getCredentials,
  deleteCredentials,
  isAvailable
};
