import { useState } from 'react';
import { type ImageSourcePropType } from 'react-native';
import { ApprovedPhoto } from '../photos/ApprovedPhoto';
import type { PlacePhoto } from '../discovery/types';

/** Show the complete artwork, including any lettering, at its natural ratio. */
export function ServiceDetailsPhoto({
  photo,
  fallback,
}: {
  photo?: PlacePhoto;
  fallback?: ImageSourcePropType;
}) {
  const [aspectRatio, setAspectRatio] = useState(
    photo && photo.width > 0 && photo.height > 0
      ? photo.width / photo.height
      : 1,
  );
  return (
    <ApprovedPhoto
      testID="service-details-photo"
      uri={photo?.detailUrl}
      fallback={fallback}
      contentFit="contain"
      accessible={false}
      style={{ width: '100%', aspectRatio }}
      onLoad={({ source }) => {
        if (source.width > 0 && source.height > 0)
          setAspectRatio(source.width / source.height);
      }}
    />
  );
}
