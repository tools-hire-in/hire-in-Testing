# EMPLOYEE PORTAL — COMPLETE SYSTEM SPECIFICATION v2.0

> **Context:** 10-person BPO staffing company registered in Delhi NCT, fully remote.
> Governed by Delhi Shops & Establishments Act, 1954 + Maternity Benefit Act, 1961.
> Employees work US hours (night shifts in IST). 5-day week (Mon–Fri). Avg CTC: ₹50,000/month.

---

## MODULE 1: SHIFT MANAGEMENT

### 1.1 Shift Definitions

```
SHIFT CONFIGURATION TABLE:
──────────────────────────
┌──────────┬──────────────┬──────────────┬──────────────────────────────────┐
│ Shift ID │ Name         │ IST Timing   │ US Coverage                      │
├──────────┼──────────────┼──────────────┼──────────────────────────────────┤
│ SHIFT_A  │ East Coast   │ 6:30p–3:30a  │ 9AM–6PM ET (full East Coast)     │
│ SHIFT_B  │ West Coast   │ 8:30p–5:30a  │ 8AM–5PM PT (full West Coast)     │
│ SHIFT_C  │ Dual Coast   │ 7:30p–4:30a  │ 10AM–7PM ET + 7AM–4PM PT         │
└──────────┴──────────────┴──────────────┴──────────────────────────────────┘

ALL SHIFTS:
  - Duration: 9 hours (including 1 hour breaks)
  - Productive hours: 8 hours
  - Break structure: Same as Module 3 (30 min lunch + 15 min x 2 tea)
  - Weekly off: Saturday + Sunday

COMPLIANCE CHECKS (enforce in system):
  - No shift may exceed 9 hours total.
  - No shift spread-over may exceed 10.5 hours.
  - No employee may work in 2 shifts on the same calendar day.
```

### 1.2 DST (Daylight Saving Time) Shift Adjustment

```
DST LOGIC — CRITICAL:
─────────────────────
India does NOT observe DST. US does. This changes shift timings TWICE a year.

RULE: When US clocks change, ALL IST shift timings shift by 1 hour.

US DST ACTIVE (2nd Sunday of March – 1st Sunday of November):
  Shift A: 6:30 PM – 3:30 AM IST
  Shift B: 8:30 PM – 5:30 AM IST
  Shift C: 7:30 PM – 4:30 AM IST

US STANDARD TIME (1st Sunday of November – 2nd Sunday of March):
  Shift A: 7:30 PM – 4:30 AM IST
  Shift B: 9:30 PM – 6:30 AM IST
  Shift C: 8:30 PM – 5:30 AM IST

SYSTEM IMPLEMENTATION:
  1. Store US DST transition dates for next 5 years in a config table.
  2. 14 days before each transition: 
     → Auto-generate notification to HR: "DST change on [date]. Review shift timings."
  3. 7 days before each transition:
     → Notify all employees: "Your shift timing will change from [old] to [new] 
        effective [date]. This is due to US Daylight Saving Time change."
  4. On transition date at midnight IST:
     → System auto-switches the active shift timing profile.
     → Update all dashboards, break schedules, attendance expectations.

DST TRANSITION DATES (store these, update annually):
  2026: Spring forward Mar 8, Fall back Nov 1
  2027: Spring forward Mar 14, Fall back Nov 7
  2028: Spring forward Mar 12, Fall back Nov 5
  2029: Spring forward Mar 11, Fall back Nov 4
  2030: Spring forward Mar 10, Fall back Nov 3
```

### 1.3 Night Shift Compliance (Women Employees)

```
NIGHT SHIFT RULES FOR WOMEN:
─────────────────────────────
All shifts fall within 9 PM – 7 AM → ALL are classified as night shifts.

IF employee.gender == "Female":
  BEFORE assigning night shift, the system MUST:
  
  1. CONSENT FORM:
     - Generate a digital consent form for the employee to sign.
     - Consent text: "I, [name], voluntarily consent to working night shifts 
       at [Company Name]. I understand that I may withdraw this consent at 
       any time without any adverse consequences to my employment."
     - Store: signed consent, date, IP address, acknowledgement timestamp.
     - Consent must be RENEWED every 12 months.
     - System alert 30 days before expiry: "Night shift consent expiring for [name]."
  
  2. REFUSAL RIGHT:
     - If a female employee refuses night shift → system must NOT flag this 
       as non-compliance or misconduct.
     - Manager cannot override. HR must reassign to a day-role or alternate arrangement.
  
  3. POSH COMMITTEE:
     - System should have a section showing Internal Complaints Committee members.
     - Link to POSH policy document.
  
  4. SHIFT ROTATION:
     - No female employee should be permanently on night shift.
     - System should track consecutive night shift weeks and alert if >8 weeks continuous.

FOR ALL EMPLOYEES (male and female):
  - Night shift allowance (if any) should be a configurable field in payroll.
  - System should track total night shift hours per month for reporting.
```

### 1.4 Employee Shift Assignment UI

```
ADMIN: SHIFT ASSIGNMENT
────────────────────────
Admin can assign shifts per employee:
  - Employee Name
  - Assigned Shift: [Shift A / Shift B / Shift C / Custom]
  - Effective From: [date]
  - Effective Until: [date or "until further notice"]
  - DST Auto-Adjust: [Yes/No] (default: Yes)

If Custom shift:
  - Start Time (IST): [time picker]
  - End Time (IST): [time picker]
  - VALIDATION: If (end - start) > 9 hours → ERROR "Shift exceeds 9-hour limit"
  - VALIDATION: If shift spans 9 PM – 7 AM and employee is female 
    → WARN "Night shift consent required. Has consent been obtained?"

EMPLOYEE VIEW:
  - "My Shift" card on dashboard showing:
    - Current shift name and timing
    - Next DST change date and new timing
    - Break schedule for today
```

---

## MODULE 2: LEAVE MANAGEMENT (COMPLETE LOGIC)

### 2.1 Leave Types Configuration

