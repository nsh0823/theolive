import { Switch } from '@theolive/ui/components/switch';
import { Text } from '@theolive/ui/components/text';
import { View } from 'react-native';

type Props = {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
};

export function SettingSwitchRow({
  label,
  description,
  value,
  onValueChange,
  disabled = false,
}: Props) {
  return (
    <View className="min-h-14 flex-row items-center gap-3 px-4 py-2">
      <View className="flex-1">
        <Text className="font-medium">{label}</Text>
        {description ? (
          <Text size="sm" className="text-muted-foreground">
            {description}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        accessibilityLabel={label}
        accessibilityState={{ checked: value, disabled }}
      />
    </View>
  );
}
