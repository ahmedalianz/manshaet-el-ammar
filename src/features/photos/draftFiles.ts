import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

export function deleteDraftPhoto(uri?: string) {
  if (!uri || Platform.OS === 'web') return;
  const directory = new Directory(Paths.document, 'service-photo-drafts');
  // Draft JSON is untrusted; never delete files outside our own image directory.
  if (
    !uri.startsWith(`${directory.uri.replace(/\/$/, '')}/`) ||
    uri.includes('..')
  )
    return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {}
}
