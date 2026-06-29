import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

type ApiOptions = RequestInit & {
  json?: unknown;
};

export type User = {
  id: string;
  email: string;
  created_at?: string;
};

export type FriendUser = User & {
  requested_at?: string;
  friends_since?: string;
};

export type FriendRelationships = {
  incomingRequests: FriendUser[];
  outgoingRequests: FriendUser[];
  friends: FriendUser[];
};

export const reactionEmojis = ['👍', '👎', '😎', '💀', '💩', '😂'] as const;

export type ReactionEmoji = (typeof reactionEmojis)[number];

export type ImageReactionCount = {
  emoji: ReactionEmoji;
  count: number;
};

export type ImageReactionSummary = {
  counts: ImageReactionCount[];
  viewer_emoji: ReactionEmoji | null;
};

export type ImageRecord = {
  id: string;
  user_id: string;
  user_email?: string;
  original_filename: string;
  stored_filename: string;
  mime_type: string;
  byte_size: number;
  created_at: string;
  reactions: ImageReactionSummary;
};

export type UploadableImage = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  file?: File;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function getImageFileUrl(imageId: string) {
  return `${API_URL}/images/${imageId}/file`;
}

async function apiRequest<T>(path: string, options: ApiOptions = {}) {
  const headers = new Headers(options.headers);

  if (options.json !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers,
    body: options.json === undefined ? options.body : JSON.stringify(options.json),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(body?.error ?? 'Request failed', response.status);
  }

  return body as T;
}

export async function requestMagicLink(email: string) {
  return apiRequest<{ ok: true }>('/auth/magic-link', {
    method: 'POST',
    json: {
      email,
      ...(Platform.OS === 'web' ? {} : { redirectUrl: Linking.createURL('auth/callback') }),
    },
  });
}

export async function completeMagicLinkLogin(token: string) {
  return apiRequest<{ user: User }>('/auth/session', {
    method: 'POST',
    json: { token },
  });
}

export async function logout() {
  return apiRequest<{ ok: true }>('/auth/logout', {
    method: 'POST',
  });
}

export async function getMe() {
  return apiRequest<{ user: User }>('/me');
}

export async function getFriendRelationships() {
  return apiRequest<FriendRelationships>('/friends');
}

export async function getFeedImages() {
  return apiRequest<{ images: ImageRecord[] }>('/feed');
}

export async function getUserProfile(userId: string) {
  return apiRequest<{
    user: User;
    stats: {
      friendCount: number;
      imageCount: number;
    };
    images: ImageRecord[];
  }>(`/users/${userId}`);
}

export async function sendFriendRequest(email: string) {
  return apiRequest<{
    relationship: 'request_sent' | 'friends';
    user: User;
    friends: FriendRelationships;
  }>('/friends/requests', {
    method: 'POST',
    json: { email },
  });
}

export async function acceptFriendRequest(userId: string) {
  return apiRequest<{
    relationship: 'friends';
    friends: FriendRelationships;
  }>(`/friends/requests/${userId}/accept`, {
    method: 'POST',
  });
}

export async function getImages() {
  return apiRequest<{ images: ImageRecord[] }>('/images');
}

export async function uploadImage(image: UploadableImage) {
  const formData = new FormData();
  const fileName = image.fileName ?? `leet-${Date.now()}.jpg`;
  const mimeType = image.mimeType ?? 'image/jpeg';

  if (image.file) {
    formData.append('image', image.file, fileName);
  } else {
    formData.append(
      'image',
      {
        uri: image.uri,
        name: fileName,
        type: mimeType,
      } as unknown as Blob
    );
  }

  return apiRequest<{ image: ImageRecord }>('/images', {
    method: 'POST',
    body: formData,
  });
}

export async function setImageReaction(imageId: string, emoji: ReactionEmoji) {
  return apiRequest<{ reactions: ImageReactionSummary }>(`/images/${imageId}/reaction`, {
    method: 'POST',
    json: { emoji },
  });
}

export async function deleteImageReaction(imageId: string) {
  return apiRequest<{ reactions: ImageReactionSummary }>(`/images/${imageId}/reaction`, {
    method: 'DELETE',
  });
}
