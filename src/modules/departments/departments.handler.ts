import { Request, Response } from 'express';
import { DepartmentService } from './department.services';
import Respond from '@/lib/respond';
import logger from '@/configs/logger';

export class DepartmentHandler {
  static async createDepartment(req: Request, res: Response) {
    try {
      const { name, slug, logo, metadata } = req.body;

      const department = await DepartmentService.createDepartment({
        name,
        slug,
        logo,
        metadata,
      });

      Respond(
        res,
        {
          department,
          message: 'Department created successfully',
        },
        201
      );
    } catch (error: any) {
      logger.error('Error creating department:', error);
      Respond(
        res,
        {
          message: error.message || 'Failed to create department',
        },
        400
      );
    }
  }

  static async getDepartment(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const department = await DepartmentService.getDepartment(id);
      if (!department) {
        return Respond(
          res,
          {
            message: 'Department not found',
          },
          404
        );
      }

      Respond(
        res,
        {
          department,
          message: 'Department fetched successfully',
        },
        200
      );
    } catch (error: any) {
      logger.error('Error fetching department:', error);
      Respond(
        res,
        {
          message: error.message || 'Failed to fetch department',
        },
        400
      );
    }
  }

  static async getDepartments(req: Request, res: Response) {
    try {
      const { page, limit, search } = req.query;

      const filters = {
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 10,
        search: (search as string) || '',
      };

      const result = await DepartmentService.getDepartments(filters);
      Respond(
        res,
        {
          ...result,
          message: 'Departments fetched successfully',
        },
        200
      );
    } catch (error: any) {
      logger.error('Error fetching departments:', error);
      Respond(
        res,
        {
          message: error.message || 'Failed to fetch departments',
        },
        400
      );
    }
  }

  static async updateDepartment(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name, slug, logo, metadata } = req.body;

      const department = await DepartmentService.updateDepartment(id, {
        name,
        slug,
        logo,
        metadata,
      });

      if (!department) {
        return Respond(
          res,
          {
            message: 'Department not found',
          },
          404
        );
      }

      Respond(
        res,
        {
          department,
          message: 'Department updated successfully',
        },
        200
      );
    } catch (error: any) {
      logger.error('Error updating department:', error);
      Respond(
        res,
        {
          message: error.message || 'Failed to update department',
        },
        400
      );
    }
  }

  static async deleteDepartment(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const department = await DepartmentService.deleteDepartment(id);
      if (!department) {
        return Respond(
          res,
          {
            message: 'Department not found',
          },
          404
        );
      }

      Respond(
        res,
        {
          department,
          message: 'Department deleted successfully',
        },
        200
      );
    } catch (error: any) {
      logger.error('Error deleting department:', error);
      Respond(
        res,
        {
          message: error.message || 'Failed to delete department',
        },
        400
      );
    }
  }
}
