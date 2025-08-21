import APIError from '@/lib/errors/APIError';
import {
  KPITemplateModel,
  KPITemplateVersionModel,
  KPITemplate,
  KPITemplateVersion,
} from './template.model';

export class TemplateService {
  // Create new template
  static async createTemplate(
    template: Omit<KPITemplate, 'createdAt' | 'updatedAt'>
  ) {
    try {
      const newTemplate = await KPITemplateModel.create(template);
      return newTemplate;
    } catch (error) {
      throw error;
    }
  }

  // Get template by ID
  static async getTemplateById(id: string) {
    try {
      const template = await KPITemplateModel.findById(id).lean();
      return template;
    } catch (error) {
      throw error;
    }
  }

  // Get all templates with pagination and search
  static async getAllTemplates({
    page = 1,
    limit = 10,
    search = '',
    departmentSlug = '',
    frequency = '',
    role = '',
  }: {
    page?: number;
    limit?: number;
    search?: string;
    departmentSlug?: string;
    frequency?: string;
    role?: string;
  }) {
    try {
      const searchQuery: any = {};

      // Add search functionality
      if (search) {
        searchQuery.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { role: { $regex: search, $options: 'i' } },
        ];
      }

      // Add filters
      if (departmentSlug) {
        searchQuery.departmentSlug = departmentSlug;
      }

      if (frequency) {
        searchQuery.frequency = frequency;
      }

      if (role) {
        searchQuery.role = role;
      }

      const [templates, total] = await Promise.all([
        KPITemplateModel.find(searchQuery)
          .skip((page - 1) * limit)
          .limit(limit)
          .sort({ createdAt: -1 })
          .lean(),
        KPITemplateModel.countDocuments(searchQuery),
      ]);

      return {
        docs: templates,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPreviousPage: page > 1,
      };
    } catch (error) {
      throw error;
    }
  }

  // Update template
  static async updateTemplate(id: string, updates: Partial<KPITemplate>) {
    try {
      const updatedTemplate = await KPITemplateModel.findByIdAndUpdate(
        id,
        updates,
        { new: true }
      ).lean();

      if (!updatedTemplate) {
        throw new APIError({
          STATUS: 404,
          TITLE: 'Template not found',
          MESSAGE: 'Template not found',
        });
      }

      return updatedTemplate;
    } catch (error) {
      throw error;
    }
  }

  // Delete template
  static async deleteTemplate(id: string) {
    try {
      const deletedTemplate = await KPITemplateModel.findByIdAndDelete(id);
      return deletedTemplate;
    } catch (error) {
      throw error;
    }
  }

  // Create template version
  static async createTemplateVersion(
    version: Omit<KPITemplateVersion, 'createdAt' | 'updatedAt'>
  ) {
    try {
      const newVersion = await KPITemplateVersionModel.create(version);
      return newVersion;
    } catch (error) {
      throw error;
    }
  }

  // Get template versions by template ID
  static async getTemplateVersions(templateId: string) {
    try {
      const versions = await KPITemplateVersionModel.find({ templateId })
        .sort({ version: -1 })
        .lean();
      return versions;
    } catch (error) {
      throw error;
    }
  }

  // Get specific template version
  static async getTemplateVersion(templateId: string, version: number) {
    try {
      const templateVersion = await KPITemplateVersionModel.findOne({
        templateId,
        version,
      }).lean();
      return templateVersion;
    } catch (error) {
      throw error;
    }
  }

  // Get templates by department
  static async getTemplatesByDepartment(departmentSlug: string) {
    try {
      const templates = await KPITemplateModel.find({ departmentSlug })
        .sort({ createdAt: -1 })
        .lean();
      return templates;
    } catch (error) {
      throw error;
    }
  }

  // Get templates by frequency
  static async getTemplatesByFrequency(
    frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly'
  ) {
    try {
      const templates = await KPITemplateModel.find({ frequency })
        .sort({ createdAt: -1 })
        .lean();
      return templates;
    } catch (error) {
      throw error;
    }
  }

  // Get templates by role
  static async getTemplatesByRole(role: string) {
    try {
      const templates = await KPITemplateModel.find({ role })
        .sort({ createdAt: -1 })
        .lean();
      return templates;
    } catch (error) {
      throw error;
    }
  }

  // Get templates by employee department and role
  static async getTemplatesByEmployeeDepartment(employeeId: string) {
    try {
      // First get employee details
      const { EmployeeModal } = await import('../employee/employee.model');
      const employee = await EmployeeModal.findById(employeeId).lean();

      if (!employee) {
        throw new APIError({
          STATUS: 404,
          TITLE: 'Employee not found',
          MESSAGE: 'Employee not found',
        });
      }

      // Get templates by department slug and role
      const templates = await KPITemplateModel.find({
        departmentSlug: employee.department,
        role: employee.departmentRole,
      })
        .sort({ createdAt: -1 })
        .lean();

      return templates;
    } catch (error) {
      throw error;
    }
  }

  // Generate form structure from template
  static async generateFormStructure(templateId: string) {
    try {
      const template = await KPITemplateModel.findById(templateId).lean();

      if (!template) {
        throw new APIError({
          STATUS: 404,
          TITLE: 'Template not found',
          MESSAGE: 'Template not found',
        });
      }

      // Generate form structure based on template
      const formStructure = {
        templateId: template._id,
        templateName: template.name,
        templateDescription: template.description,
        frequency: template.frequency,
        role: template.role,
        departmentSlug: template.departmentSlug,
        kpis: template.template.map((kpi) => ({
          name: kpi.name,
          description: kpi.description,
          maxMarks: kpi.maxMarks,
          kpiType: kpi.kpiType,
          metric: kpi.metric,
          kpiUnit: kpi.kpiUnit,
          isDynamic: kpi.isDynamic,
          key: kpi.name.toLowerCase().replace(/[^a-z0-9]/g, ''),
          subKpis: kpi.subKpis || [],
        })),
      };

      return formStructure;
    } catch (error) {
      throw error;
    }
  }
}
