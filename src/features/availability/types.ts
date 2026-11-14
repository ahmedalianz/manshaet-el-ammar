export type ServiceMode = 'fixed' | 'mobile' | 'both';
export type DayKey = 'sat' | 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri';
export type TimePeriod = { start: string; end: string; overnight: boolean };
export type DayHours = {
  status: 'unspecified' | 'closed' | 'appointment' | 'allDay' | 'open';
  periods?: TimePeriod[];
};
export type WeeklyHours = Partial<Record<DayKey, DayHours>>;
export type Availability = {
  serviceMode?: ServiceMode;
  coverageAreas?: string[];
  weeklyHours?: WeeklyHours;
};
