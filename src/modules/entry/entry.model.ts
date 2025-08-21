import mongoose from 'mongoose';
import { z } from 'zod';

export const kpientryZodSchema = z
  .object({
    employeeId: z.string(),
    templateId: z.string(),
    month: z.number().int().min(1).max(12, 'Month must be between 1 and 12'),
    year: z.number().int().min(2000, 'Year must be 2000 or later'),
    kpiNames: z
      .array(
        z.object({
          label: z.string().nonempty('KPI label is required'),
          value: z.string().optional(),
        })
      )
      .min(1, 'At least one KPI required'),
    values: z
      .array(
        z.object({
          key: z.string().nonempty('KPI key is required'),
          value: z
            .number()
            .min(0)
            .max(100, 'Value must be a percentage between 0 and 100')
            .optional(),
          score: z.number().min(0, 'Score must be non-negative').optional(),
          subKpis: z
            .array(
              z.object({
                key: z.string().nonempty('Sub-KPI key is required'),
                value: z
                  .number()
                  .min(0, 'Sub-KPI value must be non-negative')
                  .optional(),
              })
            )
            .default([])
            .optional(),
        })
      )
      .min(1, 'At least one KPI value required'),
    score: z.number().min(0, 'Total score must be non-negative').optional(),
    status: z.enum(['initiated', 'inprogress', 'generated'], {
      errorMap: () => ({
        message: 'Status must be initiated, inprogress, or generated',
      }),
    }),
    dataSource: z.string().optional(),
    createdAt: z.date().optional(),
    updatedAt: z.date().optional(),
  })
  .refine(
    (data) =>
      data.kpiNames.every((kpi) =>
        data.values.some(
          (v) => v.key === kpi.label.toLowerCase().replace(/[^a-z0-9]/g, '')
        )
      ),
    'Each kpiNames.label must have a corresponding values.key'
  )
  .refine(
    (data) =>
      data.values.every(
        (v) =>
          !v.subKpis ||
          v.subKpis.length === 0 ||
          (v.subKpis.some((sk) => sk.key === 'darj') &&
            v.subKpis.some((sk) => sk.key === 'nirakrit'))
      ),
    "If sub-KPIs are provided, each KPI must include 'darj' and 'nirakrit' sub-KPIs"
  );

export type Entry = z.infer<typeof kpientryZodSchema>;

// Mongoose Schema
const kpiNameSchema = new mongoose.Schema({
  label: {
    type: String,
    required: true,
  },
  value: {
    type: String,
  },
});

const subKpiValueSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
  },
  value: {
    type: Number,
    min: 0,
  },
});

const kpiValueSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
  },
  value: {
    type: Number,
    min: 0,
    max: 100,
  },
  score: {
    type: Number,
    min: 0,
    default: 0,
  },
  subKpis: {
    type: [subKpiValueSchema],
    default: [],
  },
});

const entrySchema = new mongoose.Schema<Entry>(
  {
    employeeId: {
      type: String,
      required: true,
    },
    templateId: {
      type: String,
      required: true,
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    year: {
      type: Number,
      required: true,
      min: 2000,
    },
    kpiNames: [kpiNameSchema],
    values: [kpiValueSchema],
    score: {
      type: Number,
      min: 0,
      default: 0,
    },
    status: {
      type: String,
      enum: ['initiated', 'inprogress', 'generated'],
      default: 'initiated',
    },
    dataSource: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index for employee, month, year, and kpiNames
// This allows multiple entries for same employee in same month with different KPI names
entrySchema.index(
  {
    employeeId: 1,
    month: 1,
    year: 1,
    'kpiNames.label': 1,
    'kpiNames.value': 1,
  },
  { unique: true }
);

// Index for efficient queries
entrySchema.index({ employeeId: 1, templateId: 1 });
entrySchema.index({ month: 1, year: 1 });
entrySchema.index({ status: 1 });

// Model
export const EntryModel = mongoose.model('tb_kpi_entry', entrySchema);

// Export schema for validation
