import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'MediSyn API',
      version: '1.0.0',
      description: 'MediSyn healthcare platform REST API',
    },
    servers: [{ url: '/api/v1', description: 'MediSyn API v1' }],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
                requestId: { type: 'string' },
              },
            },
          },
        },
      },
    },
    tags: [
      { name: 'Auth', description: 'Authentication and session management' },
      { name: 'Catalogue', description: 'Products, categories, inventory, coupons' },
      { name: 'Commerce', description: 'Cart, checkout, orders, shipping' },
      { name: 'Healthcare', description: 'Prescriptions, compounding, ask-pharmacist, minor ailments' },
      { name: 'Appointments', description: 'Vaccine services, availability slots, booking' },
      { name: 'Notifications', description: 'User notifications' },
      { name: 'Reports', description: 'Admin reports and dashboard metrics' },
    ],
  },
  apis: [
    path.join(__dirname, '../../core/auth/*.router.{ts,js}'),
    path.join(__dirname, '../../modules/**/*.router.{ts,js}'),
    path.join(__dirname, '../../notifications/*.router.{ts,js}'),
    path.join(__dirname, '../../email/*.router.{ts,js}'),
  ],
};

export const swaggerSpec = swaggerJsdoc(options);
