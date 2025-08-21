import { createAuthMiddleware } from 'better-auth/plugins';
import { auth } from '../auth';
import {
  APIError,
  BetterAuthOptions,
  GenericEndpointContext,
} from 'better-auth';

export const authHooks = {
  before: createAuthMiddleware(async (ctx) => {
    if (ctx.path.startsWith('/admin/create-user')) {
      const session = await auth.api.getSession({
        headers: ctx.headers as Headers,
      });
      // @ts-ignore
      if (session?.user?.role !== 'admin') {
        throw new APIError('UNAUTHORIZED', {
          message: 'Unauthorized to create user because you are not an admin',
        });
      }
      // const member = await MemberService.getMemberByUserId(session.user.id);
      // if (
      //   !(
      //     member?.departmentSlug === 'collector-office' ||
      //     member?.role?.startsWith('nodalOfficer')
      //   )
      // ) {
      //   throw new APIError('UNAUTHORIZED', {
      //     message:
      //       'Unauthorized Member should be from collector-office or nodalOfficer',
      //   });
      // }
      // if (!(member?.departmentSlug === 'collector-office')) {
      //   if (
      //     !(
      //       member?.role?.startsWith('nodalOfficer') &&
      //       member.departmentSlug === ctx.body.data.department
      //     )
      //   ) {
      //     throw new APIError('UNAUTHORIZED', {
      //       message:
      //         'Unauthorized Member should be from nodalOfficer and should be from the same department',
      //     });
      //   }

      //   if (
      //     !(
      //       member?.role?.startsWith('nodalOfficer') &&
      //       member.role.split('-')[1] === ctx.body.data.role
      //     )
      //   ) {
      //     throw new APIError('UNAUTHORIZED', {
      //       message:
      //         'Unauthorized Member should be from nodalOfficer and assigned to the same role',
      //     });
      //   }
      // }
    }
  }),
  // after: createAuthMiddleware(async (ctx) => {
  //   if (ctx.path.startsWith('/admin/create-user')) {
  //     const body = ctx.body;
  //     const returned = ctx.context.returned as any;
  //   }
  // }),
};

export const authDbHooks: BetterAuthOptions['databaseHooks'] = {
  user: {
    create: {
      before: async (user, ctx) => {
        return {
          data: {
            ...user,
            role:
              // @ts-ignore
              user?.role === 'admin' || user?.role.startsWith('nodalOfficer')
                ? 'admin'
                : 'user',
          },
        };
      },
    },
  },
};
