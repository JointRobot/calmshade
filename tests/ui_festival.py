import asyncio,json
from playwright.async_api import async_playwright
B='http://127.0.0.1:8099/index.html'
ok=0;bad=[]
def check(n,c,i=''):
    global ok
    if c: ok+=1
    else: bad.append(f'{n}: {i}')
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); errs=[]
        ctx=await b.new_context(viewport={'width':1366,'height':860})
        pg=await ctx.new_page(); pg.on('pageerror',lambda e: errs.append(str(e)))
        # 1 outage: no fake booking
        await pg.route('**/fest.php*',lambda r: r.abort())
        await pg.goto(B+'#appa'); await pg.wait_for_timeout(1500)
        t=await pg.inner_text('.fx')
        check('outage banner',"can't reach the booking desk" in t,t[:200])
        await pg.click('[data-fxu="lefarm"][data-fxd="2027-02-12"]'); await pg.evaluate("CS.fx('add')"); await pg.evaluate("CS.fx('checkout')"); await pg.wait_for_timeout(200)
        dis=await pg.get_attribute('text=Hold my rooms','disabled'); check('booking paused when offline',dis is not None,dis)
        await pg.unroute('**/fest.php*'); await pg.click('text=Try again now'); await pg.wait_for_timeout(1500)
        t=await pg.inner_text('.fx'); check('recovers',"can't reach" not in t)
        # 2 back button
        await pg.goto(B); await pg.wait_for_timeout(1200); await pg.evaluate("CS.go('fest')"); await pg.wait_for_timeout(800)
        check('hash set',await pg.evaluate("location.hash")=='#appa')
        await pg.go_back(); await pg.wait_for_timeout(800)
        check('back -> home',await pg.evaluate("!!document.querySelector('.fx-band') && !document.querySelector('.fx-board')"))
        await pg.go_forward(); await pg.wait_for_timeout(800)
        check('forward -> fest',await pg.evaluate("!!document.querySelector('.fx-board')"))
        # 3 book + two-tap cancel
        await pg.evaluate("CS.fx('checkout')"); await pg.wait_for_timeout(200)
        await pg.fill('#fxg-name','UI Tester'); await pg.fill('#fxg-phone','9711111111')
        await pg.click('text=Hold my rooms'); await pg.wait_for_timeout(1800)
        ref=await pg.inner_text('.fx-ref'); check('booked',ref.startswith('APPA-'),ref)
        wa=await pg.get_attribute('a:has-text("Send this booking on WhatsApp")','href'); check('whatsapp link',wa and 'wa.me/918799938193' in wa and ref in __import__('urllib.parse',fromlist=['x']).unquote(wa),wa)
        await pg.click('text=Back to the board'); await pg.wait_for_timeout(300)
        await pg.click('text=Cancel >> nth=0'); await pg.wait_for_timeout(200)
        t=await pg.inner_text('.fx-trip'); check('first tap arms',"Tap again to cancel" in t and 'pending' in t.lower(),t[-200:])
        await pg.wait_for_timeout(4300); t=await pg.inner_text('.fx-trip'); check('arm resets',"Tap again" not in t)
        await pg.click('text=Cancel >> nth=0'); await pg.click('text=Tap again to cancel'); await pg.wait_for_timeout(1500)
        t=await pg.inner_text('.fx-trip'); check('cancelled',"cancelled" in t.lower(),t[-200:])
        # 4 find on another device
        pg2=await (await b.new_context(viewport={'width':390,'height':844},is_mobile=True)).new_page(); pg2.on('pageerror',lambda e: errs.append(str(e)))
        await pg2.goto(B+'#appa'); await pg2.wait_for_timeout(1500)
        await pg2.evaluate("CS.fx('toggleTrip')"); await pg2.click('text=Booked on another phone? Find your booking')
        await pg2.fill('#fxf-ref',ref); await pg2.fill('#fxf-ph','9711111110'); await pg2.click('text=Find booking'); await pg2.wait_for_timeout(800)
        t=await pg2.inner_text('.fx-trip'); check('find wrong phone msg','No booking matches' in t,t[-150:])
        await pg2.fill('#fxf-ph','+91 97111 11111'); await pg2.click('text=Find booking'); await pg2.wait_for_timeout(1500)
        t=await pg2.inner_text('.fx-trip'); check('find works',ref in t,t[-200:])
        check('no sideways scroll on phone',await pg2.evaluate("document.documentElement.scrollWidth<=innerWidth"))
        await pg2.screenshot(path='/tmp/m-find.png')
        # 5 stale cart pruned
        pg3=await ctx.new_page()
        await pg3.goto(B); await pg3.evaluate("""localStorage.setItem('appa-cart',JSON.stringify({stays:[{key:'a',unit:'L-GONE',from:'2027-02-01',n:2,rooms:1,guests:2},{key:'b',unit:'calmshet',from:'2027-02-03',n:1,rooms:1,guests:2},{junk:1}],passes:[{date:'x'}]}))""")
        await pg3.goto(B+'?r=1#appa'); await pg3.wait_for_timeout(1800)
        t=await pg3.inner_text('.fx-trip'); check('stale cart pruned','Calmshet' in t and t.count('Remove')==1,t[:300])
        await pg3.evaluate("localStorage.setItem('appa-cart','{{broken')"); await pg3.goto(B+'?r=2#appa'); await pg3.wait_for_timeout(1200)
        check('broken storage tolerated',await pg3.evaluate("!!document.querySelector('.fx-board')"))
        # 6 calm shade calendar: past days disabled, current month label
        await pg3.goto(B); await pg3.wait_for_timeout(1200); await pg3.evaluate("CS.open('p1')"); await pg3.wait_for_timeout(800)
        t=await pg3.inner_text('.book-card')
        import datetime; n=datetime.date.today()
        check('month label not July 2026','July 2026' not in t,t[:200])
        if n.day>1:
            await pg3.evaluate(f"CS.bkDay({n.day-1})"); await pg3.wait_for_timeout(200)
            check('past day not bookable',await pg3.evaluate("!document.querySelector('.gcal .dy.sel')"))
        print('ERR',errs)
        await b.close()
asyncio.run(main())
print(f'PASS {ok}  FAIL {len(bad)}'); [print(' -',x) for x in bad]
