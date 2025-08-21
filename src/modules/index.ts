import express from 'express';
import { createRouter } from '@/configs/server.config';
import departmentRouter from '@/modules/departments/departments.route';
import employeeRouter from '@/modules/employee/employee.route';
import templateRouter from '@/modules/template/template.route';
import entryRouter from '@/modules/entry/entry.route';

const router = createRouter();

router.use('/departments', departmentRouter);
router.use('/employees', employeeRouter);
router.use('/templates', templateRouter);
router.use('/entries', entryRouter);

export default router;
