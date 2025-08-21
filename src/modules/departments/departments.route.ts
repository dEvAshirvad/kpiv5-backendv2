import express from 'express';
import { DepartmentHandler } from './departments.handler';

const router = express.Router();

// GET /api/v1/departments - Get all departments with pagination and search
router.get('/', DepartmentHandler.getDepartments);

// GET /api/v1/departments/:id - Get a specific department
router.get('/:id', DepartmentHandler.getDepartment);

// POST /api/v1/departments - Create a new department
router.post('/', DepartmentHandler.createDepartment);

// PUT /api/v1/departments/:id - Update a department
router.put('/:id', DepartmentHandler.updateDepartment);

// DELETE /api/v1/departments/:id - Delete a department
router.delete('/:id', DepartmentHandler.deleteDepartment);

export default router;
