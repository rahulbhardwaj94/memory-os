import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { WorkingMemoryService } from '../src/working-memory/working-memory.service';

describe('WorkingMemoryService', () => {
  let service: WorkingMemoryService;

  beforeEach(() => {
    // env.SESSION_TTL_SECONDS defaults to 3600 in tests
    service = new WorkingMemoryService();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('remember + recall round-trips entries in insertion order', () => {
    service.remember('s1', 'first note');
    service.remember('s1', 'second note');

    const entries = service.recall('s1');
    expect(entries).toHaveLength(2);
    expect(entries[0]?.content).toBe('first note');
    expect(entries[1]?.content).toBe('second note');
  });

  it('recall returns empty array for unknown session', () => {
    expect(service.recall('unknown')).toEqual([]);
  });

  it('clear removes all entries for a session', () => {
    service.remember('s2', 'something');
    service.clear('s2');
    expect(service.recall('s2')).toEqual([]);
  });

  it('sessions are isolated from each other', () => {
    service.remember('s-a', 'note for a');
    service.remember('s-b', 'note for b');

    expect(service.recall('s-a')).toHaveLength(1);
    expect(service.recall('s-b')).toHaveLength(1);
    expect(service.recall('s-a')[0]?.content).toBe('note for a');
  });

  it('purgeExpired evicts sessions past their TTL', () => {
    vi.useFakeTimers();

    service.remember('s3', 'will expire');
    // Advance past the 3600s default TTL
    vi.advanceTimersByTime(3_601_000);

    service.purgeExpired();
    expect(service.recall('s3')).toEqual([]);
  });

  it('recall refreshes TTL so active sessions survive a purge', () => {
    vi.useFakeTimers();

    service.remember('s4', 'active');
    vi.advanceTimersByTime(3_500_000); // just under TTL
    service.recall('s4');              // refresh TTL
    vi.advanceTimersByTime(3_500_000); // would have expired without refresh

    service.purgeExpired();
    expect(service.recall('s4')).toHaveLength(1);
  });
});
