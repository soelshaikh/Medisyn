import { Router } from 'express';
import { vaccineServiceRouter } from './vaccine-services/vaccine-service.router';
import { availabilitySlotRouter } from './availability-slots/availability-slot.router';
import { appointmentRouter } from './appointments/appointment.router';

export const appointmentsRouter = Router();

appointmentsRouter.use(vaccineServiceRouter);
appointmentsRouter.use(availabilitySlotRouter);
appointmentsRouter.use(appointmentRouter);
