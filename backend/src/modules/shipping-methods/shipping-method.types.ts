export interface ShippingMethod {
  id: string;
  facilityId: string;
  name: string;
  description: string | null;
  flatRate: string;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
  isActive: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateShippingMethodInput {
  name: string;
  description?: string;
  flatRate: number;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
  displayOrder?: number;
}

export interface UpdateShippingMethodInput {
  name?: string;
  description?: string;
  flatRate?: number;
  estimatedDaysMin?: number;
  estimatedDaysMax?: number;
  displayOrder?: number;
}
