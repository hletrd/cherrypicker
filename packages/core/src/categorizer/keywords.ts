/**
 * Static map of well-known Korean merchant names to canonical category IDs.
 * Category IDs follow the taxonomy defined in packages/rules/data/categories.yaml.
 * Higher-specificity matches take priority during lookup.
 */
export const MERCHANT_KEYWORDS: Record<string, string> = {
  // Coffee / Cafe
  '스타벅스': 'dining.cafe',
  'starbucks': 'dining.cafe',
  '투썸플레이스': 'dining.cafe',
  'twosome': 'dining.cafe',
  '이디야': 'dining.cafe',
  '빽다방': 'dining.cafe',
  '메가커피': 'dining.cafe',
  '컴포즈커피': 'dining.cafe',
  '할리스': 'dining.cafe',
  '폴바셋': 'dining.cafe',
  '커피빈': 'dining.cafe',
  'coffee bean': 'dining.cafe',
  '파스쿠찌': 'dining.cafe',

  // Fast food / Restaurant
  '맥도날드': 'dining.fastfood',
  'mcdonald': 'dining.fastfood',
  '버거킹': 'dining.fastfood',
  'burger king': 'dining.fastfood',
  '롯데리아': 'dining.fastfood',
  '맘스터치': 'dining.fastfood',
  'kfc': 'dining.fastfood',
  '서브웨이': 'dining.fastfood',
  'subway': 'dining.fastfood',
  '파파이스': 'dining.fastfood',
  '노브랜드버거': 'dining.fastfood',

  // Food delivery
  '배달의민족': 'dining.delivery',
  '배민': 'dining.delivery',
  '요기요': 'dining.delivery',
  '쿠팡이츠': 'dining.delivery',

  // Grocery / Supermarket
  '이마트': 'grocery.supermarket',
  '홈플러스': 'grocery.supermarket',
  '롯데마트': 'grocery.supermarket',
  '코스트코': 'grocery.supermarket',
  'costco': 'grocery.supermarket',
  '농협하나로마트': 'grocery.supermarket',
  '하나로클럽': 'grocery.supermarket',

  // Convenience store
  'cu': 'convenience_store',
  'gs25': 'convenience_store',
  '세븐일레븐': 'convenience_store',
  '7-eleven': 'convenience_store',
  '7eleven': 'convenience_store',
  '미니스톱': 'convenience_store',
  '이마트24': 'convenience_store',

  // Online shopping
  '쿠팡': 'online_shopping.general',
  'coupang': 'online_shopping.general',
  '네이버쇼핑': 'online_shopping.general',
  '11번가': 'online_shopping.general',
  'g마켓': 'online_shopping.general',
  'gmarket': 'online_shopping.general',
  '옥션': 'online_shopping.general',
  'auction': 'online_shopping.general',
  '위메프': 'online_shopping.general',
  '티몬': 'online_shopping.general',
  '인터파크': 'online_shopping.general',
  '카카오쇼핑': 'online_shopping.general',

  // Department store / Fashion
  '롯데백화점': 'shopping.department',
  '현대백화점': 'shopping.department',
  '신세계백화점': 'shopping.department',
  'shinsegae': 'shopping.department',
  '갤러리아': 'shopping.department',
  '에이케이플라자': 'shopping.department',

  // Transportation / Public transit
  '카카오택시': 'public_transit.taxi',
  '카카오T': 'public_transit.taxi',
  '타다': 'public_transit.taxi',
  '우티': 'public_transit.taxi',
  '코레일': 'public_transit.train',
  'korail': 'public_transit.train',
  'srt': 'public_transit.train',
  '서울교통공사': 'public_transit.subway',

  // Fuel / Gas station
  'sk주유소': 'fuel',
  'gs칼텍스': 'fuel',
  '현대오일뱅크': 'fuel',
  '에쓰오일': 'fuel',
  's-oil': 'fuel',
  '알뜰주유소': 'fuel',

  // Entertainment / Movie
  'cgv': 'entertainment.movie',
  '롯데시네마': 'entertainment.movie',
  '메가박스': 'entertainment.movie',

  // Streaming / Digital content
  '넷플릭스': 'entertainment.streaming',
  'netflix': 'entertainment.streaming',
  '유튜브프리미엄': 'entertainment.streaming',
  'youtube': 'entertainment.streaming',
  '왓챠': 'entertainment.streaming',
  '웨이브': 'entertainment.streaming',
  '시즌': 'entertainment.streaming',
  '티빙': 'entertainment.streaming',
  '디즈니플러스': 'entertainment.streaming',
  'disney+': 'entertainment.streaming',
  '애플tv': 'entertainment.streaming',
  'apple tv': 'entertainment.streaming',
  '스포티파이': 'entertainment.streaming',
  'spotify': 'entertainment.streaming',
  '멜론': 'entertainment.streaming',
  '지니뮤직': 'entertainment.streaming',

  // Health / Medical
  '올리브영': 'health.pharmacy',
  '롭스': 'health.pharmacy',

  // Telecom
  'skt': 'telecom',
  'kt': 'telecom',
  'lg유플러스': 'telecom',
  '알뜰폰': 'telecom',

  // Insurance
  '삼성화재': 'insurance',
  '현대해상': 'insurance',
  'kb손해보험': 'insurance',
  '메리츠화재': 'insurance',
  '한화생명': 'insurance',
  '삼성생명': 'insurance',
};
