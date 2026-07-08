/**
 * auditor-api — auditors.astranov.eu
 * Γενικό καθολικό · ισοζύγιο · ισολογισμός · φόροι · AVC ledger
 * Deploy: supabase functions deploy auditor-api
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function num(v: unknown) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function periodMonth(d: Date) {
  return d.toISOString().slice(0, 7)
}

function inRange(iso: string | null | undefined, from: string | null, to: string | null) {
  if (!iso) return false
  const day = iso.slice(0, 10)
  if (from && day < from) return false
  if (to && day > to) return false
  return true
}

type Profile = { id: string; is_owner?: boolean; is_auditor?: boolean; display_name?: string; balance?: number }

async function resolveCaller(sb: ReturnType<typeof createClient>, authHeader: string) {
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return { error: 'Unauthorized', status: 401 as const }
  const { data: { user }, error } = await sb.auth.getUser(token)
  if (error || !user) return { error: 'Unauthorized', status: 401 as const }
  const { data: prof } = await sb.from('profiles').select('id,is_owner,is_auditor,display_name,balance').eq('id', user.id).single()
  const p = (prof || { id: user.id }) as Profile
  const isOwner = p.is_owner === true
  const isAuditor = p.is_auditor === true || isOwner
  const ownerEmail = (Deno.env.get('OWNER_EMAIL') || 'notisastranov@gmail.com').toLowerCase()
  const isArchitect = (user.email || '').toLowerCase() === ownerEmail
  return {
    user,
    profile: p,
    isOwner: isOwner || isArchitect,
    isAuditor: isAuditor || isArchitect,
    canCompany: isOwner || isAuditor || isArchitect,
  }
}

function buildJournalFromInvoices(invoices: Array<Record<string, unknown>>) {
  const lines: Array<Record<string, unknown>> = []
  for (const inv of invoices) {
    const sub = num(inv.subtotal)
    const del = num(inv.delivery_fee)
    const plat = num(inv.platform_fee)
    const total = num(inv.total)
    const vatFood = sub * num(inv.vat_food ?? 0.13)
    const vatSvc = (del + plat) * num(inv.vat_service ?? 0.24)
    const vat = vatFood + vatSvc
    const net = total - vat
    const day = String(inv.issued_at || inv.created_at || '').slice(0, 10)
    const id = String(inv.id || inv.mark || '')
    const memo = `Τιμολόγιο ${inv.mark || id} · ${inv.vendor_name || ''}`
    if (sub > 0) lines.push({ entry_date: day, account_code: '70', debit: 0, credit: sub, memo, source_type: 'invoice', source_id: id })
    if (del > 0) lines.push({ entry_date: day, account_code: '72', debit: 0, credit: del, memo, source_type: 'invoice', source_id: id })
    if (plat > 0) lines.push({ entry_date: day, account_code: '71', debit: 0, credit: plat, memo, source_type: 'invoice', source_id: id })
    if (vat > 0) lines.push({ entry_date: day, account_code: '54', debit: 0, credit: vat, memo: memo + ' · ΦΠΑ', source_type: 'invoice', source_id: id })
    if (total > 0) lines.push({ entry_date: day, account_code: '30', debit: total, credit: 0, memo, source_type: 'invoice', source_id: id })
    const goodsCost = sub * 0.7
    if (goodsCost > 0) lines.push({ entry_date: day, account_code: '40', debit: 0, credit: goodsCost, memo: memo + ' · προμηθευτής', source_type: 'invoice', source_id: id })
    if (del > 0) lines.push({ entry_date: day, account_code: '64', debit: del * 0.85, credit: 0, memo: memo + ' · οδηγός', source_type: 'invoice', source_id: id })
  }
  return lines
}

function trialBalance(lines: Array<Record<string, unknown>>, accounts: Array<Record<string, unknown>>) {
  const map = new Map<string, { debit: number; credit: number }>()
  for (const l of lines) {
    const code = String(l.account_code)
    const cur = map.get(code) || { debit: 0, credit: 0 }
    cur.debit += num(l.debit)
    cur.credit += num(l.credit)
    map.set(code, cur)
  }
  const acctMap = new Map(accounts.map((a) => [String(a.code), a]))
  const rows = [...map.entries()].map(([code, v]) => {
    const a = acctMap.get(code) || {}
    const balance = v.debit - v.credit
    return {
      code,
      name_el: a.name_el || code,
      name_en: a.name_en || '',
      category: a.category || 'asset',
      debit: Math.round(v.debit * 100) / 100,
      credit: Math.round(v.credit * 100) / 100,
      balance: Math.round(balance * 100) / 100,
    }
  }).sort((a, b) => a.code.localeCompare(b.code))
  const totalDebit = rows.reduce((s, r) => s + r.debit, 0)
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0)
  return { rows, total_debit: totalDebit, total_credit: totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.02 }
}

function balanceSheetFromTrial(tb: ReturnType<typeof trialBalance>, userLiabilities: number, projected = false) {
  const byCat = (cat: string) => tb.rows.filter((r) => r.category === cat)
  const sumBal = (rows: typeof tb.rows, sign: 1 | -1) =>
    rows.reduce((s, r) => s + (sign === 1 ? Math.max(0, r.balance) : Math.max(0, -r.balance)), 0)

  let assets = sumBal(byCat('asset'), 1)
  let liabilities = sumBal(byCat('liability'), -1) + userLiabilities
  const equityBook = sumBal(byCat('equity'), -1)
  const revenue = sumBal(byCat('revenue'), -1)
  const expenses = sumBal(byCat('expense'), 1)
  const retained = revenue - expenses
  const equity = equityBook + retained
  assets += userLiabilities

  const lines = {
    assets: [
      { label: 'Ταμείο / AVC', amount: tb.rows.find((r) => r.code === '10')?.balance || 0 },
      { label: 'Απαιτήσεις', amount: tb.rows.find((r) => r.code === '30')?.balance || 0 },
      { label: 'AVC χρηστών (ενεργητικό αντιστάθμιση)', amount: userLiabilities },
    ],
    liabilities: [
      { label: 'Υποχρεώσεις AVC χρηστών', amount: userLiabilities },
      { label: 'Υποχρεώσεις προμηθευτών', amount: tb.rows.find((r) => r.code === '40')?.balance ? -tb.rows.find((r) => r.code === '40')!.balance : 0 },
      { label: 'ΦΠΑ πληρωτέο', amount: tb.rows.find((r) => r.code === '54')?.balance ? -tb.rows.find((r) => r.code === '54')!.balance : 0 },
    ],
    equity: [
      { label: 'Κεφάλαιο', amount: equityBook },
      { label: 'Αποτελέσματα χρήσης (τρέχον)', amount: retained },
    ],
  }

  return {
    projected,
    as_of: new Date().toISOString().slice(0, 10),
    assets: Math.round(assets * 100) / 100,
    liabilities: Math.round(liabilities * 100) / 100,
    equity: Math.round(equity * 100) / 100,
    lines,
    balanced: Math.abs(assets - (liabilities + equity)) < 1,
  }
}

const GREEK_TAX = {
  CORPORATE: 0.22,
  DIVIDEND: 0.05,
  EMPLOYEE_EFK: 0.1355,
  EMPLOYER_EFK: 0.2229,
}

function monthlySalaryTax(gross: number) {
  const annual = gross * 12
  const bands: [number, number][] = [[10000, 0.09], [20000, 0.22], [30000, 0.28], [40000, 0.36], [65000, 0.44], [220000, 0.50], [1e12, 0.54]]
  let tax = 0
  let prev = 0
  for (const [cap, rate] of bands) {
    const slice = Math.min(annual, cap) - prev
    if (slice <= 0) break
    tax += slice * rate
    prev = cap
    if (annual <= cap) break
  }
  return Math.max(0, tax / 12)
}

function payrollCalc(gross: number) {
  const employeeEfka = gross * GREEK_TAX.EMPLOYEE_EFK
  const employerEfka = gross * GREEK_TAX.EMPLOYER_EFK
  const incomeTax = monthlySalaryTax(gross)
  return {
    gross,
    employee_efka: employeeEfka,
    employer_efka: employerEfka,
    income_tax: incomeTax,
    net_pay: gross - employeeEfka - incomeTax,
    employer_total: gross + employerEfka,
  }
}

function buildJournalFromPayroll(runs: Array<Record<string, unknown>>) {
  const lines: Array<Record<string, unknown>> = []
  for (const r of runs) {
    if (!r.posted) continue
    const day = String(r.period_month || '') + '-28'
    const id = String(r.id || '')
    const gross = num(r.gross)
    const empEfka = num(r.employee_efka)
    const erEfka = num(r.employer_efka)
    const tax = num(r.income_tax)
    const net = num(r.net_pay)
    const memo = 'Μισθοδοσία ' + (r.employee_name || r.period_month)
    if (gross + erEfka > 0) lines.push({ entry_date: day, account_code: '60.01', debit: gross + erEfka, credit: 0, memo, source_type: 'payroll', source_id: id })
    if (net > 0) lines.push({ entry_date: day, account_code: '41', debit: 0, credit: net, memo, source_type: 'payroll', source_id: id })
    if (empEfka + erEfka > 0) lines.push({ entry_date: day, account_code: '41', debit: 0, credit: empEfka + erEfka, memo: memo + ' · ΕΦΚΑ', source_type: 'payroll', source_id: id })
    if (tax > 0) lines.push({ entry_date: day, account_code: '55', debit: 0, credit: tax, memo: memo + ' · φόρος', source_type: 'payroll', source_id: id })
  }
  return lines
}

function buildJournalFromExpenses(rows: Array<Record<string, unknown>>) {
  const lines: Array<Record<string, unknown>> = []
  for (const e of rows) {
    if (!e.posted) continue
    const day = String(e.entry_date || e.period_month + '-01')
    const id = String(e.id || '')
    const net = num(e.amount_net)
    const vat = num(e.vat_amount)
    const gross = num(e.amount_gross)
    const acct = e.expense_type === 'rent' ? '60.02' : '60.04'
    const memo = String(e.description || e.expense_type)
    if (net > 0) lines.push({ entry_date: day, account_code: acct, debit: net, credit: 0, memo, source_type: 'expense', source_id: id })
    if (vat > 0) lines.push({ entry_date: day, account_code: '54', debit: vat, credit: 0, memo: memo + ' · ΦΠΑ', source_type: 'expense', source_id: id })
    if (gross > 0) lines.push({ entry_date: day, account_code: '11', debit: 0, credit: gross, memo, source_type: 'expense', source_id: id })
  }
  return lines
}

function incomeStatementFromTb(tb: ReturnType<typeof trialBalance>, extraExpense = 0) {
  const rev = tb.rows.filter((r) => r.category === 'revenue').reduce((s, r) => s + Math.max(0, -r.balance), 0)
  const exp = tb.rows.filter((r) => r.category === 'expense').reduce((s, r) => s + Math.max(0, r.balance), 0) + extraExpense
  const ebit = rev - exp
  const corporateTax = Math.max(0, ebit * GREEK_TAX.CORPORATE)
  const net = ebit - corporateTax
  const lines = [
    { label: 'Έσοδα πωλήσεων & υπηρεσιών', amount: rev },
    { label: 'Λειτουργικά έξοδα', amount: -exp },
    { label: 'Αποτέλεσμα προ φόρων (EBIT)', amount: ebit },
    { label: 'Φόρος εισοδήματος 22%', amount: -corporateTax },
    { label: 'Καθαρά κέρδη μετά φόρων', amount: net },
  ]
  return {
    revenue: Math.round(rev * 100) / 100,
    expenses: Math.round(exp * 100) / 100,
    ebit: Math.round(ebit * 100) / 100,
    corporate_tax: Math.round(corporateTax * 100) / 100,
    net_after_tax: Math.round(net * 100) / 100,
    lines,
    note: 'ΕΛΠ · φόρος εισοδήματος νομικών προσώπων 22% (Ν. 4172/2013) · όχι φορολογική συμβουλή',
  }
}

function taxEstimate(invoices: Array<Record<string, unknown>>, orders: Array<Record<string, unknown>>, netProfit = 0) {
  let vatPayable = 0
  let revenue = 0
  for (const inv of invoices) {
    const sub = num(inv.subtotal)
    const del = num(inv.delivery_fee)
    const plat = num(inv.platform_fee)
    revenue += sub + del + plat
    vatPayable += sub * num(inv.vat_food ?? 0.13) + (del + plat) * num(inv.vat_service ?? 0.24)
  }
  let pendingRevenue = 0
  for (const o of orders) {
    if (String(o.status) === 'cancelled') continue
    const c = (o.calc || {}) as Record<string, unknown>
    pendingRevenue += num(c.total_eur ?? c.total_avc ?? c.goods_eur)
  }
  const profit = netProfit > 0 ? netProfit : revenue * 0.28
  const corporateTax = profit * GREEK_TAX.CORPORATE
  const dividendBase = Math.max(0, profit - corporateTax)
  const dividendWh = dividendBase * GREEK_TAX.DIVIDEND
  return {
    period_revenue_eur: Math.round(revenue * 100) / 100,
    vat_payable_eur: Math.round(vatPayable * 100) / 100,
    estimated_profit_eur: Math.round(profit * 100) / 100,
    corporate_tax_22pct_eur: Math.round(corporateTax * 100) / 100,
    dividend_withholding_eur: Math.round(dividendWh * 100) / 100,
    total_tax_estimate_eur: Math.round((vatPayable + corporateTax + dividendWh) * 100) / 100,
    pending_orders_revenue_eur: Math.round(pendingRevenue * 100) / 100,
    invoices_count: invoices.length,
    note: 'Ελληνική νομοθεσία · ΦΠΑ 13%/24% · ΕΠΕ/ΑΕ φόρος 22% · παρακράτηση μερίσματος 5% · ΕΦΚΑ ~13.55%+22.29%',
  }
}

async function fetchInvoices(sb: ReturnType<typeof createClient>, from: string | null, to: string | null) {
  let q = sb.from('invoices').select('*').order('issued_at', { ascending: false }).limit(500)
  if (from) q = q.gte('issued_at', from + 'T00:00:00Z')
  if (to) q = q.lte('issued_at', to + 'T23:59:59Z')
  const { data } = await q
  return (data || []) as Array<Record<string, unknown>>
}

async function fetchOrders(sb: ReturnType<typeof createClient>, from: string | null, to: string | null, vendorId: string | null, driverId: string | null) {
  let q = sb.from('orders').select('*').order('created_at', { ascending: false }).limit(500)
  if (from) q = q.gte('created_at', from + 'T00:00:00Z')
  if (to) q = q.lte('created_at', to + 'T23:59:59Z')
  if (vendorId) q = q.eq('vendor_id', vendorId)
  if (driverId) q = q.eq('driver_id', driverId)
  const { data } = await q
  return (data || []) as Array<Record<string, unknown>>
}

async function userAvcTotal(sb: ReturnType<typeof createClient>) {
  const { data } = await sb.from('balance_ledger').select('balance')
  return (data || []).reduce((s: number, r: { balance?: number }) => s + num(r.balance), 0)
}

async function modeDashboard(sb: ReturnType<typeof createClient>, filters: Record<string, unknown>) {
  const from = filters.from as string | null
  const to = filters.to as string | null
  const orders = await fetchOrders(sb, from, to, filters.vendor_id as string | null, filters.driver_id as string | null)
  const invoices = await fetchInvoices(sb, from, to)
  let goods = 0, delivery = 0, platform = 0, driverPayouts = 0
  for (const o of orders) {
    const c = (o.calc || {}) as Record<string, unknown>
    goods += num(c.goods_eur ?? c.subtotal_eur)
    delivery += num(c.delivery_eur ?? c.delivery_fee)
    platform += num(c.platform_eur ?? c.platform_fee)
    driverPayouts += num(c.driver_payout_eur ?? c.delivery_eur) * 0.85
  }
  return {
    kpis: {
      orders: orders.length,
      goods_eur: goods,
      delivery_eur: delivery,
      platform_eur: platform,
      driver_payouts_eur: driverPayouts,
      invoices_sent: invoices.filter((i) => i.status === 'issued' || i.status === 'submitted').length,
      invoices_pending: invoices.filter((i) => i.status !== 'issued' && i.status !== 'submitted').length,
    },
    recent_orders: orders.slice(0, 12),
  }
}

async function modeAvcLedger(sb: ReturnType<typeof createClient>, filters: Record<string, unknown>) {
  const from = filters.from as string | null
  const to = filters.to as string | null
  let q = sb.from('avc_ledger').select('*').order('seq', { ascending: false }).limit(200)
  if (from) q = q.gte('created_at', from + 'T00:00:00Z')
  if (to) q = q.lte('created_at', to + 'T23:59:59Z')
  const { data: rows } = await q
  const list = (rows || []) as Array<Record<string, unknown>>
  let minted = 0, spent = 0
  let chainValid = true
  let prevHash = ''
  const asc = [...list].sort((a, b) => num(a.seq) - num(b.seq))
  for (const e of asc) {
    if (num(e.delta_avc) >= 0) minted += num(e.delta_avc)
    else spent += Math.abs(num(e.delta_avc))
    if (e.prev_hash && prevHash && e.prev_hash !== prevHash) chainValid = false
    prevHash = String(e.entry_hash || '')
  }
  if (!list.length) {
    const { data: led } = await sb.from('balance_ledger').select('user_id,balance,updated_at').limit(100)
    return {
      kpis: { entries: 0, minted_avc: 0, spent_avc: 0 },
      rows: [],
      chain_valid: true,
      note: 'AVC ledger κενό — χρησιμοποιείται balance_ledger · ' + (led?.length || 0) + ' λογαριασμοί',
      balances: led || [],
    }
  }
  return {
    kpis: { entries: list.length, minted_avc: minted, spent_avc: spent },
    rows: list,
    chain_valid: chainValid,
  }
}

async function modeGeneralLedger(sb: ReturnType<typeof createClient>, filters: Record<string, unknown>, canCompany: boolean) {
  if (!canCompany) return { error: 'Auditor or owner role required', status: 403 }
  const from = filters.from as string | null
  const to = filters.to as string | null
  const { data: stored } = await sb.from('gl_journal_entries').select('*').order('entry_date', { ascending: false }).limit(300)
  const invoices = await fetchInvoices(sb, from, to)
  const { data: payroll } = await sb.from('gl_payroll_runs').select('*, gl_employees(name)').eq('posted', true).limit(200)
  const { data: opex } = await sb.from('gl_operating_expenses').select('*').eq('posted', true).limit(200)
  const payrollRuns = ((payroll || []) as Array<Record<string, unknown>>).map((r) => ({
    ...r,
    employee_name: (r.gl_employees as { name?: string })?.name,
  }))
  const generated = [
    ...buildJournalFromInvoices(invoices),
    ...buildJournalFromPayroll(payrollRuns),
    ...buildJournalFromExpenses((opex || []) as Array<Record<string, unknown>>),
  ]
  const storedFiltered = ((stored || []) as Array<Record<string, unknown>>).filter((e) => inRange(String(e.entry_date), from, to))
  const lines = [...generated, ...storedFiltered].sort((a, b) => String(b.entry_date).localeCompare(String(a.entry_date)))
  const { data: accounts } = await sb.from('gl_accounts').select('*').order('sort_order')
  return { rows: lines.slice(0, 400), accounts: accounts || [], source: 'invoices+stored' }
}

async function modeTrialBalance(sb: ReturnType<typeof createClient>, filters: Record<string, unknown>, canCompany: boolean) {
  if (!canCompany) return { error: 'Auditor or owner role required', status: 403 }
  const gl = await modeGeneralLedger(sb, filters, canCompany)
  if ('error' in gl) return gl
  const userLiab = await userAvcTotal(sb)
  const tb = trialBalance(gl.rows as Array<Record<string, unknown>>, gl.accounts as Array<Record<string, unknown>>)
  if (userLiab > 0) {
    tb.rows.push({
      code: '38',
      name_el: 'Υποχρεώσεις AVC χρηστών',
      name_en: 'User AVC',
      category: 'liability',
      debit: 0,
      credit: userLiab,
      balance: -userLiab,
    })
    tb.total_credit += userLiab
  }
  return { ...tb, user_avc_liabilities: userLiab }
}

async function modeBalanceSheet(sb: ReturnType<typeof createClient>, filters: Record<string, unknown>, canCompany: boolean, projected = false) {
  if (!canCompany) return { error: 'Auditor or owner role required', status: 403 }
  const tb = await modeTrialBalance(sb, filters, canCompany)
  if ('error' in tb) return tb
  const userLiab = tb.user_avc_liabilities as number
  let sheet = balanceSheetFromTrial(tb as ReturnType<typeof trialBalance>, userLiab, projected)
  if (projected) {
    const orders = await fetchOrders(sb, filters.from as string | null, filters.to as string | null, null, null)
    const pending = orders.filter((o) => !['delivered', 'cancelled', 'completed'].includes(String(o.status)))
    const pendingVal = pending.reduce((s, o) => {
      const c = (o.calc || {}) as Record<string, unknown>
      return s + num(c.total_eur ?? c.total_avc)
    }, 0)
    sheet = {
      ...sheet,
      projected_additions: { pending_orders: pending.length, pending_revenue_eur: pendingVal },
      assets: sheet.assets + pendingVal * 0.15,
      liabilities: sheet.liabilities + pendingVal * 0.85,
    }
  }
  return sheet
}

async function modeBalanceHistory(sb: ReturnType<typeof createClient>) {
  const { data } = await sb.from('gl_balance_snapshots').select('*').order('period_end', { ascending: false }).limit(24)
  return { rows: data || [] }
}

async function modeSnapshotSave(sb: ReturnType<typeof createClient>, filters: Record<string, unknown>, userId: string) {
  const sheet = await modeBalanceSheet(sb, filters, true, false)
  if ('error' in sheet) return sheet
  const periodEnd = (filters.to as string) || new Date().toISOString().slice(0, 10)
  const row = {
    period_end: periodEnd,
    snapshot_type: 'monthly',
    label: 'Ισολογισμός ' + periodEnd,
    assets: sheet.assets,
    liabilities: sheet.liabilities,
    equity: sheet.equity,
    data: sheet,
    created_by: userId,
  }
  const { data, error } = await sb.from('gl_balance_snapshots').upsert(row, { onConflict: 'period_end,snapshot_type' }).select().single()
  if (error) return { error: error.message, status: 500 }
  return { ok: true, snapshot: data }
}

async function modeMyFinancials(sb: ReturnType<typeof createClient>, userId: string, filters: Record<string, unknown>) {
  const from = filters.from as string | null
  const to = filters.to as string | null
  const { data: prof } = await sb.from('profiles').select('balance,display_name').eq('id', userId).single()
  const { data: balRow } = await sb.from('balance_ledger').select('balance').eq('user_id', userId).maybeSingle()
  const balance = num(balRow?.balance ?? prof?.balance)
  let invQ = sb.from('invoices').select('*').eq('buyer_id', userId).order('issued_at', { ascending: false }).limit(100)
  if (from) invQ = invQ.gte('issued_at', from + 'T00:00:00Z')
  if (to) invQ = invQ.lte('issued_at', to + 'T23:59:59Z')
  const { data: invoices } = await invQ
  let ordQ = sb.from('orders').select('*').eq('customer_id', userId).order('created_at', { ascending: false }).limit(100)
  if (from) ordQ = ordQ.gte('created_at', from + 'T00:00:00Z')
  if (to) ordQ = ordQ.lte('created_at', to + 'T23:59:59Z')
  const { data: orders } = await ordQ
  const spent = (invoices || []).reduce((s: number, i: { total?: number }) => s + num(i.total), 0)
  return {
    user_id: userId,
    display_name: prof?.display_name,
    avc_balance: balance,
    eur_equivalent: balance,
    invoices: invoices || [],
    orders: orders || [],
    summary: {
      invoices_count: (invoices || []).length,
      orders_count: (orders || []).length,
      spent_avc: spent,
    },
  }
}

async function postJournalLines(sb: ReturnType<typeof createClient>, lines: Array<Record<string, unknown>>, userId: string) {
  const rows = lines.map((l) => ({
    entry_date: l.entry_date,
    account_code: l.account_code,
    debit: num(l.debit),
    credit: num(l.credit),
    memo: l.memo,
    source_type: l.source_type || 'manual',
    source_id: l.source_id,
    period_month: String(l.entry_date || '').slice(0, 7),
    created_by: userId,
  }))
  const { error } = await sb.from('gl_journal_entries').insert(rows)
  if (error) return { error: error.message, status: 500 }
  return { ok: true, count: rows.length }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
  const caller = await resolveCaller(sb, req.headers.get('Authorization') || '')
  if ('error' in caller) return json({ error: caller.error }, caller.status)

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* */ }
  const mode = String(body.mode || 'dashboard')
  const filters = {
    from: body.from ? String(body.from) : null,
    to: body.to ? String(body.to) : null,
    vendor_id: body.vendor_id ? String(body.vendor_id) : null,
    driver_id: body.driver_id ? String(body.driver_id) : null,
  }

  try {
    switch (mode) {
      case 'dashboard':
        return json(await modeDashboard(sb, filters))
      case 'payments':
      case 'orders': {
        const rows = await fetchOrders(sb, filters.from, filters.to, filters.vendor_id, filters.driver_id)
        const { data: vendors } = await sb.from('vendors').select('id,name').limit(80)
        const { data: drivers } = await sb.from('profiles').select('id,display_name').limit(80)
        return json({ orders: rows, rows, vendors: vendors || [], drivers: drivers || [], events: [] })
      }
      case 'invoices': {
        const rows = await fetchInvoices(sb, filters.from, filters.to)
        return json({ rows })
      }
      case 'avc_ledger':
        return json(await modeAvcLedger(sb, filters))
      case 'general_ledger':
        return json(await modeGeneralLedger(sb, filters, caller.canCompany))
      case 'trial_balance':
        return json(await modeTrialBalance(sb, filters, caller.canCompany))
      case 'balance_sheet':
        return json(await modeBalanceSheet(sb, filters, caller.canCompany, false))
      case 'balance_sheet_projected':
        return json(await modeBalanceSheet(sb, filters, caller.canCompany, true))
      case 'balance_sheet_history':
        return json(await modeBalanceHistory(sb))
      case 'snapshot_save':
        if (!caller.canCompany) return json({ error: 'Auditor or owner required' }, 403)
        return json(await modeSnapshotSave(sb, filters, caller.user.id))
      case 'tax_estimate':
        if (!caller.canCompany) return json({ error: 'Auditor or owner required' }, 403)
        return json(taxEstimate(
          await fetchInvoices(sb, filters.from, filters.to),
          await fetchOrders(sb, filters.from, filters.to, null, null),
        ))
      case 'my_financials':
        return json(await modeMyFinancials(sb, caller.user.id, filters))
      case 'company_summary': {
        if (!caller.canCompany) return json({ error: 'Auditor or owner required' }, 403)
        const tb = await modeTrialBalance(sb, filters, true)
        const pnl = 'error' in tb ? null : incomeStatementFromTb(tb as ReturnType<typeof trialBalance>)
        return json({
          trial_balance: tb,
          balance_sheet: await modeBalanceSheet(sb, filters, true, false),
          projected: await modeBalanceSheet(sb, filters, true, true),
          tax: taxEstimate(
            await fetchInvoices(sb, filters.from, filters.to),
            await fetchOrders(sb, filters.from, filters.to, null, null),
            pnl?.net_after_tax || 0,
          ),
        })
      }
      case 'income_statement': {
        if (!caller.canCompany) return json({ error: 'Auditor or owner required' }, 403)
        const tb = await modeTrialBalance(sb, filters, true)
        if ('error' in tb) return json(tb)
        return json(incomeStatementFromTb(tb as ReturnType<typeof trialBalance>))
      }
      case 'accounts_list': {
        const { data } = await sb.from('gl_accounts').select('*').order('sort_order')
        return json({ rows: data || [] })
      }
      case 'employee_save': {
        if (!caller.canCompany) return json({ error: 'Forbidden' }, 403)
        const { data, error } = await sb.from('gl_employees').insert({
          name: String(body.name || ''),
          afm: body.afm ? String(body.afm) : null,
          gross_monthly: num(body.gross_monthly),
        }).select().single()
        if (error) return json({ error: error.message }, 500)
        return json({ ok: true, employee: data })
      }
      case 'payroll_run': {
        if (!caller.canCompany) return json({ error: 'Forbidden' }, 403)
        const month = String(body.period_month || periodMonth(new Date()))
        const { data: emps } = await sb.from('gl_employees').select('*').eq('is_active', true)
        const runs = []
        for (const e of (emps || []) as Array<Record<string, unknown>>) {
          const calc = payrollCalc(num(e.gross_monthly))
          const row = { period_month: month, employee_id: e.id, ...calc, posted: true }
          const { data } = await sb.from('gl_payroll_runs').upsert(row, { onConflict: 'period_month,employee_id' }).select().single()
          runs.push({ ...data, employee_name: e.name })
        }
        return json({ ok: true, runs })
      }
      case 'payroll_list': {
        if (!caller.canCompany) return json({ error: 'Forbidden' }, 403)
        const { data: emps } = await sb.from('gl_employees').select('*').order('name')
        const { data: runs } = await sb.from('gl_payroll_runs').select('*, gl_employees(name)').order('period_month', { ascending: false }).limit(120)
        const mapped = ((runs || []) as Array<Record<string, unknown>>).map((r) => ({
          ...r,
          employee_name: (r.gl_employees as { name?: string })?.name,
        }))
        const totals = mapped.reduce((a, r) => ({
          employer_total: a.employer_total + num(r.employer_total),
          net_pay: a.net_pay + num(r.net_pay),
        }), { employer_total: 0, net_pay: 0 })
        return json({ employees: emps || [], runs: mapped, totals })
      }
      case 'expense_save': {
        if (!caller.canCompany) return json({ error: 'Forbidden' }, 403)
        const net = num(body.amount_net)
        const vatRate = num(body.vat_rate) || 0.24
        const vat = net * vatRate
        const { data, error } = await sb.from('gl_operating_expenses').insert({
          expense_type: String(body.expense_type || 'rent'),
          description: String(body.description || ''),
          amount_net: net,
          vat_rate: vatRate,
          vat_amount: vat,
          amount_gross: net + vat,
          period_month: String(body.period_month || periodMonth(new Date())),
          posted: true,
          created_by: caller.user.id,
        }).select().single()
        if (error) return json({ error: error.message }, 500)
        return json({ ok: true, expense: data })
      }
      case 'expenses_list': {
        if (!caller.canCompany) return json({ error: 'Forbidden' }, 403)
        const { data } = await sb.from('gl_operating_expenses').select('*').order('entry_date', { ascending: false }).limit(200)
        return json({ rows: data || [] })
      }
      case 'journal_post': {
        if (!caller.canCompany) return json({ error: 'Forbidden' }, 403)
        const debit = num(body.debit)
        const credit = num(body.credit)
        if (debit <= 0 && credit <= 0) return json({ error: 'Χρέωση ή πίστωση απαιτείται' }, 400)
        return json(await postJournalLines(sb, [{
          entry_date: String(body.entry_date || new Date().toISOString().slice(0, 10)),
          account_code: String(body.account_code || '60.04'),
          debit, credit,
          memo: String(body.memo || 'Χειροκίνητη εγγραφή'),
          source_type: 'manual',
        }], caller.user.id))
      }
      case 'owner_save': {
        if (!caller.canCompany) return json({ error: 'Forbidden' }, 403)
        const { data, error } = await sb.from('gl_owners').insert({
          name: String(body.name || ''),
          afm: body.afm ? String(body.afm) : null,
          share_pct: num(body.share_pct),
        }).select().single()
        if (error) return json({ error: error.message }, 500)
        return json({ ok: true, owner: data })
      }
      case 'owners_list': {
        if (!caller.canCompany) return json({ error: 'Forbidden' }, 403)
        const { data: owners } = await sb.from('gl_owners').select('*').eq('is_active', true)
        const tb = await modeTrialBalance(sb, filters, true)
        const pnl = 'error' in tb ? { net_after_tax: 0 } : incomeStatementFromTb(tb as ReturnType<typeof trialBalance>)
        const pool = num(pnl.net_after_tax)
        const distribution = ((owners || []) as Array<Record<string, unknown>>).map((o) => {
          const gross = pool * (num(o.share_pct) / 100)
          const withholding = gross * GREEK_TAX.DIVIDEND
          return { name: o.name, share_pct: o.share_pct, gross_dividend: gross, withholding, net_dividend: gross - withholding }
        })
        return json({ owners: owners || [], distribution, profit_pool: pool })
      }
      case 'whoami':
        return json({
          user_id: caller.user.id,
          email: caller.user.email,
          is_owner: caller.isOwner,
          is_auditor: caller.isAuditor,
          can_company: caller.canCompany,
        })
      default:
        return json({ error: 'Unknown mode: ' + mode }, 400)
    }
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})