import { Request, Response } from 'express';
import { TemplateService } from './template.services';
import Respond from '@/lib/respond';
import logger from '@/configs/logger';
import { paramStr } from '@/lib/param';

export class TemplateHandler {
  // Create template
  static async createTemplate(req: Request, res: Response) {
    try {
      const {
        name,
        description,
        role,
        frequency,
        departmentSlug,
        kpiName,
        template,
        createdBy,
        updatedBy,
      } = req.body;

      const newTemplate = await TemplateService.createTemplate({
        name,
        description,
        role,
        frequency,
        departmentSlug,
        kpiName,
        template,
        createdBy,
        updatedBy,
      });

      Respond(
        res,
        {
          template: newTemplate,
          message: 'Template created successfully',
        },
        201
      );
    } catch (error) {
      logger.error('Error creating template:', error);
      throw error;
    }
  }

  // Get template by ID
  static async getTemplateById(req: Request, res: Response) {
    try {
      const id = paramStr(req.params.id);

      const template = await TemplateService.getTemplateById(id);
      if (!template) {
        return Respond(
          res,
          {
            message: 'Template not found',
          },
          404
        );
      }

      Respond(
        res,
        {
          template,
          message: 'Template fetched successfully',
        },
        200
      );
    } catch (error) {
      logger.error('Error fetching template:', error);
      throw error;
    }
  }

  // Get all templates
  static async getAllTemplates(req: Request, res: Response) {
    try {
      const { page, limit, search, departmentSlug, frequency, role } =
        req.query;

      const filters = {
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 10,
        search: (search as string) || '',
        departmentSlug: (departmentSlug as string) || '',
        frequency: (frequency as string) || '',
        role: (role as string) || '',
      };

      const result = await TemplateService.getAllTemplates(filters);
      Respond(
        res,
        {
          ...result,
          message: 'Templates fetched successfully',
        },
        200
      );
    } catch (error) {
      logger.error('Error fetching templates:', error);
      throw error;
    }
  }

  // Update template
  static async updateTemplate(req: Request, res: Response) {
    try {
      const id = paramStr(req.params.id);
      const updates = req.body;

      const template = await TemplateService.updateTemplate(id, updates);

      Respond(
        res,
        {
          template,
          message: 'Template updated successfully',
        },
        200
      );
    } catch (error) {
      logger.error('Error updating template:', error);
      throw error;
    }
  }

  // Delete template
  static async deleteTemplate(req: Request, res: Response) {
    try {
      const id = paramStr(req.params.id);

      const template = await TemplateService.deleteTemplate(id);
      if (!template) {
        return Respond(
          res,
          {
            message: 'Template not found',
          },
          404
        );
      }

      Respond(
        res,
        {
          template,
          message: 'Template deleted successfully',
        },
        200
      );
    } catch (error) {
      logger.error('Error deleting template:', error);
      throw error;
    }
  }

  // Create template version
  static async createTemplateVersion(req: Request, res: Response) {
    try {
      const {
        templateId,
        version,
        name,
        description,
        role,
        frequency,
        departmentSlug,
        kpiName,
        template,
        createdBy,
      } = req.body;

      const newVersion = await TemplateService.createTemplateVersion({
        templateId,
        version,
        name,
        description,
        role,
        frequency,
        departmentSlug,
        kpiName,
        template,
        createdBy,
      });

      Respond(
        res,
        {
          version: newVersion,
          message: 'Template version created successfully',
        },
        201
      );
    } catch (error) {
      logger.error('Error creating template version:', error);
      throw error;
    }
  }

  // Get template versions
  static async getTemplateVersions(req: Request, res: Response) {
    try {
      const templateId = paramStr(req.params.templateId);

      const versions = await TemplateService.getTemplateVersions(templateId);
      Respond(
        res,
        {
          versions,
          message: 'Template versions fetched successfully',
        },
        200
      );
    } catch (error) {
      logger.error('Error fetching template versions:', error);
      throw error;
    }
  }

  // Get specific template version
  static async getTemplateVersion(req: Request, res: Response) {
    try {
      const templateId = paramStr(req.params.templateId);
      const version = paramStr(req.params.version);

      const templateVersion = await TemplateService.getTemplateVersion(
        templateId,
        parseInt(version, 10)
      );
      if (!templateVersion) {
        return Respond(
          res,
          {
            message: 'Template version not found',
          },
          404
        );
      }

      Respond(
        res,
        {
          version: templateVersion,
          message: 'Template version fetched successfully',
        },
        200
      );
    } catch (error) {
      logger.error('Error fetching template version:', error);
      throw error;
    }
  }

  // Get templates by department
  static async getTemplatesByDepartment(req: Request, res: Response) {
    try {
      const departmentSlug = paramStr(req.params.departmentSlug);

      const templates =
        await TemplateService.getTemplatesByDepartment(departmentSlug);
      Respond(
        res,
        {
          templates,
          message: 'Department templates fetched successfully',
        },
        200
      );
    } catch (error) {
      logger.error('Error fetching department templates:', error);
      throw error;
    }
  }

  // Get templates by frequency
  static async getTemplatesByFrequency(req: Request, res: Response) {
    try {
      const { frequency } = req.params;

      const templates = await TemplateService.getTemplatesByFrequency(
        frequency as any
      );
      Respond(
        res,
        {
          templates,
          message: 'Frequency templates fetched successfully',
        },
        200
      );
    } catch (error) {
      logger.error('Error fetching frequency templates:', error);
      throw error;
    }
  }

  // Get templates by role
  static async getTemplatesByRole(req: Request, res: Response) {
    try {
      const role = paramStr(req.params.role);

      const templates = await TemplateService.getTemplatesByRole(role);
      Respond(
        res,
        {
          templates,
          message: 'Role templates fetched successfully',
        },
        200
      );
    } catch (error) {
      logger.error('Error fetching role templates:', error);
      throw error;
    }
  }

  // Get templates by employee department
  static async getTemplatesByEmployeeDepartment(req: Request, res: Response) {
    try {
      const employeeId = paramStr(req.params.employeeId);

      const templates =
        await TemplateService.getTemplatesByEmployeeDepartment(employeeId);
      Respond(
        res,
        {
          templates,
          message: 'Employee department templates fetched successfully',
        },
        200
      );
    } catch (error) {
      logger.error('Error fetching employee department templates:', error);
      throw error;
    }
  }

  // Generate form structure from template
  static async generateFormStructure(req: Request, res: Response) {
    try {
      const templateId = paramStr(req.params.templateId);

      const formStructure =
        await TemplateService.generateFormStructure(templateId);
      Respond(
        res,
        {
          formStructure,
          message: 'Form structure generated successfully',
        },
        200
      );
    } catch (error) {
      logger.error('Error generating form structure:', error);
      throw error;
    }
  }
}
