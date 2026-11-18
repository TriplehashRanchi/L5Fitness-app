import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { chainPath } from '@/lib/blob-path';

const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;
const PAD = 5; // gap between a chip and its bead outline
const CHIP_H = 44;
const BEAD_H = CHIP_H + PAD * 2;
const OVERLAP = 6; // neighbouring beads overlap by this much, which makes the waist
const WAIST = 8;
const SIDE = 20;

export type ChainOption = { key: string; label: string };

/**
 * Filter row drawn as a chain of capsule beads: one thin outline runs around all chips and pinches in
 * between them. The active chip is a solid white capsule. Scrolls sideways; the outline grows with the chips.
 */
export function ChainFilter({
  options,
  selected,
  onSelect,
  accessibilityLabelFor,
}: {
  options: ChainOption[];
  selected: string;
  onSelect: (key: string) => void;
  accessibilityLabelFor?: (option: ChainOption) => string;
}) {
  const [boxes, setBoxes] = useState<Record<string, { x: number; w: number }>>({});
  const measured = options.every((o) => boxes[o.key]);
  const beads = measured ? options.map((o) => ({ x: boxes[o.key].x - PAD, w: boxes[o.key].w + PAD * 2 })) : [];
  const width = measured && beads.length ? beads[beads.length - 1].x + beads[beads.length - 1].w : 0;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="mb-5"
      contentContainerStyle={{ paddingHorizontal: SIDE }}>
      <View style={{ height: BEAD_H, paddingLeft: PAD, paddingRight: PAD, flexDirection: 'row', alignItems: 'center', gap: PAD * 2 - OVERLAP }}>
        {measured ? (
          <Svg width={width} height={BEAD_H} style={{ position: 'absolute', left: 0, top: 0 }} pointerEvents="none">
            <Path d={chainPath(beads, BEAD_H, WAIST)} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth={1} />
          </Svg>
        ) : null}
        {options.map((o) => {
          const isSelected = o.key === selected;
          return (
            <Pressable
              key={o.key}
              onLayout={(e) => {
                const { x, width: w } = e.nativeEvent.layout;
                setBoxes((prev) => (prev[o.key]?.x === x && prev[o.key]?.w === w ? prev : { ...prev, [o.key]: { x, w } }));
              }}
              onPress={() => onSelect(o.key)}
              accessibilityRole="button"
              accessibilityLabel={accessibilityLabelFor ? accessibilityLabelFor(o) : o.label}
              accessibilityState={{ selected: isSelected }}
              style={{ height: CHIP_H, minWidth: 64, borderRadius: CHIP_H / 2, paddingHorizontal: 22, backgroundColor: isSelected ? '#ffffff' : 'transparent' }}
              className="items-center justify-center">
              <Text {...COMPACT_TEXT} className={`text-sm font-bold ${isSelected ? 'text-ink' : 'text-muted'}`}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}
