import APIError from '@/lib/errors/APIError';
import { EntryModel, Entry } from './entry.model';
import { KPITemplateModel } from '../template/template.model';
import { EmployeeModal } from '../employee/employee.model';

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

  // Get statistics and ranking data
  static async getStatistics(filters: {
    department?: string;
    role?: string;
    month?: number;
    year?: number;
  }) {
    try {
      const { department, role, month, year } = filters;

      // Build query for entries
      const entryQuery: any = {};

      if (month !== undefined) {
        entryQuery.month = month;
      }

      if (year !== undefined) {
        entryQuery.year = year;
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
        .select('name description role frequency departmentSlug')
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

      // Get unique departments and roles for filter options
      const departments = [
        ...new Set(
          entries
            .map((entry) => {
              const employee = employeeMap.get(entry.employeeId);
              return employee?.department;
            })
            .filter(Boolean)
        ),
      ];
      const roles = [
        ...new Set(
          entries
            .map((entry) => {
              const template = templateMap.get(entry.templateId);
              return template?.role;
            })
            .filter(Boolean)
        ),
      ];

      // Create ranking array with full employee and department data
      const ranking = filteredEntries.map((entry, index) => {
        const employee = employeeMap.get(entry.employeeId);
        const template = templateMap.get(entry.templateId);

        return {
          rank: index + 1,
          entryId: entry._id,
          employee: {
            _id: employee?._id,
            name: employee?.name,
            contact: employee?.contact,
            department: employee?.department,
            departmentRole: employee?.departmentRole,
          },
          template: {
            _id: template?._id,
            name: template?.name,
            description: template?.description,
            role: template?.role,
            frequency: template?.frequency,
            departmentSlug: template?.departmentSlug,
          },
          month: entry.month,
          year: entry.year,
          score: entry.score,
          status: entry.status,
          kpiNames: entry.kpiNames,
          values: entry.values,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
        };
      });

      // Calculate statistics
      const totalEntries = ranking.length;
      const averageScore =
        totalEntries > 0
          ? ranking.reduce((sum, entry) => sum + (entry.score || 0), 0) /
            totalEntries
          : 0;
      const maxScore =
        totalEntries > 0
          ? Math.max(...ranking.map((entry) => entry.score || 0))
          : 0;
      const minScore =
        totalEntries > 0
          ? Math.min(...ranking.map((entry) => entry.score || 0))
          : 0;

      // Group by department for department-wise statistics
      const departmentStats = departments.map((dept) => {
        const deptEntries = ranking.filter(
          (entry) => entry.employee.department === dept
        );
        const deptCount = deptEntries.length;
        const deptAvgScore =
          deptCount > 0
            ? deptEntries.reduce((sum, entry) => sum + (entry.score || 0), 0) /
              deptCount
            : 0;

        return {
          department: dept,
          totalEntries: deptCount,
          averageScore: deptAvgScore,
          topScore:
            deptCount > 0
              ? Math.max(...deptEntries.map((entry) => entry.score || 0))
              : 0,
        };
      });

      // Group by role for role-wise statistics
      const roleStats = roles.map((role) => {
        const roleEntries = ranking.filter(
          (entry) => entry.template.role === role
        );
        const roleCount = roleEntries.length;
        const roleAvgScore =
          roleCount > 0
            ? roleEntries.reduce((sum, entry) => sum + (entry.score || 0), 0) /
              roleCount
            : 0;

        return {
          role: role,
          totalEntries: roleCount,
          averageScore: roleAvgScore,
          topScore:
            roleCount > 0
              ? Math.max(...roleEntries.map((entry) => entry.score || 0))
              : 0,
        };
      });

      return {
        filters: {
          department,
          role,
          month,
          year,
        },
        statistics: {
          totalEntries,
          averageScore: Math.round(averageScore * 100) / 100,
          maxScore,
          minScore,
          departmentStats,
          roleStats,
        },
        availableFilters: {
          departments,
          roles,
          months: [...new Set(entries.map((entry) => entry.month))].sort(),
          years: [...new Set(entries.map((entry) => entry.year))].sort(),
        },
        ranking,
      };
    } catch (error) {
      throw error;
    }
  }
}
