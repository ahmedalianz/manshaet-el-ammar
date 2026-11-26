import { Image, type ImageProps } from 'expo-image';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentRef,
  type ReactNode,
} from 'react';
import { View, useWindowDimensions } from 'react-native';
import { usePhotoViewport } from './PhotoViewport';
import type { ImageSourcePropType } from 'react-native';

/** Versioned public URLs only; private candidates never enter the disk cache. */
export function ApprovedPhoto({
  uri,
  fallback,
  fallbackElement,
  lazy = false,
  contentFit = 'cover',
  ...props
}: Omit<ImageProps, 'source'> & {
  uri?: string;
  lazy?: boolean;
  fallback?: ImageSourcePropType;
  fallbackElement?: ReactNode;
}) {
  const [failedUri, setFailedUri] = useState<string>();
  const [visible, setVisible] = useState(!lazy);
  const viewport = usePhotoViewport();
  const ref = useRef<ComponentRef<typeof View>>(null);
  const { height, width } = useWindowDimensions();
  const measure = useCallback(() => {
    if (visible) return;
    ref.current?.measureInWindow((x, y, w, h) => {
      if (w > 0 && h > 0 && y < height && y + h > 0 && x < width && x + w > 0)
        setVisible(true);
    });
  }, [visible, height, width]);
  useEffect(() => {
    measure();
    return visible ? undefined : viewport?.subscribe(measure);
  }, [measure, viewport, visible]);
  const showRemote = Boolean(visible && uri && failedUri !== uri);
  const fallbackSource = (
    Array.isArray(fallback) ? [...fallback] : fallback
  ) as ImageProps['placeholder'];
  if (!showRemote && !fallback && fallbackElement) {
    return lazy ? (
      <View
        ref={ref}
        collapsable={false}
        onLayout={measure}
        style={props.style}
      >
        {fallbackElement}
      </View>
    ) : (
      <>{fallbackElement}</>
    );
  }
  const image = (
    <Image
      {...props}
      source={
        showRemote
          ? { uri, cacheKey: uri }
          : (fallbackSource as ImageProps['source'])
      }
      placeholder={showRemote ? fallbackSource : undefined}
      placeholderContentFit={contentFit}
      cachePolicy="memory-disk"
      contentFit={contentFit}
      transition={150}
      onError={() => setFailedUri(uri)}
      style={lazy ? { width: '100%', height: '100%' } : props.style}
    />
  );
  return lazy ? (
    <View ref={ref} collapsable={false} onLayout={measure} style={props.style}>
      {image}
    </View>
  ) : (
    image
  );
}
