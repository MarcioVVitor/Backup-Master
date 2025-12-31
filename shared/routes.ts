import { z } from 'zod';
import { insertFileSchema, files } from './schema';

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
  files: {
    list: {
      method: 'GET' as const,
      path: '/api/files',
      responses: {
        200: z.array(z.custom<typeof files.$inferSelect>()),
      },
    },
    upload: {
      method: 'POST' as const,
      path: '/api/files',
      // Input validation handled by multipart form data in handler
      responses: {
        201: z.custom<typeof files.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/files/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  user: {
    me: {
      method: 'GET' as const,
      path: '/api/user',
      responses: {
        200: z.any(), // User object
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
