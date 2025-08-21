import { Request, Response } from 'express';
import { EntryService } from './entry.services';
import Respond from '@/lib/respond';
import logger from '@/configs/logger';
import APIError from '@/lib/errors/APIError';

export class EntryHandler {
  // Create entry
  static async createEntry(req: Request, res: Response) {
    try {
      const {
        employeeId,
        templateId,
        month,
        year,
        kpiNames,
        values,
        score,
        status,
        dataSource,
      } = req.body;

      const newEntry = await EntryService.createEntry({
        employeeId,
        templateId,
        month,
        year,
        kpiNames,
        values,
        score,
        status,
        dataSource,
      });

      Respond(
        res,
        {
          entry: newEntry,
          message: 'Entry created successfully',
        },
        201
      );
    } catch (error) {
      logger.error('Error creating entry:', error);
      throw error;
    }
  }

  // Get entry by ID
  static async getEntryById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const entry = await EntryService.getEntryById(id);
      if (!entry) {
        return Respond(
          res,
          {
            message: 'Entry not found',
          },
          404
        );
      }

      Respond(
        res,
        {
          entry,
          message: 'Entry fetched successfully',
        },
        200
      );
    } catch (error) {
      logger.error('Error fetching entry:', error);
      throw error;
    }
  }

  // Get all entries
  static async getAllEntries(req: Request, res: Response) {
    try {
      const {
        page,
        limit,
        search,
        employeeId,
        templateId,
        month,
        year,
        status,
      } = req.query;

      const filters = {
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 10,
        search: (search as string) || '',
        employeeId: (employeeId as string) || '',
        templateId: (templateId as string) || '',
        month: (month as string) || '',
        year: (year as string) || '',
        status: (status as string) || '',
      };

      const result = await EntryService.getAllEntries(filters);
      Respond(
        res,
        {
          ...result,
          message: 'Entries fetched successfully',
        },
        200
      );
    } catch (error) {
      logger.error('Error fetching entries:', error);
      throw error;
    }
  }

  // Update entry
  static async updateEntry(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const entry = await EntryService.updateEntry(id, updates);

      Respond(
        res,
        {
          entry,
          message: 'Entry updated successfully',
        },
        200
      );
    } catch (error) {
      logger.error('Error updating entry:', error);
      throw error;
    }
  }

  // Delete entry
  static async deleteEntry(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const entry = await EntryService.deleteEntry(id);
      if (!entry) {
        return Respond(
          res,
          {
            message: 'Entry not found',
          },
          404
        );
      }

      Respond(
        res,
        {
          entry,
          message: 'Entry deleted successfully',
        },
        200
      );
    } catch (error) {
      logger.error('Error deleting entry:', error);
      throw error;
    }
  }

  // Get entries by employee
  static async getEntriesByEmployee(req: Request, res: Response) {
    try {
      const { employeeId } = req.params;

      const entries = await EntryService.getEntriesByEmployee(employeeId);
      Respond(
        res,
        {
          entries,
          message: 'Employee entries fetched successfully',
        },
        200
      );
    } catch (error) {
      logger.error('Error fetching employee entries:', error);
      throw error;
    }
  }

  // Get entries by template
  static async getEntriesByTemplate(req: Request, res: Response) {
    try {
      const { templateId } = req.params;

      const entries = await EntryService.getEntriesByTemplate(templateId);
      Respond(
        res,
        {
          entries,
          message: 'Template entries fetched successfully',
        },
        200
      );
    } catch (error) {
      logger.error('Error fetching template entries:', error);
      throw error;
    }
  }

  // Get entries by month and year
  static async getEntriesByMonthYear(req: Request, res: Response) {
    try {
      const { month, year } = req.params;

      const entries = await EntryService.getEntriesByMonthYear(
        parseInt(month),
        parseInt(year)
      );
      Respond(
        res,
        {
          entries,
          message: 'Month-year entries fetched successfully',
        },
        200
      );
    } catch (error) {
      logger.error('Error fetching month-year entries:', error);
      throw error;
    }
  }

  // Get entries by status
  static async getEntriesByStatus(req: Request, res: Response) {
    try {
      const { status } = req.params;

      const entries = await EntryService.getEntriesByStatus(status as any);
      Respond(
        res,
        {
          entries,
          message: 'Status entries fetched successfully',
        },
        200
      );
    } catch (error) {
      logger.error('Error fetching status entries:', error);
      throw error;
    }
  }

  // Update entry status
  static async updateEntryStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const entry = await EntryService.updateEntryStatus(id, status);

      Respond(
        res,
        {
          entry,
          message: 'Entry status updated successfully',
        },
        200
      );
    } catch (error) {
      logger.error('Error updating entry status:', error);
      throw error;
    }
  }

  // Check if entry exists
  static async checkEntryExists(req: Request, res: Response) {
    try {
      const { employeeId, templateId, month, year } = req.params;

      const exists = await EntryService.checkEntryExists(
        employeeId,
        templateId,
        parseInt(month),
        parseInt(year)
      );

      Respond(
        res,
        {
          exists,
          message: 'Entry existence checked successfully',
        },
        200
      );
    } catch (error) {
      logger.error('Error checking entry existence:', error);
      throw error;
    }
  }

  // Get entry by employee, template, month, year
  static async getEntryByEmployeeTemplateMonthYear(
    req: Request,
    res: Response
  ) {
    try {
      const { employeeId, templateId, month, year } = req.params;

      const entry = await EntryService.getEntryByEmployeeTemplateMonthYear(
        employeeId,
        templateId,
        parseInt(month),
        parseInt(year)
      );

      if (!entry) {
        return Respond(
          res,
          {
            message: 'Entry not found',
          },
          404
        );
      }

      Respond(
        res,
        {
          entry,
          message: 'Entry fetched successfully',
        },
        200
      );
    } catch (error) {
      logger.error('Error fetching entry:', error);
      throw error;
    }
  }

  // Workflow: Get or create entry for employee, template, month, year
  static async getOrCreateEntryForWorkflow(req: Request, res: Response) {
    try {
      const { employeeId, templateId, month, year } = req.params;

      const result = await EntryService.getOrCreateEntryForWorkflow(
        employeeId,
        templateId,
        parseInt(month),
        parseInt(year)
      );

      Respond(
        res,
        {
          ...result,
          message: result.message,
        },
        200
      );
    } catch (error) {
      logger.error('Error in workflow get or create entry:', error);
      throw error;
    }
  }

  // Workflow: Get available months and years for employee and template
  static async getAvailableMonthsYears(req: Request, res: Response) {
    try {
      const { employeeId, templateId } = req.params;

      const entries = await EntryService.getAvailableMonthsYears(
        employeeId,
        templateId
      );
      Respond(
        res,
        {
          entries,
          message: 'Available months and years fetched successfully',
        },
        200
      );
    } catch (error) {
      logger.error('Error fetching available months and years:', error);
      throw error;
    }
  }

  // Workflow: Get entry summary for employee
  static async getEntrySummaryForEmployee(req: Request, res: Response) {
    try {
      const { employeeId } = req.params;

      const summary = await EntryService.getEntrySummaryForEmployee(employeeId);
      Respond(
        res,
        {
          summary,
          message: 'Entry summary fetched successfully',
        },
        200
      );
    } catch (error) {
      logger.error('Error in getEntrySummaryForEmployee:', error);
      if (error instanceof APIError) {
        Respond(res, { message: error.message }, error.statusCode);
      } else {
        Respond(res, { message: 'Internal server error' }, 500);
      }
    }
  }

  static async searchEntries(req: Request, res: Response) {
    try {
      const { employeeId, templateId, month, year, kpiNames } = req.query;

      // Parse query parameters
      const searchCriteria: any = {};

      if (employeeId) {
        searchCriteria.employeeId = employeeId as string;
      }

      if (templateId) {
        searchCriteria.templateId = templateId as string;
      }

      if (month) {
        searchCriteria.month = parseInt(month as string, 10);
      }

      if (year) {
        searchCriteria.year = parseInt(year as string, 10);
      }

      if (kpiNames) {
        try {
          // Parse kpiNames as JSON array if it's a string
          const parsedKpiNames =
            typeof kpiNames === 'string' ? JSON.parse(kpiNames) : kpiNames;

          if (Array.isArray(parsedKpiNames)) {
            searchCriteria.kpiNames = parsedKpiNames;
          }
        } catch (parseError) {
          return Respond(
            res,
            { message: 'Invalid kpiNames format. Expected JSON array.' },
            400
          );
        }
      }

      const entries = await EntryService.searchEntries(searchCriteria);
      Respond(
        res,
        {
          entries,
          message: 'Entries searched successfully',
        },
        200
      );
    } catch (error) {
      logger.error('Error in searchEntries:', error);
      if (error instanceof APIError) {
        Respond(res, { message: error.message }, error.statusCode);
      } else {
        Respond(res, { message: 'Internal server error' }, 500);
      }
    }
  }

  static async getStatistics(req: Request, res: Response) {
    try {
      const { department, role, month, year } = req.query;

      // Parse query parameters
      const filters: any = {};

      if (department) {
        filters.department = department as string;
      }

      if (role) {
        filters.role = role as string;
      }

      if (month) {
        filters.month = parseInt(month as string, 10);
      }

      if (year) {
        filters.year = parseInt(year as string, 10);
      }

      const statistics = await EntryService.getStatistics(filters);
      Respond(
        res,
        {
          ...statistics,
          message: 'Statistics fetched successfully',
        },
        200
      );
    } catch (error) {
      logger.error('Error in getStatistics:', error);
      if (error instanceof APIError) {
        Respond(res, { message: error.message }, error.statusCode);
      } else {
        Respond(res, { message: 'Internal server error' }, 500);
      }
    }
  }
}
