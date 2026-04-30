import { getDb } from '@/infrastructure/database/db.client';
import { DoctorsRepository } from './doctors.repository';
import { TimeSlot, AvailabilityResult } from './doctors.types';

export class AvailabilityEngine {
  private repo = new DoctorsRepository();
  private db   = getDb();

  // Generate all time slots for a given schedule template
  private generateSlots(
    startTime:    string,
    endTime:      string,
    slotDuration: number,
  ): string[] {
    const slots: string[] = [];
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const startMins = sh * 60 + sm;
    const endMins   = eh * 60 + em;

    for (let min = startMins; min < endMins; min += slotDuration) {
      const h = Math.floor(min / 60).toString().padStart(2, '0');
      const m = (min % 60).toString().padStart(2, '0');
      slots.push(`${h}:${m}`);
    }
    return slots;
  }

  // Check if a date is a public holiday
  private async isHoliday(dateStr: string): Promise<boolean> {
    const { rows } = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) FROM settings.public_holidays
       WHERE holiday_date = $1::DATE
          OR (is_recurring = TRUE
              AND EXTRACT(MONTH FROM holiday_date) = EXTRACT(MONTH FROM $1::DATE)
              AND EXTRACT(DAY   FROM holiday_date) = EXTRACT(DAY   FROM $1::DATE))`,
      [dateStr],
    );
    return Number(rows[0].count) > 0;
  }

  // Core method — computes full availability for one doctor on one date
  async getForDate(doctorId: string, dateStr: string): Promise<AvailabilityResult> {
    const date = new Date(dateStr);

    // 1. Check if it is a public holiday
    const isHoliday = await this.isHoliday(dateStr);
    if (isHoliday) {
      return { date: dateStr, doctorId, isWorkDay: false, isOnLeave: false, isHoliday: true, slots: [], totalSlots: 0, freeSlots: 0 };
    }

    // 2. Check if doctor is on leave
    const isOnLeave = await this.repo.isOnLeave(doctorId, dateStr);
    if (isOnLeave) {
      return { date: dateStr, doctorId, isWorkDay: true, isOnLeave: true, isHoliday: false, slots: [], totalSlots: 0, freeSlots: 0 };
    }

    // 3. Get schedule template for this day-of-week
    const schedule = await this.repo.getScheduleForDate(doctorId, date);
    if (!schedule) {
      return { date: dateStr, doctorId, isWorkDay: false, isOnLeave: false, isHoliday: false, slots: [], totalSlots: 0, freeSlots: 0 };
    }

    // 4. Generate all time slots from the template
    const slotTimes  = this.generateSlots(
      schedule.start_time.slice(0, 5),
      schedule.end_time.slice(0, 5),
      schedule.slot_duration,
    );

    // 5. Get existing booking counts for all slots in one query
    const bookingCounts = await this.repo.getBookingCounts(doctorId, dateStr);

    // 6. Build the availability array
    const now       = new Date();
    const isToday   = dateStr === now.toISOString().split('T')[0];
    const nowMins   = now.getHours() * 60 + now.getMinutes();

    const slots: TimeSlot[] = slotTimes.map((startTime, i) => {
      const [sh, sm]   = startTime.split(':').map(Number);
      const endMins    = sh * 60 + sm + schedule.slot_duration;
      const endH       = Math.floor(endMins / 60).toString().padStart(2, '0');
      const endM       = (endMins % 60).toString().padStart(2, '0');
      const endTime    = `${endH}:${endM}`;
      const booked     = bookingCounts.get(startTime) ?? 0;
      // Slot is available if: not in past, not fully booked
      const isPast     = isToday && (sh * 60 + sm) <= nowMins;
      const available  = !isPast && booked < schedule.max_patients;

      return {
        startTime,
        endTime,
        available,
        bookedCount: booked,
        maxPatients: schedule.max_patients,
      };
    });

    const freeSlots = slots.filter(s => s.available).length;

    return {
      date:       dateStr,
      doctorId,
      isWorkDay:  true,
      isOnLeave:  false,
      isHoliday:  false,
      slots,
      totalSlots: slots.length,
      freeSlots,
    };
  }

  // Get availability for a date range — returns a date-keyed map
  async getForDateRange(
    doctorId: string,
    fromDate: string,
    toDate:   string,
  ): Promise<Record<string, AvailabilityResult>> {
    const result: Record<string, AvailabilityResult> = {};
    const from = new Date(fromDate);
    const to   = new Date(toDate);

    // Max 60 days to prevent abuse
    const maxDays = 60;
    let current   = new Date(from);
    let count     = 0;

    while (current <= to && count < maxDays) {
      const dateStr = current.toISOString().split('T')[0];
      result[dateStr] = await this.getForDate(doctorId, dateStr);
      current.setDate(current.getDate() + 1);
      count++;
    }

    return result;
  }
}
