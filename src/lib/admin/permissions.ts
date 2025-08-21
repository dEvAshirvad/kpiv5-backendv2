import { createAccessControl } from 'better-auth/plugins/access';
import { defaultStatements, adminAc } from 'better-auth/plugins/admin/access';

/**
 * KPI System Statements
 * employee: create, list, update, delete
 * template: create, list, update, delete
 * kpi: create, list, update, delete
 * user: create, list, set-role, ban, impersonate, delete, set-password (from defaultStatements)
 * session: list, revoke, delete (from defaultStatements)
 */

const kpiStatements = {
  employee: ['create', 'list', 'update', 'delete'],
  template: ['create', 'list', 'update', 'delete'],
  kpi: ['create', 'list', 'update', 'delete'],
};

const statement = {
  ...defaultStatements,
  ...kpiStatements,
} as const;

const ac = createAccessControl(statement);

// Admin role: Full access to all resources
const admin = ac.newRole({
  ...adminAc.statements,
  ...kpiStatements,
});

// NodalOfficer role: Limited access (e.g., cannot create templates or delete employees)
const nodalOfficer = ac.newRole({
  employee: ['create', 'list', 'update'],
  template: ['list', 'update'],
  kpi: ['create', 'list', 'update'],
});

export { ac, admin, nodalOfficer };
