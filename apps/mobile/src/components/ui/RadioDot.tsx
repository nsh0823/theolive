import { View } from 'react-native';

/** Ring radio; the filled inner dot (not only color) marks the selected option. */
export function RadioDot({ selected }: { selected: boolean }) {
  return (
    <View
      className={`h-6 w-6 items-center justify-center rounded-full border-2 ${
        selected ? 'border-primary' : 'border-sage'
      }`}
    >
      {selected ? <View className="h-3 w-3 rounded-full bg-primary" /> : null}
    </View>
  );
}
