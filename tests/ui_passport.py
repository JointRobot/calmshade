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
        ctx=await b.new_context(viewport={'width':1366,'height':860}); pg=await ctx.new_page(); pg.on('pageerror',lambda e: errs.append(str(e)))
        # book: Le Farm 3 nights + day pass 10 Feb, via UI
        await pg.goto(B+'#appa'); await pg.wait_for_timeout(1500)
        await pg.click('[data-fxu="lefarm"][data-fxd="2027-02-02"]'); await pg.click('[data-fxu="lefarm"][data-fxd="2027-02-04"]'); await pg.evaluate("CS.fx('add')")
        await pg.evaluate("CS.fx('tab','pass')"); await pg.click('.fx-day:has-text("10")'); await pg.evaluate("CS.fx('addPass');CS.fx('checkout')"); await pg.wait_for_timeout(300)
        await pg.fill('#fxg-name','Ravi Menon'); await pg.fill('#fxg-phone','9811122233'); await pg.click('text=Hold my rooms'); await pg.wait_for_timeout(1800)
        ref=await pg.inner_text('.fx-ref')
        # passport before payment
        await pg.evaluate("CS.go('passport')"); await pg.wait_for_timeout(1200)
        t=await pg.inner_text('.pp'); check('pending passport message','waiting for payment confirmation' in t,t[:300])
        c,links=api('stamp_links',None,True); sig={l['spot']:l['sig'] for l in links['links']}
        c,j=api('stamp',{'spot':'lefarm','sig':sig['lefarm'],'tickets':[]}); check('stamp without booking 403',c==403,(c,j))
        c,j=api('stamp',{'spot':'lefarm','sig':'000000000000','tickets':[]}); check('forged stamp 400',c==400,(c,j))
        # timetable
        c,j=api('schedule_set',{'items':[{'date':'2027-02-03','time':'19:30','spot':'lefarm','title':'Roots night concert','access':'all'},{'date':'2027-02-03','time':'22:00','spot':'calmshet','title':'Artist dinner','access':'vvip'},{'date':'2027-02-20','time':'','spot':'theeya','title':'Choir day','access':'all'},{'date':'bad','title':'x'}]},True)
        check('schedule saved, bad dropped',c==200 and len(j['schedule'])==3,(c,j))
        c,j=api('status',{'ref':ref,'status':'confirmed'},True); check('confirmed',c==200)
        await pg.reload(); await pg.wait_for_timeout(1800)
        t=await pg.inner_text('.pp')
        check('cover','Ravi’s' in t and '4 festival days' in t and '0 of 9 stamps' in t,t[:400])
        # stamp via QR URL on same phone
        await pg.goto(B+f'?stamp=lefarm.{sig["lefarm"]}'); await pg.wait_for_timeout(2200)
        t=await pg.inner_text('.pp'); check('stamped via QR','1 of 9 stamps' in t and 'VISITED' in t.upper(),t[:500])
        check('url cleaned',await pg.evaluate("location.search===''&&location.hash==='#passport'"))
        await pg.goto(B+f'?stamp=lefarm.{sig["lefarm"]}'); await pg.wait_for_timeout(2000)
        t=await pg.inner_text('.pp'); check('restamp idempotent','1 of 9 stamps' in t)
        check('stay ring on Le Farm',await pg.evaluate("!!document.querySelector('.pp-pin.stay')"))
        await pg.screenshot(path='/tmp/pp-stamps.png')
        # itinerary
        await pg.evaluate("CS.pp('tab','itin')"); await pg.wait_for_timeout(300)
        t=await pg.inner_text('.pp-itin'); check('my days','Staying at Le Farm' in t and 'Day pass' in t and 'Roots night concert' in t,t[:500])
        check('vvip item locked','Artist dinner' in t and 'VVIP' in t,t[:600])
        await pg.evaluate("CS.pp('mine',false)"); await pg.wait_for_timeout(300)
        t=await pg.inner_text('.pp-itin'); check('whole festival shows others + no encore for non-VIP','Add this day' in t and 'Choir day' in t and 'Encore' not in t,t[-300:])
        await pg.screenshot(path='/tmp/pp-itin.png',full_page=False)
        await pg.click('.pp-day:has-text("Choir day") >> text=Add this day'); await pg.wait_for_timeout(800)
        t=await pg.inner_text('.fx-trip'); check('add day → checkout with pass','Day pass' in t and '20 Feb' in t and 'Continue to payment' in t,t[:400])
        # new phone: scan → find → stamped
        ctx2=await b.new_context(viewport={'width':390,'height':844},is_mobile=True); m=await ctx2.new_page(); m.on('pageerror',lambda e: errs.append(str(e)))
        await m.goto(B+f'?stamp=theeya.{sig["theeya"]}'); await m.wait_for_timeout(1500)
        t=await m.inner_text('.pp'); check('new phone asked to open passport','Open your passport' in t and 'Theeya' in t,t[:300])
        await m.fill('#fxf-ref',ref); await m.fill('#fxf-ph','98111 22233'); await m.click('button:has-text("Open passport")'); await m.wait_for_timeout(2500)
        t=await m.inner_text('.pp'); check('stamp applied after finding','2 of 9 stamps' in t,t[:300])
        check('phone no sideways scroll',await m.evaluate("document.documentElement.scrollWidth<=innerWidth"))
        await m.screenshot(path='/tmp/pp-phone.png',full_page=True)
        # desk posters
        await pg.goto(B); await pg.wait_for_timeout(1000); await pg.evaluate("CS.go('login')"); await pg.wait_for_timeout(300)
        await pg.fill('#lg-id','karthik@xtrathin.in'); await pg.evaluate("CS.id()"); await pg.wait_for_timeout(300)
        import re; code=re.search(r'\d{6}',await pg.inner_text('.demo-otp')).group(0); await pg.click('.otp input'); await pg.keyboard.type(code,delay=40); await pg.wait_for_timeout(800)
        await pg.evaluate("CS.mode('fest')"); await pg.fill('#fx-dk','test-desk-key-123456'); await pg.click('text=Open desk'); await pg.wait_for_timeout(1500)
        await pg.click('text=Show posters'); await pg.wait_for_timeout(800)
        n=await pg.evaluate("document.querySelectorAll('.pp-poster [data-qr*=\"?stamp=\"]').length"); check('9 posters with stamp links',n==9,n)
        t=await pg.inner_text('.con'); check('poster counts','1 stamp so far' in t,'')
        await pg.fill('#pps-ti','Sunrise yoga'); await pg.click('text=Add to timetable'); await pg.wait_for_timeout(1200)
        t=await pg.inner_text('.con'); check('timetable add via desk','Sunrise yoga' in t)
        print('ERR',errs); await b.close()
asyncio.run(main())
print(f'PASS {ok}  FAIL {len(bad)}'); [print(' -',x) for x in bad]
