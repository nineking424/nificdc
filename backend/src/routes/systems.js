const express = require('express');
const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     System:
 *       type: object
 *       required:
 *         - name
 *         - type
 *         - connectionInfo
 *       properties:
 *         id:
 *           type: string
 *           description: System ID
 *         name:
 *           type: string
 *           description: System name
 *         type:
 *           type: string
 *           enum: [oracle, postgresql, sqlite, ftp, local_fs]
 *           description: System type
 *         connectionInfo:
 *           type: object
 *           description: Connection information (encrypted)
 *         isActive:
 *           type: boolean
 *           description: Whether the system is active
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/v1/systems:
 *   get:
 *     summary: Get all systems
 *     tags: [Systems]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of systems
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/System'
 */
router.get('/', (req, res) => {
  // Mock data - replace with database query
  const systems = [
    {
      id: '1',
      name: 'Oracle Production DB',
      type: 'oracle',
      connectionInfo: { encrypted: true },
      isActive: true,
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z'
    }
  ];
  
  res.json(systems);
});

/**
 * @swagger
 * /api/v1/systems/{id}:
 *   get:
 *     summary: Get system by ID
 *     tags: [Systems]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: System ID
 *     responses:
 *       200:
 *         description: System details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/System'
 *       404:
 *         description: System not found
 */
router.get('/:id', (req, res) => {
  res.json({ message: 'Get system by ID', id: req.params.id });
});

/**
 * @swagger
 * /api/v1/systems:
 *   post:
 *     summary: Create new system
 *     tags: [Systems]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/System'
 *     responses:
 *       201:
 *         description: System created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/System'
 */
router.post('/', (req, res) => {
  res.status(201).json({ message: 'Create system', data: req.body });
});

/**
 * @swagger
 * /api/v1/systems/{id}:
 *   put:
 *     summary: Update system
 *     tags: [Systems]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: System ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/System'
 *     responses:
 *       200:
 *         description: System updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/System'
 *       404:
 *         description: System not found
 */
router.put('/:id', (req, res) => {
  res.json({ message: 'Update system', id: req.params.id, data: req.body });
});

/**
 * @swagger
 * /api/v1/systems/{id}:
 *   delete:
 *     summary: Delete system
 *     tags: [Systems]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: System ID
 *     responses:
 *       204:
 *         description: System deleted
 *       404:
 *         description: System not found
 */
router.delete('/:id', (req, res) => {
  res.status(204).send();
});

/**
 * @swagger
 * /api/v1/systems/{id}/test:
 *   post:
 *     summary: Test system connection
 *     tags: [Systems]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: System ID
 *     responses:
 *       200:
 *         description: Connection test result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 responseTime:
 *                   type: number
 */
router.post('/:id/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Connection successful',
    responseTime: 120
  });
});

module.exports = router;