```
LEAVE TYPES:
────────────
┌──────┬─────────────────────┬────────┬─────────────────────────────────┬──────────┬───────────┬──────┐
│ Code │ Name                │ Quota  │ Accrual                         │ Carry Fwd│ Encashable│ Paid │
├──────┼─────────────────────┼────────┼─────────────────────────────────┼──────────┼───────────┼──────┤
│ EL   │ Earned Leave        │ 15/yr  │ 1/month + 1 bonus Jan,May,Sep  │ Yes (45) │ Separation│ Yes  │
│ CL   │ Casual/Sick Leave   │ 12/yr  │ 1/month unconditional          │ No       │ Never     │ Yes  │
│ CO   │ Comp-Off            │ Varies │ On working weekly off/holiday   │ 30 days  │ Never     │ Yes  │
│ LWP  │ Leave Without Pay   │ N/A    │ N/A                            │ N/A      │ N/A       │ No   │
│ ML   │ Maternity Leave     │ 182/84 │ One-time block                  │ N/A      │ Never     │ Yes  │
└──────┴─────────────────────┴────────┴─────────────────────────────────┴──────────┴───────────┴──────┘
```

### 2.2 EL Accrual Engine (Run on 1st of every month at 00:00 IST)

```
FUNCTION: run_monthly_el_accrual(year, month)
──────────────────────────────────────────────
FOR EACH employee WHERE status = 'active':
  
  // Step 1: Check eligibility — must have completed previous month
  days_employed = (1st_of_current_month - employee.date_of_joining).days
  IF days_employed < 30:
    SKIP (not yet completed 1 full month)
    CONTINUE to next employee
  
  // Step 2: Credit monthly EL
  credit = 1
  accrual_type = 'monthly'
  
  // Step 3: Check if bonus month
  IF month IN [1, 5, 9]:  // January, May, September
    credit = 2  // 1 monthly + 1 bonus
    accrual_type = 'monthly+bonus'
  
  // Step 4: Apply carry-forward cap check
  current_balance = get_leave_balance(employee.id, 'EL')
  
  // If January, first apply year-end carry forward cap
  IF month == 1:
    previous_year_balance = get_previous_year_closing_balance(employee.id, 'EL')
    carried_forward = MIN(previous_year_balance, 45)
    set_opening_balance(employee.id, 'EL', year, carried_forward)
    current_balance = carried_forward
  
  // Step 5: Credit the leave
  new_balance = current_balance + credit
  
  // Step 6: Cap at 45
  IF new_balance > 45:
    actual_credit = credit - (new_balance - 45)
    new_balance = 45
    LOG: "EL capped at 45 for employee {id}. {credit - actual_credit} days lapsed."
  ELSE:
    actual_credit = credit
  
  // Step 7: Update balance and log
  update_leave_balance(employee.id, 'EL', new_balance)
  INSERT INTO leave_accrual_log:
    employee_id, leave_type='EL', accrual_date=today,
    days_credited=actual_credit, accrual_type, 
    running_balance=new_balance

  // Step 8: Notify employee
  SEND notification: 
    IF accrual_type == 'monthly+bonus':
      "2 Earned Leaves credited (1 monthly + 1 bonus). Balance: {new_balance} EL"
    ELSE:
      "1 Earned Leave credited. Balance: {new_balance} EL"
```

### 2.3 CL Accrual Engine (Run on 1st of every month at 00:00 IST)

```
FUNCTION: run_monthly_cl_accrual(year, month)
──────────────────────────────────────────────
FOR EACH employee WHERE status = 'active':
  
  // Step 1: Check eligibility
  days_employed = (1st_of_current_month - employee.date_of_joining).days
  IF days_employed < 30:
    SKIP
    CONTINUE
  
  // Step 2: If January, reset CL balance to 0 (annual lapse)
  IF month == 1:
    previous_cl = get_previous_year_closing_balance(employee.id, 'CL')
    IF previous_cl > 0:
      LOG: "{previous_cl} unused CL lapsed for employee {id}"
      SEND notification: "{previous_cl} Casual/Sick Leaves have lapsed as of 1 Jan."
    set_opening_balance(employee.id, 'CL', year, 0)
  
  // Step 3: Credit 1 CL — UNCONDITIONAL (no attendance/hours check)
  current_balance = get_leave_balance(employee.id, 'CL')
  new_balance = current_balance + 1
  update_leave_balance(employee.id, 'CL', new_balance)
  
  // Step 4: Log and notify
  INSERT INTO leave_accrual_log:
    employee_id, leave_type='CL', accrual_date=today,
    days_credited=1, accrual_type='monthly',
    running_balance=new_balance
  
  SEND notification: "1 Casual/Sick Leave credited. Balance: {new_balance} CL"

IMPORTANT: CL accrual is NEVER conditional. Do NOT add any check for:
  - attendance percentage
  - hours worked
  - performance rating
  - disciplinary status
  The law says: employed for 1 month → gets 1 CL. Period.
```

### 2.4 Year-End Batch Jobs (Run on 1st January at 00:01 IST)

```
FUNCTION: run_year_end_processing(new_year)
───────────────────────────────────────────
// This runs BEFORE the January accrual job

FOR EACH employee WHERE status = 'active':

  // 1. LAPSE all unused CL
  cl_balance = get_leave_balance(employee.id, 'CL', new_year - 1)
  IF cl_balance > 0:
    INSERT INTO leave_lapse_log: employee_id, leave_type='CL', 
      year=new_year-1, lapsed_days=cl_balance
    NOTIFY employee: "{cl_balance} CL lapsed on 31 Dec."
  SET leave_balance(employee.id, 'CL', new_year) = 0

  // 2. CARRY FORWARD EL (cap at 45)
  el_balance = get_leave_balance(employee.id, 'EL', new_year - 1)
  carried = MIN(el_balance, 45)
  lapsed_el = el_balance - carried
  SET leave_balance(employee.id, 'EL', new_year) = carried
  IF lapsed_el > 0:
    INSERT INTO leave_lapse_log: employee_id, leave_type='EL',
      year=new_year-1, lapsed_days=lapsed_el
    NOTIFY employee: "{lapsed_el} EL exceeded the 45-day cap and lapsed."
  NOTIFY employee: "{carried} EL carried forward to {new_year}."

  // 3. EXPIRE old Comp-Offs
  EXPIRE all comp_off WHERE expiry_date < today AND status = 'available'

// 4. THEN run January accrual (which credits 2 EL + 1 CL)
run_monthly_el_accrual(new_year, 1)
run_monthly_cl_accrual(new_year, 1)

// 5. Generate year-end summary report
generate_leave_summary_report(new_year - 1)
```

