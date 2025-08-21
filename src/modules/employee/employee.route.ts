import express from 'express';
import { EmployeeHandler } from './employee.handler';
import { validateRequest } from '@/middlewares/zod-validate-request';
import { employeeZodSchema } from './employee.model';

const router = express.Router();

// GET /api/v1/employees - Get all employees with pagination and search
router.get('/', EmployeeHandler.getAllEmployees);

// GET /api/v1/employees/:id - Get a specific employee
router.get('/:id', EmployeeHandler.getEmployeeById);

// POST /api/v1/employees - Create a new employee
router.post(
  '/',
  validateRequest({ body: employeeZodSchema }),
  EmployeeHandler.createEmployee
);

// PUT /api/v1/employees/:id - Update an employee (partial update supported)
router.put(
  '/:id',
  validateRequest({ body: employeeZodSchema.partial() }),
  EmployeeHandler.updateEmployee
);

// DELETE /api/v1/employees/:id - Delete an employee
router.delete('/:id', EmployeeHandler.deleteEmployee);

// Filter routes for workflow
// GET /api/v1/employees/department/:department - Get employees by department
router.get('/department/:department', EmployeeHandler.getEmployeesByDepartment);

// GET /api/v1/employees/role/:departmentRole - Get employees by department role
router.get(
  '/role/:departmentRole',
  EmployeeHandler.getEmployeesByDepartmentRole
);

export default router;
