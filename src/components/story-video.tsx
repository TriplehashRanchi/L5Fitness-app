import { DomWebView, type DomWebViewRef } from '@expo/dom-webview';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, AppState, Text, View } from 'react-native';

import { getStoryVideo } from '@/lib/story-api';
import { useT } from '@/providers/language-provider';

const FILL = { flex: 1, backgroundColor: '#000000' } as const;

/**
 * A page holding nothing but the video, which starts by itself and says how far it is. The web view comes with
 * Expo, so every build of the app can play it.
 */
function videoPage(url: string) {
  const src = url.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  // i18n-ignore: a page of code, with no words anyone reads
  const html = `<!doctype html>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}video{width:100%;height:100%;object-fit:contain}</style>
<video autoplay playsinline preload="auto" poster="data:image/gif;base64,R0lGODlhAQABAAAAACw=" src="${src}"></video>
<script>
var video = document.querySelector('video');
function tell(message) { window.ReactNativeWebView.postMessage(JSON.stringify(message)); }
video.addEventListener('playing', function () { tell({ playing: true }); });
video.addEventListener('timeupdate', function () { if (video.duration > 0) tell({ at: video.currentTime / video.duration }); });
video.addEventListener('ended', function () { tell({ ended: true }); });
video.addEventListener('error', function () { tell({ failed: true }); });
video.play().catch(function () {});
</script>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

type Message = { playing?: boolean; at?: number; ended?: boolean; failed?: boolean };

/**
 * A story's video. It plays by itself, with sound, as soon as its story is on screen; holding the screen or leaving
 * the app pauses it. `children` are the tap areas, laid over the picture.
 */
export function StoryVideo({
  id,
  paused,
  onProgress,
  onEnd,
  children,
}: {
  id: string;
  paused: boolean;
  onProgress: (fraction: number) => void;
  onEnd: () => void;
  children: ReactNode;
}) {
  const t = useT();
  const view = useRef<DomWebViewRef>(null);
  /** Kept as one object: a new one would load the video again from the start. */
  const [source, setSource] = useState<{ uri: string } | null>(null);
  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState(false);
  const [away, setAway] = useState(false);

  useEffect(() => {
    let live = true;
    getStoryVideo(id)
      .then((v) => live && setSource({ uri: videoPage(v.url) }))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [id]);

  useEffect(() => {
    const app = AppState.addEventListener('change', (s) => setAway(s !== 'active'));
    return () => app.remove();
  }, []);

  const stop = paused || away;
  useEffect(() => {
    if (started) view.current?.injectJavaScript(`document.querySelector('video').${stop ? 'pause' : 'play'}();true;`);
  }, [stop, started]);

  const hear = (data: string) => {
    const m = JSON.parse(data) as Message;
    if (m.playing) setStarted(true);
    if (m.at !== undefined) onProgress(Math.min(1, m.at));
    if (m.failed) setFailed(true);
    if (m.ended) onEnd();
  };

  return (
    <View style={FILL}>
      {source ? (
        <View style={FILL} pointerEvents="none">
          <DomWebView ref={view} source={source} style={FILL} containerStyle={FILL} scrollEnabled={false} mediaPlaybackRequiresUserAction={false} onMessage={(e) => hear(e.nativeEvent.data)} />
        </View>
      ) : null}
      <View className="absolute inset-0 flex-row">{children}</View>
      {failed || !started ? (
        <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
          {failed ? (
            <Text maxFontSizeMultiplier={1.3} className="text-center font-bold text-white" style={{ fontSize: 15, paddingHorizontal: 24 }}>
              {t('story.videoFailed')}
            </Text>
          ) : (
            <ActivityIndicator color="#ffffff" size="large" />
          )}
        </View>
      ) : null}
    </View>
  );
}
