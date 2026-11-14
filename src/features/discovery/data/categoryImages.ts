import type { ImageSourcePropType } from 'react-native';

// Bundled category illustrations, not photographs of individual providers.
// Source credits and licenses: assets/images/services/sources.json.
export const categoryImages: Record<string, ImageSourcePropType | undefined> = {
  plumbing: require('../../../../assets/images/services/plumbing.jpg'),
  electricity: require('../../../../assets/images/services/electricity.jpg'),
  clinics: require('../../../../assets/images/services/clinics.jpg'),
  pharmacies: require('../../../../assets/images/services/pharmacies.jpg'),
  carpentry: require('../../../../assets/images/services/carpentry.jpg'),
  shops: require('../../../../assets/images/services/shops.jpg'),
  transport: require('../../../../assets/images/services/transport.jpg'),
  construction: require('../../../../assets/images/services/construction.jpg'),
  appliances: require('../../../../assets/images/services/appliances.jpg'),
  education: require('../../../../assets/images/services/education.jpg'),
  tailoring: require('../../../../assets/images/services/tailoring.jpg'),
  laundry: require('../../../../assets/images/services/laundry.jpg'),
  'sewage-trucks': require('../../../../assets/images/services/sewage-trucks.jpg'),
};