### 2.5 Leave Application — Complete Flow

```
FUNCTION: apply_leave(employee_id, leave_type, from_date, to_date, 
                      reason, half_day, half_day_type, medical_cert)
──────────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════
// STEP 1: CALCULATE LEAVE DAYS (Weekend & Holiday Exclusion)
// ═══════════════════════════════════════════

total_calendar_days = (to_date - from_date).days + 1
leave_days = 0

FOR EACH date IN range(from_date, to_date inclusive):
  day_of_week = date.weekday()
  
  // Skip weekends (Saturday = 5, Sunday = 6)
  IF day_of_week IN [5, 6]:
    CONTINUE  // NOT deducted — no sandwich rule
  
  // Skip public holidays
  IF date IN get_holidays(date.year):
    CONTINUE  // NOT deducted
  
  // This is a working day — count it
  leave_days += 1

// Handle half-day
IF half_day == true AND leave_days >= 1:
  leave_days = leave_days - 0.5  // Deduct half day from count
  // half_day_type: 'first_half' or 'second_half'

IF leave_days <= 0:
  RETURN ERROR: "Selected dates are all weekends/holidays. No leave needed."


// ═══════════════════════════════════════════
// STEP 2: VALIDATE LEAVE BUCKET SELECTION
// ═══════════════════════════════════════════

current_balance = get_leave_balance(employee_id, leave_type)

SWITCH leave_type:

  CASE 'EL':
    IF current_balance < leave_days:
      remaining = leave_days - current_balance
      RETURN WARNING: "You have {current_balance} EL available but need {leave_days}. 
        Options: (a) Use {current_balance} EL + {remaining} CL, 
        (b) Use {current_balance} EL + {remaining} LWP, 
        (c) Reduce leave duration."
      // Show split-leave UI (see 2.7)
    
    IF from_date - today < 7:
      SHOW WARNING (soft): "EL requires 7 days advance notice. Your manager 
        may reject this request." // Allow submission anyway
  
  CASE 'CL':
    IF current_balance < leave_days:
      remaining = leave_days - current_balance
      RETURN WARNING: "You have {current_balance} CL available but need {leave_days}.
        Options: (a) Use {current_balance} CL + {remaining} EL,
        (b) Use {current_balance} CL + {remaining} LWP,
        (c) Reduce leave duration."
      // Show split-leave UI
    
    IF leave_days > 2 AND medical_cert IS NULL:
      SHOW WARNING: "Medical certificate recommended for CL exceeding 2 days. 
        Upload now or submit within 2 days of return."
    
    IF from_date == today:
      SHOW NOTE: "Same-day CL. Please ensure your manager has been informed 
        verbally/via message."
  
  CASE 'CO':
    co_available = get_available_comp_offs(employee_id)
    IF co_available.count == 0:
      RETURN ERROR: "No Comp-Off balance available."
    IF co_available.count < leave_days:
      RETURN ERROR: "Only {co_available.count} Comp-Off available. 
        Reduce days or use a different leave type for remaining."
    // Show which comp-offs will be consumed (FIFO, earliest first)
    SHOW INFO: "The following Comp-Offs will be used:"
    FOR EACH co IN co_available ORDER BY earned_date ASC LIMIT leave_days:
      SHOW "  CO earned on {co.earned_date} (expires: {co.expiry_date})"
  
  CASE 'LWP':
    // Check if any paid leave is available
    el_bal = get_leave_balance(employee_id, 'EL')
    cl_bal = get_leave_balance(employee_id, 'CL')
    co_bal = get_available_comp_offs(employee_id).count
    total_paid = el_bal + cl_bal + co_bal
    
    IF total_paid > 0:
      RETURN BLOCK: "You have {total_paid} paid leaves available 
        ({el_bal} EL, {cl_bal} CL, {co_bal} CO). 
        You must exhaust paid leave before applying LWP."
      // Do NOT allow LWP if paid leave exists
    
    daily_deduction = employee.monthly_ctc / 26
    total_deduction = leave_days * daily_deduction
    SHOW WARNING: "LWP will deduct ₹{total_deduction} from your salary 
      ({leave_days} days × ₹{daily_deduction}/day). Proceed?"
  
  CASE 'ML':
    IF employee.gender != 'Female':
      RETURN ERROR: "Maternity Leave is available for female employees only."
    // Check 80-day eligibility
    days_worked = calculate_days_worked(employee_id, last_12_months)
    IF days_worked < 80:
      RETURN ERROR: "Eligibility: Minimum 80 days worked in preceding 12 months. 
        You have worked {days_worked} days."
    // Check child count
    existing_children = employee.maternity_leave_count or 0
    IF existing_children < 2:
      max_ml = 182  // 26 weeks
    ELSE:
      max_ml = 84   // 12 weeks
    IF leave_days > max_ml:
      RETURN ERROR: "Maximum maternity leave: {max_ml} days."


// ═══════════════════════════════════════════
// STEP 3: CREATE LEAVE REQUEST
// ═══════════════════════════════════════════

request = INSERT INTO leave_requests:
  employee_id, leave_type, from_date, to_date,
  total_days = leave_days,
  reason, medical_certificate_url = medical_cert,
  status = 'pending',
  applied_on = NOW(),
  is_half_day = half_day,
  half_day_type,
  salary_impact = (leave_type == 'LWP') ? leave_days * (monthly_ctc/26) : 0

// ═══════════════════════════════════════════
// STEP 4: TRIGGER APPROVAL FLOW
// ═══════════════════════════════════════════

IF leave_type == 'LWP':
  // Needs both manager AND HR approval
  NOTIFY reporting_manager: "Leave request from {employee.name}: 
    {leave_days} days LWP ({from_date} to {to_date})"
  NOTIFY hr_admin: "LWP request pending your approval after manager approval."
  request.approval_chain = ['manager', 'hr']
ELSE:
  // Only manager approval
  NOTIFY reporting_manager: "Leave request from {employee.name}: 
    {leave_days} days {leave_type} ({from_date} to {to_date})"
  request.approval_chain = ['manager']

RETURN SUCCESS: "Leave request submitted. Pending approval from {approver}."
```

### 2.6 Leave Approval / Rejection Logic

