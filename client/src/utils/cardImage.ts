/** 从 card.id 中提取卡牌编号，支持 card_1、debug_card_1_xxx、brew_card_1_xxx 等格式 */
export function getCardImageNum(cardId: string): string {
  const match = cardId.match(/card_(\d+)/);
  return match ? match[1] : '0';
}

export function getCardImageUrl(cardId: string): string {
  const num = getCardImageNum(cardId);
  const ext = num === '21' ? '.gif' : '.png';
  return `/assets/item/${num}${ext}`;
}
