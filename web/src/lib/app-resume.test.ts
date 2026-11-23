import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { onResume, resumeDedupeMs } from "@/lib/app-resume";

describe("onResume", () => {
  let stop: (() => void) | undefined;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
  });

  afterEach(() => {
    stop?.();
    vi.useRealTimers();
    Reflect.deleteProperty(document, "visibilityState");
  });

  it.each([
    ["visibilitychange", document],
    ["pageshow", window],
    ["focus", window],
  ] as const)("runs on %s", (event, target) => {
    const callback = vi.fn();
    stop = onResume(callback);

    target.dispatchEvent(new Event(event));

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("counts events that fire together as one return", () => {
    const callback = vi.fn();
    stop = onResume(callback);

    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("pageshow"));
    window.dispatchEvent(new Event("focus"));
    expect(callback).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(resumeDedupeMs);
    window.dispatchEvent(new Event("focus"));
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("ignores the app going out of view", () => {
    const callback = vi.fn();
    stop = onResume(callback);
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });

    document.dispatchEvent(new Event("visibilitychange"));

    expect(callback).not.toHaveBeenCalled();
  });

  it("stops when cleaned up", () => {
    const callback = vi.fn();
    onResume(callback)();

    window.dispatchEvent(new Event("focus"));

    expect(callback).not.toHaveBeenCalled();
  });
});
