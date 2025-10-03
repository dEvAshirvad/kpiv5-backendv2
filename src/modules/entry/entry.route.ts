import express from 'express';
import { EntryHandler } from './entry.handler';
import { validateRequest } from '@/middlewares/zod-validate-request';
import { kpientryZodSchema } from './entry.model';

const router = express.Router();

// Main entry routes
// GET /api/v1/entries - Get all entries with pagination and search
router.get('/', EntryHandler.getAllEntries);

// Search routes (must come before /:id routes)
// GET /api/v1/entries/search - Search entries by multiple criteria
router.get('/search', EntryHandler.searchEntries);

// Statistics routes
// GET /api/v1/entries/statistics - Get ranking and statistics data (Department and Role Required)
router.get('/statistics', EntryHandler.getStatistics);

// GET /api/v1/entries/all-department-stats - Get aggregated stats across all departments
router.get('/all-department-stats', EntryHandler.getAllDepartmentStats);

// GET /api/v1/entries/nodal-officer-stats - Get nodal officer statistics
router.get('/nodal-officer-stats', EntryHandler.getNodalOfficerStats);

// GET /api/v1/entries/available-filters - Get available filters for statistics
router.get('/available-filters', EntryHandler.getAvailableFilters);

// WhatsApp ranking routes
// POST /api/v1/entries/generate - Generate KPI entries for timeframe
router.post('/generate', EntryHandler.generateKPIEntries);

// GET /api/v1/entries/whatsapp-ranking - Get WhatsApp ranking with contacts
router.get('/whatsapp-ranking', EntryHandler.getWhatsAppRanking);

// Cleanup routes
// GET /api/v1/entries/orphaned-report - Get report of orphaned entries
router.get('/orphaned-report', EntryHandler.getOrphanedEntriesReport);

// POST /api/v1/entries/cleanup-orphaned - Cleanup orphaned entries
router.post('/cleanup-orphaned', EntryHandler.cleanupOrphanedEntries);

// Single user WhatsApp report
// GET /api/v1/entries/single-user-report/:entryId - Get detailed WhatsApp report for single user
router.get(
  '/single-user-report/:entryId',
  EntryHandler.getSingleUserWhatsAppReport
);

// GET /api/v1/entries/:id - Get a specific entry
router.get('/:id', EntryHandler.getEntryById);

// POST /api/v1/entries - Create a new entry
router.post('/', EntryHandler.createEntry);

// PUT /api/v1/entries/:id - Update an entry (partial update supported)
router.put('/:id', EntryHandler.updateEntry);

// DELETE /api/v1/entries/:id - Delete an entry
router.delete('/:id', EntryHandler.deleteEntry);

// Status management
// PUT /api/v1/entries/:id/status - Update entry status
router.put('/:id/status', EntryHandler.updateEntryStatus);

// Filter routes
// GET /api/v1/entries/employee/:employeeId - Get entries by employee
router.get('/employee/:employeeId', EntryHandler.getEntriesByEmployee);

// GET /api/v1/entries/template/:templateId - Get entries by template
router.get('/template/:templateId', EntryHandler.getEntriesByTemplate);

// GET /api/v1/entries/month/:month/year/:year - Get entries by month and year
router.get('/month/:month/year/:year', EntryHandler.getEntriesByMonthYear);

// GET /api/v1/entries/status/:status - Get entries by status
router.get('/status/:status', EntryHandler.getEntriesByStatus);

// Utility routes
// GET /api/v1/entries/check/:employeeId/:templateId/:month/:year - Check if entry exists
router.get(
  '/check/:employeeId/:templateId/:month/:year',
  EntryHandler.checkEntryExists
);

// GET /api/v1/entries/find/:employeeId/:templateId/:month/:year - Get specific entry by employee, template, month, year
router.get(
  '/find/:employeeId/:templateId/:month/:year',
  EntryHandler.getEntryByEmployeeTemplateMonthYear
);

// Workflow routes
// GET /api/v1/entries/workflow/:employeeId/:templateId/:month/:year - Get or create entry for workflow
router.get(
  '/workflow/:employeeId/:templateId/:month/:year',
  EntryHandler.getOrCreateEntryForWorkflow
);

// GET /api/v1/entries/available/:employeeId/:templateId - Get available months and years
router.get(
  '/available/:employeeId/:templateId',
  EntryHandler.getAvailableMonthsYears
);

// GET /api/v1/entries/summary/:employeeId - Get entry summary for employee
router.get('/summary/:employeeId', EntryHandler.getEntrySummaryForEmployee);

// GET /api/v1/entries/pdf/:department - Generate PDF report for department
router.get('/pdf/:department', EntryHandler.generateDepartmentPDF);

export default router;
