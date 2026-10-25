import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {imageDimensions,supportedDimensions} from '../lib/swap/image-spec';
it('accepts the generated sample garments at documented dimensions',()=>{for(const file of ['denim','blouse','cardigan'])expect(supportedDimensions(readFileSync(`public/garments/${file}.png`))).toBe(true);});
it('rejects malformed, truncated, undersized and oversized headers',()=>{expect(imageDimensions(new Uint8Array([255,216,255]))).toBeNull();expect(supportedDimensions(new Uint8Array(30))).toBe(false);const photo=readFileSync('public/garments/denim.png');photo.writeUInt32BE(5000,16);expect(supportedDimensions(photo)).toBe(false);photo.writeUInt32BE(100,16);expect(supportedDimensions(photo)).toBe(false);});
