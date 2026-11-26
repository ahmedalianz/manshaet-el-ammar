import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { AppState, type AppStateStatus } from 'react-native';
import * as Updates from 'expo-updates';
import { FeedbackProvider } from '../src/components/ui/Feedback';
import { AppUpdatesWatcher } from '../src/features/updates/AppUpdatesWatcher';
import { fireEvent, render, screen, waitFor } from './helpers/render';

jest.mock('expo-updates', () => ({
  isEnabled: true,
  checkForUpdateAsync: jest.fn(),
  fetchUpdateAsync: jest.fn(),
  reloadAsync: jest.fn(),
  UpdateCheckResultNotAvailableReason: {
    NO_UPDATE_AVAILABLE_ON_SERVER: 'noUpdateAvailableOnServer',
  },
}));

const mockedUpdates = jest.mocked(Updates);
const fakeManifest = { id: 'test-update-id' } as unknown as Updates.Manifest;

const unavailableCheck: Updates.UpdateCheckResult = {
  isAvailable: false,
  isRollBackToEmbedded: false,
  manifest: undefined,
  reason: Updates.UpdateCheckResultNotAvailableReason.NO_UPDATE_AVAILABLE_ON_SERVER,
};

const availableCheck: Updates.UpdateCheckResult = {
  isAvailable: true,
  isRollBackToEmbedded: false,
  manifest: fakeManifest,
  reason: undefined,
};

const noNewFetch: Updates.UpdateFetchResult = {
  isNew: false,
  isRollBackToEmbedded: false,
  manifest: undefined,
};

const newFetch: Updates.UpdateFetchResult = {
  isNew: true,
  isRollBackToEmbedded: false,
  manifest: fakeManifest,
};

describe('AppUpdatesWatcher', () => {
  let appStateListener: ((state: AppStateStatus) => void) | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    appStateListener = null;
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_type, listener) => {
        appStateListener = listener;
        return { remove: jest.fn() };
      });
    mockedUpdates.checkForUpdateAsync.mockResolvedValue(unavailableCheck);
    mockedUpdates.fetchUpdateAsync.mockResolvedValue(noNewFetch);
    mockedUpdates.reloadAsync.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not check for updates when disabled', async () => {
    await render(
      <FeedbackProvider>
        <AppUpdatesWatcher enabled={false} />
      </FeedbackProvider>,
    );
    expect(mockedUpdates.checkForUpdateAsync).not.toHaveBeenCalled();
  });

  it('downloads an available update, prompts the user, and reloads on confirmation', async () => {
    mockedUpdates.checkForUpdateAsync.mockResolvedValueOnce(availableCheck);
    mockedUpdates.fetchUpdateAsync.mockResolvedValueOnce(newFetch);

    await render(
      <FeedbackProvider>
        <AppUpdatesWatcher enabled />
      </FeedbackProvider>,
    );

    await waitFor(() =>
      expect(screen.getByText('في تحديث جديد للتطبيق')).toBeTruthy(),
    );
    expect(mockedUpdates.fetchUpdateAsync).toHaveBeenCalledTimes(1);
    expect(mockedUpdates.reloadAsync).not.toHaveBeenCalled();

    await fireEvent.press(
      screen.getByRole('button', { name: 'إعادة التشغيل دلوقتي' }),
    );
    expect(mockedUpdates.reloadAsync).toHaveBeenCalledTimes(1);
  });

  it('respects cooldown on foreground resume and suppresses repeated prompts after dismissal', async () => {
    await render(
      <FeedbackProvider>
        <AppUpdatesWatcher enabled cooldownMs={60_000} />
      </FeedbackProvider>,
    );

    await waitFor(() =>
      expect(mockedUpdates.checkForUpdateAsync).toHaveBeenCalledTimes(1),
    );

    // Immediate foreground transition within cooldown should not re-check.
    appStateListener?.('active');
    await waitFor(() =>
      expect(mockedUpdates.checkForUpdateAsync).toHaveBeenCalledTimes(1),
    );

    // Subsequent foreground check with cooldown 0 fetches update once and stops prompting after 'بعدين'.
    mockedUpdates.checkForUpdateAsync.mockResolvedValue(availableCheck);
    mockedUpdates.fetchUpdateAsync.mockResolvedValue(newFetch);

    await render(
      <FeedbackProvider>
        <AppUpdatesWatcher enabled cooldownMs={0} />
      </FeedbackProvider>,
    );

    await waitFor(() =>
      expect(screen.getByText('في تحديث جديد للتطبيق')).toBeTruthy(),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'بعدين' }));

    const callsBeforeResume = mockedUpdates.checkForUpdateAsync.mock.calls.length;
    appStateListener?.('active');
    expect(mockedUpdates.checkForUpdateAsync).toHaveBeenCalledTimes(
      callsBeforeResume,
    );
  });
});
