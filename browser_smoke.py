import os,subprocess,time
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
env=dict(os.environ,GA_DB_PATH=str(root/'data'/'browser_smoke.sqlite3'),GA_SECURE_COOKIES='0')
proc=subprocess.Popen(['uvicorn','server:app','--host','127.0.0.1','--port','8765'],cwd=root,env=env,stdout=subprocess.DEVNULL,stderr=subprocess.STDOUT)
try:
 time.sleep(2)
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  page=browser.new_page()
  errs=[]
  page.on('pageerror',lambda e:errs.append(str(e)))
  page.goto('http://127.0.0.1:8765/',wait_until='domcontentloaded')
  page.locator('#authForm input[name=email]').fill('admin@example.com')
  page.locator('#authForm input[name=password]').fill('secure-password-123')
  page.locator('#authAction').click()
  page.locator('#appNav').wait_for(state='visible',timeout=15000)
  page.locator('[data-tab=scripts]').click()
  page.locator('#scripts').wait_for(state='visible')
  print('script choices',page.locator('#ceremonySection option').count())
  page.locator('[data-tab=missions]').click()
  page.locator('#missions').wait_for(state='visible')
  print('mission cards',page.locator('.mission-tile').count())
  page.locator('[data-tab=console]').click()
  page.locator('#console').wait_for(state='visible')
  print('JS errors',errs[:5])
  assert not errs,errs
  browser.close()
finally:proc.terminate();proc.wait(timeout=5)
