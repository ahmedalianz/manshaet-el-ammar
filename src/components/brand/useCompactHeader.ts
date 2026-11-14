import { useCallback, useRef, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

export function useCompactHeader() {
  const [compact, setCompact] = useState(false);
  const current = useRef(false);
  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      // Expand before the last few pixels of scroll deceleration; keep a gap
      // between thresholds so the header does not oscillate near the top.
      const next = current.current ? y > 20 : y > 48;
      if (next !== current.current) {
        current.current = next;
        setCompact(next);
      }
    },
    [],
  );
  return { compact, onScroll, scrollEventThrottle: 16 };
}
