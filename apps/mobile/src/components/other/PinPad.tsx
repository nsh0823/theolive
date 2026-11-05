import { Text } from '@theolive/ui/components/text';
import { Delete } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { PIN_LENGTH } from '@/lib/pin';

import { AppIcon } from '../ui/AppIcon';

const KEY_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
] as const;

type Props = {
  entryLength: number;
  onDigit: (digit: string) => void;
  onDelete: () => void;
};

const KEY_CLASS = 'h-16 w-20 items-center justify-center rounded-full active:bg-secondary';

/** Numeric keypad with filled-dot progress; digits are never echoed on screen. */
export function PinPad({ entryLength, onDigit, onDelete }: Props) {
  return (
    <View className="items-center gap-8">
      <View
        className="flex-row gap-4"
        accessible
        accessibilityLabel={`${PIN_LENGTH}자리 중 ${entryLength}자리 입력됨`}
        accessibilityLiveRegion="polite"
      >
        {Array.from({ length: PIN_LENGTH }, (_, index) => (
          <View
            key={index}
            className={`h-4 w-4 rounded-full ${index < entryLength ? 'bg-primary' : 'border-2 border-sage'}`}
          />
        ))}
      </View>
      <View className="gap-2">
        {KEY_ROWS.map((row) => (
          <View key={row.join('')} className="flex-row gap-4">
            {row.map((digit) => (
              <Pressable
                key={digit}
                onPress={() => onDigit(digit)}
                accessibilityRole="button"
                accessibilityLabel={digit}
                className={KEY_CLASS}
              >
                <Text size="2xl" className="font-semibold">
                  {digit}
                </Text>
              </Pressable>
            ))}
          </View>
        ))}
        <View className="flex-row gap-4">
          <View className="w-20" />
          <Pressable
            onPress={() => onDigit('0')}
            accessibilityRole="button"
            accessibilityLabel="0"
            className={KEY_CLASS}
          >
            <Text size="2xl" className="font-semibold">
              0
            </Text>
          </Pressable>
          <Pressable
            onPress={onDelete}
            accessibilityRole="button"
            accessibilityLabel="지우기"
            className={KEY_CLASS}
          >
            <AppIcon icon={Delete} size={26} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
