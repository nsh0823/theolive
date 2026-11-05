import { Heading } from '@theolive/ui/components/heading';
import { Text } from '@theolive/ui/components/text';
import { X } from 'lucide-react-native';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CtaButton } from '../ui/CtaButton';
import { IconButton } from '../ui/IconButton';

type Props = {
  visible: boolean;
  summary: string;
  onGoToCart: () => void;
  onContinue: () => void;
};

/**
 * Add-to-cart confirmation (brief 6.3): a bottom sheet with a left-aligned title and close
 * button, the added item, and the two actions side by side.
 */
export function AddToCartSheet({ visible, summary, onGoToCart, onContinue }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onContinue}>
      <View className="flex-1 justify-end">
        <Pressable
          className="absolute inset-0 bg-foreground opacity-40"
          onPress={onContinue}
          accessibilityRole="button"
          accessibilityLabel="닫고 계속 주문하기"
        />
        <View className="rounded-t-3xl bg-card" accessibilityViewIsModal>
          <View className="flex-row items-center justify-between pl-5 pr-3 pt-3">
            <Heading size="lg" accessibilityRole="header">
              장바구니에 담았어요
            </Heading>
            <IconButton icon={X} label="닫기" onPress={onContinue} />
          </View>
          <View className="mt-3 items-center bg-background px-5 py-8">
            <Text className="text-center">{summary}</Text>
          </View>
          <View
            className="flex-row gap-3 bg-background px-5 pt-2"
            style={{ paddingBottom: Math.max(insets.bottom, 16) }}
          >
            <View className="flex-1">
              <CtaButton label="장바구니로 이동하기" variant="outline" onPress={onGoToCart} />
            </View>
            <View className="flex-1">
              <CtaButton label="계속 주문하기" onPress={onContinue} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
