"use client";

import { useSyncExternalStore, type HTMLAttributes } from "react";

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

// The external account view may own this empty slot only after React hydration.
export function AccountSlot(props: HTMLAttributes<HTMLDivElement>) {
  const hydrated = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  return hydrated ? <div {...props} data-fribench-account /> : null;
}

