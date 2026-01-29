import { Request, Response } from 'express';
import { EmployeeService } from './employee.services';
import Respond from '@/lib/respond';
import logger from '@/configs/logger';
import { paramStr } from '@/lib/param';

export class EmployeeHandler {
  static async createEmployee(req: Request, res: Response) {
    try {
      const { name, contact, department, departmentRole, metadata } = req.body;

      const employee = await EmployeeService.createEmployee({
        name,
        contact,
        department,
        departmentRole,
        metadata,
      });

      Respond(
        res,
        {
          employee,
          message: 'Employee created successfully',
        },
        201
      );
    } catch (error) {
      logger.error('Error creating employee:', error);
      throw error;
    }
  }

  static async getEmployeeById(req: Request, res: Response) {
    try {
      const id = paramStr(req.params.id);

      const employee = await EmployeeService.getEmployeeById(id);
      if (!employee) {
        return Respond(
          res,
          {
            message: 'Employee not found',
          },
          404
        );
      }

      Respond(
        res,
        {
          employee,
          message: 'Employee fetched successfully',
        },
        200
      );
    } catch (error) {
      logger.error('Error fetching employee:', error);
      throw error;
    }
  }

  static async getAllEmployees(req: Request, res: Response) {
    try {
      const { page, limit, search } = req.query;

      const filters = {
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 10,
        search: (search as string) || '',
      };

      const result = await EmployeeService.getAllEmployees(filters);
      Respond(
        res,
        {
          ...result,
          message: 'Employees fetched successfully',
        },
        200
      );
    } catch (error) {
      logger.error('Error fetching employees:', error);
      throw error;
    }
  }

  static async updateEmployee(req: Request, res: Response) {
    try {
      const id = paramStr(req.params.id);
      const updates = req.body;

      const employee = await EmployeeService.updateEmployee(id, updates);

      if (!employee) {
        return Respond(
          res,
          {
            message: 'Employee not found',
          },
          404
        );
      }

      Respond(
        res,
        {
          employee,
          message: 'Employee updated successfully',
        },
        200
      );
    } catch (error) {
      logger.error('Error updating employee:', error);
      throw error;
    }
  }

  static async deleteEmployee(req: Request, res: Response) {
    try {
      const id = paramStr(req.params.id);

      const employee = await EmployeeService.deleteEmployee(id);
      if (!employee) {
        return Respond(
          res,
          {
            message: 'Employee not found',
          },
          404
        );
      }

      Respond(
        res,
        {
          employee,
          message: 'Employee deleted successfully',
        },
        200
      );
    } catch (error) {
      logger.error('Error deleting employee:', error);
      throw error;
    }
  }

  // Get employees by department
  static async getEmployeesByDepartment(req: Request, res: Response) {
    try {
      const department = paramStr(req.params.department);
      const { page, limit, search } = req.query;

      const employees = await EmployeeService.getEmployeesByDepartment(
        department,
        {
          page: page ? parseInt(page as string) : 1,
          limit: limit ? parseInt(limit as string) : 10,
          search: search as string,
        }
      );
      Respond(
        res,
        {
          ...employees,
          message: 'Department employees fetched successfully',
        },
        200
      );
    } catch (error) {
      logger.error('Error fetching department employees:', error);
      throw error;
    }
  }

  // Get employees by department role
  static async getEmployeesByDepartmentRole(req: Request, res: Response) {
    try {
      const departmentRole = paramStr(req.params.departmentRole);
      const { page, limit, search } = req.query;

      const employees = await EmployeeService.getEmployeesByDepartmentRole(
        departmentRole,
        {
          page: page ? parseInt(page as string) : 1,
          limit: limit ? parseInt(limit as string) : 10,
          search: search as string,
        }
      );
      Respond(
        res,
        {
          ...employees,
          message: 'Department role employees fetched successfully',
        },
        200
      );
    } catch (error) {
      logger.error('Error fetching department role employees:', error);
      throw error;
    }
  }
}
