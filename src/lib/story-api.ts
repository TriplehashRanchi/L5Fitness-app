import { api } from '@/lib/http';

/** A testimonial in Home's row, added by the admin: the name shown, the words, the day of their journey and the cheers. */
export type Story = { id: string; name: string; text: string; programmeDay: number | null; cheers: number; cheered: boolean; hasVideo: boolean };

/** Today's pick comes first. */
export const getStories = () => api<{ stories: Story[] }>('/stories');
/** A short-lived address to play a story's video from. */
export const getStoryVideo = (id: string) => api<{ url: string }>(`/stories/${id}/video`);
export const cheerStory = (id: string, on: boolean) => api<{ cheered: boolean; cheers: number }>(`/stories/${id}/cheer`, { method: on ? 'POST' : 'DELETE' });
