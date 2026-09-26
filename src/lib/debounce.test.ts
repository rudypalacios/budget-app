import { createDebouncedWriter } from './debounce';

describe('createDebouncedWriter', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('collapses a burst of schedules into one write of the last value', () => {
    const write = jest.fn();
    const writer = createDebouncedWriter(write, 400);

    writer.schedule(4);
    jest.advanceTimersByTime(100);
    writer.schedule(5);
    jest.advanceTimersByTime(100);
    writer.schedule(6);
    jest.advanceTimersByTime(100);
    writer.schedule(7);

    expect(write).not.toHaveBeenCalled();
    jest.advanceTimersByTime(399);
    expect(write).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith(7);
  });

  it('writes separately when schedules are further apart than the delay', () => {
    const write = jest.fn();
    const writer = createDebouncedWriter(write, 400);

    writer.schedule(1);
    jest.advanceTimersByTime(400);
    writer.schedule(2);
    jest.advanceTimersByTime(400);

    expect(write.mock.calls).toEqual([[1], [2]]);
  });

  it('flush writes the waiting value immediately, and only once', () => {
    const write = jest.fn();
    const writer = createDebouncedWriter(write, 400);

    writer.schedule(3);
    writer.flush();
    expect(write).toHaveBeenCalledWith(3);

    jest.advanceTimersByTime(400);
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('flush is a no-op when nothing is waiting', () => {
    const write = jest.fn();
    const writer = createDebouncedWriter(write, 400);

    writer.flush();
    expect(write).not.toHaveBeenCalled();
  });

  it('cancel drops the waiting value', () => {
    const write = jest.fn();
    const writer = createDebouncedWriter(write, 400);

    writer.schedule(3);
    writer.cancel();
    jest.advanceTimersByTime(400);
    writer.flush();

    expect(write).not.toHaveBeenCalled();
  });
});
