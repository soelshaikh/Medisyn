// Public-facing (no isActive field)
export interface PublicVaccineService {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  eligibilityNotes: string | null;
  doseNumber: string | null;
}

// Admin-facing (full record)
export interface AdminVaccineService extends PublicVaccineService {
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