```
FUNCTION: process_leave_decision(request_id, approver_id, decision, rejection_reason)
─────────────────────────────────────────────────────────────────────────────────────

request = get_leave_request(request_id)

IF decision == 'APPROVE':
  
  // Check if this is manager approving and HR still needs to approve (LWP)
  IF request.leave_type == 'LWP' AND approver_role == 'manager':
    request.status = 'pending_hr'
    NOTIFY hr_admin: "LWP request from {employee.name} approved by manager. 
      Awaiting your approval."
    RETURN
  
  // Final approval — deduct balance
  request.status = 'approved'
  request.approved_by = approver_id
  request.approved_on = NOW()
  
  SWITCH request.leave_type:
    CASE 'EL':
      deduct_leave_balance(request.employee_id, 'EL', request.total_days)
    
    CASE 'CL':
      deduct_leave_balance(request.employee_id, 'CL', request.total_days)
    
    CASE 'CO':
      // Consume comp-offs in FIFO order
      remaining = request.total_days
      comp_offs = get_available_comp_offs(request.employee_id) ORDER BY earned_date ASC
      FOR EACH co IN comp_offs:
        IF remaining <= 0: BREAK
        co.status = 'used'
        co.used_date = request.from_date
        remaining -= 1
    
    CASE 'LWP':
      // No balance to deduct. Flag for payroll.
      INSERT INTO payroll_flags:
        employee_id, month=request.from_date.month, year=request.from_date.year,
        flag_type='LWP', days=request.total_days,
        deduction_amount = request.total_days * (employee.monthly_ctc / 26)
    
    CASE 'ML':
      // No balance to deduct from regular leave. 
      // ML is a separate entitlement.
      // EL and CL continue to accrue during ML.
      INSERT INTO maternity_log:
        employee_id, start_date=request.from_date, end_date=request.to_date,
        child_number = employee.maternity_leave_count + 1
  
  // Mark dates on attendance calendar
  FOR EACH date IN working_days(request.from_date, request.to_date):
    INSERT OR UPDATE attendance:
      employee_id, date, is_on_leave=true, leave_request_id=request.id
  
  NOTIFY employee: "Your {request.leave_type} from {from_date} to {to_date} 
    has been approved. Updated balance: {new_balance}"

ELIF decision == 'REJECT':
  request.status = 'rejected'
  request.rejection_reason = rejection_reason  // MANDATORY field
  
  // CL special rule: Cannot reject if reason is accident, family death, or sickness
  IF request.leave_type == 'CL':
    IF request.reason CONTAINS ['accident', 'death', 'sickness', 'medical', 'emergency']:
      SHOW WARNING TO APPROVER: "Under Delhi S&E Act, CL cannot be refused for 
        accident, death in family, or sickness. If you reject, you must grant 
        equivalent leave later in the same calendar year."
  
  NOTIFY employee: "Your leave request has been rejected. 
    Reason: {rejection_reason}. 
    You can modify and resubmit, or contact HR."

ELIF decision == 'REQUEST_INFO':
  request.status = 'info_requested'
  NOTIFY employee: "Your manager has requested additional information 
    regarding your leave request. Message: {rejection_reason}"
```

### 2.7 Split-Leave (When One Bucket Isn't Enough)

```
SPLIT LEAVE UI:
───────────────
When employee's chosen leave type has insufficient balance, show a split-leave form:

┌─────────────────────────────────────────────────────┐
│  SPLIT LEAVE REQUEST                                 │
│                                                      │
│  Total days needed: 5                                │
│  Your EL balance: 3                                  │
│  Your CL balance: 2                                  │
│  Your CO balance: 0                                  │
│                                                      │
│  How would you like to split?                        │
│                                                      │
│  EL days: [3▼]  ← max: 3 (your balance)             │
│  CL days: [2▼]  ← max: 2 (your balance)             │
│  LWP days: [0]  ← auto-calculated remainder         │
│                                                      │
│  Total: 3 + 2 + 0 = 5 ✓                             │
│                                                      │
│  Salary impact: ₹0 (no LWP)                         │
│                                                      │
│  [Submit Split Leave Request]                        │
└─────────────────────────────────────────────────────┘

LOGIC:
  - The split must equal total_days.
  - Each bucket cannot exceed its available balance.
  - LWP auto-fills the remainder.
  - If LWP > 0, show salary deduction warning.
  - Creates multiple leave_request entries linked by a split_group_id.
  - All entries in a split group are approved/rejected together.
```

### 2.8 Leave Cancellation Logic

```
FUNCTION: cancel_leave(request_id, cancelled_by, reason)
────────────────────────────────────────────────────────
request = get_leave_request(request_id)

// Employee cancelling their own approved leave
IF cancelled_by == request.employee_id:
  IF request.from_date <= today:
    // Leave already started or past
    IF request.from_date < today AND request.to_date >= today:
      // Partially consumed — can only cancel future portion
      consumed_days = working_days_between(request.from_date, yesterday)
      remaining_days = request.total_days - consumed_days
      // Restore only remaining days
      restore_leave_balance(request.employee_id, request.leave_type, remaining_days)
      request.to_date = yesterday
      request.total_days = consumed_days
      request.status = 'partially_cancelled'
    ELIF request.to_date < today:
      RETURN ERROR: "Cannot cancel past leave."
  ELSE:
    // Future leave — full cancellation
    restore_leave_balance(request.employee_id, request.leave_type, request.total_days)
    request.status = 'cancelled'
    // If LWP, remove payroll flag
    IF request.leave_type == 'LWP':
      DELETE payroll_flag WHERE leave_request_id = request.id
  
  NOTIFY reporting_manager: "{employee.name} cancelled their leave 
    from {from_date} to {to_date}."

// Manager recalling approved leave
IF cancelled_by == request.approved_by (manager):
  restore_leave_balance(request.employee_id, request.leave_type, request.total_days)
  request.status = 'recalled'
  request.recall_reason = reason
  NOTIFY employee: "Your leave has been recalled by your manager. 
    Reason: {reason}. Your leave balance has been restored."
```

### 2.9 Separation / Full & Final Settlement

