import serverlessExpress from '@vendia/serverless-express';
import { app } from './app';

export const handler = serverlessExpress({
  app,
  // Defaults only base64-encode image/*, which corrupts proxied exercise videos.
  binarySettings: {
    contentTypes: ['image/*', 'video/*', 'application/octet-stream'],
  },
});
