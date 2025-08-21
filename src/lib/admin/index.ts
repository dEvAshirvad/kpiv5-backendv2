import {
  ac,
  admin as adminRole,
  nodalOfficer as nodalOfficerRole,
} from '@/lib/admin/permissions';

const admin = {
  ac,
  defaultRole: 'user',
  adminRoles: 'admin',
  roles: {
    admin: adminRole,
    nodalOfficer: nodalOfficerRole,
  },
};

export default admin;