```
FUNCTION: process_separation(employee_id, last_working_date, separation_type)
─────────────────────────────────────────────────────────────────────────────

// Step 1: Calculate pro-rata accrual up to LWD
months_worked_this_year = months between Jan 1 and last_working_date
// Credit any un-accrued months
run_accrual_up_to(employee_id, last_working_date)

// Step 2: Cancel all future approved leaves
cancel_all_future_leaves(employee_id, after=last_working_date)

// Step 3: EL Encashment
el_balance = get_leave_balance(employee_id, 'EL')
daily_rate = employee.monthly_salary / 26  // basic + DA
el_encashment = el_balance * daily_rate

// Step 4: CL — NOT encashable
cl_balance = get_leave_balance(employee_id, 'CL')
cl_encashment = 0  // Always zero

// Step 5: Pending OT
ot_pending = get_unpaid_overtime(employee_id)
ot_amount = SUM(ot_pending.hours * ot_hourly_rate)

// Step 6: LWP deductions
lwp_days = get_lwp_days(employee_id, current_month)
lwp_deduction = lwp_days * (employee.monthly_ctc / 26)

// Step 7: Generate F&F statement
fnf_statement = {
  employee_name, employee_id, last_working_date, separation_type,
  el_balance, el_encashment_amount: el_encashment,
  cl_balance, cl_encashment_amount: 0, cl_note: "Not encashable per policy",
  co_balance: get_co_balance(employee_id), co_note: "Lapsed on separation",
  pending_ot: ot_amount,
  lwp_deduction,
  net_leave_payout: el_encashment - lwp_deduction + ot_amount
}

// Step 8: Mark employee as separated
employee.status = 'separated'
employee.separation_date = last_working_date
```

---

## MODULE 3: BREAK MANAGEMENT

### 3.1 Break Configuration

```
BREAK TYPES:
────────────
1. LUNCH (30 min, mandatory, 1x/shift, after max 5 hrs continuous work)
2. TEA_1 (15 min, paid, first half of shift)
3. TEA_2 (15 min, paid, second half of shift)
4. BIO (as needed, unrestricted, DO NOT track frequency)

Total break per shift: 60 minutes

BREAK WINDOWS (calculated dynamically based on shift):
  Employee's shift: {start_time} to {end_time}
  shift_midpoint = start_time + (end_time - start_time) / 2
  
  TEA_1 window: start_time + 1.5hrs  to  shift_midpoint
  LUNCH window: shift_midpoint - 30min  to  shift_midpoint + 30min
  TEA_2 window: shift_midpoint  to  end_time - 1.5hrs
  
  5-HOUR RULE: 
    IF employee has not taken lunch break AND 
       current_time > start_time + 5hrs:
    → SHOW POPUP: "You have worked 5 hours continuously. 
       Please take your 30-minute lunch break now. This is required by law."
```

### 3.2 Break Tracking UI

```
EMPLOYEE DASHBOARD — BREAK WIDGET:
──────────────────────────────────
┌──────────────────────────────────────────┐
│  TODAY'S BREAKS                          │
│                                          │
│  Shift: 6:30 PM – 3:30 AM (East Coast)  │
│                                          │
│  ☕ Tea Break 1    [Start Break]          │
│     Window: 8:00 PM – 10:00 PM          │
│     Status: Not taken                    │
│                                          │
│  🍽  Lunch Break    ✓ Done               │
│     10:30 PM – 11:00 PM (30 min)         │
│                                          │
│  ☕ Tea Break 2    [Start Break]          │
│     Window: 12:00 AM – 2:00 AM          │
│     Status: Not taken                    │
│                                          │
│  Total break today: 30 / 60 min          │
│  ████████░░░░░░░░ 50%                    │
└──────────────────────────────────────────┘

BREAK BUTTON STATES:
  [Start Break] → clicked → timer starts → button changes to [End Break (12:34)]
  [End Break]   → clicked → break logged → shows "✓ Done (15 min)"
  
  If break runs over by >10 min:
    Gentle reminder (NOT a warning): "Your break has been 25 min. 
    Your allocated time is 15 min."

DO NOT:
  - Block work tools if break is overdue
  - Create "break violation" reports
  - Use break data in performance reviews
  - Track bio break frequency or duration
```

### 3.3 Overtime Request & Tracking

```
OT WORKFLOW:
────────────
EMPLOYEE requests OT:
  → Date, Expected hours (1-3 max), Reason
  → System checks:
    - Daily cap: current_shift_hours + requested_ot ≤ 10.5 hrs spread-over
    - Weekly cap: current_week_hours + requested_ot ≤ 48 hrs
    - Annual cap: ytd_ot_hours + requested_ot ≤ 150 hrs
    - If any cap exceeded → BLOCK with message showing remaining capacity
  → Manager approves/rejects

AFTER OT is worked:
  → Employee logs actual hours
  → System calculates: ot_pay = actual_hours × (monthly_ctc / 26 / 8) × 2
  → Flagged for payroll
  → If OT ≥ 2 hours: system should have recorded a 15-min break during OT
```

---

## MODULE 4: EMPLOYEE DASHBOARD — COMPLETE UI SPEC

### 4.1 Leave Balance Card

