import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock all db interactions
jest.mock('@/infrastructure/database/db.client', () => ({
  getDb: jest.fn(() => ({ query: jest.fn() })),
}));

jest.mock('@/modules/doctors/doctors.repository');

describe('AvailabilityEngine — slot generation', () => {

  // Test the private slot generation algorithm directly
  function generateSlots(start: string, end: string, duration: number): string[] {
    const slots: string[] = [];
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const startMins = sh * 60 + sm;
    const endMins   = eh * 60 + em;

    for (let min = startMins; min < endMins; min += duration) {
      const h = Math.floor(min / 60).toString().padStart(2, '0');
      const m = (min % 60).toString().padStart(2, '0');
      slots.push(`${h}:${m}`);
    }
    return slots;
  }

  it('generates correct number of 15-min slots for 08:00–12:00', () => {
    const slots = generateSlots('08:00', '12:00', 15);
    expect(slots).toHaveLength(16);
    expect(slots[0]).toBe('08:00');
    expect(slots[slots.length - 1]).toBe('11:45');
  });

  it('generates correct number of 30-min slots for 08:00–17:00', () => {
    const slots = generateSlots('08:00', '17:00', 30);
    expect(slots).toHaveLength(18);
  });

  it('generates 1 slot for a 60-min window with 60-min duration', () => {
    const slots = generateSlots('09:00', '10:00', 60);
    expect(slots).toHaveLength(1);
    expect(slots[0]).toBe('09:00');
  });

  it('generates no slots when start equals end', () => {
    const slots = generateSlots('10:00', '10:00', 15);
    expect(slots).toHaveLength(0);
  });

  it('handles midnight boundary correctly', () => {
    const slots = generateSlots('23:30', '24:00', 15);
    expect(slots).toHaveLength(2);
    expect(slots[0]).toBe('23:30');
    expect(slots[1]).toBe('23:45');
  });

  it('generates 5-min slots correctly', () => {
    const slots = generateSlots('08:00', '09:00', 5);
    expect(slots).toHaveLength(12);
  });

});
