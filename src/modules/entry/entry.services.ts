import APIError from '@/lib/errors/APIError';
import { EntryModel, Entry } from './entry.model';
import { KPITemplateModel } from '../template/template.model';
import { EmployeeModal } from '../employee/employee.model';
import { DepartmentModel } from '../departments/departments.model';
import { db } from '@/configs/db/mongodb';
import { FilterQuery } from 'mongoose';
import puppeteer from 'puppeteer';
import logger from '@/configs/logger';

export class EntryService {
  // Create new entry with template validation
  static async createEntry(entry: Omit<Entry, 'createdAt' | 'updatedAt'>) {
    try {
      // Validate against template
      const template = await KPITemplateModel.findById(entry.templateId);
      if (!template) {
        throw new APIError({
          STATUS: 404,
          TITLE: 'Template not found',
          MESSAGE: 'Template not found',
        });
      }

      // Use kpiNames as provided - no validation against template
      // kpiNames are used for uniqueness to allow multiple entries for same employee in same month
      const finalKpiNames = entry.kpiNames || [];

      // Calculate scores automatically based on template maxMarks
      const calculatedValues = entry.values.map((entryValue) => {
        // Try multiple matching strategies for KPI keys
        let templateKpi = template.template.find(
          (kpi) => kpi.name === entryValue.key
        );

        if (!templateKpi) {
          // Try normalized matching (remove special chars, lowercase)
          templateKpi = template.template.find(
            (kpi) =>
              kpi.name.toLowerCase().replace(/[^a-z0-9]/g, '') ===
              entryValue.key.toLowerCase().replace(/[^a-z0-9]/g, '')
          );
        }

        if (!templateKpi) {
          // Try exact name matching
          templateKpi = template.template.find(
            (kpi) => kpi.name.toLowerCase() === entryValue.key.toLowerCase()
          );
        }

        if (!templateKpi) {
          console.log(
            'Available template KPIs:',
            template.template.map((k) => k.name)
          );
          console.log('Trying to match key:', entryValue.key);
          throw new APIError({
            STATUS: 400,
            TITLE: 'Invalid KPI key',
            MESSAGE: `KPI key not found in template: ${entryValue.key}. Available KPIs: ${template.template.map((k) => k.name).join(', ')}`,
          });
        }

        // Calculate value from sub-KPIs using template metric formula
        let calculatedValue = entryValue.value || 0;

        console.log('Template KPI:', {
          name: templateKpi.name,
          maxMarks: templateKpi.maxMarks,
        });
        console.log('Entry value:', entryValue);

        // Calculate value: if sub-KPIs exist, use metric formula; otherwise use direct value
        if (entryValue.subKpis && entryValue.subKpis.length > 0) {
          // Use sub-KPIs to calculate value using metric formula
          const darjValue =
            entryValue.subKpis.find((sk) => sk.key === 'darj')?.value || 0;
          const nirakritValue =
            entryValue.subKpis.find((sk) => sk.key === 'nirakrit')?.value || 0;

          console.log('Sub-KPI values:', { darjValue, nirakritValue });

          // Apply metric formula: (completed_tasks / total_tasks) * 100
          if (darjValue > 0) {
            calculatedValue = (nirakritValue / darjValue) * 100;
            console.log('Calculated value from sub-KPIs:', calculatedValue);
          }
        } else {
          // No sub-KPIs provided, use direct value
          calculatedValue = entryValue.value || 0;
          console.log('Using direct value:', calculatedValue);
        }

        // Calculate score: (value / 100) * maxMarks
        const calculatedScore = (calculatedValue / 100) * templateKpi.maxMarks;

        return {
          ...entryValue,
          value: calculatedValue,
          score: calculatedScore,
        };
      });

      // Calculate total score
      const totalScore = calculatedValues.reduce(
        (sum, value) => sum + (value.score || 0),
        0
      );

      // Validate values structure against template
      for (const templateKpi of template.template) {
        // Try multiple matching strategies for KPI keys
        let entryValue = calculatedValues.find(
          (v) => v.key === templateKpi.name
        );

        if (!entryValue) {
          // Try normalized matching
          entryValue = calculatedValues.find(
            (v) =>
              v.key.toLowerCase().replace(/[^a-z0-9]/g, '') ===
              templateKpi.name.toLowerCase().replace(/[^a-z0-9]/g, '')
          );
        }

        if (!entryValue) {
          // Try exact name matching
          entryValue = calculatedValues.find(
            (v) => v.key.toLowerCase() === templateKpi.name.toLowerCase()
          );
        }

        if (!entryValue) {
          throw new APIError({
            STATUS: 400,
            TITLE: 'Invalid KPI values',
            MESSAGE: `Missing value for KPI: ${templateKpi.name}`,
          });
        }

        // Validate sub-KPIs only if template has them and entry provides them
        if (
          templateKpi.subKpis &&
          templateKpi.subKpis.length > 0 &&
          entryValue.subKpis &&
          entryValue.subKpis.length > 0
        ) {
          const templateSubKpiKeys = templateKpi.subKpis.map((sk) => sk.key);
          const entrySubKpiKeys = entryValue.subKpis.map((sk) => sk.key);

          const missingSubKpis = templateSubKpiKeys.filter(
            (key) => !entrySubKpiKeys.includes(key)
          );
          if (missingSubKpis.length > 0) {
            throw new APIError({
              STATUS: 400,
              TITLE: 'Invalid sub-KPIs',
              MESSAGE: `Missing sub-KPIs for ${templateKpi.name}: ${missingSubKpis.join(', ')}`,
            });
          }
        }
      }

      const newEntry = await EntryModel.create({
        ...entry,
        kpiNames: finalKpiNames,
        values: calculatedValues,
        score: totalScore,
      });
      return newEntry;
    } catch (error) {
      throw error;
    }
  }

  // Get statistics aggregated for all departments
  static async getAllDepartmentStats(filters: {
    month?: number;
    year?: number;
  }) {
    try {
      const now = new Date();
      // Default to previous month and current year (handles Jan -> Dec of previous year)
      const currentMonthIndex = now.getMonth(); // 0-based (Oct -> 9)
      const previousMonthNumber =
        currentMonthIndex === 0 ? 12 : currentMonthIndex; // 1-12
      const defaultYear =
        currentMonthIndex === 0 ? now.getFullYear() - 1 : now.getFullYear();

      const month = filters.month ?? previousMonthNumber;
      const year = filters.year ?? defaultYear;

      // Fetch all templates once to map templateId -> departmentSlug
      const templates = await KPITemplateModel.find()
        .select('_id departmentSlug template role name description frequency')
        .lean();

      const templateIdToDepartment = new Map<string, string>();
      const templateIdToTemplate = new Map<string, any>();
      templates.forEach((tpl: any) => {
        templateIdToDepartment.set(tpl._id.toString(), tpl.departmentSlug);
        templateIdToTemplate.set(tpl._id.toString(), tpl);
      });

      // Get entries for month/year with employee and template context
      const entryQuery: FilterQuery<Entry> = {
        month,
        year,
        status: 'generated',
      };
      const entries = await EntryModel.find(entryQuery).lean();

      // Build full enriched list for ranking (employee + template + score)
      const employeeIds = [...new Set(entries.map((e) => e.employeeId))];
      const employees = await EmployeeModal.find({ _id: { $in: employeeIds } })
        .select('name contact department departmentRole')
        .lean();
      const employeeMap = new Map<string, any>();
      employees.forEach((emp: any) => employeeMap.set(emp._id.toString(), emp));

      // Aggregate by departmentSlug
      const departmentStats: Record<
        string,
        {
          department: string;
          totalEntries: number;
          averageScore: number;
          maxScore: number;
          minScore: number;
        }
      > = {};

      for (const entry of entries) {
        const dept = templateIdToDepartment.get(entry.templateId?.toString());
        if (!dept) continue;

        const key = dept;
        if (!departmentStats[key]) {
          departmentStats[key] = {
            department: dept,
            totalEntries: 0,
            averageScore: 0,
            maxScore: Number.NEGATIVE_INFINITY,
            minScore: Number.POSITIVE_INFINITY,
          };
        }

        const stat = departmentStats[key];
        const score = entry.score || 0;
        stat.totalEntries += 1;
        stat.averageScore += score;
        stat.maxScore = Math.max(stat.maxScore, score);
        stat.minScore = Math.min(stat.minScore, score);
      }

      // Finalize averages and handle empty departments
      Object.values(departmentStats).forEach((s) => {
        if (s.totalEntries > 0) {
          s.averageScore =
            Math.round((s.averageScore / s.totalEntries) * 100) / 100;
        } else {
          s.averageScore = 0;
          s.maxScore = 0;
          s.minScore = 0;
        }
      });

      // Return as array for stable order
      const statsArray = Object.values(departmentStats).map((s) => ({
        department: s.department,
        totalEntries: s.totalEntries,
        averageScore: s.averageScore,
        maxScore: s.maxScore === Number.NEGATIVE_INFINITY ? 0 : s.maxScore,
        minScore: s.minScore === Number.POSITIVE_INFINITY ? 0 : s.minScore,
      }));

      return {
        filters: { month, year },
        totalDepartments: statsArray.length,
        totalEntries: entries.length,
        stats: statsArray,
      };
    } catch (error) {
      throw error;
    }
  }

