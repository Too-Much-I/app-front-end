import { z } from 'zod';

export const learningUploadSchema = z.object({
  submissionId: z.string().uuid(),
  url: z.url({ protocol: /^https$/ }),
  expiresAt: z.iso.datetime({ offset: true }),
  maxBytes: z
    .number()
    .int()
    .positive()
    .max(8 * 1024 * 1024),
});
