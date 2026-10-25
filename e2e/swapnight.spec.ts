import {test,expect} from '@playwright/test';
import {seedDemo} from '../lib/swap/demo';
import {transition} from '../lib/swap/engine';
test('solo visitor completes a three-person exchange and resets',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Explore demo',exact:true}).click();
 await expect(page.getByText('You’re at a demo swap.')).toBeVisible();
 await page.getByRole('button',{name:'Find my swap',exact:true}).click();
 await expect(page.getByText('3-person exchange')).toBeVisible();
 for(const name of ['maya','sara','lina']){await page.getByLabel('Demo participant').selectOption(name);await page.getByRole('button',{name:'Accept this exchange',exact:true}).click();}
 await expect(page.getByText('Everyone accepted · reserved')).toBeVisible();
 await expect(page.getByText('Handed over · complete')).toHaveCount(0);
 for(const name of ['maya','sara','lina']){await page.getByLabel('Demo participant').selectOption(name);await page.getByLabel('I checked the garment’s condition and measurements.').check();await page.getByLabel('I had the chance to try it on and am happy to proceed.').check();await page.getByLabel('I physically gave my item and received the agreed item.').check();await page.getByRole('button',{name:'Confirm simulated handover'}).click();}
 await expect(page.getByText('Handed over · complete')).toBeVisible();
 await page.reload();await page.getByRole('button',{name:'Explore demo',exact:true}).click();await page.getByRole('button',{name:'Your exchanges'}).click();await expect(page.getByText('Handed over · complete')).toBeVisible();
 await page.getByRole('button',{name:'Reset demo'}).click();await expect(page.getByRole('button',{name:'Find my swap',exact:true})).toBeEnabled();
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);expect(overflow).toBe(false);
});
test('decline and cancellation release garments',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Explore demo',exact:true}).click();await page.getByRole('button',{name:'Find my swap',exact:true}).click();await page.getByRole('button',{name:'Accept this exchange',exact:true}).click();await page.getByLabel('Demo participant').selectOption('sara');await page.getByRole('button',{name:'Decline',exact:true}).click();await expect(page.getByText('A participant declined.')).toBeVisible();
 await page.getByRole('button',{name:'Find a match',exact:true}).click();await page.getByRole('button',{name:'Cancel exchange & release items'}).click();await expect(page.getByText('A participant cancelled.')).toBeVisible();await expect(page.getByRole('button',{name:'Find a match',exact:true})).toBeEnabled();
});
test('visitors cannot overwrite one another’s demo',async({browser})=>{
 const contextA=await browser.newContext(),contextB=await browser.newContext();const a=await contextA.newPage(),b=await contextB.newPage();
 await a.goto('/');await b.goto('/');await a.getByRole('button',{name:'Explore demo',exact:true}).click();await b.getByRole('button',{name:'Explore demo',exact:true}).click();await a.getByRole('button',{name:'Find my swap',exact:true}).click();await b.getByRole('button',{name:'Your exchanges'}).click();await expect(b.getByText('Good things come around.')).toBeVisible();await expect(a.getByText('3-person exchange')).toBeVisible();await contextA.close();await contextB.close();
});
test('shows no-match, expiry, original garment info and truthful preview state',async({page})=>{
 await page.goto('/');let expired=transition(seedDemo(),'maya',{type:'propose',itemIds:['denim','blouse','cardigan'],proposalId:'expired'},'r',Date.now()-86400010);await page.evaluate(s=>localStorage.setItem('swapnight-demo-v1',JSON.stringify(s)),expired);
 await page.getByRole('button',{name:'Explore demo',exact:true}).click();await page.getByRole('button',{name:'Your exchanges'}).click();await expect(page.getByText('expired',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Reset demo'}).click();await page.getByRole('button',{name:/Sara’s piece/}).click();await expect(page.getByText('Chest 100 cm · length 62 cm')).toBeVisible();await expect(page.getByText(/not a promise of exact fit/)).toBeVisible();await page.getByRole('button',{name:'Remove this preference'}).click();await page.getByRole('button',{name:'Close dialog'}).click();await expect(page.getByRole('button',{name:'No available match yet'})).toBeDisabled();await page.getByRole('button',{name:'My previews',exact:true}).click();await expect(page.getByText('A little privacy, please.')).toBeVisible();
});
test('live endpoints reject anonymous access and retired endpoints do not bypass auth',async({request})=>{
 expect((await request.get('/api/events')).status()).toBe(401);expect((await request.get('/api/previews')).status()).toBe(401);expect((await request.get('/api/events/00000000-0000-4000-8000-000000000001')).status()).toBe(401);expect((await request.post('/api/upload')).status()).toBe(410);
});
