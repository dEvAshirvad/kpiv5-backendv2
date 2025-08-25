import { betterAuth, BetterAuthOptions } from 'better-auth';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import { db } from '@/configs/db/mongodb';
import { admin, openAPI } from 'better-auth/plugins';
import origins from '@/configs/origins';
import password from '@/lib/password';
import adminConfig from '@/lib/admin';
import { authDbHooks, authHooks } from './hooks/auth';
import env from '@/configs/env';

const betterAuthConfig: BetterAuthOptions = {
  emailAndPassword: {
    enabled: true,
    password,
  },
  hooks: authHooks,
  user: {
    additionalFields: {
      department: {
        type: 'string',
        required: false,
      },
      departmentRole: {
        type: 'string',
        required: false,
      },
    },
  },
  databaseHooks: authDbHooks,
  database: mongodbAdapter(db),
  plugins: [openAPI(), admin(adminConfig)],
  advanced: {
    cookiePrefix: 'rdmp',
    crossSubDomainCookies: {
      enabled: true,
      domain: env.COOKIE_DOMAIN,
    },
  },
  trustedOrigins: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003',
    'http://localhost:3030',
    'http://localhost:3031',
    'http://localhost:3032',
    'https://kpiservice.rdmp.in',
    'https://auth.rdmp.in',
    'https://shresth.rdmp.in',
    'https://rahat.rdmp.in',
    'https://filesapi.rdmp.in',
    'https://rahatapi.rdmp.in',
    'https://urvi.rdmp.in',
    'http://69.62.77.63:6030',
    'http://69.62.77.63:6031',
    'https://shresthv2.rdmp.in',
    'https://kpiapiv2.rdmp.in',
  ],
};

export const auth = betterAuth(betterAuthConfig);
