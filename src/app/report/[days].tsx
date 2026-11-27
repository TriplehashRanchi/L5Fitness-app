import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DisplayText } from '@/components/display-text';
import { ReportBody } from '@/components/profile/report-body';
import { messageFrom } from '@/lib/http';
import { goBack } from '@/lib/navigation';
import { downloadSummary, getReport, type Report } from '@/lib/progress-api';
import { useT } from '@/providers/language-provider';

const BRAND = '#3ddc68';

/** One 30, 60 or 90-day report, all on one page. The icon at the top downloads it as a PDF. */
export default function ReportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useT();
  const days = Number(useLocalSearchParams<{ days: string }>().days);

  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setReport((await getReport(days)).report);
    } catch (e) {
      setError(messageFrom(e));
    }
  }, [days]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const download = async () => {
    setDownloading(true);
    setError(null);
    try {
      await downloadSummary(days);
    } catch (e) {
      setError(messageFrom(e));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: '#000000' }}>
      <StatusBar style="light" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, width: '100%', maxWidth: 840, alignSelf: 'center' }}>
        <View className="flex-row items-center gap-3 px-5" style={{ paddingBottom: 14 }}>
          <Pressable onPress={() => goBack(router)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.back')} className="h-11 w-11 items-center justify-center rounded-full border border-white/10 active:opacity-70">
            <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} tintColor="white" size={16} />
          </Pressable>
          <DisplayText accessibilityRole="header" className="flex-1 text-white" style={{ fontSize: 22, lineHeight: 28 }} numberOfLines={1} adjustsFontSizeToFit>
            {t('prof.reports.day', { n: days })}
          </DisplayText>
          {report ? (
            <Pressable
              onPress={() => void download()}
              disabled={downloading}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`${t('prof.reports.download')} PDF`}
              accessibilityState={{ busy: downloading }}
              className="h-11 w-11 items-center justify-center active:opacity-60">
              {downloading ? <ActivityIndicator color={BRAND} size="small" /> : <SymbolView name={{ ios: 'arrow.down.to.line', android: 'download', web: 'download' }} tintColor={BRAND} size={22} />}
            </Pressable>
          ) : null}
        </View>

        {error ? (
          <View className="items-center px-8" style={{ paddingVertical: 20, gap: 12 }}>
            <Text accessibilityRole="alert" className="text-center text-accent" style={{ fontSize: 14 }}>
              {error}
            </Text>
            {report ? null : (
              <Pressable onPress={() => void load()} accessibilityRole="button" className="rounded-full bg-brand px-8 py-3 active:opacity-80">
                <Text className="font-bold text-ink">{t('common.tryAgain')}</Text>
              </Pressable>
            )}
          </View>
        ) : null}

        {report ? <ReportBody report={report} /> : error ? null : <ActivityIndicator color={BRAND} size="large" style={{ marginTop: 60 }} />}
      </ScrollView>
    </View>
  );
}
