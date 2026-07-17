import { describe, it, expect } from "bun:test";
import { evaluateSnapshotTransition } from "@/components/nuvex/NuviaDraftAuditCard";

describe("evaluateSnapshotTransition", () => {
  it("primer snapshot tras montar → hydrate (no invalida)", () => {
    const r = evaluateSnapshotTransition({
      prevKind: "waiting",
      doneHash: null,
      lastEmittedHash: null,
      newHash: "aaaa",
      wasFirst: true,
    });
    expect(r.kind).toBe("hydrate");
  });

  it("re-emisión del mismo hash → ignore", () => {
    const r = evaluateSnapshotTransition({
      prevKind: "ready",
      doneHash: null,
      lastEmittedHash: "aaaa",
      newHash: "aaaa",
      wasFirst: false,
    });
    expect(r.kind).toBe("ignore");
  });

  it("mismo hash en estado done → ignore (no reset)", () => {
    const r = evaluateSnapshotTransition({
      prevKind: "done",
      doneHash: "aaaa",
      lastEmittedHash: "bbbb",
      newHash: "aaaa",
      wasFirst: false,
    });
    expect(r.kind).toBe("ignore");
  });

  it("hash distinto tras done → invalidate", () => {
    const r = evaluateSnapshotTransition({
      prevKind: "done",
      doneHash: "aaaa",
      lastEmittedHash: "aaaa",
      newHash: "bbbb",
      wasFirst: false,
    });
    expect(r.kind).toBe("invalidate");
  });

  it("hash distinto en ready → ready (permite re-auditar)", () => {
    const r = evaluateSnapshotTransition({
      prevKind: "ready",
      doneHash: null,
      lastEmittedHash: "aaaa",
      newHash: "bbbb",
      wasFirst: false,
    });
    expect(r.kind).toBe("ready");
  });

  it("desde invalidated con snapshot nuevo → ready", () => {
    const r = evaluateSnapshotTransition({
      prevKind: "invalidated",
      doneHash: null,
      lastEmittedHash: "aaaa",
      newHash: "cccc",
      wasFirst: false,
    });
    expect(r.kind).toBe("ready");
  });

  it("hash vacío → ignore", () => {
    const r = evaluateSnapshotTransition({
      prevKind: "ready",
      doneHash: null,
      lastEmittedHash: null,
      newHash: "",
      wasFirst: false,
    });
    expect(r.kind).toBe("ignore");
  });
});
