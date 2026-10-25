import { Router }    from 'express';
import rateLimit     from 'express-rate-limit';
import { authController }       from './auth.controller';
import { authenticate }         from '@/shared/middleware/authenticate';
import { validate }             from '@/shared/middleware/validate';
import { loginSchema, refreshSchema, changePasswordSchema, mfaCredentialSchema, mfaEnrollmentSchema } from './auth.validation';
import { MfaService } from './mfa.service';
import { asyncHandler } from '@/shared/utils/async-handler';

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
const securityLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 20,
  keyGenerator: req => req.user!.id,
  message: { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many security requests. Try in 15 minutes.' } },
});
authRouter.post('/change-password', authenticate, securityLimit, validate(changePasswordSchema), authController.changePassword);
const mfa = new MfaService();
authRouter.use('/mfa', authenticate, (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
authRouter.get('/mfa', asyncHandler(async (req, res) => { res.json({ success: true, data: await mfa.status(req.user!.id) }); }));
authRouter.post('/mfa/enroll', securityLimit, validate(mfaEnrollmentSchema), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await mfa.enroll(req.user!.id, req.body.currentPassword) });
}));
authRouter.post('/mfa/confirm', securityLimit, validate(mfaCredentialSchema), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await mfa.confirm(req.user!.id, req.body) });
}));
authRouter.post('/mfa/disable', securityLimit, validate(mfaCredentialSchema), asyncHandler(async (req, res) => {
  await mfa.disable(req.user!.id, req.body); res.json({ success: true, data: { enabled: false } });
}));
authRouter.post('/mfa/recovery-codes', securityLimit, validate(mfaCredentialSchema), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await mfa.regenerate(req.user!.id, req.body) });
}));
