import type { MenuCategory, MenuItem } from '@/models';

/** Stand-in for a server menu response in tests; ids are readable strings, not the seeded uuids. */
export const TEST_CATEGORIES: MenuCategory[] = [
  { id: 'coffee', name: '커피' },
  { id: 'latte', name: '라떼' },
  { id: 'non-coffee', name: '논커피' },
  { id: 'tea', name: '티' },
  { id: 'dessert', name: '디저트' },
];

const BOTH = ['HOT', 'ICE'] as const;

function item(
  id: string,
  categoryId: string,
  name: string,
  description: string,
  price: number,
  temperatures: MenuItem['temperatures'],
  isSoldOut = false,
): MenuItem {
  return { id, categoryId, name, description, price, temperatures, isSoldOut, imageUrl: null };
}

export const TEST_MENU: MenuItem[] = [
  item('americano', 'coffee', '아메리카노', '진한 에스프레소에 물을 더한 깊은 풍미의 커피', 4500, [
    ...BOTH,
  ]),
  item('cold-brew', 'coffee', '콜드브루', '저온에서 오래 우려낸 부드러운 커피', 5000, ['ICE']),
  item('latte', 'latte', '카페 라떼', '에스프레소와 스팀 우유의 부드러운 조화', 5000, [...BOTH]),
  item(
    'vanilla-latte',
    'latte',
    '바닐라 라떼',
    '바닐라 시럽을 더한 달콤한 라떼',
    5500,
    [...BOTH],
    true,
  ),
  item('choco-milk', 'non-coffee', '초코 우유', '진한 초콜릿을 부드러운 우유에 더했어요', 5200, [
    ...BOTH,
  ]),
  item('green-tea', 'tea', '그린티', '은은한 향의 따뜻한 녹차', 4800, ['HOT']),
  item('scone', 'dessert', '플레인 스콘', '겉은 바삭하고 속은 촉촉한 스콘', 3800, [...BOTH]),
  item('bottled-water', 'dessert', '생수', '병 음료', 1500, []),
];

/** Default hook responses; `jest.setup.ts` installs them and tests restore them after overriding a hook. */
export function menuQueryDefault() {
  return { status: 'success' as const, data: TEST_MENU };
}
export function categoriesQueryDefault() {
  return { status: 'success' as const, data: TEST_CATEGORIES };
}
export function menuItemQueryDefault(id: string) {
  return { status: 'success' as const, data: TEST_MENU.find((item) => item.id === id) ?? null };
}
