# SendGrid Sender Verification — alina.carter@hire-in.com

**Verified on:** 2026-05-01  
**Task:** #100

## Summary

`alina.carter@hire-in.com` is authorized to send email through SendGrid via **domain authentication** on `hire-in.com`. No individual single-sender verification is required when domain authentication is active.

## Domain Authentication Status

| Field | Value |
|---|---|
| Domain | `hire-in.com` |
| SendGrid Domain ID | `30154905` |
| Subdomain | `em8882` |
| Status | **valid: true** |
| mail_cname | `em8882.hire-in.com` → `u58983878.wl129.sendgrid.net` ✅ |
| DKIM s1 | `s1._domainkey.hire-in.com` → `s1.domainkey.u58983878.wl129.sendgrid.net` ✅ |
| DKIM s2 | `s2._domainkey.hire-in.com` → `s2.domainkey.u58983878.wl129.sendgrid.net` ✅ |
| Automatic Security | true |

Domain authentication covers **all addresses at `@hire-in.com`**, including `alina.carter@hire-in.com`.

## Delivery Evidence

### Prior system email delivery (from activity logs)
- **From:** `alina.carter@hire-in.com`
- **Subject:** `Offer Letter from Rayomind Solutions LLP — Senior Software Engineer`
- **Status:** `delivered`
- **Timestamp:** `2026-05-01T03:25:43Z`
- **Message ID:** `60az2idLSJaMlnogNy2lxw.recvd-6d75975858-q5jmd-1-69F41D33-A.0`

### Manual test email (sent as part of this verification)
- **From:** `alina.carter@hire-in.com`
- **To:** `simranjeet@hire-in.com`
- **Subject:** `SendGrid Sender Verification Test - alina.carter@hire-in.com`
- **SendGrid response:** `HTTP 202 Accepted`
- **Sent:** 2026-05-01

## How to Re-verify

Run the following commands (requires `SENDGRID_API_KEY_NEW` in the environment):

```bash
# Check domain authentication for hire-in.com
curl -s "https://api.sendgrid.com/v3/whitelabel/domains" \
  -H "Authorization: Bearer $SENDGRID_API_KEY_NEW" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); \
  [print(x['domain'], 'valid:', x['valid']) for x in d]"

# Check recent activity from alina.carter@hire-in.com
QUERY=$(python3 -c "import urllib.parse; print(urllib.parse.quote('from_email=\"alina.carter@hire-in.com\"'))")
curl -s "https://api.sendgrid.com/v3/messages?limit=5&query=${QUERY}" \
  -H "Authorization: Bearer $SENDGRID_API_KEY_NEW"
```

## Related

- `server/email.ts` — `FROM_EMAIL` constant set to `alina.carter@hire-in.com`
- SendGrid account: Settings → Sender Authentication → Domain Authentication
