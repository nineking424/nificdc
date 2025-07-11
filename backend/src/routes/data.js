const express = require('express');
const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     DataSchema:
 *       type: object
 *       required:
 *         - systemId
 *         - name
 *         - schemaDefinition
 *       properties:
 *         id:
 *           type: string
 *           description: Schema ID
 *         systemId:
 *           type: string
 *           description: System ID
 *         name:
 *           type: string
 *           description: Schema name
 *         version:
 *           type: integer
 *           description: Schema version
 *         schemaDefinition:
 *           type: object
 *           description: Schema definition (JSON)
 *         createdAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/v1/data:
 *   get:
 *     summary: Get all data schemas
 *     tags: [Data Schemas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: systemId
 *         schema:
 *           type: string
 *         description: Filter by system ID
 *     responses:
 *       200:
 *         description: List of data schemas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/DataSchema'
 */
router.get('/', (req, res) => {
  const { systemId } = req.query;
  
  // Mock data - replace with database query
  let schemas = [
    {
      id: '1',
      systemId: '1',
      name: 'User Table',
      version: 1,
      schemaDefinition: {
        type: 'table',
        columns: [
          { name: 'id', type: 'NUMBER', primaryKey: true },
          { name: 'username', type: 'VARCHAR2(50)', nullable: false },
          { name: 'email', type: 'VARCHAR2(100)', nullable: true }
        ]
      },
      createdAt: '2023-01-01T00:00:00Z'
    }
  ];
  
  if (systemId) {
    schemas = schemas.filter(s => s.systemId === systemId);
  }
  
  res.json(schemas);
});

/**
 * @swagger
 * /api/v1/data/{id}:
 *   get:
 *     summary: Get data schema by ID
 *     tags: [Data Schemas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Schema ID
 *     responses:
 *       200:
 *         description: Data schema details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DataSchema'
 *       404:
 *         description: Schema not found
 */
router.get('/:id', (req, res) => {
  res.json({ message: 'Get data schema by ID', id: req.params.id });
});

/**
 * @swagger
 * /api/v1/data:
 *   post:
 *     summary: Create new data schema
 *     tags: [Data Schemas]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DataSchema'
 *     responses:
 *       201:
 *         description: Data schema created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DataSchema'
 */
router.post('/', (req, res) => {
  res.status(201).json({ message: 'Create data schema', data: req.body });
});

/**
 * @swagger
 * /api/v1/data/{id}:
 *   put:
 *     summary: Update data schema
 *     tags: [Data Schemas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Schema ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DataSchema'
 *     responses:
 *       200:
 *         description: Data schema updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DataSchema'
 *       404:
 *         description: Schema not found
 */
router.put('/:id', (req, res) => {
  res.json({ message: 'Update data schema', id: req.params.id, data: req.body });
});

/**
 * @swagger
 * /api/v1/data/{id}:
 *   delete:
 *     summary: Delete data schema
 *     tags: [Data Schemas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Schema ID
 *     responses:
 *       204:
 *         description: Data schema deleted
 *       404:
 *         description: Schema not found
 */
router.delete('/:id', (req, res) => {
  res.status(204).send();
});

module.exports = router;