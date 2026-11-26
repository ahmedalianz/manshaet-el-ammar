import type { PlacePhoto, ServiceProvider } from '../discovery/types';
export type PhotoChange = {
  action: 'keep' | 'replace' | 'remove';
  candidateId?: string;
  expectedPhotoVersion?: string | null;
};
export type ServiceValues = Pick<
  ServiceProvider,
  | 'name'
  | 'categoryId'
  | 'serviceTitle'
  | 'description'
  | 'phone'
  | 'whatsapp'
  | 'address'
  | 'serviceMode'
  | 'weeklyHours'
> & { photoChange?: PhotoChange };
export type ProviderListing = ServiceProvider & {
  photoReviewStatus?: 'pending' | 'approved' | 'rejected';
  photoReviewReason?: string;
  photoCandidateId?: string;
  photoAction?: 'keep' | 'replace' | 'remove';
  ownerId: string;
  rejectionReason?: string;
  pendingChanges?: ServiceValues;
  publicationStatus?: 'published' | 'unpublished';
  editRejectionReason?: string;
  unpublishReason?: string;
  unpublishedAt?: string;
  updatedAt?: string;
  lastConfirmedAt?: string;
};
export type DemoProfile = 'empty' | 'listings' | 'admin';
export type MockAccount = {
  id: string;
  name: string;
  email: string;
  role: 'provider' | 'admin';
};
export type PublishedService = ServiceValues & {
  placePhoto?: PlacePhoto;
  id: string;
  ownerId: string;
  claimable?: boolean;
  publicationStatus: 'published' | 'unpublished';
  unpublishReason?: string;
  unpublishedAt?: string;
  updatedAt?: string;
  lastConfirmedAt?: string;
};
export type ClaimStatus = 'pending' | 'approved' | 'rejected';
export type ServiceClaim = {
  id: string;
  providerId: string;
  serviceName: string;
  serviceTitle: string;
  claimantId: string;
  claimantName: string;
  claimantPhone: string;
  note: string;
  status: ClaimStatus;
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
};
export type ServiceRequest = {
  id: string;
  providerId: string;
  ownerId: string;
  type: 'create' | 'update' | 'restore';
  status: 'pending' | 'approved' | 'rejected';
  proposedData: ServiceValues;
  photoChange?: PhotoChange;
  photoReviewStatus?: 'pending' | 'approved' | 'rejected';
  photoReviewReason?: string;
  photoReviewedAt?: string;
  approvedPlacePhoto?: PlacePhoto | null;
  rejectionReason?: string;
  createdAt: string;
  reviewedAt?: string;
};
export type ServiceReport = {
  id: string;
  providerId: string;
  reason: string;
  status: 'open' | 'closed';
  createdAt: string;
  closedAt?: string;
};
export type MockState = {
  accounts: MockAccount[];
  services: PublishedService[];
  requests: ServiceRequest[];
  reports: ServiceReport[];
  claims?: ServiceClaim[];
};
export type MockOperation =
  | {
      type: 'submit';
      values: ServiceValues;
      providerId?: string;
      replacePending?: boolean;
    }
  | {
      type: 'adminSave';
      values: ServiceValues;
      providerId?: string;
    }
  | { type: 'approve'; requestId: string }
  | { type: 'reject'; requestId: string; reason: string }
  | { type: 'unpublish'; providerId: string }
  | { type: 'closeReport'; reportId: string }
  | { type: 'updateAccount'; name: string }
  | {
      type: 'submitClaim';
      providerId: string;
      claimantName: string;
      claimantPhone: string;
      note?: string;
    }
  | { type: 'approveClaim'; claimId: string }
  | { type: 'rejectClaim'; claimId: string; reason: string };
