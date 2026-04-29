import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8).max(100),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z.string()
    .min(8, 'Minimum 8 characters')
    .max(100)
    .regex(/[A-Z]/,          'Must have uppercase letter')
    .regex(/[0-9]/,          'Must have a number')
    .regex(/[^A-Za-z0-9]/,  'Must have a special character'),
  confirmPassword: z.string(),
}).refine(d => d.newPassword === d.confirmPassword, {
  message: 'Passwords do not match',
  path:    ['confirmPassword'],
});
