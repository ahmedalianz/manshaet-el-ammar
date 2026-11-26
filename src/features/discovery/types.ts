import type { Availability } from '../availability/types';
import type { ComponentProps } from 'react';
import type { MaterialCommunityIcons } from '@expo/vector-icons';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export type CategoryGroup = 'health' | 'trades' | 'shops' | 'community';

export type ServiceCategory = {
  cachedAt?: string;
  id: string;
  name: string;
  description: string;
  icon: IconName;
  group: CategoryGroup;
  keywords: string[];
};

export type ProviderStatus = 'approved' | 'pending' | 'rejected';

export type PlacePhoto = {
  version: string;
  thumbnailUrl: string;
  detailUrl: string;
  width: number;
  height: number;
};
export type ServiceProvider = Availability & {
  placePhoto?: PlacePhoto;
  updatedAt?: string;
  lastConfirmedAt?: string;
  cachedAt?: string;
  dataSource?: 'firestore';
  id: string;
  name: string;
  categoryId: string;
  serviceTitle: string;
  description: string;
  phone: string;
  whatsapp?: string;

  address: string;
  latitude?: number;
  longitude?: number;
  status: ProviderStatus;
  publicationStatus?: 'published' | 'unpublished';
  claimable?: boolean;
};
