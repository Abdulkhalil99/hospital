const mockDb = { query: jest.fn() };
jest.mock('@/infrastructure/database/db.client', () => ({ getDb: jest.fn(() => mockDb) }));
jest.mock('@/infrastructure/logger/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn() },
}));
jest.mock('@/shared/events/event-bus', () => ({ eventBus: { emit: jest.fn() } }));

import { LaboratoryService } from '@/modules/laboratory/laboratory.service';
import { eventBus } from '@/shared/events/event-bus';
import { EVENTS } from '@/shared/events/event-types';

describe('Laboratory validation and release', () => {
  beforeEach(() => jest.clearAllMocks());

  it('only releases validated results and reports the number actually changed', async () => {
    mockDb.query.mockResolvedValue({ rows: [{ id: 'validated-result' }] });
    await expect(new LaboratoryService().releaseResults(
      ['validated-result', 'unvalidated-result', 'missing-result', 'validated-result'], 'doctor',
    )).resolves.toEqual({ released: 1 });
    const [query] = mockDb.query.mock.calls[0];
    expect(query).toContain('AND validated_at IS NOT NULL');
    expect(query).toContain('AND released_at IS NULL');
    expect(query).toContain('RETURNING id');
  });

  it('reports zero when no result is eligible for release', async () => {
    mockDb.query.mockResolvedValue({ rows: [] });
    await expect(new LaboratoryService().releaseResults(['unvalidated-result'], 'doctor'))
      .resolves.toEqual({ released: 0 });
  });

  it('notifies and counts only newly validated results', async () => {
    mockDb.query.mockResolvedValue({ rows: [{ id: 'new-result' }] });
    await expect(new LaboratoryService().validateResults(
      ['new-result', 'already-validated', 'missing-result', 'new-result'], 'doctor',
    )).resolves.toEqual({ validated: 1 });
    expect(eventBus.emit).toHaveBeenCalledWith(EVENTS.LAB_RESULT_READY, { resultIds: ['new-result'] });
  });

  it('does not emit another ready notification when no validation changed', async () => {
    mockDb.query.mockResolvedValue({ rows: [] });
    await expect(new LaboratoryService().validateResults(['already-validated'], 'doctor'))
      .resolves.toEqual({ validated: 0 });
    expect(eventBus.emit).not.toHaveBeenCalled();
  });

  it('rejects an empty release without writing to the database', async () => {
    await expect(new LaboratoryService().releaseResults([], 'doctor'))
      .rejects.toMatchObject({ statusCode: 422 });
    expect(mockDb.query).not.toHaveBeenCalled();
  });
});
