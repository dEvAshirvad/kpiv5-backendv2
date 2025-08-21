import express from 'express';
import { TemplateHandler } from './template.handler';
import { validateRequest } from '@/middlewares/zod-validate-request';
import {
  kpitemplateZodSchema,
  kpitemplateVersionZodSchema,
} from './template.model';

const router = express.Router();

// Main template routes
// GET /api/v1/templates - Get all templates with pagination and search
router.get('/', TemplateHandler.getAllTemplates);

// GET /api/v1/templates/:id - Get a specific template
router.get('/:id', TemplateHandler.getTemplateById);

// POST /api/v1/templates - Create a new template
router.post(
  '/',
  validateRequest({ body: kpitemplateZodSchema }),
  TemplateHandler.createTemplate
);

// PUT /api/v1/templates/:id - Update a template (partial update supported)
router.put(
  '/:id',
  validateRequest({ body: kpitemplateZodSchema.partial() }),
  TemplateHandler.updateTemplate
);

// DELETE /api/v1/templates/:id - Delete a template
router.delete('/:id', TemplateHandler.deleteTemplate);

// Template version routes
// POST /api/v1/templates/versions - Create a new template version
router.post(
  '/versions',
  validateRequest({ body: kpitemplateVersionZodSchema }),
  TemplateHandler.createTemplateVersion
);

// GET /api/v1/templates/:templateId/versions - Get all versions of a template
router.get('/:templateId/versions', TemplateHandler.getTemplateVersions);

// GET /api/v1/templates/:templateId/versions/:version - Get specific template version
router.get(
  '/:templateId/versions/:version',
  TemplateHandler.getTemplateVersion
);

// Filter routes
// GET /api/v1/templates/department/:departmentSlug - Get templates by department
router.get(
  '/department/:departmentSlug',
  TemplateHandler.getTemplatesByDepartment
);

// GET /api/v1/templates/frequency/:frequency - Get templates by frequency
router.get('/frequency/:frequency', TemplateHandler.getTemplatesByFrequency);

// GET /api/v1/templates/role/:role - Get templates by role
router.get('/role/:role', TemplateHandler.getTemplatesByRole);

// Workflow routes
// GET /api/v1/templates/employee/:employeeId - Get templates by employee department and role
router.get(
  '/employee/:employeeId',
  TemplateHandler.getTemplatesByEmployeeDepartment
);

// GET /api/v1/templates/:templateId/form-structure - Generate form structure from template
router.get(
  '/:templateId/form-structure',
  TemplateHandler.generateFormStructure
);

export default router;
