import mongoose from 'mongoose';
import { z } from 'zod';

export const employeeZodSchema = z.object({
  name: z.string(),
  contact: z.object({
    email: z.string().email().optional(),
    phone: z.string(),
  }),
  department: z.string(),
  departmentRole: z.string(),
  metadata: z.record(z.string(), z.string()).optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type Employee = z.infer<typeof employeeZodSchema>;

const employeeSchema = new mongoose.Schema<Employee>(
  {
    name: {
      type: String,
      required: true,
    },
    contact: {
      email: {
        type: String,
      },
      phone: {
        type: String,
        required: true,
      },
    },
    department: {
      type: String,
    },
    departmentRole: {
      type: String,
    },
    metadata: {
      type: Map,
      of: String,
    },
  },
  {
    timestamps: true,
  }
);

export const EmployeeModal = mongoose.model('tb_employees', employeeSchema);
