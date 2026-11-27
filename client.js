// dsh-shuguang-wish-pet — Client half.
//
// Native WebP playback with cached bytes, immediate click actions, and a
// separate double-click gesture. Atomic transitions and saved dragging remain.
window.__ModuleLoader__.load({
  id: 'dsh-shuguang-wish-pet',
  factory(require) {
    const React = require('react')

    // BEGIN SHARED BILLING DIALOG
    const BILLING_THEME = {"id":"wish","label":"HER ASPIRATION","accent":"#afc692"}
    let readBillingAccount = async () => null
    // Shared source, embedded into the three standalone PET clients by build-pet-billing.mjs.
    function createBillingDialog({ pet, host, theme, readAccount }) {
      let panel = null, sequence = 0, abort = null, timeout = 0, lastFocus = null, previousZ = ''
      const money = (value, currency) => new Intl.NumberFormat('zh-CN', {
        style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 4,
      }).format(value)
      const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0
      const today = () => new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10)
      function node(tag, text, css) {
        const el = document.createElement(tag)
        if (text !== undefined) el.textContent = text
        if (css) el.style.cssText = css
        return el
      }
      function row(parent, label, value, large = false) {
        const el = node('div', undefined, 'display:flex;align-items:baseline;justify-content:space-between;gap:10px;padding:5px 0;border-bottom:1px solid #ffffff12')
        el.appendChild(node('span', label, 'font-size:11px;color:#c5ced3'))
        el.appendChild(node('strong', value, `font-size:${large ? 20 : 13}px;font-weight:500;letter-spacing:.02em;color:#f5f7f6;font-variant-numeric:tabular-nums;text-align:right`))
        parent.appendChild(el)
      }
      function place() {
        if (!panel) return
        const rect = pet.getBoundingClientRect()
        const width = Math.min(330, Math.max(0, window.innerWidth - 24))
        panel.style.width = `${width}px`
        const height = panel.getBoundingClientRect().height || 230
        const left = Math.min(Math.max(12, rect.right - width), Math.max(12, window.innerWidth - width - 12))
        let top = rect.top - height - 16
        if (top < 12) top = rect.bottom + 16
        panel.style.left = `${left}px`
        panel.style.top = `${Math.min(Math.max(12, top), Math.max(12, window.innerHeight - height - 12))}px`
      }
      function close() {
        if (!panel) return
        sequence++
        abort?.abort(); abort = null
        window.clearTimeout(timeout)
        document.removeEventListener('pointerdown', outside, true)
        document.removeEventListener('keydown', keydown, true)
        window.removeEventListener('resize', place)
        panel.remove(); panel = null
        host.style.zIndex = previousZ
        if (lastFocus?.isConnected) lastFocus.focus({ preventScroll: true })
        lastFocus = null
      }
      function outside(event) { if (panel && !panel.contains(event.target) && !pet.contains(event.target)) close() }
      function keydown(event) { if (event.key === 'Escape') { event.preventDefault(); close() } }
      function wallets(result) {
        // Remote methods wrap their safe result; never read credentials or call Platform directly.
        const detail = result?.ok === true ? result.value : result?.status ? result : null
        if (!detail || detail.status !== 'ready') return []
        const groups = new Map()
        for (const [kind, list] of [['recharge', detail.value], ['bonus', detail.bonusWallets]]) {
          for (const wallet of Array.isArray(list) ? list : []) {
            if (!['CNY', 'USD'].includes(wallet?.currency) || wallet.balance === null || wallet.balance === '' || wallet.balance === undefined) continue
            const amount = Number(wallet.balance)
            if (!Number.isFinite(amount)) continue
            const group = groups.get(wallet.currency) || { currency: wallet.currency, recharge: 0, bonus: 0 }
            group[kind] += amount; groups.set(wallet.currency, group)
          }
        }
        return [...groups.values()]
      }
      async function refresh(body, footer, button) {
        const revision = ++sequence
        abort?.abort(); window.clearTimeout(timeout)
        abort = new AbortController()
        const signal = abort.signal
        button.disabled = true; button.textContent = '读取中…'
        footer.textContent = '正在读取账户余额与本机用量…'
        const deadline = new Promise(resolve => {
          timeout = window.setTimeout(() => { abort?.abort(); resolve([null, null]) }, 8000)
        })
        // Today's usage comes from this profile's own ledger first (the skin's host
        // half records every assistant message), with the Closure PET's ledger only
        // as a fallback when it happens to be enabled. Absence must stay
        // unavailable rather than zero.
        const loadLocal = async () => {
          for (const url of ['/dsh-shuguang/state', '/dsh-closure/state']) {
            try {
              const response = await fetch(url, { cache: 'no-store', credentials: 'same-origin', signal })
              if (!response.ok) continue
              const payload = await response.json()
              if (payload && payload.schemaVersion === 1) return payload
            } catch (error) {
              // try the next ledger
            }
          }
          return null
        }
        const request = Promise.all([
          Promise.resolve().then(() => readAccount({ version: 'unknown', locale: 'zh_CN', timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60 })).catch(() => null),
          loadLocal(),
        ])
        const [account, local] = await Promise.race([request, deadline])
        if (!panel || revision !== sequence) return
        window.clearTimeout(timeout)
        body.replaceChildren()
        const balances = wallets(account)
        if (balances.length) {
          for (const wallet of balances) {
            row(body, `剩余费用 · ${wallet.currency}`, money(wallet.recharge + wallet.bonus, wallet.currency), true)
            row(body, '充值余额 / 赠送余额', `${money(wallet.recharge, wallet.currency)} / ${money(wallet.bonus, wallet.currency)}`)
          }
        } else row(body, '剩余费用', '暂未获取')
        const spend = local?.schemaVersion === 1 && local.spend?.day === today() ? local.spend : null
        row(body, '今日花费 · 本机估算', number(spend?.today) ? money(spend.today, 'CNY') : '暂无统计')
        row(body, '今日 Token', number(spend?.tokensToday) ? new Intl.NumberFormat('zh-CN').format(spend.tokensToday) : '暂无统计')
        const fetchedAt = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(new Date())
        footer.textContent = `${balances.length ? '账户余额' : '请先登录 DeepSeek 账户或稍后重试'} · ${fetchedAt}\n${spend ? '北京时间今日 · 本机记录仅供参考，以平台账单为准' : '未获取本机用量记录；今日花费以平台账单为准'}`
        button.disabled = false; button.textContent = '刷新'
        place()
      }
      function open(event) {
        event.preventDefault(); event.stopPropagation()
        if (panel) { close(); return }
        // Only one PET dialogue is open when several companions are enabled.
        document.dispatchEvent(new Event('dsh-pet-billing-close'))
        lastFocus = document.activeElement
        previousZ = host.style.zIndex
        host.style.zIndex = '2147483000'
        panel = node('section', undefined, `position:fixed;box-sizing:border-box;pointer-events:auto;z-index:2147483000;max-height:calc(100vh - 24px);overflow:auto;padding:26px 16px 16px;background:linear-gradient(115deg,#192327ed,#11181ceb);border:1px solid #d6e6e333;border-left:3px solid ${theme.accent};box-shadow:0 8px 26px #0005;backdrop-filter:blur(12px);color:#f5f7f6;font-family:inherit;isolation:isolate`)
        panel.setAttribute('data-pet-billing', theme.id)
        panel.setAttribute('role', 'dialog')
        panel.setAttribute('aria-label', '费用与用量')
        const label = node('div', `✣  ${theme.label} / ACCOUNT`, `position:absolute;left:10px;top:0;transform:translateY(0) skewX(-5deg);padding:2px 9px;background:${theme.accent};color:#102022;font-size:10px;font-weight:750;letter-spacing:.07em`)
        panel.appendChild(label)
        const dismiss = node('button', '×', 'position:absolute;right:8px;top:3px;border:0;background:none;color:#dce5e5;font:20px/1.2 sans-serif;cursor:pointer;padding:3px 7px')
        dismiss.type = 'button'; dismiss.setAttribute('aria-label', '关闭费用面板'); dismiss.addEventListener('click', close)
        panel.appendChild(dismiss)
        const body = node('div', '正在读取费用…', 'min-height:90px')
        body.setAttribute('aria-live', 'polite'); panel.appendChild(body)
        const bottom = node('div', undefined, 'display:flex;align-items:end;gap:8px;margin-top:10px')
        const footer = node('div', '', 'flex:1;white-space:pre-line;color:#aebcbe;font-size:9px;line-height:1.5')
        const button = node('button', '刷新', 'border:1px solid #ffffff30;border-radius:2px;background:#ffffff0a;color:#edf2f1;padding:3px 8px;font-size:11px;font-family:inherit;cursor:pointer')
        button.type = 'button'; button.addEventListener('click', () => refresh(body, footer, button))
        bottom.appendChild(footer); bottom.appendChild(button); panel.appendChild(bottom)
        panel.appendChild(node('span', '', 'position:absolute;bottom:7px;right:9px;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid #e9efed'))
        host.appendChild(panel); place()
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && panel.animate) panel.animate([{ opacity: 0, transform: 'translateY(7px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 160, easing: 'ease-out' })
        document.addEventListener('pointerdown', outside, true)
        document.addEventListener('keydown', keydown, true)
        window.addEventListener('resize', place)
        dismiss.focus({ preventScroll: true })
        refresh(body, footer, button)
      }
      pet.addEventListener('contextmenu', open)
      document.addEventListener('dsh-pet-billing-close', close)
      return { close, dispose() { close(); pet.removeEventListener('contextmenu', open); document.removeEventListener('dsh-pet-billing-close', close) } }
    }
    
    // END SHARED BILLING DIALOG

    const BASE = '/dsh-shuguang-wish-pet/assets'
    const POS_KEY = 'dsh-shuguang-wish-pet:pos'
    // Only double-click detection uses this window; singles never wait for it.
    const DOUBLE_MS = 240
    // The state that follows each animation; preloaded so the swap decodes instantly.
    const NEXT_STATES = {
      start: 'idle-a',
      attack: 'idle-a',
      skill2: 'idle-a',
      skill3begin: 'skill3idle',
      skill3end: 'idle-a',
      loop: 'skill3idle',
    }
    const DRAG_PX = 6
    const DISPLAY_HEIGHT = 240
    const MARGIN = 24

    function prefersReducedMotion() {
      try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches
      } catch (err) {
        return false
      }
    }

    function clamp(value, min, max) {
      return Math.min(Math.max(value, min), Math.max(min, max))
    }

    function createPet(host) {
      let disposed = false
      let manifest = null
      let mode = 'normal'
      let current = null
      let generation = 0
      let endTimer = 0
      let endDeadline = 0
      let moveFrame = 0
      let activeURL = null
      let warmTask = 0
      let warmIdle = false
      const assetCache = new Map()
      const objectURLs = new Set()
      let idleTick = 0
      let lastClickAt = null
      let drag = null
      let pos = null
      let draggingClass = false
      let layerSeq = 0

      const wrap = document.createElement('div')
      wrap.setAttribute('data-dsh-shuguang-wish-pet', 'stage')
      wrap.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;pointer-events:none;z-index:1'

      const pet = document.createElement('div')
      pet.setAttribute('role', 'img')
      pet.setAttribute('aria-label', 'Shuguang wish pet')
      pet.style.cssText = [
        'position:absolute',
        'left:0',
        'top:0',
        `height:${DISPLAY_HEIGHT}px`,
        'width:0',
        'cursor:grab',
        'pointer-events:none',
        'user-select:none',
        '-webkit-user-select:none',
        'touch-action:none',
        'will-change:transform',
      ].join(';')

      wrap.appendChild(pet)
      const visual = document.createElement('div')
      visual.setAttribute('data-pet-visual', '')
      visual.style.cssText = 'position:absolute;inset:0;pointer-events:none;will-change:transform;transition:transform 80ms ease-out'
      pet.appendChild(visual)

      // Only the drawn character catches the pointer: the canvas margin around
      // it stays click-through so the pet never blocks the UI underneath.
      const hit = document.createElement('div')
      hit.setAttribute('data-dsh-shuguang-hit', '')
      hit.style.cssText = 'position:absolute;pointer-events:auto;cursor:grab;touch-action:none'
      pet.appendChild(hit)

      function layoutHit() {
        if (!manifest) return
        const box = contentBox('idle-a')
        hit.style.left = `${box.x}px`
        hit.style.top = `${box.y}px`
        hit.style.width = `${box.w}px`
        hit.style.height = `${box.h}px`
      }
      host.appendChild(wrap)

      function size() {
        if (!manifest) return
        pet.style.width = `${Math.round(DISPLAY_HEIGHT * manifest.canvas.width / manifest.canvas.height)}px`
        // Press feedback scales around the planted skill3 feet, not the canvas
        // centre; this also prevents a small bob on each half of a double click.
        const anchor = contentBox('skill3idle')
        visual.style.transformOrigin = `${anchor.x + anchor.w / 2}px ${anchor.y + anchor.h}px`
        layoutHit()
      }

      // The crop keeps transparent margin and effect room around the character.
      // Clamp against the drawn character so the pet can sit flush with the edge.
      function contentBox(name) {
        const scale = DISPLAY_HEIGHT / manifest.canvas.height
        const state = manifest.states[name] || manifest.states['idle-a'] || null
        const content = (state && state.content) || manifest.content || {
          x: 0,
          y: 0,
          width: manifest.canvas.width,
          height: manifest.canvas.height,
        }
        return {
          x: content.x * scale,
          y: (content.y + (state?.offsetY || 0)) * scale,
          w: content.width * scale,
          h: content.height * scale,
        }
      }

      function defaultPos() {
        const box = contentBox('idle-a')
        return {
          x: Math.max(MARGIN, window.innerWidth - box.x - box.w - MARGIN),
          y: Math.max(MARGIN, window.innerHeight - box.y - box.h - MARGIN - 280),
        }
      }

      function clampPos(next) {
        // Keep the same edge constraint in both forms, including during a small
        // drag between clicks. Transient effect bounds must not move the origin.
        const box = contentBox('skill3idle')
        return {
          x: clamp(next.x, -box.x, window.innerWidth - box.x - box.w),
          y: clamp(next.y, -box.y, window.innerHeight - box.y - box.h),
        }
      }

      function applyPos() {
        if (!pos) return
        if (moveFrame) window.cancelAnimationFrame(moveFrame)
        moveFrame = 0
        pet.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`
      }

      function readPos() {
        try {
          const raw = window.localStorage.getItem(POS_KEY)
          if (!raw) return null
          const parsed = JSON.parse(raw)
          if (typeof parsed.x !== 'number' || typeof parsed.y !== 'number') return null
          return parsed
        } catch (err) {
          return null
        }
      }

      function savePos() {
        try {
          window.localStorage.setItem(POS_KEY, JSON.stringify(pos))
        } catch (err) {
          // Storage can be unavailable; position then resets on reload.
        }
      }

      function idleState() {
        const states = manifest.states
        if (states['idle-a'] && states['idle-b']) {
          idleTick += 1
          return idleTick % 2 === 0 ? 'idle-a' : 'idle-b'
        }
        return states['idle-a'] ? 'idle-a' : 'idle-b'
      }

      function baseState() {
        if (mode === 'transformed' && manifest.states.skill3idle) return 'skill3idle'
        return idleState()
      }

      function loadAsset(file) {
        if (!assetCache.has(file)) {
          const ready = fetch(`${BASE}/${file}`).then(response => {
            if (!response.ok) throw new Error(String(response.status))
            return response.blob()
          }).catch(error => {
            assetCache.delete(file)
            throw error
          })
          assetCache.set(file, ready)
        }
        return assetCache.get(file)
      }

      function releaseURL(url) {
        if (!url) return
        URL.revokeObjectURL(url)
        objectURLs.delete(url)
      }

      function setImage(name, onPresent, onError) {
        const state = manifest.states[name]
        if (!state) return
        const file = prefersReducedMotion() && state.loop && state.still ? state.still : state.file
        const seq = ++layerSeq
        let nextURL = null
        loadAsset(file).then(async blob => {
          if (disposed || seq !== layerSeq) return
          // A fresh URL restarts the animation at frame zero. The compressed
          // bytes stay cached, so repeated clicks do not reread large WebPs.
          nextURL = URL.createObjectURL(blob)
          objectURLs.add(nextURL)
          const img = document.createElement('img')
          img.alt = ''
          img.draggable = false
          img.decoding = 'async'
          img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;user-select:none;-webkit-user-drag:none'
          // Current assets share a baked skill3 origin. Keep optional legacy
          // offsets for old manifests without changing the saved PET position.
          img.style.transform = `translate3d(0, ${(state.offsetY || 0) * DISPLAY_HEIGHT / manifest.canvas.height}px, 0)`
          img.src = nextURL
          if (typeof img.decode === 'function') await img.decode()
          else await new Promise((resolve, reject) => {
            img.addEventListener('load', resolve, { once: true })
            img.addEventListener('error', reject, { once: true })
          })
          if (disposed || seq !== layerSeq) {
            releaseURL(nextURL)
            return
          }
          visual.replaceChildren(img)
          releaseURL(activeURL)
          activeURL = nextURL
          if (onPresent) onPresent()
        }).catch(error => {
          releaseURL(nextURL)
          if (disposed || seq !== layerSeq) return
          console.warn('[pet] animation unavailable:', name, error.message)
          if (onError) onError()
        })
      }

      function cancelEnd() {
        if (endTimer) window.clearTimeout(endTimer)
        endTimer = 0
        endDeadline = 0
      }

      function startEnd(name, token, state) {
        // Native image playback owns frame timing; only schedule the boundary,
        // instead of running a second JavaScript loop on every display frame.
        const limit = Math.max(16, state.durationMs + 16)
        endDeadline = performance.now() + limit
        endTimer = window.setTimeout(() => {
          endTimer = 0
          endDeadline = 0
          if (!disposed && token === generation) finish(name, token)
        }, limit)
      }

      function play(name) {
        if (disposed || !manifest) return
        const state = manifest.states[name]
        if (!state) return
        cancelEnd()
        generation += 1
        const token = generation
        const previous = current
        current = name
        preloadNext(name)
        setImage(name, () => {
          if (disposed || token !== generation) return
          if (!state.loop && state.durationMs > 0) startEnd(name, token, state)
        }, () => {
          if (disposed || token !== generation) return
          current = previous
          const fallback = baseState()
          if (fallback !== name) play(fallback)
        })
      }

      function preloadNext(name) {
        const next = NEXT_STATES[name]
        if (!next || !manifest.states[next]) return
        loadAsset(manifest.states[next].file).catch(() => {})
      }

      function finish(name, token) {
        if (disposed || token !== generation) return
        if (name === 'skill3begin') {
          mode = 'transformed'
        } else if (name === 'skill3end' || name === 'start') {
          mode = 'normal'
        }
        play(baseState())
      }

      function isAtomicPlaying() {
        const state = current && manifest && manifest.states[current]
        return Boolean(state && state.atomic)
      }

      function handleClick() {
        if (!manifest) return
        if (isAtomicPlaying()) return
        if (mode === 'normal') {
          const pick = Math.random() < 0.5 ? 'attack' : 'skill2'
          play(manifest.states[pick] ? pick : 'attack')
        } else {
          play('loop')
        }
      }

      function handleDouble() {
        if (!manifest) return
        if (isAtomicPlaying()) return
        if (mode === 'normal') {
          mode = 'transformed'
          play('skill3begin')
        } else {
          mode = 'normal'
          play('skill3end')
        }
      }

      function lockSelection(lock) {
        if (lock === draggingClass) return
        draggingClass = lock
        try {
          document.body.style.userSelect = lock ? 'none' : ''
        } catch (err) {
          // ignore
        }
      }

      function onPointerDown(event) {
        if (event.button === 0) billing.close()
        if (drag || (event.button !== 0 && event.pointerType === 'mouse')) return
        event.preventDefault()
        drag = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          left: pos ? pos.x : 0,
          top: pos ? pos.y : 0,
          moved: false,
        }
        try {
          pet.setPointerCapture(event.pointerId)
        } catch (err) {
          // ignore
        }
        pet.style.cursor = 'grabbing'
        visual.style.transition = prefersReducedMotion() ? 'none' : 'transform 80ms ease-out'
        visual.style.transform = prefersReducedMotion() ? 'none' : 'scale(.97)'
      }

      function onPointerMove(event) {
        if (!drag || event.pointerId !== drag.id) return
        const dx = event.clientX - drag.x
        const dy = event.clientY - drag.y
        if (!drag.moved && Math.hypot(dx, dy) > DRAG_PX) {
          drag.moved = true
          lastClickAt = null
          visual.style.transform = 'none'
          lockSelection(true)
        }
        if (!drag.moved) return
        pos = clampPos({ x: drag.left + dx, y: drag.top + dy })
        if (!moveFrame) moveFrame = window.requestAnimationFrame(() => {
          moveFrame = 0
          if (!disposed) applyPos()
        })
      }

      function endDrag(event, cancelled) {
        if (!drag || event.pointerId !== drag.id) return
        const wasDrag = drag.moved
        drag = null
        lockSelection(false)
        pet.style.cursor = 'grab'
        visual.style.transform = 'none'
        if (cancelled || wasDrag) {
          lastClickAt = null
          if (wasDrag) {
            applyPos()
            if (!cancelled) savePos()
          }
          return
        }
        if (isAtomicPlaying()) { lastClickAt = null; return }
        const now = performance.now()
        if (lastClickAt !== null && now - lastClickAt < DOUBLE_MS) {
          lastClickAt = null
          handleDouble()
          return
        }
        lastClickAt = now
        // Single-click actions start on release, with no double-click timeout.
        handleClick()
      }

      function onPointerUp(event) {
        endDrag(event, false)
      }

      function onPointerCancel(event) {
        endDrag(event, true)
      }

      function onVisibilityChange() {
        pet.style.visibility = document.hidden ? 'hidden' : ''
        if (document.hidden) billing.close()
        if (!document.hidden && endDeadline && performance.now() >= endDeadline) {
          const name = current
          const token = generation
          cancelEnd()
          finish(name, token)
        }
      }

      function onResize() {
        billing.close()
        if (!pos) return
        pos = clampPos(pos)
        applyPos()
      }

      const billing = createBillingDialog({ pet, host: wrap, theme: BILLING_THEME, readAccount: client => readBillingAccount(client) })
      pet.addEventListener('pointerdown', onPointerDown)
      pet.addEventListener('pointermove', onPointerMove)
      pet.addEventListener('pointerup', onPointerUp)
      pet.addEventListener('pointercancel', onPointerCancel)
      pet.addEventListener('lostpointercapture', onPointerCancel)
      window.addEventListener('resize', onResize)
      document.addEventListener('visibilitychange', onVisibilityChange)

      fetch(`${BASE}/manifest.json`, { cache: 'no-store' })
        .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
        .then((data) => {
          if (disposed) return
          manifest = data
          size()
          pos = clampPos(readPos() || defaultPos())
          applyPos()
          play(manifest.states.start ? 'start' : baseState())
          // Warm the cache in the background; the base animation is already loading.
          const order = ['attack', 'skill2', 'loop', 'skill3begin', 'skill3end', 'skill3idle', 'idle-a', 'idle-b']
          const warm = (index) => {
            if (disposed || index >= order.length) return
            const state = manifest.states[order[index]]
            if (state) {
              loadAsset(state.file).catch(() => {})
            }
            if (typeof window.requestIdleCallback === 'function') {
              warmIdle = true
              warmTask = window.requestIdleCallback(() => { warmTask = 0; warm(index + 1) }, { timeout: 200 })
            } else {
              warmIdle = false
              warmTask = window.setTimeout(() => { warmTask = 0; warm(index + 1) }, 50)
            }
          }
          warm(0)
        })
        .catch((error) => {
          console.warn('[dsh-shuguang-wish-pet] manifest unavailable:', error && error.message ? error.message : error)
        })

      const controller = {
        play(name) {
          play(name)
        },
        get current() {
          return current
        },
        get mode() {
          return mode
        },
        dispose() {
          if (disposed) return
          disposed = true
          billing.dispose()
          layerSeq++
          if (moveFrame) window.cancelAnimationFrame(moveFrame)
          if (warmTask) {
            if (warmIdle && window.cancelIdleCallback) window.cancelIdleCallback(warmTask)
            else window.clearTimeout(warmTask)
          }
          for (const url of objectURLs) URL.revokeObjectURL(url)
          objectURLs.clear()
          assetCache.clear()
          cancelEnd()
            lockSelection(false)
          pet.removeEventListener('pointerdown', onPointerDown)
          pet.removeEventListener('pointermove', onPointerMove)
          pet.removeEventListener('pointerup', onPointerUp)
          pet.removeEventListener('pointercancel', onPointerCancel)
          pet.removeEventListener('lostpointercapture', onPointerCancel)
          window.removeEventListener('resize', onResize)
          document.removeEventListener('visibilitychange', onVisibilityChange)
          wrap.remove()
          if (window.__dshShuguangWishPet === controller) delete window.__dshShuguangWishPet
        },
      }

      window.__dshShuguangWishPet = controller
      return controller
    }

    function PetLayer() {
      const hostRef = React.useRef(null)
      React.useEffect(() => {
        const host = hostRef.current
        if (!host) return undefined
        const pet = createPet(host)
        return () => pet.dispose()
      }, [])
      return React.createElement('div', {
        ref: hostRef,
        style: { position: 'fixed', left: 0, top: 0, width: 0, height: 0, pointerEvents: 'none' },
      })
    }

    return {
      inject: ['slots', 'remote', 'remote.account'],
      apply(ctx) {
        readBillingAccount = client => ctx.remote?.account?.getBalance(client)
        document.documentElement.dataset.dshShuguangWishPet = ''
        ctx.effect(() => () => {
          delete document.documentElement.dataset.dshShuguangWishPet
        })
        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay',
          id: 'dsh-shuguang-wish-pet',
          order: 22,
        }, PetLayer))
      },
    }
  },
})
