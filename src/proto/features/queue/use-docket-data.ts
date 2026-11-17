"use client";

import { useMemo } from "react";
import { allDockets } from "../../fixtures/dockets";
import { getVenue } from "../../fixtures/venues";
import { useProto, useProtoSlice } from "../../state/store";
import type { Docket } from "../../types";
import {
  applyOverrides,
  EMPTY_CONTEXT,
  type QueueContext,
  type StatusOverrides,
} from "./queue-state";

export const DEFAULT_DOCKET_COUNT = 120;

/** Full docket dataset for the current venue/scenario with review decisions applied. Never sliced here. */
export function useDocketData() {
  const { venueId, scenario } = useProto();
  const [count, setCount] = useProtoSlice<number>(
    "queue:count",
    DEFAULT_DOCKET_COUNT,
  );
  const [overrides, setOverrides] = useProtoSlice<StatusOverrides>(
    "queue:overrides",
    {},
  );
  const [changes, setChanges] = useProtoSlice<Record<string, number>>(
    "queue:changes",
    {},
  );
  const [ctx, setCtx] = useProtoSlice<QueueContext>("queue:ctx", EMPTY_CONTEXT);
  const effectiveCount =
    scenario === "empty" || getVenue(venueId).empty ? 0 : count;
  const all: Docket[] = useMemo(
    () => applyOverrides(allDockets(venueId, effectiveCount), overrides),
    [venueId, effectiveCount, overrides],
  );
  return {
    all,
    count,
    setCount,
    overrides,
    setOverrides,
    changes,
    setChanges,
    ctx,
    setCtx,
    venueId,
    scenario,
  };
}
