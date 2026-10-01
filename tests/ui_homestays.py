import asyncio,re,datetime
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
        pg=await b.new_page(viewport={'width':1366,'height':860}); pg.on('pageerror',lambda e: errs.append(str(e)))
        await pg.goto(B); await pg.wait_for_timeout(1500)
        await pg.evaluate("CS.open('p2')"); await pg.wait_for_timeout(1200)
        free=await pg.evaluate("[...document.querySelectorAll('.gcal .dy:not(.dis):not(.bl)')].map(e=>parseInt(e.textContent))")
        check('free days exist',len(free)>=3,free)
        d1,d2=free[1],free[2]
        await pg.evaluate(f"CS.bkDay({d1});CS.bkDay({d2})"); await pg.wait_for_timeout(300)
        btn=await pg.inner_text('.book-card .fx-btn'); check('hold button with total',btn.startswith('Hold') and '₹5,600' in btn,btn)
        await pg.click('.book-card .fx-btn'); await pg.wait_for_timeout(200)
        await pg.click('text=Breakfast only'); await pg.wait_for_timeout(200)
        t=await pg.inner_text('.book-card form'); check('meals toggle reprices','₹3,800' in t,t[:200])
        await pg.fill('#csh-name','Meera Iyer'); await pg.fill('#csh-phone','9876501234'); await pg.click('text=Hold my nights'); await pg.wait_for_timeout(1800)
        t=await pg.inner_text('.book-card'); ref=(re.search(r'CS-[A-Z0-9]{5}',t) or [None])[0]
        check('held with ref',ref and 'Nights held' in t,t[:300])
        dis=await pg.evaluate(f"[{d1},{d2}].map(d=>[...document.querySelectorAll('.gcal .dy')].find(e=>parseInt(e.textContent)===d).classList.contains('dis'))")
        check('nights now blocked',dis==[True,True],dis)
        await pg.click('text=Done · hold more nights'); await pg.wait_for_timeout(200)
        # chat handoff with nothing picked
        await pg.evaluate("CS.chatHold('p3',3)"); await pg.wait_for_timeout(800)
        check('chatHold opens p3 with 3 guests',await pg.evaluate("document.querySelector('.det h1').textContent.includes('Calmshet Room 1')"))
        # curated
        await pg.evaluate("CS.go('home')"); await pg.wait_for_timeout(800)
        await pg.evaluate("CS.jump('.curated')"); await pg.wait_for_timeout(600)
        today=datetime.date.today()
        days=await pg.evaluate("[...document.querySelectorAll('.curated .gcal .dy:not(.dis):not(.bl)')].map(e=>parseInt(e.textContent))")
        a,z=days[3],days[5]
        await pg.evaluate(f"CS.curPick({a});CS.curPick({z});CS.curDot('p6')"); await pg.wait_for_timeout(300)
        await pg.evaluate("CS.curGo()"); await pg.wait_for_timeout(3500)
        await pg.fill('.curated input[placeholder="Full name"]','Trip Tester'); await pg.dispatch_event('.curated input[placeholder="Full name"]','input')
        await pg.fill('.curated input[type="tel"]','9123409876'); await pg.dispatch_event('.curated input[type="tel"]','change')
        await pg.wait_for_timeout(300)
        await pg.click('.curated .wa-cta'); await pg.wait_for_timeout(2200)
        t=await pg.inner_text('.curated'); cref=(re.search(r'CS-[A-Z0-9]{5}',t) or [None])[0]
        check('curated held',cref and 'held for' in t,t[-400:])
        # host approval
        await pg.evaluate("CS.go('login')"); await pg.wait_for_timeout(300)
        await pg.fill('#lg-id','karthik@xtrathin.in'); await pg.evaluate("CS.id()"); await pg.wait_for_timeout(300)
        code=re.search(r'\d{6}',await pg.inner_text('.demo-otp')).group(0)
        await pg.click('.otp input'); await pg.keyboard.type(code,delay=50); await pg.wait_for_timeout(800)
        await pg.evaluate("CS.mode('host')"); await pg.wait_for_timeout(300)
        t=await pg.inner_text('.con'); check('locked banner',"Live bookings are locked" in t)
        await pg.fill('#cs-dk','test-desk-key-123456'); await pg.click('text=Load live bookings'); await pg.wait_for_timeout(1500)
        t=await pg.inner_text('.con'); check('approvals listed',ref in t and cref in t,t[:500])
        await pg.click(f'.appr:has-text("{ref}") .b-ok'); await pg.wait_for_timeout(1500)
        t=await pg.inner_text('.con'); check('confirmed moves out of pending',f'{ref} · Calmshet Room' not in t.split('Your listings')[0],t[:400])
        await pg.screenshot(path='/tmp/host.png')
        await pg.evaluate("CS.mode('creator')"); await pg.wait_for_timeout(500)
        t=await pg.inner_text('.con'); check('creator log shows confirmed',ref in t and 'confirmed' in t.lower())
        # phone: property page hold UI fits
        m=await b.new_page(viewport={'width':390,'height':844},is_mobile=True); m.on('pageerror',lambda e: errs.append(str(e)))
        await m.goto(B); await m.wait_for_timeout(1200); await m.evaluate("CS.open('p1')"); await m.wait_for_timeout(800)
        f=await m.evaluate("[...document.querySelectorAll('.gcal .dy:not(.dis):not(.bl)')].map(e=>parseInt(e.textContent))")
        await m.evaluate(f"CS.bkDay({f[4]});CS.csOpen()"); await m.wait_for_timeout(400)
        await m.screenshot(path='/tmp/m-hold.png')
        check('phone no sideways scroll',await m.evaluate("document.documentElement.scrollWidth<=innerWidth"))
        print('ERR',errs)
        await b.close()
asyncio.run(main())
print(f'PASS {ok}  FAIL {len(bad)}'); [print(' -',x) for x in bad]
