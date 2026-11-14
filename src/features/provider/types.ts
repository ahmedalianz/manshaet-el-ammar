import type { ServiceProvider } from '../discovery/types';
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
  | 'coverageAreas'
  | 'weeklyHours'
>;
export type ProviderListing = ServiceProvider & {
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
  id: string;
  ownerId: string;
  publicationStatus: 'published' | 'unpublished';
  unpublishReason?: string;
  unpublishedAt?: string;
  updatedAt?: string;
  lastConfirmedAt?: string;
};
export type ServiceRequest = {
  id: string;
  providerId: string;
  ownerId: string;
  type: 'create' | 'update' | 'restore';
  status: 'pending' | 'approved' | 'rejected';
  proposedData: ServiceValues;
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
};
export type MockOperation =
  | {
      type: 'submit';
      values: ServiceValues;
      providerId?: string;
      replacePending?: boolean;
    }
  | { type: 'approve'; requestId: string }
  | { type: 'reject'; requestId: string; reason: string }
  | { type: 'unpublish'; providerId: string }
  | { type: 'closeReport'; reportId: string }
  | { type: 'updateAccount'; name: string };
