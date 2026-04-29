import { Router }    from 'express';
import rateLimit     from 'express-rate-limit';
import { authController }       from './auth.controller';
import { authenticate }         from '@/shared/middleware/authenticate';
import { validate }             from '@/shared/middleware/validate';
import { loginSchema, refreshSchema, changePasswordSchema } from './auth.validation';

export const authRouter = Router();

const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      10,
  message: {
    success: false,
    error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many attempts. Try in 15 minutes.' },
  },
});

authRouter.post('/login',   loginLimit, validate(loginSchema),   authController.login);
authRouter.post('/refresh', validate(refreshSchema),             authController.refresh);
authRouter.post('/logout',                                       authController.logout);
authRouter.get ('/me',      authenticate,                        authController.me);
authRouter.post('/change-password', authenticate, validate(changePasswordSchema), authController.changePassword);
