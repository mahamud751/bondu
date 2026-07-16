const { isWithinVendorSchedule } = require('../dist/src/vendors/vendor-schedule');

describe('vendor working schedules', () => {
  const window = (dayOfWeek,startMinute,endMinute) => ({ dayOfWeek,startMinute,endMinute,timezone:'UTC',enabled:true });
  it('allows unrestricted availability when no schedule is enabled',()=>expect(isWithinVendorSchedule([],new Date('2026-07-13T03:00:00Z'))).toBe(true));
  it('enforces a daytime window in the configured timezone',()=>{const monday=window(1,9*60,17*60);expect(isWithinVendorSchedule([monday],new Date('2026-07-13T10:00:00Z'))).toBe(true);expect(isWithinVendorSchedule([monday],new Date('2026-07-13T18:00:00Z'))).toBe(false)});
  it('supports overnight shifts across the following day',()=>{const monday=window(1,22*60,2*60);expect(isWithinVendorSchedule([monday],new Date('2026-07-13T23:00:00Z'))).toBe(true);expect(isWithinVendorSchedule([monday],new Date('2026-07-14T01:00:00Z'))).toBe(true);expect(isWithinVendorSchedule([monday],new Date('2026-07-14T03:00:00Z'))).toBe(false)});
});
