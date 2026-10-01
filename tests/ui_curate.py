import asyncio,json,urllib.request
from playwright.async_api import async_playwright
B='http://127.0.0.1:8099/'
ok=0;bad=[]
def check(n,c,i=''):
    global ok
    if c: ok+=1
    else: bad.append(f'{n}: {i}')
def api(a,body):
    r=urllib.request.Request(B+'fest.php?a='+a,data=json.dumps(body).encode(),headers={'Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(r) as f: return f.status,json.load(f)
    except urllib.error.HTTPError as e: return e.code,json.load(e)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']); errs=[]
        # 1 festival app tickets panel
        a=await b.new_page(viewport={'width':1366,'height':860}); a.on('pageerror',lambda e: errs.append('APP '+str(e)))
        await a.goto(B+'appa/2027/'); await a.wait_for_timeout(5000)
        await a.evaluate("document.querySelector('#ticketsbtn').click()"); await a.wait_for_timeout(1200)
        links=await a.evaluate("[...document.querySelectorAll('a.cbtn')].map(x=>[x.textContent,x.getAttribute('href')])")
        check('app links',any(h=='../../#appa-pass' for _,h in links) and any(h=='../../#appa-curate' for _,h in links) and any(h=='../../#passport' for _,h in links),links)
        t=await a.inner_text('body'); check('app keeps info','Cycle or e-bike pickup' in t and 'Personal meet-ups with resident artists' in t and 'Priority entry' in t and '₹12,000' in t and 'Kids under 10 always enter free' in t,'')
        await a.screenshot(path='/tmp/app-tickets.png')
        # 2 deep links resolve
        pg=await b.new_page(viewport={'width':1366,'height':860}); pg.on('pageerror',lambda e: errs.append(str(e)))
        await pg.goto(B+'appa/2027/../../#appa-pass'); await pg.wait_for_timeout(1500)
        check('deep link pass tab',await pg.evaluate("document.querySelector('.fx-tab.on').textContent")=='Day passes')
        await pg.goto(B+'?x=1#appa-curate'); await pg.wait_for_timeout(1500)
        check('deep link curate tab',(await pg.evaluate("document.querySelector('.fx-tab.on').textContent")).startswith('Curate'))
        # 3 curate auto, 7 nights
        await pg.click('text=Curate my stay'); await pg.wait_for_timeout(300)
        t=await pg.inner_text('.fx-main'); check('auto suggestion','Our suggestion' in t and 'VIP · 7 nights inside' in t.replace('\n',' ').upper().replace('VIP · 7 NIGHTS INSIDE','VIP · 7 nights inside'),t[-600:])
        await pg.screenshot(path='/tmp/curate.png',full_page=True)
        # 4 chosen route: Le Farm then Theeya, 2 rooms
        await pg.evaluate("CS.cu('rooms',1)")
        await pg.click('.fx-chip:has-text("Le Farm")'); await pg.click('.fx-chip:has-text("Theeya")'); await pg.click('text=Curate my stay'); await pg.wait_for_timeout(300)
        t=await pg.inner_text('.fx-main'); check('route split 4/3 or 3/4','Your route · 2 venues' in t and ('4 nights' in t and '3 nights' in t),t[-700:])
        await pg.click('text=Add to my trip'); await pg.wait_for_timeout(600)
        t=await pg.inner_text('.fx-trip'); check('added to trip as 2 stays, VIP',t.count('Remove')==2 and 'VIP' in t and '2 rooms' in t,t[:500])
        # 5 book it; then theeya fully booked for those nights? 2 rooms of 4 taken
        await pg.evaluate("CS.fx('checkout')"); await pg.fill('#fxg-name','Curator'); await pg.fill('#fxg-phone','9700011122'); await pg.click('text=Hold my rooms'); await pg.wait_for_timeout(2000)
        ref=await pg.inner_text('.fx-ref'); check('booked',ref.startswith('APPA-'),ref)
        c,j=api('passport',{'tickets':[]})
        # fill Theeya for the remaining rooms on one of those nights via API, then curate with Theeya only for 7 nights -> error message
        for i in range(2): api('book',{'stays':[{'unit':'theeya','from':'2027-01-28','n':1,'rooms':1,'guests':2}],'passes':[],'guest':{'name':'F','phone':f'93000000{i:02d}'}})
        await pg.reload(); await pg.wait_for_timeout(1500)
        await pg.evaluate("CS.fx('tab','curate')"); await pg.wait_for_timeout(200)
        await pg.evaluate("CS.cu('clear')"); await pg.click('.fx-chip:has-text("Theeya")'); await pg.click('text=Curate my stay'); await pg.wait_for_timeout(300)
        t=await pg.inner_text('.fx-main'); check('full venue explained','full' in t.lower() or "can’t split" in t,t[-500:])
        # 6 VVIP preset
        await pg.evaluate("CS.cu('clear')"); await pg.click('text=The month · VVIP'); await pg.click('text=Curate my stay'); await pg.wait_for_timeout(500)
        t=await pg.inner_text('.fx-main'); check('vvip month','VVIP' in t and '−₹40,000' in t,t[-500:])
        # 7 home entry points
        await pg.goto(B+'?h=1'); await pg.wait_for_timeout(1500)
        await pg.click('.fx-band >> text=Curate a VIP week'); await pg.wait_for_timeout(800)
        check('band → curate',(await pg.evaluate("document.querySelector('.fx-tab.on').textContent")).startswith('Curate'))
        await pg.goto(B+'?h=2'); await pg.wait_for_timeout(1500)
        await pg.click('.curated >> text=Curate your festival stay'); await pg.wait_for_timeout(800)
        check('curated section → curate',(await pg.evaluate("location.hash"))=='#appa-curate' and (await pg.evaluate("document.querySelector('.fx-tab.on').textContent")).startswith('Curate'))
        # 8 included section
        await pg.evaluate("CS.fx('tab','stay')"); await pg.wait_for_timeout(200)
        t=await pg.inner_text('.fx-main'); check('included section',"What's included" in t and 'Personal meet-ups' in t and 'Cycle or e-bike' in t)
        m=await b.new_page(viewport={'width':390,'height':844},is_mobile=True); m.on('pageerror',lambda e: errs.append(str(e)))
        await m.goto(B+'?m=1#appa-curate'); await m.wait_for_timeout(1500); await m.click('text=Curate my stay'); await m.wait_for_timeout(300)
        check('phone no sideways scroll',await m.evaluate("document.documentElement.scrollWidth<=innerWidth"))
        await m.screenshot(path='/tmp/m-curate.png',full_page=True)
        print('ERR',errs); await b.close()
asyncio.run(main())
print(f'PASS {ok}  FAIL {len(bad)}'); [print(' -',x) for x in bad]
