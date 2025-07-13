const redis = require('redis');
const logger = require('./logger');

let client;

const connectRedis = async () => {
  try {
    client = redis.createClient({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || 'redispassword123',
      retry_strategy: (options) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
          logger.error('Redis server connection refused');
          return new Error('Redis server connection refused');
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
          logger.error('Redis retry time exhausted');
          return new Error('Redis retry time exhausted');
        }
        if (options.attempt > 10) {
          logger.error('Redis max attempts reached');
          return undefined;
        }
        return Math.min(options.attempt * 100, 3000);
      }
    });

    client.on('error', (err) => {
      logger.error('Redis client error:', err);
    });

    client.on('connect', () => {
      logger.info('Redis client connected');
    });

    client.on('ready', () => {
      logger.info('Redis client ready');
    });

    // Set a timeout for connection
    const connectTimeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Redis connection timeout')), 5000)
    );
    
    await Promise.race([
      client.connect(),
      connectTimeout
    ]);
    
    // Test connection
    await client.ping();
    logger.info('Redis connection established successfully');
    
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    throw error;
  }
};

const getRedisClient = () => {
  if (!client) {
    throw new Error('Redis client not initialized');
  }
  return client;
};

// Cache utility functions
const cache = {
  get: async (key) => {
    try {
      const value = await client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Redis GET error:', error);
      return null;
    }
  },

  set: async (key, value, ttl = 3600) => {
    try {
      await client.setEx(key, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      logger.error('Redis SET error:', error);
      return false;
    }
  },

  del: async (key) => {
    try {
      await client.del(key);
      return true;
    } catch (error) {
      logger.error('Redis DEL error:', error);
      return false;
    }
  },

  exists: async (key) => {
    try {
      const result = await client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Redis EXISTS error:', error);
      return false;
    }
  },

  expire: async (key, ttl) => {
    try {
      await client.expire(key, ttl);
      return true;
    } catch (error) {
      logger.error('Redis EXPIRE error:', error);
      return false;
    }
  },

  // Session management
  setSession: async (sessionId, data, ttl = 86400) => {
    return await cache.set(`session:${sessionId}`, data, ttl);
  },

  getSession: async (sessionId) => {
    return await cache.get(`session:${sessionId}`);
  },

  deleteSession: async (sessionId) => {
    return await cache.del(`session:${sessionId}`);
  },

  // Rate limiting
  increment: async (key, ttl = 60) => {
    try {
      const current = await client.incr(key);
      if (current === 1) {
        await client.expire(key, ttl);
      }
      return current;
    } catch (error) {
      logger.error('Redis INCREMENT error:', error);
      return null;
    }
  }
};

module.exports = {
  connectRedis,
  getRedisClient,
  cache
};