import mongoose from 'mongoose';
import { z } from 'zod';

const kpitemplateZodSchema = z.object({
  name: z.string().nonempty('Name is required'),
  description: z.string().nonempty('Description is required'),
  role: z.string().nonempty('Role is required'),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly']),
  departmentSlug: z.string().nonempty('Department slug is required'),
  kpiName: z.string().nonempty('KPI name is required'),
  template: z
    .array(
      z.object({
        name: z.string().nonempty('KPI name is required'),
        description: z.string().nonempty('KPI description is required'),
        maxMarks: z.number().int().min(0, 'maxMarks must be non-negative'),
        kpiType: z.literal('percentage'),
        kpiUnit: z.literal('%', {
          errorMap: () => ({ message: "kpiUnit must be '%'" }),
        }),
        subKpis: z
          .array(
            z.object({
              name: z.string().nonempty('Sub-KPI name is required'),
              key: z.string().nonempty('Sub-KPI key is required'),
              value_type: z.literal('number'),
            })
          )
          .default([])
          .optional(),
      })
    )
    .min(2, 'At least 2 KPIs required')
    .refine(
      (templates) =>
        new Set(templates.map((t) => t.name)).size === templates.length,
      'Template KPI names must be unique'
    ),
  createdBy: z.string(),
  updatedBy: z.string(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

const kpitemplateVersionZodSchema = z.object({
  templateId: z.string(),
  version: z.number(),
  name: z.string().nonempty('Name is required'),
  description: z.string().nonempty('Description is required'),
  role: z.string().nonempty('Role is required'),
  kpiName: z.string().nonempty('KPI name is required'),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly']),
  departmentSlug: z.string().nonempty('Department slug is required'),
  template: z
    .array(
      z.object({
        name: z.string().nonempty('KPI name is required'),
        description: z.string().nonempty('KPI description is required'),
        maxMarks: z.number().int().min(0, 'maxMarks must be non-negative'),
        kpiType: z.literal('percentage'),
        kpiUnit: z.literal('%', {
          errorMap: () => ({ message: "kpiUnit must be '%'" }),
        }),
        isDynamic: z.boolean(),
        subKpis: z
          .array(
            z.object({
              name: z.string().nonempty('Sub-KPI name is required'),
              key: z.string().nonempty('Sub-KPI key is required'),
              value_type: z.literal('number'),
            })
          )
          .default([])
          .optional(),
      })
    )
    .min(2, 'At least 2 KPIs required')
    .refine(
      (templates) =>
        new Set(templates.map((t) => t.name)).size === templates.length,
      'Template KPI names must be unique'
    ),
  createdBy: z.string(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

// Types
export type KPITemplate = z.infer<typeof kpitemplateZodSchema>;
export type KPITemplateVersion = z.infer<typeof kpitemplateVersionZodSchema>;

// Mongoose Schemas
const subKpiSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  key: {
    type: String,
    required: true,
  },
  value_type: {
    type: String,
    enum: ['number'],
    default: 'number',
  },
});

const kpiTemplateItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  maxMarks: {
    type: Number,
    required: true,
    min: 0,
  },
  kpiType: {
    type: String,
    enum: ['percentage'],
    default: 'percentage',
  },
  kpiUnit: {
    type: String,
    enum: ['%'],
    default: '%',
  },
  isDynamic: {
    type: Boolean,
    default: false,
  },
  subKpis: {
    type: [subKpiSchema],
    default: [],
  },
});

const kpiTemplateSchema = new mongoose.Schema<KPITemplate>(
  {
    name: {
      type: String,
      required: true,
    },
    kpiName: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      required: true,
    },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'quarterly'],
      required: true,
    },
    departmentSlug: {
      type: String,
      required: true,
    },
    template: [kpiTemplateItemSchema],
    createdBy: {
      type: String,
      required: true,
    },
    updatedBy: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const kpiTemplateVersionSchema = new mongoose.Schema<KPITemplateVersion>(
  {
    templateId: {
      type: String,
      required: true,
    },
    version: {
      type: Number,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      required: true,
    },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'quarterly'],
      required: true,
    },
    departmentSlug: {
      type: String,
      required: true,
    },
    template: [kpiTemplateItemSchema],
    createdBy: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Models
export const KPITemplateModel = mongoose.model(
  'tb_kpi_template',
  kpiTemplateSchema
);
export const KPITemplateVersionModel = mongoose.model(
  'tb_kpi_template_version',
  kpiTemplateVersionSchema
);

// Export schemas for validation
export { kpitemplateZodSchema, kpitemplateVersionZodSchema };
