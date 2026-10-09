import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { ApiClient } from '../api/client';

export interface PickedFile {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
}

/** Let the user pick one file from the device. Returns null when cancelled. */
export async function pickFile(): Promise<PickedFile | null> {
  const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
  if (res.canceled || !res.assets || res.assets.length === 0) return null;
  const a = res.assets[0];
  return {
    uri: a.uri,
    name: a.name ?? 'file',
    mimeType: a.mimeType ?? 'application/octet-stream',
    size: a.size ?? undefined,
  };
}

export function appendFile(form: FormData, field: string, file: PickedFile): void {
  form.append(field, { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);
}

/**
 * Download an API file with the session token, then open the OS share sheet
 * (preview / save / open in another app). Files land in app-private storage.
 */
export async function downloadAndShare(client: ApiClient, path: string, filename: string): Promise<void> {
  const safe = filename.replace(/[^\w.\-() ]+/g, '_') || 'download';
  const dest = new File(Paths.cache, `${Date.now()}-${safe}`);
  const file = await File.downloadFileAsync(client.buildUrl(path), dest, { headers: client.authHeaders() });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri);
  }
}