  // Get entry by ID
  static async getEntryById(id: string) {
    try {
      const entry = await EntryModel.findById(id)
        .populate('employeeId', 'name contact department')
        .populate('templateId', 'name description role frequency')
        .lean();
      return entry;
    } catch (error) {
      throw error;
    }
  }

  // Get all entries with pagination and search
  static async getAllEntries({
    page = 1,
    limit = 10,
    search = '',
    employeeId = '',
    templateId = '',
    month = '',
    year = '',
    status = '',
  }: {
    page?: number;
    limit?: number;
    search?: string;
    employeeId?: string;
    templateId?: string;
    month?: string;
    year?: string;
    status?: string;
  }) {
    try {
      const searchQuery: any = {};

      // Add search functionality
      if (search) {
        searchQuery.$or = [
          { 'kpiNames.label': { $regex: search, $options: 'i' } },
        ];
      }

      // Add filters
      if (employeeId) {
        searchQuery.employeeId = employeeId;
      }

      if (templateId) {
        searchQuery.templateId = templateId;
      }

      if (month) {
        searchQuery.month = parseInt(month);
      }

      if (year) {
        searchQuery.year = parseInt(year);
      }

      if (status) {
        searchQuery.status = status;
      }

      const [entries, total] = await Promise.all([
        EntryModel.find(searchQuery)
          .populate('employeeId', 'name contact department')
          .populate('templateId', 'name description role frequency')
          .skip((page - 1) * limit)
          .limit(limit)
          .sort({ createdAt: -1 })
          .lean(),
        EntryModel.countDocuments(searchQuery),
      ]);

      return {
        docs: entries,
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

  // Update entry
  static async updateEntry(id: string, updates: Partial<Entry>) {
    try {
      // If values are being updated, recalculate scores
      if (updates.values) {
        const entry = await EntryModel.findById(id);
        if (!entry) {
          throw new APIError({
            STATUS: 404,
            TITLE: 'Entry not found',
            MESSAGE: 'Entry not found',
          });
        }

        const template = await KPITemplateModel.findById(entry.templateId);
        if (!template) {
          throw new APIError({
            STATUS: 404,
            TITLE: 'Template not found',
            MESSAGE: 'Template not found',
          });
        }

        // Calculate scores automatically based on template maxMarks
        const calculatedValues = updates.values.map((entryValue) => {
          // Try multiple matching strategies for KPI keys
          let templateKpi = template.template.find(
            (kpi) => kpi.name === entryValue.key
          );

          if (!templateKpi) {
            // Try normalized matching (remove special chars, lowercase)
            templateKpi = template.template.find(
              (kpi) =>
                kpi.name.toLowerCase().replace(/[^a-z0-9]/g, '') ===
                entryValue.key.toLowerCase().replace(/[^a-z0-9]/g, '')
            );
          }

          if (!templateKpi) {
            // Try exact name matching
            templateKpi = template.template.find(
              (kpi) => kpi.name.toLowerCase() === entryValue.key.toLowerCase()
            );
          }

          if (!templateKpi) {
            console.log(
              'Available template KPIs:',
              template.template.map((k) => k.name)
            );
            console.log('Trying to match key:', entryValue.key);
            throw new APIError({
              STATUS: 400,
              TITLE: 'Invalid KPI key',
              MESSAGE: `KPI key not found in template: ${entryValue.key}. Available KPIs: ${template.template.map((k) => k.name).join(', ')}`,
            });
          }

          // Calculate value from sub-KPIs using template metric formula
          let calculatedValue = entryValue.value || 0;

          console.log('Template KPI:', {
            name: templateKpi.name,
            maxMarks: templateKpi.maxMarks,
          });
          console.log('Entry value:', entryValue);

          // Calculate value: if sub-KPIs exist, use metric formula; otherwise use direct value
          if (entryValue.subKpis && entryValue.subKpis.length > 0) {
            // Use sub-KPIs to calculate value using metric formula
            const darjValue =
              entryValue.subKpis.find((sk) => sk.key === 'darj')?.value || 0;
            const nirakritValue =
              entryValue.subKpis.find((sk) => sk.key === 'nirakrit')?.value ||
              0;

            console.log('Sub-KPI values:', { darjValue, nirakritValue });

            // Apply metric formula: (completed_tasks / total_tasks) * 100
            if (darjValue > 0) {
              calculatedValue = (nirakritValue / darjValue) * 100;
              console.log('Calculated value from sub-KPIs:', calculatedValue);
            }
          } else {
            // No sub-KPIs provided, use direct value
            calculatedValue = entryValue.value || 0;
            console.log('Using direct value:', calculatedValue);
          }

          // Calculate score: (value / 100) * maxMarks
          const calculatedScore =
            (calculatedValue / 100) * templateKpi.maxMarks;

          return {
            ...entryValue,
            value: calculatedValue,
            score: calculatedScore,
          };
        });

        // Calculate total score
        const totalScore = calculatedValues.reduce(
          (sum, value) => sum + (value.score || 0),
          0
        );

        updates.values = calculatedValues;
        updates.score = totalScore;
      }

      const updatedEntry = await EntryModel.findByIdAndUpdate(id, updates, {
        new: true,
      })
        .populate('employeeId', 'name contact department')
        .populate('templateId', 'name description role frequency')
        .lean();

      if (!updatedEntry) {
        throw new APIError({
          STATUS: 404,
          TITLE: 'Entry not found',
          MESSAGE: 'Entry not found',
        });
      }

      return updatedEntry;
    } catch (error) {
      throw error;
    }
  }

  // Delete entry
  static async deleteEntry(id: string) {
    try {
      const deletedEntry = await EntryModel.findByIdAndDelete(id);
      return deletedEntry;
    } catch (error) {
      throw error;
    }
  }

  // Get entries by employee
  static async getEntriesByEmployee(employeeId: string) {
    try {
      const entries = await EntryModel.find({ employeeId })
        .populate('employeeId', 'name contact department')
        .populate('templateId', 'name description role frequency')
        .sort({ createdAt: -1 })
        .lean();
      return entries;
    } catch (error) {
      throw error;
    }
  }

  // Get entries by template
  static async getEntriesByTemplate(templateId: string) {
    try {
      const entries = await EntryModel.find({ templateId })
        .populate('employeeId', 'name contact department')
        .populate('templateId', 'name description role frequency')
        .sort({ createdAt: -1 })
        .lean();
      return entries;
    } catch (error) {
      throw error;
    }
  }

  // Get entries by month and year
  static async getEntriesByMonthYear(month: number, year: number) {
    try {
      const entries = await EntryModel.find({ month, year })
        .populate('employeeId', 'name contact department')
        .populate('templateId', 'name description role frequency')
        .sort({ createdAt: -1 })
        .lean();
      return entries;
    } catch (error) {
      throw error;
    }
  }

  // Get entries by status
  static async getEntriesByStatus(
    status: 'initiated' | 'inprogress' | 'generated'
  ) {
    try {
      const entries = await EntryModel.find({ status })
        .populate('employeeId', 'name contact department')
        .populate('templateId', 'name description role frequency')
        .sort({ createdAt: -1 })
        .lean();
      return entries;
    } catch (error) {
      throw error;
    }
  }

  // Update entry status
  static async updateEntryStatus(
    id: string,
    status: 'initiated' | 'inprogress' | 'generated'
  ) {
    try {
      const updatedEntry = await EntryModel.findByIdAndUpdate(
        id,
        { status },
        { new: true }
      )
        .populate('employeeId', 'name contact department')
        .populate('templateId', 'name description role frequency')
        .lean();

      if (!updatedEntry) {
        throw new APIError({
          STATUS: 404,
          TITLE: 'Entry not found',
          MESSAGE: 'Entry not found',
        });
      }

      return updatedEntry;
    } catch (error) {
      throw error;
    }
  }

  // Check if entry exists for employee, template, month, year
  static async checkEntryExists(
    employeeId: string,
    templateId: string,
    month: number,
    year: number
  ) {
    try {
      const entry = await EntryModel.findOne({
        employeeId,
        templateId,
        month,
        year,
      });
      return !!entry;
    } catch (error) {
      throw error;
    }
  }

  // Get entry by employee, template, month, year
  static async getEntryByEmployeeTemplateMonthYear(
    employeeId: string,
    templateId: string,
    month: number,
    year: number
  ) {
    try {
      const entry = await EntryModel.findOne({
        employeeId,
        templateId,
        month,
        year,
      })
        .populate('employeeId', 'name contact department')
        .populate('templateId', 'name description role frequency')
        .lean();
      return entry;
    } catch (error) {
      throw error;
    }
  }

  // Workflow: Get or create entry for employee, template, month, year
  static async getOrCreateEntryForWorkflow(
    employeeId: string,
    templateId: string,
    month: number,
    year: number
  ) {
    try {
      // Check if entry exists
      const existingEntry = await EntryModel.findOne({
        employeeId,
        templateId,
        month,
        year,
      })
        .populate('employeeId', 'name contact department')
        .populate('templateId', 'name description role frequency')
        .lean();

      if (existingEntry) {
        return {
          entry: existingEntry,
          isNew: false,
          message: 'Existing entry found',
        };
      }

      // Get template to create new entry
      const { KPITemplateModel } = await import('../template/template.model');
      const template = await KPITemplateModel.findById(templateId).lean();

      if (!template) {
        throw new APIError({
          STATUS: 404,
          TITLE: 'Template not found',
          MESSAGE: 'Template not found',
        });
      }

      // Validate template structure
      if (
        !template.template ||
        !Array.isArray(template.template) ||
        template.template.length === 0
      ) {
        throw new APIError({
          STATUS: 400,
          TITLE: 'Invalid template structure',
          MESSAGE: 'Template has no KPIs defined',
        });
      }

      // Create new entry with empty kpiNames - should be provided by user for uniqueness
      const kpiNames: Array<{ label: string; value?: string }> = [];

      const values = template.template.map((kpi) => {
        // Ensure kpi.name exists and is a string
        if (!kpi.name || typeof kpi.name !== 'string') {
          throw new APIError({
            STATUS: 400,
            TITLE: 'Invalid template structure',
            MESSAGE: `KPI name is missing or invalid in template: ${JSON.stringify(kpi)}`,
          });
        }

        const key = kpi.name.toLowerCase().replace(/[^a-z0-9]/g, '');

        // Ensure subKpis has at least 2 items as required by the schema
        const subKpis =
          kpi.subKpis && kpi.subKpis.length >= 2
            ? kpi.subKpis.map((sk) => ({
                key: sk.key,
                value: 0,
              }))
            : [
                { key: 'darj', value: 0 },
                { key: 'nirakrit', value: 0 },
              ];

        return {
          key,
          value: 0,
          score: 0,
          subKpis,
        };
      });

      const newEntry = await EntryModel.create({
        employeeId,
        templateId,
        month,
        year,
        kpiNames,
        values,
        score: 0,
        status: 'initiated',
        dataSource: 'manual',
      });

      const populatedEntry = await EntryModel.findById(newEntry._id)
        .populate('employeeId', 'name contact department')
        .populate('templateId', 'name description role frequency')
        .lean();

      return {
        entry: populatedEntry,
        isNew: true,
        message: 'New entry created',
      };
    } catch (error) {
      throw error;
    }
  }

  // Workflow: Get available months and years for employee and template
  static async getAvailableMonthsYears(employeeId: string, templateId: string) {
    try {
      const entries = await EntryModel.find({ employeeId, templateId })
        .select('month year status')
        .sort({ year: -1, month: -1 })
        .lean();

      return entries;
    } catch (error) {
      throw error;
    }
  }

  // Workflow: Get entry summary for employee
  static async getEntrySummaryForEmployee(employeeId: string) {
    try {
      const entries = await EntryModel.find({ employeeId })
        .populate('templateId', 'name')
        .sort({ year: -1, month: -1 })
        .lean();

      const summary = entries.reduce(
        (acc: Record<string, Record<string, any>>, entry) => {
          const templateName = (entry.templateId as any).name;
          const key = `${entry.year}-${entry.month.toString().padStart(2, '0')}`;

          if (!acc[templateName]) {
            acc[templateName] = {};
          }

          acc[templateName][key] = {
            entryId: entry._id,
            status: entry.status,
            score: entry.score,
            month: entry.month,
            year: entry.year,
          };

          return acc;
        },
        {}
      );

      return summary;
    } catch (error) {
      throw error;
    }
  }

  static async searchEntries(searchCriteria: {
    employeeId?: string;
    templateId?: string;
    month?: number;
    year?: number;
    kpiNames?: Array<{ label: string; value?: string }>;
  }) {
    try {
      const { employeeId, templateId, month, year, kpiNames } = searchCriteria;

      // Build query object
      const query: any = {};

      if (employeeId) {
        query.employeeId = employeeId;
      }

      if (templateId) {
        query.templateId = templateId;
      }

      if (month !== undefined) {
        query.month = month;
      }

      if (year !== undefined) {
        query.year = year;
      }

      if (kpiNames && kpiNames.length > 0) {
        // Search for entries that have any of the specified KPI names
        const kpiLabels = kpiNames.map((kpi) => kpi.label);
        query['kpiNames.label'] = { $in: kpiLabels };

        // If specific values are provided, also match them
        const kpiNamesWithValues = kpiNames.filter((kpi) => kpi.value);
        if (kpiNamesWithValues.length > 0) {
          const kpiNameQueries = kpiNamesWithValues.map((kpi) => ({
            'kpiNames.label': kpi.label,
            'kpiNames.value': kpi.value,
          }));
          query.$or = kpiNameQueries;
        }
      }

      const entries = await EntryModel.find(query)
        .populate('employeeId', 'name contact department departmentRole')
        .populate(
          'templateId',
          'name description role frequency departmentSlug'
        )
        .sort({ createdAt: -1 })
        .lean();

      return entries;
    } catch (error) {
      throw error;
    }
  }

  // Get statistics and ranking data (Optimized - Department and Role Required)
  static async getStatistics(filters: {
    department: string;
    role: string;
    month?: number;
    year?: number;
    page?: number;
    limit?: number;
  }) {
    try {
      const { department, role, month, year, page = 1, limit = 20 } = filters;

      // Default month/year to previous month and current year (Jan -> Dec of prev year)
      const now = new Date();
      const currentMonthIndex = now.getMonth(); // 0-based
      const defaultMonth = currentMonthIndex === 0 ? 12 : currentMonthIndex;
      const defaultYear =
        currentMonthIndex === 0 ? now.getFullYear() - 1 : now.getFullYear();
      const resolvedMonth = month ?? defaultMonth;
      const resolvedYear = year ?? defaultYear;

      // Validate required parameters
      if (!department || !role) {
        throw new APIError({
          STATUS: 400,
          TITLE: 'Missing Required Parameters',
          MESSAGE:
            'Department and role are required for statistics calculation as ranking is relative to specific department and role context',
        });
      }

      // Find template by department and role first
      const template = await KPITemplateModel.findOne({
        departmentSlug: department,
        role: role,
      })
        .select('_id name description role frequency departmentSlug template')
        .lean();

      if (!template) {
        throw new APIError({
          STATUS: 404,
          TITLE: 'Template Not Found',
          MESSAGE: `No template found for department: ${department} and role: ${role}`,
        });
      }

      // Build optimized query - filter by templateId, month, and year at database level
      const entryQuery: any = {
        templateId: template._id,
        month: resolvedMonth,
        year: resolvedYear,
      };

      // Get entries directly filtered by templateId, month, and year
      const allEntries = await EntryModel.find(entryQuery)
        .sort({ score: -1 })
        .lean();

      // Get unique employee IDs from filtered entries
      const employeeIds = [
        ...new Set(allEntries.map((entry) => entry.employeeId)),
      ];

      // Fetch employee data
      const employees = await EmployeeModal.find({ _id: { $in: employeeIds } })
        .select('name contact department departmentRole')
        .lean();

      // Create lookup map for employees - use string keys for reliable lookup
      const employeeMap = new Map();
      employees.forEach((emp: any) => {
        const idStr = emp._id.toString();
        employeeMap.set(idStr, emp);
        // Also store with the raw _id in case it's different
        employeeMap.set(emp._id, emp);
      });

      console.log('Employee Map Size:', employeeMap.size);
      console.log('Employee Map Keys:', Array.from(employeeMap.keys()));
      console.log('Sample Entry employeeId:', allEntries[0]?.employeeId);
      console.log(
        'Employee Map has entry employeeId?',
        employeeMap.has(allEntries[0]?.employeeId)
      );
      console.log('Sample Employee:', employees[0]);

      // Filter entries to exclude orphaned entries (missing employees)
      const filteredEntries = allEntries.filter((entry) => {
        const employee = employeeMap.get(entry.employeeId);
        return employee !== undefined; // Only include entries with valid employees
      });

      const entries = filteredEntries;

      // Process entries with employee and template data
      const allRanking = entries
        .map((entry, index) => {
          const employee = employeeMap.get(entry.employeeId);

          // Skip entries with missing employees
          if (!employee) {
            return null;
          }

          return {
            entryId: entry._id,
            employee: {
              _id: employee._id,
              name: employee.name,
              contact: employee.contact,
              department: employee.department,
              departmentRole: employee.departmentRole,
            },
            template: {
              _id: template._id,
              name: template.name,
              description: template.description,
              role: template.role,
              frequency: template.frequency,
              departmentSlug: template.departmentSlug,
            },
            month: entry.month,
            year: entry.year,
            score: entry.score,
            maxScore: template.template.reduce((total: number, kpi: any) => {
              return total + (kpi.maxMarks || 0);
            }, 0),
            status: entry.status,
            kpiNames: entry.kpiNames,
            values: entry.values,
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt,
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

      // Apply pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const ranking = allRanking
        .slice(startIndex, endIndex)
        .map((entry, index) => ({
          ...entry,
          rank: index + 1, // Rank relative to current page (starts from 1)
        }));
      const totalRanking = allRanking.length;

      // Calculate statistics using all ranking data
      const totalEntries = allRanking.length;
      const averageScore =
        totalEntries > 0
          ? allRanking.reduce((sum, entry) => sum + (entry.score || 0), 0) /
            totalEntries
          : 0;
      const maxScore =
        totalEntries > 0
          ? Math.max(...allRanking.map((entry) => entry.score || 0))
          : 0;
      const minScore =
        totalEntries > 0
          ? Math.min(...allRanking.map((entry) => entry.score || 0))
          : 0;

      // Score distribution relative to the topper (normalize to 10 CGPA scale)
      const topScore = maxScore; // topper's raw score in this department+role for month/year
      const distribution = {
        excellent: 0,
        good: 0,
        average: 0,
        poor: 0,
      };
      if (topScore > 0 && totalEntries > 0) {
        for (const e of allRanking) {
          const normalized = ((e.score || 0) / topScore) * 10; // 0..10
          if (normalized >= 9 && normalized <= 10) {
            distribution.excellent++;
          } else if (normalized >= 7 && normalized < 9) {
            distribution.good++;
          } else if (normalized >= 4 && normalized < 7) {
            distribution.average++;
          } else {
            distribution.poor++;
          }
        }
      } else if (totalEntries > 0) {
        // When topScore is 0, all are zero → classify as poor
        distribution.poor = totalEntries;
      }
      const distributionPercent =
        totalEntries > 0
          ? {
              excellent:
                Math.round((distribution.excellent / totalEntries) * 10000) /
                100,
              good:
                Math.round((distribution.good / totalEntries) * 10000) / 100,
              average:
                Math.round((distribution.average / totalEntries) * 10000) / 100,
              poor:
                Math.round((distribution.poor / totalEntries) * 10000) / 100,
            }
          : { excellent: 0, good: 0, average: 0, poor: 0 };

      // Compute top/bottom arrays based on custom rules
      const sortedByScore = [...allRanking].sort(
        (a, b) => (b.score || 0) - (a.score || 0)
      );
      let topBottomCount = Math.max(1, Math.ceil(totalEntries * 0.05));
      if (totalEntries < 10) {
        topBottomCount = 1;
      } else if (totalEntries > 15) {
        topBottomCount = 5;
      }
      const topFivePercent = sortedByScore.slice(0, topBottomCount);
      const bottomFivePercent = sortedByScore.slice(-topBottomCount);

      return {
        filters: {
          department,
          role,
          month: resolvedMonth,
          year: resolvedYear,
          page,
          limit,
        },
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalRanking / limit),
          totalItems: totalRanking,
          itemsPerPage: limit,
          hasNextPage: page < Math.ceil(totalRanking / limit),
          hasPreviousPage: page > 1,
        },
        statistics: {
          totalEntries,
          averageScore: Math.round(averageScore * 100) / 100,
          maxScore,
          minScore,
          scoreDistribution: {
            counts: distribution,
            percentages: distributionPercent,
            scale: 'relative_to_topper_10_cgpa',
            buckets: {
              excellent: '9-10',
              good: '7-9',
              average: '4-7',
              poor: '0-4',
            },
          },
        },
        ranking,
        topFivePercent,
        bottomFivePercent,
      };
    } catch (error) {
      throw error;
    }
  }

  // Get available filters for statistics
  static async getAvailableFilters(filters?: {
    department?: string;
    month?: number;
    year?: number;
  }) {
    try {
      const { department, month, year } = filters || {};

      // Build query for entries
      const entryQuery: any = {};
      if (month !== undefined) {
        entryQuery.month = month;
      }
      if (year !== undefined) {
        entryQuery.year = year;
      }

      entryQuery.status = 'generated';

      // Get all entries
      const allEntries = await EntryModel.find(entryQuery).lean();

      // Get unique employee and template IDs
      const employeeIds = [
        ...new Set(allEntries.map((entry) => entry.employeeId)),
      ];
      const templateIds = [
        ...new Set(allEntries.map((entry) => entry.templateId)),
      ];

      // Fetch employee and template data
      const employees = await EmployeeModal.find({ _id: { $in: employeeIds } })
        .select('department')
        .lean();
      const templates = await KPITemplateModel.find({
        _id: { $in: templateIds },
      })
        .select('role')
        .lean();

      // Create lookup maps
      const employeeMap = new Map();
      const templateMap = new Map();

      employees.forEach((emp: any) => {
        const idStr = emp._id.toString();
        employeeMap.set(idStr, emp);
        employeeMap.set(emp._id, emp);
      });

      templates.forEach((temp: any) => {
        const idStr = temp._id.toString();
        templateMap.set(idStr, temp);
        templateMap.set(temp._id, temp);
      });

      // Get all unique departments
      const allDepartments = [
        ...new Set(
          allEntries
            .map((entry) => {
              const employee = employeeMap.get(entry.employeeId);
              return employee?.department;
            })
            .filter(Boolean)
        ),
      ].sort();

      // Get all unique roles
      const allRoles = [
        ...new Set(
          allEntries
            .map((entry) => {
              const template = templateMap.get(entry.templateId);
              return template?.role;
            })
            .filter(Boolean)
        ),
      ].sort();

      // If department is specified, get roles available for that department
      let availableRoles = allRoles;
      if (department) {
        availableRoles = [
          ...new Set(
            allEntries
              .filter((entry) => {
                const employee = employeeMap.get(entry.employeeId);
                return employee?.department === department;
              })
              .map((entry) => {
                const template = templateMap.get(entry.templateId);
                return template?.role;
              })
              .filter(Boolean)
          ),
        ].sort();
      }

      // Get available months and years
      const availableMonths = [
        ...new Set(allEntries.map((entry) => entry.month)),
      ].sort();
      const availableYears = [
        ...new Set(allEntries.map((entry) => entry.year)),
      ].sort();

      return {
        filters: { department, month, year },
        availableFilters: {
          departments: allDepartments,
          roles: availableRoles,
          months: availableMonths,
          years: availableYears,
        },
        summary: {
          totalEntries: allEntries.length,
          totalDepartments: allDepartments.length,
          totalRoles: allRoles.length,
          totalMonths: availableMonths.length,
          totalYears: availableYears.length,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  // Get Nodal Officer Statistics
  static async getNodalOfficerStats(filters?: {
    month?: number;
    year?: number;
  }) {
    try {
      const { month, year } = filters || {};

      // Build query for entries
      const entryQuery: any = {};
      if (month !== undefined) {
        entryQuery.month = month;
      }
      if (year !== undefined) {
        entryQuery.year = year;
      }

      // Get all nodal officers from employee collection
      const nodalOfficers = await db
        .collection('user')
        .find({ departmentRole: 'nodalOfficer' })
        .toArray();

      const nodalOfficerStats = [];

      for (const officer of nodalOfficers) {
        const officerDepartment = officer.department;

        if (!officerDepartment) continue;

        // Get templates created by this nodal officer's department
        const templates = await KPITemplateModel.find({
          departmentSlug: officerDepartment,
        })
          .select('_id name role departmentSlug')
          .lean();

        const templateIds = templates.map((t) => t._id);

        // Get employees in this department
        const employees = await EmployeeModal.countDocuments({
          department: officerDepartment,
        })
          .select('_id name department departmentRole')
          .lean();

        // Get entries for this department
        const entries = await EntryModel.find({
          ...entryQuery,
          templateId: { $in: templateIds },
        })
          .select('status score month year')
          .lean();

        // Calculate statistics
        const totalTemplates = templates.length;
        const totalEmployees = employees;
        const totalEntries = entries.length;

        // Count entries by status
        const entriesByStatus = entries.reduce(
          (acc, entry) => {
            acc[entry.status] = (acc[entry.status] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        );

        // Calculate completion percentage
        const completedEntries = entriesByStatus['generated'] || 0;
        const pendingEntries = totalEmployees - completedEntries;
        const completionPercentage =
          totalEmployees > 0 ? (completedEntries / totalEmployees) * 100 : 0;

        nodalOfficerStats.push({
          nodalOfficer: {
            name: officer.name,
            department: officerDepartment,
            departmentRole: officer.departmentRole,
          },
          overview: {
            totalTemplates,
            totalEmployees,
            totalEntries,
            completedEntries,
            pendingEntries,
            completionPercentage: Math.round(completionPercentage * 100) / 100,
          },
          entriesByStatus,
        });
      }

      return {
        filters: { month, year },
        totalNodalOfficers: nodalOfficerStats.length,
        nodalOfficerStats,
        summary: {
          totalTemplates: nodalOfficerStats.reduce(
            (sum, stat) => sum + stat.overview.totalTemplates,
            0
          ),
          totalEmployees: nodalOfficerStats.reduce(
            (sum, stat) => sum + stat.overview.totalEmployees,
            0
          ),
          totalEntries: nodalOfficerStats.reduce(
            (sum, stat) => sum + stat.overview.totalEntries,
            0
          ),
          totalCompleted: nodalOfficerStats.reduce(
            (sum, stat) => sum + stat.overview.completedEntries,
            0
          ),
          totalPending: nodalOfficerStats.reduce(
            (sum, stat) => sum + stat.overview.pendingEntries,
            0
          ),
          overallCompletion:
            nodalOfficerStats.length > 0
              ? Math.round(
                  (nodalOfficerStats.reduce(
                    (sum, stat) => sum + stat.overview.completionPercentage,
                    0
                  ) /
                    nodalOfficerStats.length) *
                    100
                ) / 100
              : 0,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  // Generate KPI entries for a specific timeframe
  static async generateKPIEntries(month: number, year: number) {
    try {
      // Find all entries for the specified month and year
      const entries = await EntryModel.find({ month, year }).lean();

      if (entries.length === 0) {
        throw new APIError({
          STATUS: 404,
          TITLE: 'No entries found',
          MESSAGE: 'No entries found for the specified timeframe',
        });
      }

      // Update all entries to 'generated' status
      const updateResult = await EntryModel.updateMany(
        { month, year },
        { $set: { status: 'generated' } }
      );

      return {
        message: `Successfully generated ${updateResult.modifiedCount} KPI entries for ${month}/${year}`,
        totalEntries: entries.length,
        updatedEntries: updateResult.modifiedCount,
        month,
        year,
      };
    } catch (error) {
      throw error;
    }
  }

  // Get ranking with employee contacts for WhatsApp API
  static async getWhatsAppRanking(filters: {
    department: string;
    role: string;
    month?: number;
    year?: number;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    try {
      const {
        department,
        role,
        month,
        year,
        status = 'generated',
        page = 1,
        limit = 50,
      } = filters;

      // Validate required parameters
      if (!department || !role) {
        throw new APIError({
          STATUS: 400,
          TITLE: 'Missing Required Parameters',
          MESSAGE:
            'Department and role are required for WhatsApp ranking calculation',
        });
      }

      // Build query for entries
      const entryQuery: any = {};

      if (month !== undefined) {
        entryQuery.month = month;
      }

      if (year !== undefined) {
        entryQuery.year = year;
      }

      if (status) {
        entryQuery.status = status;
      }

      // Get all entries
      const entries = await EntryModel.find(entryQuery)
        .sort({ score: -1 })
        .lean();

      // Get unique employee and template IDs
      const employeeIds = [
        ...new Set(entries.map((entry) => entry.employeeId)),
      ];
      const templateIds = [
        ...new Set(entries.map((entry) => entry.templateId)),
      ];

      // Fetch employee and template data
      const employees = await EmployeeModal.find({ _id: { $in: employeeIds } })
        .select('name contact department departmentRole')
        .lean();
      const templates = await KPITemplateModel.find({
        _id: { $in: templateIds },
      })
        .select('name description role frequency departmentSlug template')
        .lean();

      // Create lookup maps
      const employeeMap = new Map(
        employees.map((emp: any) => [emp._id.toString(), emp])
      );
      const templateMap = new Map(
        templates.map((temp: any) => [temp._id.toString(), temp])
      );

      // Filter entries based on department and role
      let filteredEntries = entries;

      if (department) {
        filteredEntries = filteredEntries.filter((entry) => {
          const employee = employeeMap.get(entry.employeeId);
          return employee?.department === department;
        });
      }

      if (role) {
        filteredEntries = filteredEntries.filter((entry) => {
          const template = templateMap.get(entry.templateId);
          return template?.role === role;
        });
      }

      // Create ranking array with WhatsApp-friendly format and full KPI data
      const allRanking = filteredEntries
        .map((entry, index) => {
          const employee = employeeMap.get(entry.employeeId);
          const template = templateMap.get(entry.templateId);

          // Skip entries with missing employees or templates
          if (!employee || !template) {
            return null;
          }

          // Calculate max possible score from template
          const maxPossibleScore =
            template?.template?.reduce((total: number, kpi: any) => {
              return total + (kpi.maxMarks || 0);
            }, 0) || 0;

          // Calculate percentage score
          const percentageScore =
            maxPossibleScore > 0
              ? ((entry.score || 0) / maxPossibleScore) * 100
              : 0;

          return {
            rank: index + 1,
            entryId: entry._id,
            employee: {
              _id: employee._id,
              name: employee.name,
              contact: employee.contact,
              department: employee.department,
              departmentRole: employee.departmentRole,
            },
            template: {
              _id: template._id,
              name: template.name,
              role: template.role,
              maxPossibleScore,
            },
            month: entry.month,
            year: entry.year,
            score: entry.score,
            percentageScore: Math.round(percentageScore * 100) / 100,
            status: entry.status,
            kpiNames: entry.kpiNames,
            values: entry.values, // Full KPI values
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null); // Remove null entries and type properly

      // Apply pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const ranking = allRanking.slice(startIndex, endIndex);
      const totalRanking = allRanking.length;

      // Generate WhatsApp message format
      const currentMonth = month || new Date().getMonth() + 1;
      const currentYear = year || new Date().getFullYear();
      const whatsappMessage = EntryService.generateWhatsAppMessage(
        ranking,
        currentMonth,
        currentYear
      );

      // Get roles available for the selected department
      const availableRolesForDepartment = department
        ? [
            ...new Set(
              allRanking
                .filter(
                  (entry) => entry && entry.employee.department === department
                )
                .map((entry) => entry.template.role)
            ),
          ]
        : [
            ...new Set(
              allRanking.filter(Boolean).map((entry) => entry.template.role)
            ),
          ];

      // Get all departments and roles for filter options
      const departments = [
        ...new Set(
          allRanking.filter(Boolean).map((entry) => entry.employee.department)
        ),
      ];
      const roles = [
        ...new Set(
          allRanking.filter(Boolean).map((entry) => entry.template.role)
        ),
      ];

      return {
        filters: {
          department,
          role,
          month,
          year,
          status,
          page,
          limit,
        },
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalRanking / limit),
          totalItems: totalRanking,
          itemsPerPage: limit,
          hasNextPage: page < Math.ceil(totalRanking / limit),
          hasPreviousPage: page > 1,
        },
        availableFilters: {
          departments,
          roles: availableRolesForDepartment,
          months: [...new Set(entries.map((entry) => entry.month))].sort(),
          years: [...new Set(entries.map((entry) => entry.year))].sort(),
        },
        ranking,
        whatsappMessage,
        totalEntries: totalRanking,
      };
    } catch (error) {
      throw error;
    }
  }

  // Generate WhatsApp message format
  private static generateWhatsAppMessage(
    ranking: any[],
    month: number,
    year: number
  ): string {
    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];

    let message = `🏆 *KPI Ranking Report - ${monthNames[month - 1]} ${year}*\n\n`;
    message += `📊 *Top Performers:*\n\n`;

    ranking.forEach((entry, index) => {
      const rank = index + 1;
      const emoji =
        rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '📈';

      message += `${emoji} *Rank ${rank}:* ${entry.employee.name}\n`;
      message += `   📞 Contact: ${entry.employee.contact?.phone || entry.employee.contact?.email || 'N/A'}\n`;
      message += `   🏢 Department: ${entry.employee.department}\n`;
      message += `   📋 Role: ${entry.template.role}\n`;
      message += `   ⭐ Score: ${entry.score}/${entry.template.maxPossibleScore} (${entry.percentageScore}%)\n`;
      message += `   📍 Zone: ${entry.kpiNames?.[0]?.label || 'N/A'} - ${entry.kpiNames?.[0]?.value || 'N/A'}\n\n`;
    });

    message += `📈 *Summary:*\n`;
    message += `• Total Participants: ${ranking.length}\n`;
    message += `• Period: ${monthNames[month - 1]} ${year}\n`;
    message += `• Status: Generated\n`;

    // Calculate overall statistics
    const totalMaxScore = ranking.reduce(
      (sum, entry) => sum + entry.template.maxPossibleScore,
      0
    );
    const totalActualScore = ranking.reduce(
      (sum, entry) => sum + (entry.score || 0),
      0
    );
    const overallPercentage =
      totalMaxScore > 0 ? (totalActualScore / totalMaxScore) * 100 : 0;

    message += `• Total Score: ${totalActualScore}/${totalMaxScore}\n`;
    message += `• Overall Performance: ${Math.round(overallPercentage * 100) / 100}%\n\n`;
    message += `🎯 Keep up the excellent work! 💪`;

    return message;
  }

  // Get detailed WhatsApp report for a single user by entry ID
  static async getSingleUserWhatsAppReport(entryId: string) {
    try {
      // Validate required parameters
      if (!entryId) {
        throw new APIError({
          STATUS: 400,
          TITLE: 'Missing Required Parameters',
          MESSAGE: 'Entry ID is required for single user report',
        });
      }

      // Find the specific entry
      const entry = await EntryModel.findById(entryId).lean();

      if (!entry) {
        throw new APIError({
          STATUS: 404,
          TITLE: 'Entry not found',
          MESSAGE: 'Entry not found',
        });
      }

      // Get employee and template data
      const employee = await EmployeeModal.findById(entry.employeeId)
        .select('name contact department departmentRole')
        .lean();

      const template = await KPITemplateModel.findById(entry.templateId)
        .select('name description role frequency departmentSlug template')
        .lean();

      if (!employee || !template) {
        throw new APIError({
          STATUS: 404,
          TITLE: 'Employee or template not found',
          MESSAGE: 'Employee or template not found for this entry',
        });
      }

      // Calculate max possible score from template
      const maxPossibleScore =
        template?.template?.reduce((total: number, kpi: any) => {
          return total + (kpi.maxMarks || 0);
        }, 0) || 0;

      // Calculate percentage score
      const percentageScore =
        maxPossibleScore > 0
          ? ((entry.score || 0) / maxPossibleScore) * 100
          : 0;

      // Get department ranking for the same month and year, filtered by the user's department and role
      const userDepartment = employee.department;
      const userRole = template.role;

      const departmentEntries = await EntryModel.find({
        month: entry.month,
        year: entry.year,
        status: 'generated',
      })
        .sort({ score: -1 })
        .lean();

      // Get all employees and templates for department ranking
      const deptEmployeeIds = [
        ...new Set(departmentEntries.map((e) => e.employeeId)),
      ];
      const deptTemplateIds = [
        ...new Set(departmentEntries.map((e) => e.templateId)),
      ];

      const deptEmployees = await EmployeeModal.find({
        _id: { $in: deptEmployeeIds },
      })
        .select('name contact department departmentRole')
        .lean();

      const deptTemplates = await KPITemplateModel.find({
        _id: { $in: deptTemplateIds },
      })
        .select('name role template')
        .lean();

      // Create lookup maps
      const deptEmployeeMap = new Map(
        deptEmployees.map((emp: any) => [emp._id.toString(), emp])
      );
      const deptTemplateMap = new Map(
        deptTemplates.map((temp: any) => [temp._id.toString(), temp])
      );

      // Create department ranking (excluding current user for cleaner display)
      const departmentRanking = departmentEntries
        .map((deptEntry) => {
          const deptEmployee = deptEmployeeMap.get(deptEntry.employeeId);
          const deptTemplate = deptTemplateMap.get(deptEntry.templateId);

          if (!deptEmployee || !deptTemplate) return null;

          // Filter by user's department and role
          if (
            deptEmployee.department !== userDepartment ||
            deptTemplate.role !== userRole
          ) {
            return null;
          }

          // Skip current user in ranking display
          if (deptEntry._id.toString() === entryId) {
            return null;
          }

          const deptMaxScore =
            deptTemplate?.template?.reduce((total: number, kpi: any) => {
              return total + (kpi.maxMarks || 0);
            }, 0) || 0;

          const deptPercentage =
            deptMaxScore > 0
              ? ((deptEntry.score || 0) / deptMaxScore) * 100
              : 0;

          return {
            entryId: deptEntry._id,
            employee: {
              _id: deptEmployee._id,
              name: deptEmployee.name,
              contact: deptEmployee.contact,
              department: deptEmployee.department,
              departmentRole: deptEmployee.departmentRole,
            },
            template: {
              _id: deptTemplate._id,
              name: deptTemplate.name,
              role: deptTemplate.role,
              maxPossibleScore: deptMaxScore,
            },
            score: deptEntry.score,
            percentageScore: Math.round(deptPercentage * 100) / 100,
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
        .sort((a, b) => (b.score || 0) - (a.score || 0)) // Sort by score descending
        .slice(0, 5) // Only top 5 for cleaner display
        .map((entry, index) => ({
          ...entry,
          rank: index + 1, // Assign rank after sorting
        }));

      // Calculate user's rank by finding position among all entries (including current user)
      const allDepartmentEntries = departmentEntries
        .map((deptEntry) => {
          const deptEmployee = deptEmployeeMap.get(deptEntry.employeeId);
          const deptTemplate = deptTemplateMap.get(deptEntry.templateId);

          if (!deptEmployee || !deptTemplate) return null;

          // Filter by user's department and role
          if (
            deptEmployee.department !== userDepartment ||
            deptTemplate.role !== userRole
          ) {
            return null;
          }

          return {
            entryId: deptEntry._id,
            score: deptEntry.score || 0,
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
        .sort((a, b) => b.score - a.score); // Sort by score descending

      // Find user's position (1-based ranking)
      const userRank =
        allDepartmentEntries.findIndex(
          (entry) => entry.entryId.toString() === entryId
        ) + 1;
      const totalInDepartment = allDepartmentEntries.length;

      return {
        entryId: entry._id,
        employee: {
          _id: employee._id,
          name: employee.name,
          contact: employee.contact,
          department: employee.department,
          departmentRole: employee.departmentRole,
        },
        template: {
          _id: template._id,
          name: template.name,
          role: template.role,
          maxPossibleScore,
        },
        month: entry.month,
        year: entry.year,
        score: entry.score,
        percentageScore: Math.round(percentageScore * 100) / 100,
        status: entry.status,
        kpiNames: entry.kpiNames,
        values: entry.values,
        rankings: {
          departmentRank: userRank,
          totalInDepartment: totalInDepartment,
        },
        departmentRanking: departmentRanking,
      };
    } catch (error) {
      throw error;
    }
  }

  // Generate detailed WhatsApp message for single user
  static generateSingleUserWhatsAppMessage(data: {
    employee: any;
    template: any;
    entry: any;
    maxPossibleScore: number;
    percentageScore: number;
    userRank: number;
    totalInDepartment: number;
    departmentRanking: any[];
  }): string {
    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];

    const {
      employee,
      template,
      entry,
      maxPossibleScore,
      percentageScore,
      userRank,
      totalInDepartment,
      departmentRanking,
    } = data;

    let message = `🏆 *Personal KPI Report - ${employee.name}*\n\n`;
    message += `📅 *Period:* ${monthNames[entry.month - 1]} ${entry.year}\n`;
    message += `🏢 *Department:* ${employee.department}\n`;
    message += `📋 *Role:* ${template.role}\n`;
    message += `📞 *Contact:* ${employee.contact?.phone || employee.contact?.email || 'N/A'}\n\n`;

    // Personal Performance
    message += `⭐ *Your Performance:*\n`;
    message += `• Score: ${entry.score}/${maxPossibleScore} (${percentageScore}%)\n`;
    message += `• Department Rank: ${userRank}/${totalInDepartment}\n\n`;

    // Zone Information
    if (entry.kpiNames && entry.kpiNames.length > 0) {
      message += `📍 *Zone:* ${entry.kpiNames[0]?.label || 'N/A'} - ${entry.kpiNames[0]?.value || 'N/A'}\n\n`;
    }

    // KPI Breakdown
    if (entry.values && entry.values.length > 0) {
      message += `📊 *KPI Breakdown:*\n`;
      entry.values.forEach((kpi: any, index: number) => {
        message += `${index + 1}. ${kpi.key}: ${kpi.value}% (Score: ${kpi.score})\n`;
      });
      message += `\n`;
    }

    // Department Top 5
    message += `🏆 *Department Top 5:*\n`;
    departmentRanking.slice(0, 5).forEach((rankEntry: any, index: number) => {
      const emoji =
        index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '📈';
      message += `${emoji} ${rankEntry.employee.name} (${rankEntry.score}/${rankEntry.template.maxPossibleScore})\n`;
    });
    message += `\n`;

    // Department Top 3
    if (departmentRanking.length > 0) {
      message += `🏢 *${employee.department} Top 3:*\n`;
      departmentRanking.slice(0, 3).forEach((rankEntry: any, index: number) => {
        const emoji = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
        message += `${emoji} ${rankEntry.employee.name} (${rankEntry.score}/${rankEntry.template.maxPossibleScore})\n`;
      });
      message += `\n`;
    }

    // Performance Analysis
    message += `📈 *Performance Analysis:*\n`;
    if (percentageScore >= 90) {
      message += `• 🎯 Excellent Performance! Keep up the great work!\n`;
    } else if (percentageScore >= 80) {
      message += `• 👍 Good Performance! Room for improvement.\n`;
    } else if (percentageScore >= 70) {
      message += `• 📈 Average Performance. Focus on key areas.\n`;
    } else {
      message += `• ⚠️ Needs Improvement. Review and enhance performance.\n`;
    }

    if (userRank <= 10) {
      message += `• 🌟 You're in the top 10! Outstanding achievement!\n`;
    } else if (userRank <= 50) {
      message += `• 🎉 You're in the top 50! Great job!\n`;
    }

    message += `\n🎯 *Keep striving for excellence!* 💪`;

    return message;
  }

  // Cleanup orphaned KPI entries (entries with deleted employees or templates)
  static async cleanupOrphanedEntries() {
    try {
      // Find all entries
      const allEntries = await EntryModel.find({}).lean();

      // Get unique employee and template IDs
      const employeeIds = [
        ...new Set(allEntries.map((entry) => entry.employeeId)),
      ];
      const templateIds = [
        ...new Set(allEntries.map((entry) => entry.templateId)),
      ];

      // Check which employees and templates exist
      const existingEmployees = await EmployeeModal.find({
        _id: { $in: employeeIds },
      })
        .select('_id')
        .lean();
      const existingTemplates = await KPITemplateModel.find({
        _id: { $in: templateIds },
      })
        .select('_id')
        .lean();

      // Create sets of existing IDs for faster lookup
      const existingEmployeeIds = new Set(
        existingEmployees.map((emp: any) => emp._id.toString())
      );
      const existingTemplateIds = new Set(
        existingTemplates.map((temp: any) => temp._id.toString())
      );

      // Find orphaned entries
      const orphanedEntries = allEntries.filter(
        (entry) =>
          !existingEmployeeIds.has(entry.employeeId) ||
          !existingTemplateIds.has(entry.templateId)
      );

      if (orphanedEntries.length === 0) {
        return {
          message: 'No orphaned entries found',
          totalEntries: allEntries.length,
          orphanedEntries: 0,
          deletedEntries: 0,
        };
      }

      // Delete orphaned entries
      const orphanedEntryIds = orphanedEntries.map((entry) => entry._id);
      const deleteResult = await EntryModel.deleteMany({
        _id: { $in: orphanedEntryIds },
      });

      return {
        message: `Successfully cleaned up ${deleteResult.deletedCount} orphaned entries`,
        totalEntries: allEntries.length,
        orphanedEntries: orphanedEntries.length,
        deletedEntries: deleteResult.deletedCount,
        orphanedDetails: {
          missingEmployees: orphanedEntries.filter(
            (entry) => !existingEmployeeIds.has(entry.employeeId)
          ).length,
          missingTemplates: orphanedEntries.filter(
            (entry) => !existingTemplateIds.has(entry.templateId)
          ).length,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  // Get orphaned entries report (without deleting)
  static async getOrphanedEntriesReport() {
    try {
      // Find all entries
      const allEntries = await EntryModel.find({}).lean();

      // Get unique employee and template IDs
      const employeeIds = [
        ...new Set(allEntries.map((entry) => entry.employeeId)),
      ];
      const templateIds = [
        ...new Set(allEntries.map((entry) => entry.templateId)),
      ];

      // Check which employees and templates exist
      const existingEmployees = await EmployeeModal.find({
        _id: { $in: employeeIds },
      })
        .select('_id')
        .lean();
      const existingTemplates = await KPITemplateModel.find({
        _id: { $in: templateIds },
      })
        .select('_id')
        .lean();

      // Create sets of existing IDs for faster lookup (handle both ObjectId and string)
      const existingEmployeeIds = new Set();
      const existingTemplateIds = new Set();

      existingEmployees.forEach((emp: any) => {
        existingEmployeeIds.add(emp._id.toString());
        existingEmployeeIds.add(emp._id); // Also add ObjectId version
      });

      existingTemplates.forEach((temp: any) => {
        existingTemplateIds.add(temp._id.toString());
        existingTemplateIds.add(temp._id); // Also add ObjectId version
      });

      // Find orphaned entries
      const orphanedEntries = allEntries.filter(
        (entry) =>
          !existingEmployeeIds.has(entry.employeeId) ||
          !existingTemplateIds.has(entry.templateId)
      );

      // Group orphaned entries by type
      const missingEmployees = orphanedEntries.filter(
        (entry) => !existingEmployeeIds.has(entry.employeeId)
      );
      const missingTemplates = orphanedEntries.filter(
        (entry) => !existingTemplateIds.has(entry.templateId)
      );

      return {
        totalEntries: allEntries.length,
        orphanedEntries: orphanedEntries.length,
        missingEmployees: missingEmployees.length,
        missingTemplates: missingTemplates.length,
        orphanedEntriesList: orphanedEntries.map((entry) => ({
          entryId: entry._id,
          employeeId: entry.employeeId,
          templateId: entry.templateId,
          month: entry.month,
          year: entry.year,
          score: entry.score,
          status: entry.status,
          issues: {
            missingEmployee: !existingEmployeeIds.has(entry.employeeId),
            missingTemplate: !existingTemplateIds.has(entry.templateId),
          },
        })),
      };
    } catch (error) {
      throw error;
    }
  }

  // Generate PDF report for department with role-wise rankings
  static async generateDepartmentPDF(
    departmentSlug: string,
    month?: number,
    year?: number
  ) {
    try {
      // Default month/year to previous month and current year
      const now = new Date();
      const currentMonthIndex = now.getMonth(); // 0-based
      const defaultMonth = currentMonthIndex === 0 ? 12 : currentMonthIndex;
      const defaultYear =
        currentMonthIndex === 0 ? now.getFullYear() - 1 : now.getFullYear();
      const resolvedMonth = month ?? defaultMonth;
      const resolvedYear = year ?? defaultYear;

      // Get department info
      const department = await DepartmentModel.findOne({
        slug: departmentSlug,
      });
      if (!department) {
        throw new APIError({
          STATUS: 404,
          TITLE: 'Department not found',
        });
      }

      // Get all entries for the department with status 'generated'
      const entries = await EntryModel.find({
        month: resolvedMonth,
        year: resolvedYear,
        status: 'generated',
      }).lean();

      // Get employees and templates for context
      const employeeIds = [...new Set(entries.map((e) => e.employeeId))];
      const templateIds = [...new Set(entries.map((e) => e.templateId))];

      const employees = await EmployeeModal.find({ _id: { $in: employeeIds } })
        .select('name contact department departmentRole')
        .lean();

      const templates = await KPITemplateModel.find({
        _id: { $in: templateIds },
      })
        .select('name role departmentSlug')
        .lean();

      // Create lookup maps
      const employeeMap = new Map(
        employees.map((emp) => [emp._id.toString(), emp])
      );
      const templateMap = new Map(
        templates.map((temp) => [temp._id.toString(), temp])
      );

      // Group entries by role
      const roleGroups: { [role: string]: any[] } = {};

      for (const entry of entries) {
        const employee = employeeMap.get(entry.employeeId.toString());
        const template = templateMap.get(entry.templateId.toString());

        if (employee && template && employee.department === departmentSlug) {
          const role = employee.departmentRole || template.role;
          if (!roleGroups[role]) {
            roleGroups[role] = [];
          }

          roleGroups[role].push({
            entryId: entry._id,
            employee: {
              name: employee.name,
              contact: employee.contact,
            },
            template: {
              name: template.name,
              role: template.role,
            },
            score: entry.score,
            month: entry.month,
            year: entry.year,
            status: entry.status,
            kpiNames: entry.kpiNames || [],
          });
        }
      }

      // Sort each role group by score (descending)
      for (const role in roleGroups) {
        roleGroups[role].sort((a, b) => (b.score || 0) - (a.score || 0));
      }

      // Generate HTML content
      const htmlContent = this.generatePDFHTML(
        department,
        roleGroups,
        resolvedMonth,
        resolvedYear
      );

      // Generate PDF using Puppeteer
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm',
        },
      });

      await browser.close();

      return {
        pdfBuffer,
        department: department.name,
        month: resolvedMonth,
        year: resolvedYear,
        totalRoles: Object.keys(roleGroups).length,
        totalEntries: entries.length,
      };
    } catch (error) {
      logger.error('Error generating department PDF:', error);
      throw error;
    }
  }

  // Generate HTML content for PDF
  private static generatePDFHTML(
    department: any,
    roleGroups: { [role: string]: any[] },
    month: number,
    year: number
  ) {
    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Department Performance Report</title>
        <style>
          body {
            font-family: 'Arial', sans-serif;
            margin: 0;
            padding: 20px;
            color: #333;
            line-height: 1.6;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 3px solid #2c3e50;
            padding-bottom: 20px;
          }
          .header h1 {
            color: #2c3e50;
            margin: 0;
            font-size: 28px;
          }
          .header h2 {
            color: #7f8c8d;
            margin: 10px 0 0 0;
            font-size: 18px;
            font-weight: normal;
          }
          .role-section {
            margin-bottom: 40px;
            page-break-inside: avoid;
          }
          .role-title {
            background: linear-gradient(135deg, #3498db, #2980b9);
            color: white;
            padding: 15px 20px;
            margin: 0 0 20px 0;
            border-radius: 8px;
            font-size: 20px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .ranking-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            border-radius: 8px;
            overflow: hidden;
          }
          .ranking-table th {
            background: #34495e;
            color: white;
            padding: 15px 12px;
            text-align: left;
            font-weight: bold;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .ranking-table td {
            padding: 12px;
            border-bottom: 1px solid #ecf0f1;
            font-size: 13px;
          }
          .ranking-table tr:nth-child(even) {
            background-color: #f8f9fa;
          }
          .ranking-table tr:hover {
            background-color: #e8f4f8;
          }
          .rank {
            font-weight: bold;
            color: #2c3e50;
            text-align: center;
            width: 60px;
          }
          .rank-1 { color: #f39c12; font-size: 16px; }
          .rank-2 { color: #95a5a6; font-size: 15px; }
          .rank-3 { color: #cd7f32; font-size: 15px; }
          .name {
            font-weight: 600;
            color: #2c3e50;
          }
          .division {
            color: #7f8c8d;
            font-size: 12px;
          }
          .score {
            font-weight: bold;
            text-align: right;
            color: #27ae60;
          }
          .score-excellent { color: #27ae60; }
          .score-good { color: #f39c12; }
          .score-average { color: #e67e22; }
          .score-poor { color: #e74c3c; }
          .no-data {
            text-align: center;
            color: #7f8c8d;
            font-style: italic;
            padding: 40px;
            background: #f8f9fa;
            border-radius: 8px;
          }
          .footer {
            margin-top: 40px;
            text-align: center;
            color: #7f8c8d;
            font-size: 12px;
            border-top: 1px solid #ecf0f1;
            padding-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${department.name}</h1>
          <h2>Performance Report - ${monthNames[month - 1]} ${year}</h2>
        </div>
    `;

    // Generate sections for each role
    const sortedRoles = Object.keys(roleGroups).sort();

    for (const role of sortedRoles) {
      const entries = roleGroups[role];

      html += `
        <div class="role-section">
          <h3 class="role-title">${role.toUpperCase()}</h3>
      `;

      if (entries.length === 0) {
        html += '<div class="no-data">No data available for this role</div>';
      } else {
        html += `
          <table class="ranking-table">
            <thead>
              <tr>
                <th style="width: 60px;">Rank</th>
                <th>Name</th>
                <th>Division</th>
                <th style="width: 100px; text-align: right;">Score</th>
              </tr>
            </thead>
            <tbody>
        `;

        entries.forEach((entry, index) => {
          const rank = index + 1;
          const score = entry.score || 0;
          let scoreClass = 'score';
          if (score >= 80) scoreClass += ' score-excellent';
          else if (score >= 60) scoreClass += ' score-good';
          else if (score >= 40) scoreClass += ' score-average';
          else scoreClass += ' score-poor';

          // Get division from kpiNames array first element's value
          const division =
            entry.kpiNames && entry.kpiNames.length > 0
              ? entry.kpiNames[0].value
              : entry.employee.contact?.email || 'N/A';

          html += `
            <tr>
              <td class="rank rank-${rank}">${rank}</td>
              <td class="name">${entry.employee.name}</td>
              <td class="division">${division}</td>
              <td class="${scoreClass}">${score.toFixed(2)}</td>
            </tr>
          `;
        });

        html += `
            </tbody>
          </table>
        `;
      }

      html += '</div>';
    }

    html += `
        <div class="footer">
          <p>Generated on ${new Date().toLocaleDateString()} | Department Performance Report</p>
        </div>
      </body>
      </html>
    `;

    return html;
  }
}
