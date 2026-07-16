import { Asset } from 'react-native-image-picker';
import { api } from './client';

export async function uploadAsset(asset: Asset, category: 'CHAT' | 'KYC' | 'PROFILE' | 'REPORT') {
  if (!asset.uri || !asset.type || !asset.fileName || !asset.fileSize) throw new Error('The selected file is incomplete');
  try {
    const { data } = await api.post('/files/upload-request', { category, fileName: asset.fileName, mimeType: asset.type, sizeBytes: asset.fileSize });
    const body = await fetch(asset.uri).then(response => response.blob());
    const uploaded = await fetch(data.uploadUrl, { method: 'PUT', headers: data.headers, body });
    if (!uploaded.ok) throw new Error('Object storage upload failed');
    await api.post(`/files/${data.assetId}/complete`);
    return data.assetId as string;
  } catch (error: any) {
    if (error.response?.status !== 503) throw error;
    const form = new FormData(); form.append('category', category); form.append('file', { uri: asset.uri, type: asset.type, name: asset.fileName } as any);
    const { data } = await api.post('/files/local', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60_000 });
    return data.id as string;
  }
}
export const uploadChatAsset = (asset: Asset) => uploadAsset(asset, 'CHAT');
