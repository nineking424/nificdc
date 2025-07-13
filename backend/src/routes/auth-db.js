const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Joi = require('joi');
const router = express.Router();
const crypto = require('crypto');

const logger = require('../utils/logger');
const { cache } = require('../utils/redis');
const { User } = require('../models');

// Validation schemas
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required()
});

const registerSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid('admin', 'user').default('user')
});

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: User login with email
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', async (req, res, next) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required',
        details: error.details
      });
    }

    const { email, password } = value;
    
    // Find user by email
    const user = await User.findOne({
      where: { email, isActive: true }
    });

    if (!user) {
      logger.warn('Login attempt with invalid email', {
        email,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      logger.warn('Login attempt with invalid password', {
        email,
        userId: user.id,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Generate tokens
    const accessToken = jwt.sign(
      { 
        id: user.id,
        email: user.email,
        name: user.username,
        role: user.role
      },
      process.env.JWT_ACCESS_SECRET || 'access-secret',
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      {
        id: user.id,
        type: 'refresh'
      },
      process.env.JWT_REFRESH_SECRET || 'refresh-secret',
      { expiresIn: '7d' }
    );

    // Generate session ID
    const sessionId = crypto.randomBytes(32).toString('hex');

    // Store session in Redis
    const sessionData = {
      userId: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      loginAt: new Date().toISOString(),
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      refreshToken
    };
    await cache.setSession(sessionId, sessionData, 7 * 24 * 60 * 60); // 7 days

    // Update last login
    await user.update({ lastLoginAt: new Date() });

    // Prepare user permissions
    const permissions = user.role === 'admin' ? ['*'] : [
      'systems:read', 'systems:create', 'systems:update', 'systems:test',
      'data:read', 'data:create', 'data:update',
      'mappings:read', 'mappings:create', 'mappings:update'
    ];

    logger.info('User login successful', {
      userId: user.id,
      email: user.email,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.username,
          email: user.email,
          role: user.role,
          permissions
        },
        accessToken,
        refreshToken,
        expiresIn: 900, // 15 minutes in seconds
        sessionId
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed due to server error'
    });
  }
});

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     summary: User logout
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 */
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // Remove session from Redis
    const sessionId = req.headers['x-session-id'];
    if (sessionId) {
      await cache.deleteSession(sessionId);
    }
    
    logger.info('User logout', {
      userId: req.user.id,
      email: req.user.email,
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Logout failed'
    });
  }
});

/**
 * @swagger
 * /api/v1/auth/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'username', 'email', 'role', 'isActive', 'lastLoginAt', 'createdAt']
    });

    if (!user || !user.isActive) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const permissions = user.role === 'admin' ? ['*'] : [
      'systems:read', 'systems:create', 'systems:update', 'systems:test',
      'data:read', 'data:create', 'data:update',
      'mappings:read', 'mappings:create', 'mappings:update'
    ];

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.username,
        email: user.email,
        role: user.role,
        permissions,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    logger.error('Get user profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user profile'
    });
  }
});

/**
 * @swagger
 * /api/v1/auth/refresh:
 *   post:
 *     summary: Refresh JWT token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token refreshed
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        error: 'Refresh token required'
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'refresh-secret');

    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }

    // Find user
    const user = await User.findByPk(decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'User not found or inactive'
      });
    }

    // Generate new access token
    const accessToken = jwt.sign(
      { 
        id: user.id,
        email: user.email,
        name: user.username,
        role: user.role
      },
      process.env.JWT_ACCESS_SECRET || 'access-secret',
      { expiresIn: '15m' }
    );

    // Generate new refresh token
    const newRefreshToken = jwt.sign(
      {
        id: user.id,
        type: 'refresh'
      },
      process.env.JWT_REFRESH_SECRET || 'refresh-secret',
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token: accessToken,
      refreshToken: newRefreshToken,
      expiresIn: 900
    });
  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(401).json({
      success: false,
      error: 'Invalid refresh token'
    });
  }
});

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access token required'
    });
  }

  jwt.verify(token, process.env.JWT_ACCESS_SECRET || 'access-secret', (err, user) => {
    if (err) {
      logger.warn('Invalid token access attempt', {
        token: token.substring(0, 20) + '...',
        ip: req.ip,
        error: err.message
      });
      return res.status(403).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }
    req.user = user;
    next();
  });
}

module.exports = router;