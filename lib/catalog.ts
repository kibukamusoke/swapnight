export type Garment = { id: string; name: string; category: string; image: string; owned: boolean; note: string };
export const samplePhoto = 'https://images.media.io/ai-prompts/gemini-ai-white-t-shirt-and-jeans-prompt-1.jpg';
export const initialGarments: Garment[] = [
 { id: 'linen', name: 'The everyday blazer', category: 'outer', image: 'https://media.stories.com/assets/005/89/ef/89ef66b39ea47cbada2d639b3cb0638b36e29a83_xxl-1.jpg', owned: false, note: 'Linen · Oat milk' },
 { id: 'tailored', name: 'A little more tailored', category: 'outer', image: 'https://cdn.mos.cms.futurecdn.net/whowhatwear/posts/285864/and-other-stories-capsule-wardrobe-285864-1582931915917-product.jpg', owned: false, note: 'Tailored · Sand' },
 { id: 'tee', name: 'The perfect white tee', category: 'upper_body', image: 'https://attiresense.com/cdn/shop/files/Gemini_Generated_Image_lhoul6lhoul6lhou.jpg?v=1764333353', owned: true, note: 'Cotton · Cloud' },
 { id: 'classic', name: 'Your everyday outfit', category: 'full_body', image: samplePhoto, owned: true, note: 'Tee + your favorite denim' },
];
