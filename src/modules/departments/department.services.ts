import { DepartmentModel } from './departments.model';
import { DepartmentCreate } from './departments.model';

export class DepartmentService {
  static async createDepartment(department: DepartmentCreate) {
    const newDepartment = await DepartmentModel.create(department);
    return newDepartment;
  }

  static async getDepartment(id: string) {
    const department = await DepartmentModel.findById(id).lean();
    return department;
  }

  static async getDepartments({
    page = 1,
    limit = 10,
    search = '',
  }: {
    page?: number;
    limit?: number;
    search?: string;
  }) {
    const [departments, total] = await Promise.all([
      DepartmentModel.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { slug: { $regex: search, $options: 'i' } },
        ],
      })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      DepartmentModel.countDocuments({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { slug: { $regex: search, $options: 'i' } },
        ],
      }),
    ]);

    return {
      docs: departments,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page < Math.ceil(total / limit),
      hasPreviousPage: page > 1,
    };
  }

  static async updateDepartment(id: string, department: DepartmentCreate) {
    const updatedDepartment = await DepartmentModel.findByIdAndUpdate(
      id,
      department,
      { new: true }
    ).lean();
    return updatedDepartment;
  }

  static async deleteDepartment(id: string) {
    const deletedDepartment = await DepartmentModel.findByIdAndDelete(id);
    return deletedDepartment;
  }
}
