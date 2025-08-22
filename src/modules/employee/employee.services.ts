import APIError from '@/lib/errors/APIError';
import { EmployeeModal, Employee } from './employee.model';
import { FilterQuery } from 'mongoose';

export class EmployeeService {
  static async createEmployee(
    employee: Omit<Employee, 'createdAt' | 'updatedAt'>
  ) {
    try {
      const newEmployee = await EmployeeModal.create(employee);
      return newEmployee;
    } catch (error) {
      throw error;
    }
  }

  static async getEmployeeById(id: string) {
    try {
      const employee = await EmployeeModal.findById(id).lean();
      return employee;
    } catch (error) {
      throw error;
    }
  }

  static async getAllEmployees({
    page = 1,
    limit = 10,
    search = '',
  }: {
    page?: number;
    limit?: number;
    search?: string;
  }) {
    try {
      const searchQuery = search
        ? {
            $or: [
              { name: { $regex: search, $options: 'i' } },
              { 'contact.email': { $regex: search, $options: 'i' } },
              { 'contact.phone': { $regex: search, $options: 'i' } },
              { department: { $regex: search, $options: 'i' } },
              { departmentRole: { $regex: search, $options: 'i' } },
            ],
          }
        : {};

      const [employees, total] = await Promise.all([
        EmployeeModal.find(searchQuery)
          .skip((page - 1) * limit)
          .limit(limit)
          .sort({ createdAt: -1 })
          .lean(),
        EmployeeModal.countDocuments(searchQuery),
      ]);

      return {
        docs: employees,
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

  static async updateEmployee(id: string, updates: Partial<Employee>) {
    try {
      const updatedEmployee = await EmployeeModal.findByIdAndUpdate(
        id,
        updates,
        {
          new: true,
        }
      ).lean();
      if (!updatedEmployee) {
        throw new APIError({
          STATUS: 404,
          TITLE: 'Employee not found',
          MESSAGE: 'Employee not found',
        });
      }
      return updatedEmployee;
    } catch (error) {
      throw error;
    }
  }

  static async deleteEmployee(id: string) {
    try {
      const deletedEmployee = await EmployeeModal.findByIdAndDelete(id);
      return deletedEmployee;
    } catch (error) {
      throw error;
    }
  }

  // Get employees by department
  static async getEmployeesByDepartment(
    department: string,
    {
      page = 1,
      limit = 10,
      search = '',
    }: {
      page?: number;
      limit?: number;
      search?: string;
    }
  ) {
    try {
      const searchQuery: FilterQuery<Employee> = search
        ? {
            $or: [
              { name: { $regex: search, $options: 'i' } },
              { 'contact.email': { $regex: search, $options: 'i' } },
              { 'contact.phone': { $regex: search, $options: 'i' } },
              { departmentRole: { $regex: search, $options: 'i' } },
            ],
          }
        : {};
      const [employees, total] = await Promise.all([
        EmployeeModal.find({ department, ...searchQuery })
          .sort({ createdAt: -1 })
          .lean(),
        EmployeeModal.countDocuments({ department, ...searchQuery }),
      ]);

      return {
        docs: employees,
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

  // Get employees by department role
  static async getEmployeesByDepartmentRole(
    departmentRole: string,
    {
      page = 1,
      limit = 10,
      search = '',
    }: {
      page?: number;
      limit?: number;
      search?: string;
    }
  ) {
    try {
      const searchQuery = search
        ? {
            $or: [
              { name: { $regex: search, $options: 'i' } },
              { 'contact.email': { $regex: search, $options: 'i' } },
              { 'contact.phone': { $regex: search, $options: 'i' } },
            ],
          }
        : {};
      const [employees, total] = await Promise.all([
        EmployeeModal.find({ departmentRole, ...searchQuery })
          .sort({ createdAt: -1 })
          .lean(),
        EmployeeModal.countDocuments({ departmentRole, ...searchQuery }),
      ]);

      return {
        docs: employees,
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
}
