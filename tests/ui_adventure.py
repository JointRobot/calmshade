import asyncio,json,urllib.request
from playwright.async_api import async_playwright
B='http://127.0.0.1:8099/index.html'
ok=0;bad=[]
def check(n,c,i=''):
    global ok
    if c: ok+=1
    else: bad.append(f'{n}: {i}')
def api(a,body=None,admin=False):
    r=urllib.request.Request('http://127.0.0.1:8099/fest.php?a='+a,data=json.dumps(body).encode() if body is not None else None,headers={'Content-Type':'application/json',**({'X-Fest-Key':'test-desk-key-123456'} if admin else {})})
    try:
        with urllib.request.urlopen(r) as f: return f.status,json.load(f)
    except urllib.error.HTTPError as e: return e.code,json.load(e)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); errs=[]
        for vw,vh in [(1366,860),(390,844)]:
            ctx=await b.new_context(viewport={'width':vw,'height':vh}); pg=await ctx.new_page(); pg.on('pageerror',lambda e: errs.append(str(e)))
            await pg.goto(B+'#appa-adv'); await pg.wait_for_timeout(1800)
            check(f'{vw} deep link opens adventures',(await pg.evaluate("document.querySelector('.fx-tab.on').textContent"))=='Adventures')
            t=await pg.inner_text('.fx-main')
            check(f'{vw} adventures listed','Kayaking' in t and 'Tandem paragliding' in t and 'Night jeep ride' in t and 'Crystal hunting' in t and '₹50 per person' in t,t[:400])
            check(f'{vw} kayak has 18 slots',await pg.evaluate("document.querySelectorAll('.fx-slot').length")==18)
            if vw==390: check('phone no sideways scroll',await pg.evaluate("document.documentElement.scrollWidth<=innerWidth+1")); await ctx.close(); continue
            # jeep, 20 Feb, 8:30 pm, 4 people
            await pg.click('.fx-adv:has-text("Night jeep ride")'); await pg.select_option('#fxa-d','2027-02-20')
            await pg.click('.fx-slot:has-text("8:30 pm")'); await pg.evaluate("CS.fx('advQty',1);CS.fx('advQty',1)")
            t=await pg.inner_text('.fx-main'); check('jeep summary','Deposit now · 4 × ₹50' in t and '₹200' in t and '₹3,800' in t,t[-300:])
            check('jeep capped at 5 people',await pg.evaluate("CS.fx('advQty',1);CS.fx('advQty',1);CS.fx('advQty',1);+document.querySelector('.fx-panel .fx-step output').textContent")==5)
            await pg.evaluate("CS.fx('advQty',-1)"); await pg.click('text=Add to my trip'); await pg.wait_for_timeout(300)
            t=await pg.inner_text('.fx-trip'); check('in trip with balance','Night jeep ride' in t and 'Adventure deposits' in t and '₹200' in t and 'Plus ₹3,800 for adventures, paid at the venue' in t,t[:600])
            # the slot now shows 1 left; adding 2 more is refused
            check('slot shows 1 left',await pg.evaluate("[...document.querySelectorAll('.fx-slot')].find(b=>b.textContent.includes('8:30 pm')).textContent.includes('1 left')"))
            await pg.evaluate("CS.fx('checkout')"); await pg.fill('#fxg-name','Asha'); await pg.fill('#fxg-phone','9800012345'); await pg.click('text=Hold my slots'); await pg.wait_for_timeout(1800)
            t=await pg.inner_text('.fx-trip'); check('slots held','Slots held' in t and '₹200' in t,t[:300])
            c,j=api('state'); check('server counts seats',j['advOcc'].get('jeep|2027-02-20|20:30')==4,j['advOcc'])
            c,j=api('admin',None,True); bk=j['bookings'][0]
            check('desk sees adventure line',bk['items'][0]['kind']=='adv' and bk['items'][0]['balance']==3800 and bk['total']==200,bk)
            await pg.evaluate("CS.fx('done')"); await pg.wait_for_timeout(300)
            # mixed trip: a stay + kayak, VIP discount excludes the deposit
            await pg.evaluate("CS.fx('tab','stay')"); await pg.wait_for_timeout(300)
            await pg.click('[data-fxu="lefarm"][data-fxd="2027-03-01"]'); await pg.click('[data-fxu="lefarm"][data-fxd="2027-03-06"]'); await pg.evaluate("CS.fx('add')")
            await pg.evaluate("CS.fx('tab','adv')"); await pg.wait_for_timeout(300); await pg.click('.fx-adv:has-text("Kayaking")'); await pg.select_option('#fxa-d','2027-03-02'); await pg.click('.fx-slot:has-text("7:20 am")'); await pg.click('text=Add to my trip'); await pg.wait_for_timeout(300)
            t=await pg.inner_text('.fx-trip'); check('vip + adventure','VIP' in t and 'Adventure deposits' in t and 'Kayaking' in t and 'Plus ₹1,200' in t,repr(t[:900]))
            await ctx.close()
        check('no page errors',not errs,errs[:3])
        await b.close()
asyncio.run(main())
print(f'PASS {ok}  FAIL {len(bad)}'); [print(' -',x) for x in bad]
