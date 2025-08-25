import express, { Express } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import Respond from '@/lib/respond';
import serveEmojiFavicon from '@/middlewares/serveEmojiFavicon';
import requestLogger from '@/middlewares/requestLogger';
import { errorHandler } from '@/middlewares/error-handler';
import router from '@/modules';
import sessions from '@/middlewares/sessions';
import { toNodeHandler } from 'better-auth/node';
import { auth } from '@/lib/auth';

const allowedOrigins = [
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
];

export function createRouter(): Express {
  return express();
}

export default function createApp() {
  const app = createRouter();

  app.use(
    cors({
      credentials: true,
      origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
    })
  );
  app.use(cookieParser());
  app.all('/api/auth/*splat', toNodeHandler(auth));
  app.use(express.json({ limit: '2048mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2048mb' }));
  app.use(requestLogger());

  app.use(serveEmojiFavicon('🔥'));
  app.get('/', (_, res) => {
    Respond(res, { message: 'API services are nominal kpiv5 v2!!' }, 200);
  });
  app.use(sessions);
  app.use('/api/v1', router);

  app.use(errorHandler);
  return app;
}
