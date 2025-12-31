import { z } from 'zod';
import { insertEquipmentSchema, equipment, backupHistory } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  equipment: {
    list: {
      method: 'GET' as const,
      path: '/api/equipment',
      responses: {
        200: z.array(z.custom<typeof equipment.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/equipment',
      input: insertEquipmentSchema,
      responses: {
        201: z.custom<typeof equipment.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/equipment/:id',
      input: insertEquipmentSchema.partial(),
      responses: {
        200: z.custom<typeof equipment.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/equipment/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
    runBackup: {
      method: 'POST' as const,
      path: '/api/equipment/:id/backup',
      responses: {
        200: z.object({ message: z.string(), backupId: z.number() }),
        404: errorSchemas.notFound,
        500: errorSchemas.internal,
      },
    },
  },
  backups: {
    list: {
      method: 'GET' as const,
      path: '/api/backups',
      responses: {
        200: z.array(z.custom<typeof backupHistory.$inferSelect>()),
      },
    },
    download: {
      method: 'GET' as const,
      path: '/api/backups/:id/download',
      responses: {
        200: z.any(),
        404: errorSchemas.notFound,
      },
    },
  },
  user: {
    me: {
      method: 'GET' as const,
      path: '/api/user',
      responses: {
        200: z.any(),
        401: z.null(),
      },
    },
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
