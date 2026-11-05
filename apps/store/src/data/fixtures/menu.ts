import { TEMPERATURE, type MenuCategory, type MenuItem, type Temperature } from '@/domain/models';

// Names and prices match apps/mobile/src/fixtures/data.ts; 카푸치노 and 유자차 are store-only additions.
export function createCategories(): MenuCategory[] {
  return [
    { id: 'coffee', name: '커피', isActive: true },
    { id: 'latte', name: '라떼', isActive: true },
    { id: 'non-coffee', name: '논커피', isActive: true },
    { id: 'tea', name: '티', isActive: true },
    { id: 'dessert', name: '디저트', isActive: true },
  ];
}

const BOTH: Temperature[] = [TEMPERATURE.HOT, TEMPERATURE.ICE];

export function createMenu(): MenuItem[] {
  const base = { isActive: true };
  return [
    {
      ...base,
      id: 'americano',
      categoryId: 'coffee',
      name: '아메리카노',
      description: '진한 에스프레소에 물을 더한 깊은 풍미의 커피',
      price: 4500,
      temperatures: BOTH,
      isSoldOut: false,
    },
    {
      ...base,
      id: 'cold-brew',
      categoryId: 'coffee',
      name: '콜드브루',
      description: '저온에서 오래 우려낸 부드러운 커피',
      price: 5000,
      temperatures: [TEMPERATURE.ICE],
      isSoldOut: false,
    },
    {
      ...base,
      id: 'latte',
      categoryId: 'latte',
      name: '카페 라떼',
      description: '에스프레소와 스팀 우유의 부드러운 조화',
      price: 5000,
      temperatures: BOTH,
      isSoldOut: false,
    },
    {
      ...base,
      id: 'vanilla-latte',
      categoryId: 'latte',
      name: '바닐라 라떼',
      description: '바닐라 시럽을 더한 달콤한 라떼',
      price: 5500,
      temperatures: BOTH,
      isSoldOut: true,
    },
    {
      ...base,
      id: 'cappuccino',
      categoryId: 'latte',
      name: '카푸치노',
      description: '풍성한 우유 거품을 올린 진한 커피',
      price: 5000,
      temperatures: [TEMPERATURE.HOT],
      isSoldOut: false,
    },
    {
      ...base,
      id: 'choco-milk',
      categoryId: 'non-coffee',
      name: '초코 우유',
      description: '진한 초콜릿을 부드러운 우유에 더했어요',
      price: 5200,
      temperatures: BOTH,
      isSoldOut: false,
    },
    {
      ...base,
      id: 'green-tea',
      categoryId: 'tea',
      name: '그린티',
      description: '은은한 향의 따뜻한 녹차',
      price: 4800,
      temperatures: [TEMPERATURE.HOT],
      isSoldOut: false,
    },
    {
      ...base,
      id: 'yuja-tea',
      categoryId: 'tea',
      name: '유자차',
      description: '달콤새콤한 유자청으로 만든 차',
      price: 5000,
      temperatures: BOTH,
      isSoldOut: false,
    },
    {
      ...base,
      id: 'scone',
      categoryId: 'dessert',
      name: '플레인 스콘',
      description: '겉은 바삭하고 속은 촉촉한 스콘',
      price: 3800,
      temperatures: BOTH,
      isSoldOut: false,
    },
  ];
}
