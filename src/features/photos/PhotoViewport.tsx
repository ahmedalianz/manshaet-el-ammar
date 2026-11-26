import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

type Viewport = {
  subscribe: (listener: () => void) => () => void;
  onScroll: () => void;
  dispose: () => void;
};
const Context = createContext<Viewport | null>(null);
export function PhotoViewportProvider({ children }: { children: ReactNode }) {
  const [viewport] = useState<Viewport>(() => {
    const listeners = new Set<() => void>();
    let previous = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const flush = () => {
      previous = Date.now();
      listeners.forEach((listener) => listener());
    };
    return {
      subscribe: (listener) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      onScroll: () => {
        const now = Date.now();
        const elapsed = now - previous;
        if (elapsed >= 100) {
          if (timer) {
            clearTimeout(timer);
            timer = undefined;
          }
          flush();
          return;
        }
        if (!timer) {
          timer = setTimeout(() => {
            timer = undefined;
            flush();
          }, 100 - elapsed);
        }
      },
      dispose: () => {
        if (timer) {
          clearTimeout(timer);
          timer = undefined;
        }
      },
    };
  });
  useEffect(() => () => viewport.dispose(), [viewport]);
  return <Context.Provider value={viewport}>{children}</Context.Provider>;
}
export function usePhotoViewport() {
  return useContext(Context);
}
export function usePhotoScroll() {
  const viewport = usePhotoViewport();
  return useCallback(() => viewport?.onScroll(), [viewport]);
}
