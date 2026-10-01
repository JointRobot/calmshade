import asyncio,re,json,urllib.request,datetime
from playwright.async_api import async_playwright
import os; SP=os.path.dirname(os.path.abspath(__file__))+'/'
B='http://127.0.0.1:8099/'
ok=0;bad=[]
def check(n,c,i=''):
    global ok
    if c: ok+=1
    else: bad.append(f'{n}: {i}')
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); errs=[]
        # 1 apply
        ap=await b.new_page(viewport={'width':1366,'height':900}); ap.on('pageerror',lambda e: errs.append(str(e)))
        await ap.goto(B+'#appa-host'); await ap.wait_for_timeout(1500)
        t=await ap.inner_text('.fx-main'); check('form copy','List your stay on Calm Shade' in t and 'Keep my place on Calm Shade after the festival' in t,t[:200])
        await ap.fill('#fxh-name','Pawna Lakeside Camp'); await ap.select_option('#fxh-cat','lake'); await ap.fill('#fxh-location','Pawna'); await ap.fill('#fxh-distance','8')
        await ap.fill('#fxh-maps','https://www.google.com/maps/place/Pawna/@18.6789,73.4912,15z'); await ap.fill('#fxh-website','pawnacamp.example')
        await ap.set_input_files('.hf-add input',[SP+'ph0.jpg',SP+'ph1.jpg',SP+'ph2.jpg']); await ap.wait_for_timeout(2500)
        n=await ap.evaluate("document.querySelectorAll('.hf-ph').length"); check('3 photos uploaded',n==3,n)
        await ap.click('.hf-ph:nth-child(2) .hf-mk'); await ap.wait_for_timeout(200)
        await ap.fill('#fxh-rooms','3'); await ap.fill('#fxh-rate','4000'); await ap.fill('#fxh-sleeps','6'); await ap.fill('#fxh-ppWith','2500'); await ap.fill('#fxh-ppWithout','1800')
        await ap.fill('#fxh-amen','Lake view · Bonfire'); await ap.fill('#fxh-desc','Tents and a cottage right on Pawna lake.')
        await ap.fill('#fxh-cname','Raj Patil'); await ap.fill('#fxh-phone','9123456780'); await ap.fill('#fxh-email','raj@example.com')
        await ap.click('text=Submit for approval'); await ap.wait_for_timeout(1500)
        t=await ap.inner_text('.fx-main'); check('submitted','is in for review' in t,t[:200])
        # 2 desk enroll
        d=await b.new_page(viewport={'width':1366,'height':900}); d.on('pageerror',lambda e: errs.append(str(e)))
        await d.goto(B); await d.wait_for_timeout(1000); await d.evaluate("CS.go('login')"); await d.wait_for_timeout(300)
        await d.fill('#lg-id','karthik@xtrathin.in'); await d.evaluate("CS.id()"); await d.wait_for_timeout(300)
        code=re.search(r'\d{6}',await d.inner_text('.demo-otp')).group(0); await d.click('.otp input'); await d.keyboard.type(code,delay=40); await d.wait_for_timeout(800)
        await d.evaluate("CS.mode('fest')"); await d.fill('#fx-dk','test-desk-key-123456'); await d.click('text=Open desk'); await d.wait_for_timeout(1500)
        t=await d.inner_text('.con'); check('application shows links+photos','Pawna Lakeside Camp' in t and 'Website' in t and 'Map' in t and await d.evaluate("document.querySelectorAll('.hf-mini img').length")==3,'')
        await d.click('text=Approve & enroll'); await d.wait_for_timeout(2000)
        link=await d.input_value('#hs-link'); check('host link shown',re.search(r'\?host=[a-f0-9]{40}$',link),link)
        wa=await d.get_attribute('a:has-text("Send on WhatsApp")','href'); check('whatsapp to host',wa and 'wa.me/919123456780' in wa,wa)
        await d.screenshot(path=SP+'enroll.png')
        # 3 home shows it
        h=await b.new_page(viewport={'width':1366,'height':900}); h.on('pageerror',lambda e: errs.append(str(e)))
        await h.goto(B+'?h=1'); await h.wait_for_timeout(2000)
        t=await h.inner_text('.grid'); check('on Calm Shade home','Pawna Lakeside Camp' in t and 'New' in t and 'Raj Patil' in t,t[-300:])
        await h.click('.pcard:has-text("Pawna Lakeside Camp")'); await h.wait_for_timeout(1200)
        t=await h.inner_text('.det'); check('detail page','Google Maps ↗' in t and 'Website ↗' in t and 'APPA Art Fest 2027' in t and '₹1,800' in t,t[:500])
        cover=await h.evaluate("document.querySelector('.det .ph img').getAttribute('src')"); check('cover = chosen 2nd photo',cover and cover.startswith('uploads/'),cover)
        # guest holds 2 nights
        free=await h.evaluate("[...document.querySelectorAll('.gcal .dy:not(.dis):not(.bl)')].map(e=>parseInt(e.textContent))")
        await h.evaluate(f"CS.bkDay({free[3]});CS.bkDay({free[4]})"); await h.click('.book-card .fx-btn'); await h.fill('#csh-name','Guest One'); await h.fill('#csh-phone','9888800001'); await h.click('text=Hold my nights'); await h.wait_for_timeout(1800)
        gt=await h.inner_text('.book-card'); gref=re.search(r'CS-[A-Z0-9]{5}',gt).group(0) if re.search(r'CS-[A-Z0-9]{5}',gt) else None; check('guest booked enrolled stay',gref,gt[:200])
        # 4 host signs in with link
        hc=await b.new_context(viewport={'width':1366,'height':900}); hp=await hc.new_page(); hp.on('pageerror',lambda e: errs.append(str(e)))
        await hp.goto(link); await hp.wait_for_timeout(2500)
        t=await hp.inner_text('#cs-app'); check('host dashboard','Welcome, Raj Patil' in t and 'Host dashboard' in t and 'LIVE ON CALM SHADE' in t.upper(),t[:400])
        check('no demo grove/moments for host','The Grove' not in t and 'Moments — your video reel' not in t)
        check('url cleaned',await hp.evaluate("location.search===''"))
        check('booking awaiting host',gref in t,t[:900])
        await hp.click(f'.appr:has-text("{gref}") .b-ok'); await hp.wait_for_timeout(1800)
        t=await hp.inner_text('#cs-app'); check('host confirmed',(gref+' · ') not in t.split('Your listings')[0] if 'Your listings' in t else False,t[:600])
        # edit listing
        await hp.click('text=Edit listing & photos'); await hp.wait_for_timeout(500)
        await hp.fill('#e-name','Pawna Lakeside Camp & Cottage'); await hp.fill('#e-pw','2700')
        await hp.set_input_files('.editor .uptile input[type=file]',SP+'ph0.jpg'); await hp.wait_for_timeout(400)
        await hp.click('text=Save changes'); await hp.wait_for_function("[...document.querySelectorAll('.toast')].some(t=>t.textContent.startsWith('Saved'))",timeout=15000); await hp.wait_for_timeout(800)
        t=await hp.inner_text('#cs-app'); check('host edit saved','Pawna Lakeside Camp & Cottage' in t,t[:500])
        await h.goto(B+'?h=2'); await h.wait_for_timeout(2000)
        t=await h.inner_text('.grid'); check('edit public',' & Cottage' in t)
        n=await h.evaluate("(()=>{const p=document.querySelector('.pcard:has(h3)');return 0})()")
        # 5 reload keeps session; sign out clears
        await hp.reload(); await hp.wait_for_timeout(2000)
        check('session persists',await hp.evaluate("document.body.innerText.includes('Raj Patil')"))
        await hp.evaluate("CS.go('dash')"); await hp.wait_for_timeout(500); await hp.click('text=Sign out'); await hp.wait_for_timeout(500)
        check('sign out clears key',await hp.evaluate("localStorage.getItem('cs-host-key')===null"))
        # 6 festival board shows partner with photo + Calm Shade link
        f=await b.new_page(viewport={'width':1366,'height':900}); f.on('pageerror',lambda e: errs.append(str(e)))
        await f.goto(B+'?f=1#appa'); await f.wait_for_timeout(1800)
        await f.click('[data-fxu^="L-"][data-fxd="2027-02-05"]'); await f.wait_for_timeout(300)
        t=await f.inner_text('#fx-sel'); check('partner panel links',('Map ↗' in t) and ('Photos & details on Calm Shade' in t) and await f.evaluate("!!document.querySelector('.hf-selimg')"),t[:300])
        # 7 login link request UI
        await f.evaluate("CS.go('login')"); await f.wait_for_timeout(300)
        await f.fill('.lg .phrow input','9123456780'); await f.click('text=Send link'); await f.wait_for_timeout(1200)
        t=await f.inner_text('.lg'); check('link request message','new sign-in link is on its way' in t,t[-300:])
        # 8 phone layout of form
        m=await b.new_page(viewport={'width':390,'height':844},is_mobile=True); m.on('pageerror',lambda e: errs.append(str(e)))
        await m.goto(B+'?m=1#appa-host'); await m.wait_for_timeout(1500)
        check('phone no sideways scroll',await m.evaluate("document.documentElement.scrollWidth<=innerWidth"))
        await m.screenshot(path=SP+'m-form.png',full_page=True)
        print('ERR',errs); await b.close()
asyncio.run(main())
print(f'PASS {ok}  FAIL {len(bad)}'); [print(' -',x) for x in bad]
