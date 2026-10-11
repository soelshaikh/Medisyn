import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './swagger.config';

export const swaggerRouter = Router();

swaggerRouter.get('/swagger.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

swaggerRouter.use('/', swaggerUi.serve);
swaggerRouter.get('/', swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'MediSyn API Docs',
  swaggerOptions: { persistAuthorization: true },
}));
