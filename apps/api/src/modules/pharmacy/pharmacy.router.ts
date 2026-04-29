import { Router } from 'express';

export const pharmacyRouter = Router();

pharmacyRouter.get('/', (_req, res) => {
  res.json({
    success: true,
    data: {
      message: 'Pharmacy module is available.',
    },
  });
});
