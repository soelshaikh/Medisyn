import { Router } from 'express';
import { prescriptionRouter } from './prescriptions/prescription.router';
import { compoundingRouter } from './compounding/compounding.router';
import { minorAilmentRouter } from './minor-ailments/minor-ailment.router';
import { askPharmacistRouter } from './ask-pharmacist/ask-pharmacist.router';

export const healthcareRouter = Router();

healthcareRouter.use(prescriptionRouter);
healthcareRouter.use(compoundingRouter);
healthcareRouter.use(minorAilmentRouter);
healthcareRouter.use(askPharmacistRouter);
