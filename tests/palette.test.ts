import {describe,it,expect} from 'vitest';
import {analyze,matchColor,dominantColor,oklch,retakeMessage,warmth,validHex,SAMPLE_TONES,PALETTES} from '../lib/swap/palette';
import {seedDemo} from '../lib/swap/demo';
import {transition,SwapError} from '../lib/swap/engine';

describe('colors that love you: palette logic on YouCam tone data',()=>{
 it('converts known colors into OKLCH correctly',()=>{const w=oklch('#ffffff');expect(w.L).toBeCloseTo(1,3);expect(w.C).toBeLessThan(0.001);expect(oklch('#000000').L).toBeCloseTo(0,3);expect(oklch('#ff0000').h).toBeCloseTo(29.2,0);});
 it('reads golden skin as warm and rosy skin as cool',()=>{expect(analyze({skin:'#e0ac69'}).undertone).toBe('warm');expect(analyze({skin:'#f1c1b9'}).undertone).toBe('cool');});
 it('lets hair and eye color nudge a borderline undertone',()=>{const skin='#c08a5e';expect(warmth({skin,hairName:'Auburn',eyeName:'Amber'})).toBeGreaterThan(warmth({skin}));expect(warmth({skin,hairName:'Black',eyeName:'Blue'})).toBeLessThan(warmth({skin}));});
 it('assigns all four seasons from undertone, depth and contrast',()=>{
  expect(analyze({skin:'#f0c99c',hair:'#8a5a2b'}).season).toBe('Spring');
  expect(analyze({skin:'#b07a45',hair:'#6b4a2e'}).season).toBe('Autumn');
  expect(analyze({skin:'#efcfc4',hair:'#9a8a7c'}).season).toBe('Summer');
  expect(analyze({skin:'#f1c1b9',hair:'#111111'}).season).toBe('Winter');
 });
 it('ignores malformed optional tones instead of trusting them',()=>{const p=analyze({skin:'#E0AC69',hair:'red',lip:'#zzzzzz'});expect(p.tones).toEqual({skin:'#e0ac69'});expect(()=>analyze({skin:'nope'})).toThrow();});
 it('ranks an exact palette color above an off-palette one',()=>{const p=analyze(SAMPLE_TONES.lina,'sample');expect(matchColor('#6f8fb0',p).tier).toBe('loves');expect(matchColor('#5b6236',p).tier).toBe('stretch');expect(matchColor('#6f8fb0',p).score).toBeGreaterThan(matchColor('#5b6236',p).score);});
 it('never shames a color: the lowest tier is still a "bold pick"',()=>{const m=matchColor('#00ff00',analyze(SAMPLE_TONES.maya,'sample'));expect(m.tier).toBe('stretch');expect(m.label).toMatch(/bold pick/);});
 it('gives every demo persona a flattering piece in the seeded three-way swap',()=>{
  const s=seedDemo();for(const leg of [['maya','blouse'],['sara','cardigan'],['lina','denim']]){const item=s.items.find(i=>i.id===leg[1])!;expect(validHex(item.color)).toBe(true);expect(matchColor(item.color!,analyze(SAMPLE_TONES[leg[0]],'sample')).tier).toBe('loves');}
 });
 it('every palette entry is valid hex',()=>{for(const colors of Object.values(PALETTES)){expect(colors).toHaveLength(12);for(const c of colors)expect(validHex(c)).toBe(true);}});
 it('finds the garment color and skips the backdrop',()=>{
  const w=20,h=20,px=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;const garment=x>=5&&x<15&&y>=4&&y<18;px.set(garment?[91,98,54,255]:[240,230,210,255],i);}
  expect(dominantColor(px,w,h)).toBe('#5b6236');
 });
 it('turns YouCam face errors into friendly retake prompts',()=>{expect(retakeMessage('error_face_position_too_small')).toMatch(/closer/);expect(retakeMessage(undefined)).toMatch(/close-up selfie/);});
 it('accepts a valid garment color and rejects a malformed one on add',()=>{
  const base={id:'new',eventId:'demo',ownerId:'maya',name:'Rust tee',category:'Top' as const,size:'M',condition:'Good',measurements:'',image:'/x.png',status:'available' as const};
  const ok=transition(seedDemo(),'maya',{type:'add',item:{...base,color:'#B5532F'}},'r1');expect(ok.items.find(i=>i.id==='new')?.color).toBe('#b5532f');
  expect(()=>transition(seedDemo(),'maya',{type:'add',item:{...base,color:'javascript:alert(1)'}},'r2')).toThrow(SwapError);
 });
});
describe('real YouCam response (sample selfie from YouCam docs, Nov 1 2026)',()=>{
 const live={skin:'#b48f75',lip:'#d99791',eyebrow:'#5b575a',hair:'#B56637',eye:'#2e1b17',eyeName:'Brown',hairName:'Auburn'};
 it('produces a stable profile from the live payload',()=>{const p=analyze(live);expect(p).toMatchObject({undertone:'neutral',depth:'medium',contrast:'soft',season:'Autumn'});expect(p.tones.hair).toBe('#b56637');});
 it('still separates in-palette from sister-palette colors for neutral undertones',()=>{const p=analyze(live);expect(matchColor('#5b6236',p).tier).toBe('loves');expect(matchColor('#6f8fb0',p).tier).not.toBe('loves');});
});
describe('copy for live YouCam edge cases',()=>{
 it('says "Flatters your coloring" for neutral undertones instead of "neutral undertone"',()=>{const p=analyze({skin:'#b48f75',lip:'#d99791',eyebrow:'#5b575a',hair:'#B56637',eyeName:'Brown',hairName:'Auburn'});expect(p.undertone).toBe('neutral');expect(matchColor('#5b6236',p).label).toBe('Flatters your coloring');expect(matchColor('#efe6d4',analyze(SAMPLE_TONES.maya,'sample')).label).toBe('Flatters your warm undertone');});
 it('turns error_no_face into a specific retake prompt',()=>{expect(retakeMessage('error_no_face')).toMatch(/could not find a face/);});
});