```
┌─────────────────────────────────────────────────────────────────┐
│  MY LEAVE BALANCE                              As of: 03 May 26│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  EARNED (EL)  │  │  CASUAL (CL) │  │  COMP-OFF    │          │
│  │     7.0       │  │     4.0      │  │     1.0      │          │
│  │   of 15/yr    │  │   of 12/yr   │  │  exp: 15 May │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                 │
│  ┌─────────────────────────────────────────────────────┐       │
│  │  ACCRUAL TIMELINE                                    │       │
│  │  Jan ██ Feb █ Mar █ Apr █ May ██ Jun █ Jul █ ...     │       │
│  │  Next credit: 1 Jun (1 EL + 1 CL)                   │       │
│  │  Bonus EL months: Jan ✓  May ✓  Sep ○               │       │
│  └─────────────────────────────────────────────────────┘       │
│                                                                 │
│  ⚠ 4 CL will lapse on 31 Dec if unused                         │
│                                                                 │
│  [Apply for Leave]  [View History]  [Download Statement]       │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Leave Application Form

```
┌─────────────────────────────────────────────────────────────────┐
│  APPLY FOR LEAVE                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Leave Type*:  [EL ▼]  [CL ▼]  [CO ▼]  [LWP ▼]               │
│                ← Radio buttons / pill selector                  │
│                Show balance next to each:                       │
│                EL (7.0)  CL (4.0)  CO (1.0)  LWP              │
│                                                                 │
│  From Date*:   [📅 date picker]                                │
│  To Date*:     [📅 date picker]                                │
│                                                                 │
│  Half Day?:    [ ] Yes                                          │
│     If checked: ( ) First Half  ( ) Second Half                │
│                                                                 │
│  ┌──────────────────────────────────────────────────┐          │
│  │  CALCULATION PREVIEW (updates live):              │          │
│  │  Calendar days: 5 (Mon 5 May – Fri 9 May)        │          │
│  │  Weekends excluded: 0                             │          │
│  │  Holidays excluded: 0                             │          │
│  │  ─────────────────────────────                    │          │
│  │  Leave days to be deducted: 5                     │          │
│  │  Current EL balance: 7.0                          │          │
│  │  Balance after leave: 2.0                         │          │
│  │  Salary impact: ₹0 (paid leave)                   │          │
│  └──────────────────────────────────────────────────┘          │
│                                                                 │
│  Reason*:      [________________________________]              │
│                                                                 │
│  Medical Cert:  [Upload File]  (required if CL > 2 days)      │
│                                                                 │
│  ┌──────────────────────────────────────────────────┐          │
│  │  ⚠ NOTICE: EL requires 7 days advance notice.    │          │
│  │  Your request is 3 days in advance. Your manager  │          │
│  │  may ask you to reschedule.                       │          │
│  └──────────────────────────────────────────────────┘          │
│                                                                 │
│  [Submit Request]                    [Cancel]                   │
└─────────────────────────────────────────────────────────────────┘

LIVE VALIDATION (as user fills form):
  - Date range changes → recalculate leave days (exclude weekends/holidays)
  - Leave type changes → show updated balance and post-leave balance
  - If balance insufficient → show split-leave option (see 2.7)
  - If LWP selected → show salary deduction amount
  - If CL > 2 days → show medical cert upload field
  - If EL < 7 days notice → show soft warning
  - If dates overlap with another approved leave → show error
  - If >50% team on leave on requested dates → show warning to manager
```

### 4.3 Leave History View

```
┌─────────────────────────────────────────────────────────────────┐
│  LEAVE HISTORY                          [Filter ▼] [Export CSV]│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Filters: Year [2026 ▼]  Type [All ▼]  Status [All ▼]         │
│                                                                 │
│  ┌───────┬──────────┬──────────┬──────┬────────┬────────────┐  │
│  │ Type  │ From     │ To       │ Days │ Status │ Action     │  │
│  ├───────┼──────────┼──────────┼──────┼────────┼────────────┤  │
│  │ EL    │ 15 Apr   │ 17 Apr   │ 3.0  │ ✓ Appr │ [Cancel]   │  │
│  │ CL    │ 02 Mar   │ 02 Mar   │ 1.0  │ ✓ Appr │    —       │  │
│  │ EL    │ 10 Feb   │ 12 Feb   │ 3.0  │ ✗ Rej  │ Reason:    │  │
│  │       │          │          │      │        │ "Peak load"│  │
│  │ CL    │ 22 Jan   │ 22 Jan   │ 0.5  │ ✓ Appr │    —       │  │
│  └───────┴──────────┴──────────┴──────┴────────┴────────────┘  │
│                                                                 │
│  ANNUAL SUMMARY:                                                │
│  EL: Accrued 7 | Used 6 | Balance 7 (incl. 6 carry fwd)       │
│  CL: Accrued 5 | Used 1.5 | Lapsed 0 | Balance 3.5            │
│  CO: Earned 2 | Used 1 | Expired 0 | Balance 1                │
│  LWP: 0 days                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 4.4 Manager Dashboard

```
MANAGER VIEW:
─────────────
1. PENDING REQUESTS QUEUE
   - List of all pending leave requests with approve/reject buttons
   - Show team coverage % for requested dates
   - Warning if >50% team will be on leave

2. TEAM LEAVE CALENDAR
   - Monthly calendar view
   - Color-coded by employee
   - Shows: approved leave, pending requests, holidays, comp-offs
   - Click any date → see who's available, who's on leave

3. TEAM BALANCE TABLE
   ┌────────────┬────┬────┬────┬──────────────────┐
   │ Employee   │ EL │ CL │ CO │ Next Accrual     │
   ├────────────┼────┼────┼────┼──────────────────┤
   │ Amit S.    │ 7  │ 4  │ 1  │ 1 Jun: 1 EL+1 CL│
   │ Priya R.   │ 12 │ 3  │ 0  │ 1 Jun: 1 EL+1 CL│
   │ ...        │    │    │    │                  │
   └────────────┴────┴────┴────┴──────────────────┘

4. REPORTS
   - Monthly leave utilization
   - LWP report → feeds to payroll
   - Absenteeism trends
   - Year-end carry forward preview (available from 1 Dec)
```

### 4.5 HR Admin Panel

```
HR ADMIN FEATURES:
──────────────────
1. MANUAL BALANCE ADJUSTMENT
   - Select employee → select leave type → enter adjustment (+/-)
   - MANDATORY: reason field + audit log
   - Only HR can do this, not managers
   - Creates entry in audit_log table

2. HOLIDAY MANAGEMENT
   - Add/edit/delete holidays for the year
   - 3 national holidays are locked (cannot delete)
   - Publish holiday list → notifies all employees
   - Bulk import from CSV

3. COMP-OFF MANAGEMENT
   - Grant comp-off to employee (when they worked on off day)
   - Set earned_date, auto-calculate expiry_date (earned_date + 30)
   - View all active, used, expired comp-offs

4. YEAR-END PROCESSING
   - Preview: Show what will happen (CL lapse amounts, EL carry fwd)
   - Execute: Run year-end batch (with confirmation)
   - Report: Year-end summary for all employees

5. SEPARATION PROCESSING
   - Enter last working date
   - System auto-calculates F&F leave component
   - Generate F&F leave statement PDF
   - Show: EL encashment, CL (not encashable), pending OT
```

---

## MODULE 5: NOTIFICATIONS & ALERTS

