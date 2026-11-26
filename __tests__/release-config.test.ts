/// <reference types="node" />
import { describe, expect, it } from '@jest/globals';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
const app = JSON.parse(readFileSync(resolve('app.json'), 'utf8')).expo;
const eas = JSON.parse(readFileSync(resolve('eas.json'), 'utf8'));
describe('Android store configuration guardrails', () => {
  it('preserves identity and valid version metadata with existing assets', () => {
    expect(app.android.package).toBe('com.ahmedalianz.manshaetelammar');
    expect(app.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(
      Number.isInteger(app.android.versionCode) && app.android.versionCode > 0,
    ).toBe(true);
    expect(existsSync(resolve(app.icon))).toBe(true);
    // A complete icon tile uses Android's uncropped legacy icon path; a
    // dedicated adaptive foreground may be supplied instead.
    const androidIcon =
      app.android.adaptiveIcon?.foregroundImage ?? app.android.icon ?? app.icon;
    expect(existsSync(resolve(androidIcon))).toBe(true);
  });
  it('prepares an AAB without embedding credentials or native debug signing projects', () => {
    expect(eas.build.production.android.buildType).toBe('app-bundle');
    expect(eas.build.production.distribution).toBe('store');
    expect(eas.build.production.android.credentialsSource).toBe('remote');
    expect(eas.build.production.channel).toBe('production');
    expect(app.runtimeVersion).toEqual({ policy: 'fingerprint' });
    expect(app.updates?.url).toBe(
      `https://u.expo.dev/${app.extra.eas.projectId}`,
    );
    const ignore = readFileSync(resolve('.easignore'), 'utf8');
    expect(ignore).toMatch(/^\/android$/m);
    expect(ignore).toMatch(/^\/ios$/m);
    expect(ignore).toMatch(/^\/backend$/m);
    expect(ignore).toMatch(/^\.dev\.vars$/m);
    expect(ignore).toMatch(/^credentials\.json$/m);
    expect(app.android.allowBackup).toBe(false);
    expect(app.android.predictiveBackGestureEnabled).toBe(false);
    expect(app.android.blockedPermissions).toEqual(
      expect.arrayContaining([
        'android.permission.CALL_PHONE',
        'android.permission.READ_CONTACTS',
        'android.permission.WRITE_EXTERNAL_STORAGE',
      ]),
    );
  });
});
