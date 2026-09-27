import { PharmacySettingsModel, type IWorkingHours } from "./settings.schema";

const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

async function getOrCreate() {
  let settings = await PharmacySettingsModel.findOne();
  if (!settings) {
    settings = await PharmacySettingsModel.create({
      workingHours: DAYS.map((_, day) => ({
        day,
        isOpen:    day >= 1 && day <= 5, // Mon-Fri open by default
        openTime:  "09:00",
        closeTime: "18:00",
      })),
    });
  }
  return settings;
}

export async function getSettings() {
  return getOrCreate();
}

export async function updateInfo(data: Partial<{ pharmacyName: string; phone: string; email: string; address: string; city: string; province: string; postalCode: string; licenseNumber: string }>) {
  const settings = await getOrCreate();
  Object.assign(settings, data);
  return settings.save();
}

export async function updateWorkingHours(hours: IWorkingHours[]) {
  const settings = await getOrCreate();
  settings.workingHours = hours as never;
  return settings.save();
}

export async function addHoliday(data: { date: string; name: string; isClosed: boolean }) {
  const settings = await getOrCreate();
  settings.holidays.push(data as never);
  return settings.save();
}

export async function updateHoliday(holidayId: string, data: Partial<{ date: string; name: string; isClosed: boolean }>) {
  const settings = await getOrCreate();
  const holiday = settings.holidays.id(holidayId);
  if (!holiday) throw new Error("Holiday not found");
  Object.assign(holiday, data);
  return settings.save();
}

export async function deleteHoliday(holidayId: string) {
  const settings = await getOrCreate();
  const holiday = settings.holidays.id(holidayId);
  if (!holiday) throw new Error("Holiday not found");
  holiday.deleteOne();
  return settings.save();
}