```
AUTOMATED NOTIFICATIONS:
────────────────────────

TO EMPLOYEE:
  ┌─────────────────────────────────────────────────────────────┐
  │ Trigger                        │ Message                    │
  ├────────────────────────────────┼────────────────────────────┤
  │ Monthly accrual (1st)          │ "1 EL + 1 CL credited"    │
  │ Bonus EL (Jan/May/Sep 1st)    │ "1 bonus EL credited"      │
  │ Leave approved/rejected        │ Decision + new balance     │
  │ Comp-off granted               │ "1 CO earned, exp: [date]" │
  │ Comp-off expiring (5 days)    │ "CO expires on [date]"     │
  │ CL lapse warning (1 Dec)      │ "X CL will lapse 31 Dec"  │
  │ CL lapse warning (15 Dec)     │ "X CL will lapse 31 Dec"  │
  │ Year-end summary (1 Jan)      │ Full year report           │
  │ DST shift change (7 days)     │ "Shift changes to [time]"  │
  │ Night shift consent expiry    │ "Consent expires in 30 days"│
  │ Break reminder (5 hrs)        │ "Take your lunch break"    │
  └────────────────────────────────┴────────────────────────────┘

TO MANAGER:
  - New leave request pending
  - Leave cancellation by employee
  - Weekly team leave calendar digest (Monday)
  - >50% team on leave alert
  - OT request pending approval

TO HR:
  - LWP approval pending
  - Monthly summary report (auto-generated 1st of month)
  - Employee night shift consent expiring
  - OT annual cap warning (employee approaching 150 hrs)
  - DST transition reminder (14 days before)
```

---

## MODULE 6: DATABASE SCHEMA

