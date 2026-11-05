// Names and prices the order fixtures snapshot into their lines (as a real order does). The live menu is
// served by Supabase now; this table disappears with the order fixtures in phase (c).
type FixtureMenuEntry = { id: string; name: string; price: number };

export const ORDER_FIXTURE_MENU: readonly FixtureMenuEntry[] = [
  { id: 'americano', name: '아메리카노', price: 4500 },
  { id: 'cold-brew', name: '콜드브루', price: 5000 },
  { id: 'latte', name: '카페 라떼', price: 5000 },
  { id: 'vanilla-latte', name: '바닐라 라떼', price: 5500 },
  { id: 'cappuccino', name: '카푸치노', price: 5000 },
  { id: 'choco-milk', name: '초코 우유', price: 5200 },
  { id: 'green-tea', name: '그린티', price: 4800 },
  { id: 'yuja-tea', name: '유자차', price: 5000 },
  { id: 'scone', name: '플레인 스콘', price: 3800 },
];
