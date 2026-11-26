import type { ImageSourcePropType } from 'react-native';

// Bundled category illustrations, not photographs of individual providers.
// Source credits and licenses: assets/images/services/sources.json.
export const categoryImages: Record<string, ImageSourcePropType | undefined> = {
  plumbing: require('../../../../assets/images/services/plumbing.webp'),
  electricity: require('../../../../assets/images/services/electricity.jpg'),
  clinics: require('../../../../assets/images/services/clinics.jpg'),
  pharmacies: require('../../../../assets/images/services/pharmacies.webp'),
  carpentry: require('../../../../assets/images/services/carpentry.jpg'),
  shops: require('../../../../assets/images/services/shops.webp'),
  transport: require('../../../../assets/images/services/transport.webp'),
  construction: require('../../../../assets/images/services/construction.jpg'),
  appliances: require('../../../../assets/images/services/appliances.webp'),
  education: require('../../../../assets/images/services/education.webp'),
  tailoring: require('../../../../assets/images/services/tailoring.webp'),
  laundry: require('../../../../assets/images/services/laundry.jpg'),
  'sewage-trucks': require('../../../../assets/images/services/sewage-trucks.webp'),
};
