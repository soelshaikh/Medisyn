export type BookingType = 'STRICT' | 'OPEN';

export interface AdminAvailabilitySlot {
  id: string;
  serviceId: string;
  serviceName: string;
  slotDate: string;
  startTime: string;
  endTime: string;
  capacity: number;
  bookingType: BookingType;
  openCapacity: number | null;
  bookedCount: number;
  remaining: number;
  isActive: boolean;
  createdAt: Date;
}

// Patient-facing: openCapacity is intentionally absent
export interface PatientAvailableSlot {
  id: string;
  serviceId: string;
  serviceName: string;
  slotDate: string;
  startTime: string;
  endTime: string;
  capacity: number;
  remaining: number;
}