```sql
-- EMPLOYEES
CREATE TABLE employees (
  id UUID PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  phone VARCHAR(15),
  gender ENUM('Male', 'Female', 'Other') NOT NULL,
  date_of_joining DATE NOT NULL,
  designation VARCHAR(100),
  department VARCHAR(50),
  reporting_manager_id UUID REFERENCES employees(id),
  assigned_shift ENUM('SHIFT_A', 'SHIFT_B', 'SHIFT_C', 'CUSTOM'),
  custom_shift_start TIME,
  custom_shift_end TIME,
  monthly_ctc DECIMAL(10,2),
  status ENUM('active', 'probation', 'separated', 'on_maternity') DEFAULT 'active',
  separation_date DATE,
  separation_type ENUM('resignation', 'termination', 'absconding'),
  night_shift_consent BOOLEAN DEFAULT FALSE,
  night_shift_consent_date DATE,
  night_shift_consent_expiry DATE,
  maternity_leave_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- LEAVE TYPES (seed data)
CREATE TABLE leave_types (
  id INT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(5) UNIQUE NOT NULL, -- EL, CL, CO, LWP, ML
  name VARCHAR(50) NOT NULL,
  annual_quota INT, -- NULL for LWP/CO
  is_paid BOOLEAN DEFAULT TRUE,
  is_encashable BOOLEAN DEFAULT FALSE,
  carry_forward BOOLEAN DEFAULT FALSE,
  max_carry_forward INT, -- 45 for EL, NULL for others
  accrual_type ENUM('monthly', 'monthly_plus_bonus', 'on_event', 'one_time', 'none')
);

-- LEAVE BALANCES (per employee per year)
CREATE TABLE leave_balances (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  employee_id UUID NOT NULL REFERENCES employees(id),
  leave_type_code VARCHAR(5) NOT NULL,
  year INT NOT NULL,
  opening_balance DECIMAL(4,1) DEFAULT 0, -- carried forward
  accrued DECIMAL(4,1) DEFAULT 0,
  used DECIMAL(4,1) DEFAULT 0,
  lapsed DECIMAL(4,1) DEFAULT 0,
  current_balance DECIMAL(4,1) DEFAULT 0, -- computed: opening + accrued - used - lapsed
  UNIQUE(employee_id, leave_type_code, year)
);

-- LEAVE ACCRUAL LOG (audit trail)
CREATE TABLE leave_accrual_log (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  employee_id UUID NOT NULL,
  leave_type_code VARCHAR(5) NOT NULL,
  accrual_date DATE NOT NULL,
  days_credited DECIMAL(3,1) NOT NULL,
  accrual_type ENUM('monthly', 'bonus', 'monthly+bonus', 'comp_off', 'manual', 'carry_forward', 'lapse') NOT NULL,
  running_balance DECIMAL(4,1),
  remarks TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- LEAVE REQUESTS
CREATE TABLE leave_requests (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  employee_id UUID NOT NULL REFERENCES employees(id),
  leave_type_code VARCHAR(5) NOT NULL,
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  total_days DECIMAL(3,1) NOT NULL,
  is_half_day BOOLEAN DEFAULT FALSE,
  half_day_type ENUM('first_half', 'second_half'),
  reason TEXT NOT NULL,
  medical_certificate_url VARCHAR(500),
  status ENUM('pending', 'pending_hr', 'approved', 'rejected', 'cancelled', 
              'recalled', 'partially_cancelled', 'info_requested') DEFAULT 'pending',
  applied_on TIMESTAMP DEFAULT NOW(),
  approved_by UUID REFERENCES employees(id),
  approved_on TIMESTAMP,
  rejection_reason TEXT,
  recall_reason TEXT,
  split_group_id UUID, -- links split-leave entries together
  salary_impact DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- COMP-OFF LOG
CREATE TABLE comp_off_log (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  employee_id UUID NOT NULL REFERENCES employees(id),
  earned_date DATE NOT NULL,
  worked_on_type ENUM('saturday', 'sunday', 'holiday') NOT NULL,
  holiday_name VARCHAR(100), -- if worked_on_type = 'holiday'
  expiry_date DATE NOT NULL, -- earned_date + 30 days
  status ENUM('available', 'used', 'expired') DEFAULT 'available',
  used_date DATE,
  approved_by UUID REFERENCES employees(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- HOLIDAYS
CREATE TABLE holidays (
  id INT PRIMARY KEY AUTO_INCREMENT,
  year INT NOT NULL,
  date DATE NOT NULL,
  name VARCHAR(100) NOT NULL,
  is_mandatory BOOLEAN DEFAULT FALSE, -- TRUE for 3 national holidays
  is_restricted BOOLEAN DEFAULT FALSE,
  UNIQUE(year, date)
);

-- BREAK LOG
CREATE TABLE break_log (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  employee_id UUID NOT NULL,
  date DATE NOT NULL,
  break_type ENUM('lunch', 'tea_1', 'tea_2', 'personal') NOT NULL,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  duration_minutes INT, -- computed on end
  created_at TIMESTAMP DEFAULT NOW()
);

-- OVERTIME LOG
CREATE TABLE overtime_log (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  employee_id UUID NOT NULL,
  date DATE NOT NULL,
  requested_hours DECIMAL(3,1),
  actual_hours DECIMAL(3,1),
  reason TEXT,
  ot_hourly_rate DECIMAL(8,2),
  ot_amount DECIMAL(10,2),
  status ENUM('requested', 'approved', 'rejected', 'completed') DEFAULT 'requested',
  approved_by UUID,
  approved_on TIMESTAMP,
  break_taken_minutes INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ATTENDANCE
CREATE TABLE attendance (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  employee_id UUID NOT NULL,
  date DATE NOT NULL,
  shift_id VARCHAR(10),
  login_time TIMESTAMP,
  logout_time TIMESTAMP,
  total_hours DECIMAL(4,2),
  productive_hours DECIMAL(4,2),
  break_minutes INT DEFAULT 0,
  is_present BOOLEAN,
  is_weekly_off BOOLEAN DEFAULT FALSE,
  is_holiday BOOLEAN DEFAULT FALSE,
  is_on_leave BOOLEAN DEFAULT FALSE,
  leave_request_id BIGINT REFERENCES leave_requests(id),
  is_comp_off_earned BOOLEAN DEFAULT FALSE,
  ot_hours DECIMAL(3,1) DEFAULT 0,
  UNIQUE(employee_id, date)
);

-- PAYROLL FLAGS (monthly export for payroll)
CREATE TABLE payroll_flags (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  employee_id UUID NOT NULL,
  month INT NOT NULL,
  year INT NOT NULL,
  flag_type ENUM('LWP', 'OT', 'HOLIDAY_WORK', 'EL_ENCASHMENT') NOT NULL,
  days DECIMAL(3,1),
  hours DECIMAL(4,1),
  amount DECIMAL(10,2),
  leave_request_id BIGINT,
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- DST CONFIG
CREATE TABLE dst_config (
  id INT PRIMARY KEY AUTO_INCREMENT,
  year INT NOT NULL,
  spring_forward_date DATE NOT NULL, -- US clocks +1hr
  fall_back_date DATE NOT NULL,      -- US clocks -1hr
  notification_sent_14d BOOLEAN DEFAULT FALSE,
  notification_sent_7d BOOLEAN DEFAULT FALSE,
  shift_switched BOOLEAN DEFAULT FALSE
);

-- NIGHT SHIFT CONSENT
CREATE TABLE night_shift_consent (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  employee_id UUID NOT NULL REFERENCES employees(id),
  consent_date DATE NOT NULL,
  expiry_date DATE NOT NULL, -- consent_date + 365
  consent_text TEXT NOT NULL,
  ip_address VARCHAR(45),
  is_active BOOLEAN DEFAULT TRUE,
  withdrawn_date DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- AUDIT LOG
CREATE TABLE audit_log (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  table_name VARCHAR(50) NOT NULL,
  record_id BIGINT NOT NULL,
  action ENUM('create', 'update', 'delete', 'manual_adjustment') NOT NULL,
  changed_by UUID NOT NULL,
  changed_on TIMESTAMP DEFAULT NOW(),
  old_value JSON,
  new_value JSON,
  reason TEXT
);

-- MATERNITY LOG
CREATE TABLE maternity_log (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  employee_id UUID NOT NULL,
  child_number INT NOT NULL,
  leave_type ENUM('delivery', 'adoption', 'surrogacy', 'miscarriage') NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days INT NOT NULL,
  daily_pay_rate DECIMAL(10,2), -- avg of last 3 months
  leave_request_id BIGINT REFERENCES leave_requests(id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## MODULE 7: BUSINESS RULES — ABSOLUTE (NEVER VIOLATE)

```
1.  EL minimum = 15/year. Accrual: 1/month + bonus in Jan, May, Sep.
2.  CL minimum = 12/year. Accrual: 1/month UNCONDITIONAL.
3.  CL lapses on 31 Dec. NEVER carries forward. NEVER encashable.
4.  EL carries forward, max 45 days. Encashable ONLY on separation.
5.  No sandwich rule. Weekends/holidays between leave = NOT deducted.
6.  Probation employees get FULL leave accrual from date of joining.
7.  LWP only allowed when ALL paid leave (EL+CL+CO) = 0.
8.  Maternity leave is SEPARATE. Does not consume EL or CL.
9.  EL/CL continue to accrue during maternity leave.
10. Max continuous work = 5 hours, then 30-min break MANDATORY.
11. Max shift = 9 hours (incl breaks). Max spread-over = 10.5 hours.
12. OT rate = 2x hourly wage. Max 150 hrs/year.
13. Bio breaks = unrestricted. NEVER penalise or track frequency.
14. 3 national holidays CANNOT be removed from holiday list.
15. Night shift for women requires written consent, renewable annually.
16. CL cannot be refused for accident, death in family, or sickness.
17. Any contract giving less than statutory minimum = VOID.
18. DST shift changes must be communicated 7 days in advance.
19. Comp-off expires 30 days after earned. FIFO consumption.
20. Daily wage for LWP deduction and EL encashment = monthly CTC ÷ 26.
```

---

**Test with these edge cases:**
- Employee joins 15 March → first accrual on 1 May (EL: 1+1 bonus = 2, CL: 1)
- Year-end: Employee has 48 EL → carried: 45, lapsed: 3
- Leave Thu–Mon → deducted: 2 days (only Thu+Fri; Sat+Sun excluded, Mon counted)
- Leave Fri–Mon with Monday = holiday → deducted: 1 day (only Fri)
- Employee has 2 EL, 1 CL, needs 5 days → split: 2 EL + 1 CL + 2 LWP
- Comp-off earned 1 Apr, employee applies 5 May → EXPIRED (>30 days)
- Female employee, no night consent → BLOCK shift assignment
- DST transition: Shift A changes from 6:30 PM to 7:30 PM on Nov 1
- Separation: 8 EL balance → encash at ₹50,000/26 × 8 = ₹15,384
- Separation: 5 CL balance → ₹0 (not encashable)
