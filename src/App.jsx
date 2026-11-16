import { useState, useEffect, useRef, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Key,
  QrCode,
  Clock,
  RefreshCw,
  Copy,
  Check,
  LogIn,
  LogOut,
  Lock,
  User,
  ArrowRight,
  Smartphone,
  Terminal,
  Sparkles,
  Info,
  CheckCircle2,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  AlertTriangle
} from 'lucide-react'
import './App.css'

// ==========================================
// 🛡️ RFC 4648 Base32 & RFC 6238 TOTP Engine
// (100% Client-side Web Crypto API, Zero-Transmission)
// ==========================================
const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

/**
 * Generate cryptographically secure random entropy (window.crypto.getRandomValues)
 * Uses 160 bits (20 bytes) of entropy to generate a Base32 secret key.
 */
function generateBase32Secret(byteLength = 20) {
  const bytes = new Uint8Array(byteLength)
  window.crypto.getRandomValues(bytes)

  let bits = 0
  let value = 0
  let output = ''

  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i]
    bits += 8
    while (bits >= 5) {
      output += BASE32_CHARS[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) {
    output += BASE32_CHARS[(value << (5 - bits)) & 31]
  }
  return output
}

/**
 * Decode Base32 string into Uint8Array byte array
 */
function base32ToBytes(base32Str) {
  const cleanStr = base32Str.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '')
  let bits = 0
  let value = 0
  const bytes = []

  for (let i = 0; i < cleanStr.length; i++) {
    const val = BASE32_CHARS.indexOf(cleanStr[i])
    if (val === -1) continue
    value = (value << 5) | val
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return new Uint8Array(bytes)
}

/**
 * Compute 6-digit TOTP code for a specific time-step (RFC 6238 / RFC 4226)
 * Uses Web Crypto API (HMAC-SHA1) in the background during verification.
 */
async function computeTOTP(secretBase32, timeStep) {
  try {
    const keyBytes = base32ToBytes(secretBase32)
    if (keyBytes.length === 0) return '------'

    const cryptoKey = await window.crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    )

    // Construct 64-bit (8-byte) big-endian counter buffer
    const counterBuffer = new ArrayBuffer(8)
    const dataView = new DataView(counterBuffer)
    dataView.setBigUint64(0, BigInt(timeStep), false)

    // Generate HMAC-SHA1 signature
    const signature = await window.crypto.subtle.sign('HMAC', cryptoKey, counterBuffer)
    const hmac = new Uint8Array(signature)

    // Dynamic Truncation (RFC 4226)
    const offset = hmac[hmac.length - 1] & 0x0f
    const binary =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff)

    // Extract 6-digit code
    const otp = (binary % 1000000).toString().padStart(6, '0')
    return otp
  } catch (err) {
    console.error('TOTP computation error:', err)
    return '------'
  }
}

/**
 * Detailed TOTP verification with diagnostic classification:
 * 1. Valid range: T, T-1, T+1 (+/- 1 time-step clock-drift tolerance)
 * 2. Failure classification:
 *    - Historical step (T-2 to T-10): 'EXPIRED' (Time Expired)
 *    - Future step (T+2 to T+10): 'CLOCK_AHEAD' (Device Clock Out-of-Sync)
 *    - Not found in extended window: 'MISMATCH' (Code Mismatch / Typo)
 * 3. Discontinuity detection: |delta| >= 2 (2 or more step gap)
 */
async function verifyTOTPCodeDetailed(inputCode, secretBase32, currentStep) {
  const cleanCode = inputCode.trim()
  if (cleanCode.length !== 6 || !/^\d{6}$/.test(cleanCode)) {
    return {
      valid: false,
      type: 'INVALID_FORMAT',
      reason: 'Please enter a valid 6-digit numeric code.',
      delta: null,
      absDelta: 0,
      isDiscontinuous: false
    }
  }

  // 1. Valid tolerance range (0s, -30s, +30s)
  const validSteps = [
    { step: currentStep, delta: 0, label: 'Current Window (0s offset)' },
    { step: currentStep - 1, delta: -1, label: 'Previous Window (-30s clock-delay allowed)' },
    { step: currentStep + 1, delta: +1, label: 'Next Window (+30s clock-advance allowed)' }
  ]

  for (const item of validSteps) {
    const computed = await computeTOTP(secretBase32, item.step)
    if (computed === cleanCode) {
      return {
        valid: true,
        type: 'SUCCESS',
        matchedStep: item.step,
        delta: item.delta,
        absDelta: Math.abs(item.delta),
        label: item.label,
        isDiscontinuous: false
      }
    }
  }

  // 2. Extended window evaluation (-10 to +10 steps) to classify failure
  for (let delta = -10; delta <= 10; delta++) {
    if (delta >= -1 && delta <= 1) continue // Skip already checked valid window
    const checkStep = currentStep + delta
    const computed = await computeTOTP(secretBase32, checkStep)

    if (computed === cleanCode) {
      const absDelta = Math.abs(delta)
      if (delta < 0) {
        return {
          valid: false,
          type: 'EXPIRED',
          delta,
          absDelta,
          isDiscontinuous: absDelta >= 2,
          reason: `Code Expired: This token expired ${absDelta * 30} seconds ago (${absDelta} steps in the past).`,
          label: `Expired Token (${absDelta * 30}s elapsed)`
        }
      } else {
        return {
          valid: false,
          type: 'CLOCK_AHEAD',
          delta,
          absDelta,
          isDiscontinuous: absDelta >= 2,
          reason: `Device Clock Skew: This is a future token for ${delta * 30} seconds ahead. Check your phone's time synchronization.`,
          label: `Future Token (+${delta * 30}s ahead)`
        }
      }
    }
  }

  // 3. Not found anywhere in extended window -> Complete Code Mismatch
  return {
    valid: false,
    type: 'MISMATCH',
    delta: null,
    absDelta: 0,
    isDiscontinuous: false,
    reason: 'Code Mismatch: The entered 6-digit code does not match. Please verify your phone authenticator or check for typos.',
    label: 'Code Mismatch'
  }
}

export default function App() {
  // Active View: 'dual' (Smartphone Setup + Login), 'security' (Security Checkpoints & Audit)
  const [activeView, setActiveView] = useState('dual')

  // Issuer and Account configuration
  const [issuer, setIssuer] = useState('ZeroAuth')
  const [account, setAccount] = useState('user@k-cybersec.ac.kr')
  const [secretKey, setSecretKey] = useState(() => generateBase32Secret(20))

  // 1. Manual Key toggle ('Cannot scan QR code?')
  const [showManualKey, setShowManualKey] = useState(false)

  // 2. Audit Log dashboard toggle
  const [showAuditLogs, setShowAuditLogs] = useState(false)

  // 3. 30-second epoch protection & re-issuance cooldown
  const [keyGeneratedAt, setKeyGeneratedAt] = useState(() => Date.now())
  const [keyCooldown, setKeyCooldown] = useState(30)

  // Track consecutive failure count (for anomaly / brute-force detection)
  const [consecutiveFailures, setConsecutiveFailures] = useState(0)

  // Current epoch step (internal verification epoch, never exposed on screen)
  const [currentStep, setCurrentStep] = useState(() => Math.floor(Date.now() / 1000 / 30))
  const [copiedKey, setCopiedKey] = useState(false)
  const [copiedUri, setCopiedUri] = useState(false)

  // Login Simulator state
  const [loginStage, setLoginStage] = useState('credentials')
  const [username, setUsername] = useState('cybersec_admin')
  const [password, setPassword] = useState('password123!')
  const [otpInputs, setOtpInputs] = useState(['', '', '', '', '', ''])
  const [isVerifying, setIsVerifying] = useState(false)
  const [verificationResult, setVerificationResult] = useState(null)
  const [sessionData, setSessionData] = useState(null)
  const [auditLogs, setAuditLogs] = useState(() => [
    {
      id: 1,
      timestamp: new Date().toLocaleTimeString(),
      event: '[SYSTEM INITIALIZED]: Zero-Transmission Web Crypto engine active',
      status: 'info'
    }
  ])

  // OTP 6-digit input refs
  const otpInputRefs = useRef([])

  // RFC 6238 Standard URI for Authenticator Apps
  const otpauthUri = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secretKey}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`

  // Re-generate secret key only when 30 seconds have elapsed
  const handleRegenerateKey = useCallback(() => {
    const elapsed = Math.floor((Date.now() - keyGeneratedAt) / 1000)
    if (elapsed < 30) {
      alert(`A new key can only be generated after 30 seconds have passed. (${30 - elapsed}s remaining)`)
      return
    }

    const newKey = generateBase32Secret(20)
    setSecretKey(newKey)
    setKeyGeneratedAt(Date.now())
    setKeyCooldown(30)
    setVerificationResult(null)
    setConsecutiveFailures(0)
    setAuditLogs((prev) => [
      {
        id: Date.now(),
        timestamp: new Date().toLocaleTimeString(),
        event: '[KEY RE-ISSUED]: 30s epoch verified - Generated fresh 160-bit Base32 secret key',
        status: 'warning'
      },
      ...prev
    ])
  }, [keyGeneratedAt])

  // 1-second interval loop for step tracking and 30s key cooldown timer
  useEffect(() => {
    const interval = setInterval(() => {
      const nowMs = Date.now()
      const nowSec = Math.floor(nowMs / 1000)
      const step = Math.floor(nowSec / 30)
      setCurrentStep(step)

      const elapsed = Math.floor((nowMs - keyGeneratedAt) / 1000)
      const remaining = Math.max(0, 30 - elapsed)
      setKeyCooldown(remaining)
    }, 1000)

    return () => clearInterval(interval)
  }, [keyGeneratedAt])

  // Clipboard copy helper
  const handleCopy = (text, setCopiedFn) => {
    navigator.clipboard.writeText(text)
    setCopiedFn(true)
    setTimeout(() => setCopiedFn(false), 2000)
  }

  // Submit Step 1 Credentials -> Proceed to Step 2 2FA Modal
  const handleCredentialsSubmit = (e) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) {
      alert('Please enter your username and password.')
      return
    }
    setOtpInputs(['', '', '', '', '', ''])
    setVerificationResult(null)
    setLoginStage('2fa')

    setTimeout(() => {
      otpInputRefs.current[0]?.focus()
    }, 100)
  }

  // Handle 6-digit OTP typing and auto-focus
  const handleOtpChange = (index, value) => {
    const cleanVal = value.replace(/\D/g, '')
    if (!cleanVal) {
      const newInputs = [...otpInputs]
      newInputs[index] = ''
      setOtpInputs(newInputs)
      return
    }

    if (cleanVal.length > 1) {
      handleOtpPaste(cleanVal)
      return
    }

    const newInputs = [...otpInputs]
    newInputs[index] = cleanVal
    setOtpInputs(newInputs)

    if (index < 5 && cleanVal) {
      otpInputRefs.current[index + 1]?.focus()
    }
  }

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpInputs[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus()
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpInputRefs.current[index - 1]?.focus()
    } else if (e.key === 'ArrowRight' && index < 5) {
      otpInputRefs.current[index + 1]?.focus()
    } else if (e.key === 'Enter') {
      executeVerification()
    }
  }

  const handleOtpPaste = (pastedText) => {
    const digits = pastedText.replace(/\D/g, '').slice(0, 6).split('')
    const newInputs = ['', '', '', '', '', '']
    digits.forEach((d, i) => {
      newInputs[i] = d
    })
    setOtpInputs(newInputs)
    const nextIdx = Math.min(digits.length, 5)
    otpInputRefs.current[nextIdx]?.focus()
  }

  // Retry verification handler
  const handleRetryVerification = () => {
    setOtpInputs(['', '', '', '', '', ''])
    setVerificationResult(null)
    setTimeout(() => {
      otpInputRefs.current[0]?.focus()
    }, 100)
  }

  // Execute 2FA Verification & Diagnostic Logging
  const executeVerification = async () => {
    const fullCode = otpInputs.join('')
    if (fullCode.length !== 6) {
      setVerificationResult({
        valid: false,
        type: 'INVALID_FORMAT',
        reason: 'Please enter all 6 digits of your authentication code.'
      })
      return
    }

    setIsVerifying(true)
    setVerificationResult(null)

    setTimeout(async () => {
      const result = await verifyTOTPCodeDetailed(fullCode, secretKey, currentStep)
      setIsVerifying(false)
      setVerificationResult(result)

      const timeStr = new Date().toLocaleTimeString()

      if (result.valid) {
        setConsecutiveFailures(0)

        const newSession = {
          user: username,
          authenticatedAt: timeStr,
          matchedWindow: result.label,
          sessionToken: 'zeroauth_' + Math.random().toString(36).substring(2, 10),
          zeroTransmissionVerified: true
        }
        setSessionData(newSession)

        setAuditLogs((prev) => [
          {
            id: Date.now(),
            timestamp: timeStr,
            event: `[SUCCESS] 2FA OTP Verified (${result.label}) - User [${username}] authorized`,
            status: 'success'
          },
          ...prev
        ])

        setTimeout(() => {
          setLoginStage('dashboard')
        }, 700)
      } else {
        const newFailCount = consecutiveFailures + 1
        setConsecutiveFailures(newFailCount)

        const newLogs = []

        // 1. Basic failure log (Mismatch vs Expiration)
        if (result.type === 'EXPIRED') {
          newLogs.push({
            id: Date.now(),
            timestamp: timeStr,
            event: `[FAILED: TIME EXPIRED] Code [${fullCode}] expired (${result.absDelta * 30}s past expiration)`,
            status: 'warning'
          })
        } else if (result.type === 'CLOCK_AHEAD') {
          newLogs.push({
            id: Date.now(),
            timestamp: timeStr,
            event: `[FAILED: CLOCK SKEW] Code [${fullCode}] future time-step (+${result.delta * 30}s ahead - phone clock skew)`,
            status: 'warning'
          })
        } else {
          newLogs.push({
            id: Date.now(),
            timestamp: timeStr,
            event: `[FAILED: CODE MISMATCH] Invalid code [${fullCode}] entered (typo or key mismatch)`,
            status: 'danger'
          })
        }

        // 2. Special Log 1: Time discontinuity >= 2 steps (|delta| >= 2)
        if (result.isDiscontinuous) {
          newLogs.unshift({
            id: Date.now() + 1,
            timestamp: timeStr,
            event: `[SPECIAL]: Detected ${result.absDelta}-step time discontinuity (delta = ${result.delta > 0 ? '+' : ''}${result.delta}, ${result.absDelta * 30}s gap) - ${result.type === 'EXPIRED' ? 'Expired historical token replay' : 'Future time-step access anomaly'}`,
            status: 'special'
          })
        }

        // 3. Special Log 2: Consecutive failure count >= 2
        if (newFailCount >= 2) {
          newLogs.unshift({
            id: Date.now() + 2,
            timestamp: timeStr,
            event: `[SPECIAL]: Detected ${newFailCount} Consecutive Failures - Warning: Potential brute-force attack or anomalous session`,
            status: 'special'
          })
        }

        setAuditLogs((prev) => [...newLogs, ...prev])
      }
    }, 200)
  }

  // Sign out
  const handleLogout = () => {
    setLoginStage('credentials')
    setSessionData(null)
    setVerificationResult(null)
    setOtpInputs(['', '', '', '', '', ''])
    setConsecutiveFailures(0)
    setAuditLogs((prev) => [
      {
        id: Date.now(),
        timestamp: new Date().toLocaleTimeString(),
        event: `[LOGOUT]: User [${username}] signed out successfully`,
        status: 'info'
      },
      ...prev
    ])
  }

  return (
    <div className="app-container">
      {/* ================= HEADER ================= */}
      <header className="app-header">
        <div className="header-brand">
          <div className="brand-icon-wrapper">
            <Shield className="brand-icon" />
          </div>
          <div>
            <div className="brand-title-row">
              <h1 className="brand-title">ZeroAuth Mobile OTP Studio</h1>
              <span className="badge badge-cyber">RFC 6238 TOTP</span>
            </div>
            <p className="brand-subtitle">
              Zero-Transmission Client-Side Web Crypto 2-Factor Authentication
            </p>
          </div>
        </div>

        {/* Security Status Indicators */}
        <div className="header-status-box">
          <div className="status-item">
            <span className="status-dot active"></span>
            <span className="status-text">Zero-Transmission: Local Web Crypto execution (0 network transmissions)</span>
          </div>
          <div className="status-item">
            <span className="status-dot secure"></span>
            <span className="status-text">CSPRNG: window.crypto.getRandomValues (160-bit Base32)</span>
          </div>
        </div>
      </header>

      {/* ================= TAB NAVIGATION ================= */}
      <nav className="nav-tabs">
        <button
          className={`tab-btn ${activeView === 'dual' ? 'active' : ''}`}
          onClick={() => setActiveView('dual')}
        >
          <Sparkles size={18} />
          <span>2FA Studio (Smartphone Setup & Live Login)</span>
        </button>

        <button
          className={`tab-btn ${activeView === 'security' ? 'active' : ''}`}
          onClick={() => setActiveView('security')}
        >
          <ShieldCheck size={18} />
          <span>Cybersecurity Checkpoints & F12 Zero-Transmission Audit</span>
        </button>
      </nav>

      {/* ================= MAIN CONTENT ================= */}
      <main className="main-content">
        {activeView === 'dual' && (
          <div className="dual-studio-container">
            {/* ================= LEFT: Smartphone QR Code Setup & Key Registration ================= */}
            <section className="studio-col qr-sync-panel">
              <div className="card h-full">
                <div className="card-header">
                  <div className="card-badge">Smartphone 2FA Registration (Criteria 1 & 2)</div>
                  <div className="card-header-row">
                    <h2 className="card-title">
                      <QrCode size={22} className="text-cyan" /> Smartphone QR Code Integration
                    </h2>

                    {/* 30-Second Cooldown Key Re-issuance Button */}
                    {keyCooldown === 0 ? (
                      <button
                        className="btn btn-primary btn-sm pulse-btn"
                        onClick={handleRegenerateKey}
                        title="30s epoch verified - Click to generate a fresh secret key."
                      >
                        <RefreshCw size={14} /> Regenerate Security Key
                      </button>
                    ) : (
                      <button
                        className="btn btn-secondary btn-sm disabled-timer-btn"
                        disabled
                        title={`30s epoch rate-limit: Please wait ${keyCooldown}s before regenerating.`}
                      >
                        <Clock size={14} /> Cooldown ({keyCooldown}s)
                      </button>
                    )}
                  </div>
                  <p className="card-desc">
                    Scan the QR code below with Google Authenticator, 2FAS, or Microsoft Authenticator on your smartphone.
                  </p>
                </div>

                {/* Scannable QR Code Display Area */}
                <div className="qr-highlight-area">
                  <div className="qr-box-main">
                    <QRCodeSVG
                      value={otpauthUri}
                      size={210}
                      level="M"
                      includeMargin={true}
                      bgColor="#ffffff"
                      fgColor="#0a0e17"
                    />
                  </div>
                  <div className="qr-badge-notice">
                    <Smartphone size={15} />
                    <span>Scan directly with your phone camera (otpauth://)</span>
                  </div>
                </div>

                {/* 1. 'Cannot scan QR code?' Toggle Button (Shields Secret Key from Shoulder-Surfing) */}
                <div className="scan-trouble-box">
                  <button
                    type="button"
                    className="btn-trouble-toggle"
                    onClick={() => setShowManualKey(!showManualKey)}
                  >
                    <div className="btn-trouble-left">
                      <HelpCircle size={16} className="text-cyan" />
                      <span>Cannot scan QR code? (View Manual Setup Key)</span>
                    </div>
                    {showManualKey ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>

                  {/* Collapsible Manual Setup Key Drawer */}
                  {showManualKey && (
                    <div className="manual-key-drawer">
                      <div className="drawer-header">
                        <span className="drawer-title">
                          <Key size={14} /> Base32 Secret Key (Manual Entry Key)
                        </span>
                        <button
                          className="btn-icon-copy"
                          onClick={() => handleCopy(secretKey, setCopiedKey)}
                        >
                          {copiedKey ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                          <span>{copiedKey ? 'Copied!' : 'Copy Key'}</span>
                        </button>
                      </div>

                      <div className="secret-key-mono">
                        {secretKey.match(/.{1,4}/g)?.join(' ') || secretKey}
                      </div>
                      <p className="manual-guide-text">
                        In your authenticator app, choose <strong>'Enter a setup key'</strong> and enter the key above.
                      </p>

                      {/* Issuer & Account Customization */}
                      <div className="issuer-account-inputs">
                        <div className="input-inline">
                          <label>Issuer:</label>
                          <input
                            type="text"
                            value={issuer}
                            onChange={(e) => setIssuer(e.target.value)}
                            placeholder="ZeroAuth"
                          />
                        </div>
                        <div className="input-inline">
                          <label>Account:</label>
                          <input
                            type="text"
                            value={account}
                            onChange={(e) => setAccount(e.target.value)}
                            placeholder="user@k-cybersec.ac.kr"
                          />
                        </div>
                      </div>

                      {/* Standard URI Box */}
                      <div className="uri-mini-box">
                        <div className="uri-mini-header">
                          <span>Standard URI (otpauth://)</span>
                          <button
                            className="btn-text-sm"
                            onClick={() => handleCopy(otpauthUri, setCopiedUri)}
                          >
                            {copiedUri ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                            <span>{copiedUri ? 'Copied' : 'Copy URI'}</span>
                          </button>
                        </div>
                        <code className="uri-mini-code">{otpauthUri}</code>
                      </div>
                    </div>
                  )}
                </div>

                {/* Smartphone 3-Step Enrollment Guide */}
                <div className="enroll-steps-card">
                  <div className="enroll-steps-title">
                    <Smartphone size={15} className="text-cyan" />
                    <span>How to link with your Smartphone Authenticator App</span>
                  </div>
                  <div className="enroll-step-list">
                    <div className="enroll-step-item">
                      <span className="step-circle">1</span>
                      <p>Open <strong>Google Authenticator</strong>, <strong>2FAS</strong>, or Microsoft Authenticator on your phone</p>
                    </div>
                    <div className="enroll-step-item">
                      <span className="step-circle">2</span>
                      <p>Tap <strong>'+' (Add)</strong> $\rightarrow$ <strong>Scan QR Code</strong> to scan the code above</p>
                    </div>
                    <div className="enroll-step-item">
                      <span className="step-circle">3</span>
                      <p>Check the <strong>6-digit code</strong> generated on your phone screen and enter it in the login panel</p>
                    </div>
                  </div>
                </div>

                {/* 2FA Security Principle Notice */}
                <div className="security-notice-card">
                  <div className="security-notice-header">
                    <ShieldCheck size={16} className="text-success" />
                    <strong>2-Factor Authentication (Possession Factor) Principle</strong>
                  </div>
                  <p className="security-notice-desc">
                    The One-Time Password (OTP) is computed exclusively inside your physical smartphone
                    and is never exposed on the web browser screen. This ensures complete protection even if
                    your PC screen is captured or your password is compromised.
                  </p>
                </div>
              </div>
            </section>

            {/* ================= RIGHT: Production Login Simulator & Verification ================= */}
            <section className="studio-col simulator-panel">
              {/* Step 1: Username & Password Form */}
              {loginStage === 'credentials' && (
                <div className="card h-full">
                  <div className="card-header">
                    <div className="card-badge">Enterprise Login Simulator (Step 1 / 2)</div>
                    <h2 className="card-title">
                      <LogIn size={22} className="text-primary" /> Service Portal Login
                    </h2>
                    <p className="card-desc">
                      Log in with your credentials, then proceed to the 2-Factor OTP verification step.
                    </p>
                  </div>

                  <form onSubmit={handleCredentialsSubmit} className="login-form-inner">
                    <div className="input-group">
                      <label className="input-label" htmlFor="input-username">
                        <User size={16} /> Username
                      </label>
                      <input
                        id="input-username"
                        type="text"
                        className="text-input"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Enter your username"
                        required
                      />
                    </div>

                    <div className="input-group">
                      <label className="input-label" htmlFor="input-password">
                        <Lock size={16} /> Password
                      </label>
                      <input
                        id="input-password"
                        type="password"
                        className="text-input"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        required
                      />
                    </div>

                    <div className="info-guide-card">
                      <Info size={16} className="text-cyan" />
                      <div>
                        <strong>Quick Start Guide:</strong>
                        <p>
                          After scanning the QR code on the left with your phone, click the button below
                          to proceed to the 2FA verification step.
                        </p>
                      </div>
                    </div>

                    <div className="form-submit-row">
                      <button type="submit" className="btn btn-primary btn-block">
                        <span>Sign In $\rightarrow$ Proceed to 2FA Verification</span>
                        <ArrowRight size={18} />
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Step 2: 2FA 6-Digit OTP Verification Modal */}
              {loginStage === '2fa' && (
                <div className="card h-full modal-glow-card">
                  <div className="card-header">
                    <div className="card-badge text-cyan">Two-Factor Identity Verification (Step 2 / 2)</div>
                    <h2 className="card-title">
                      <ShieldCheck size={22} className="text-success" /> Enter Smartphone 6-Digit OTP
                    </h2>
                    <p className="card-desc">
                      Enter the 6-digit code currently displayed in <strong>Google Authenticator</strong> or <strong>2FAS</strong> on your phone.
                    </p>
                  </div>

                  <div className="otp-verification-body">
                    {/* 6-Digit Split Inputs */}
                    <div className="otp-digit-container">
                      {otpInputs.map((digit, idx) => (
                        <input
                          key={idx}
                          ref={(el) => (otpInputRefs.current[idx] = el)}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          className={`otp-digit-input ${digit ? 'filled' : ''} ${
                            verificationResult?.valid === false ? 'error' : ''
                          }`}
                          value={digit}
                          onChange={(e) => handleOtpChange(idx, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                          autoFocus={idx === 0}
                        />
                      ))}
                    </div>

                    <div className="otp-helper-row">
                      <span className="clock-drift-pill">
                        <Clock size={13} className="text-cyan" /> $\pm 1$ Step ($\pm 30$s) Clock-Drift Tolerance Automatically Applied
                      </span>
                    </div>

                    {/* Verification Result Banner */}
                    {verificationResult && (
                      <div
                        className={`alert-banner ${
                          verificationResult.valid ? 'alert-success' : 'alert-danger'
                        }`}
                      >
                        {verificationResult.valid ? (
                          <>
                            <ShieldCheck size={22} />
                            <div>
                              <strong>Verification Successful!</strong>
                              <p>Matched at {verificationResult.label}.</p>
                            </div>
                          </>
                        ) : (
                          <>
                            <ShieldAlert size={22} />
                            <div className="alert-content-fail">
                              <div className="fail-badge-row">
                                <span className={`fail-category-badge category-${verificationResult.type.toLowerCase()}`}>
                                  {verificationResult.type === 'EXPIRED' && '⏱️ [EXPIRED]: Code Expired'}
                                  {verificationResult.type === 'CLOCK_AHEAD' && '⏰ [CLOCK SKEW]: Future Code'}
                                  {verificationResult.type === 'MISMATCH' && '❌ [MISMATCH]: Invalid Code'}
                                  {verificationResult.type === 'INVALID_FORMAT' && '⚠️ Format Error'}
                                </span>

                                {verificationResult.isDiscontinuous && (
                                  <span className="special-alert-chip">
                                    <AlertTriangle size={12} /> [SPECIAL]: {verificationResult.absDelta}-step discontinuity logged
                                  </span>
                                )}
                              </div>

                              <p className="fail-reason-text">{verificationResult.reason}</p>

                              {consecutiveFailures >= 2 && (
                                <p className="consecutive-fail-warn">
                                  🚨 [SPECIAL]: Detected {consecutiveFailures} Consecutive Failures - Security warning logged in audit trail.
                                </p>
                              )}

                              {/* Re-enter Code Button */}
                              <button
                                type="button"
                                className="btn-retry-inline"
                                onClick={handleRetryVerification}
                              >
                                <RotateCcw size={13} /> Re-enter Code
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* Verification Action Buttons */}
                    <div className="verify-actions-row">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setLoginStage('credentials')}
                      >
                        Previous Step
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={executeVerification}
                        disabled={isVerifying || otpInputs.join('').length !== 6}
                      >
                        {isVerifying ? (
                          <>
                            <RefreshCw size={18} className="spin" />
                            <span>Verifying...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 size={18} />
                            <span>Verify Code</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Authenticated Admin Dashboard */}
              {loginStage === 'dashboard' && sessionData && (
                <div className="card h-full dashboard-auth-card">
                  <div className="dashboard-header">
                    <div className="success-badge-large">
                      <ShieldCheck size={36} />
                    </div>
                    <div className="dashboard-header-text">
                      <h2 className="dashboard-title">Security Administrator Dashboard Authorized</h2>
                      <p className="dashboard-subtitle">
                        Zero-Transmission TOTP 2-Factor Authentication successfully verified.
                      </p>
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={handleLogout}>
                      <LogOut size={16} /> Sign Out
                    </button>
                  </div>

                  {/* Session Metadata Cards */}
                  <div className="session-grid">
                    <div className="session-card">
                      <span className="session-label">Authenticated User</span>
                      <strong className="session-val">{sessionData.user}</strong>
                    </div>
                    <div className="session-card">
                      <span className="session-label">Auth Timestamp</span>
                      <strong className="session-val">{sessionData.authenticatedAt}</strong>
                    </div>
                    <div className="session-card">
                      <span className="session-label">Sync Window</span>
                      <strong className="session-val text-success">{sessionData.matchedWindow}</strong>
                    </div>
                    <div className="session-card">
                      <span className="session-label">Zero-Transmission</span>
                      <strong className="session-val text-cyan">0 Bytes Outbound Payload (Web Crypto)</strong>
                    </div>
                  </div>

                  {/* 2. Collapsible Security Event Audit Trail */}
                  <div className="audit-section">
                    <div className="audit-header-row">
                      <div className="section-title">
                        <Terminal size={17} className="text-cyan" />
                        <span>Security Event Audit Trail</span>
                      </div>
                      <button
                        type="button"
                        className="btn-audit-toggle"
                        onClick={() => setShowAuditLogs(!showAuditLogs)}
                      >
                        <span>{showAuditLogs ? 'Hide Logs' : `View Logs (${auditLogs.length})`}</span>
                        {showAuditLogs ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </button>
                    </div>

                    {showAuditLogs && (
                      <div className="audit-log-list animate-slide-down">
                        {auditLogs.map((log) => (
                          <div key={log.id} className={`audit-log-item log-${log.status}`}>
                            <span className="log-time">[{log.timestamp}]</span>
                            <span className="log-event">{log.event}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        {/* ================= TAB: Cybersecurity Checkpoints & F12 Zero-Transmission Audit ================= */}
        {activeView === 'security' && (
          <div className="tab-pane security-container">
            <div className="security-hero-card">
              <ShieldCheck size={48} className="text-success" />
              <div>
                <h2>Cybersecurity Checkpoints & Zero-Transmission Audit Guide</h2>
                <p>
                  This application performs all cryptographic secret key generation, HMAC-SHA1 signature computation,
                  and clock-drift synchronization verification locally inside the browser via the Web Crypto API.
                </p>
              </div>
            </div>

            <div className="security-grid">
              {/* Checkpoint 1 */}
              <div className="card">
                <div className="card-header">
                  <div className="checkpoint-badge">Checkpoint 1</div>
                  <h3 className="card-title">Absolute Prohibition of Math.random()</h3>
                </div>
                <div className="security-detail">
                  <p>
                    Standard pseudo-random number generators (<code>Math.random()</code>) are completely predictable
                    based on seed states and are strictly prohibited for cryptographic key generation.
                  </p>
                  <div className="code-comparison">
                    <div className="code-bad">
                      <span className="code-title">❌ Vulnerable / Forbidden</span>
                      <code>Math.random().toString(36)...</code>
                      <p className="code-desc">Predictable seed, insufficient entropy</p>
                    </div>
                    <div className="code-good">
                      <span className="code-title">✅ Implemented CSPRNG</span>
                      <code>window.crypto.getRandomValues(new Uint8Array(20))</code>
                      <p className="code-desc">Hardware entropy pool sourcing 160 bits of cryptographic randomness</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Checkpoint 2 */}
              <div className="card">
                <div className="card-header">
                  <div className="checkpoint-badge">Checkpoint 2</div>
                  <h3 className="card-title">Zero-Transmission Principle</h3>
                </div>
                <div className="security-detail">
                  <p>
                    Secret keys and HMAC-SHA1 signature calculations never leave the client device or touch an external API
                    server (e.g., no external QR code generators like Google Charts API). All operations are processed natively
                    via the browser's <code>window.crypto.subtle</code> Web Crypto API and client-side SVG rendering.
                  </p>

                  <div className="verification-steps-box">
                    <h4>🔍 Browser DevTools (F12) Verification Guide</h4>
                    <ol className="verify-list">
                      <li>
                        Press <code>F12</code> to open <strong>Developer Tools</strong>.
                      </li>
                      <li>
                        Switch to the <strong>Network</strong> tab and set the filter to <code>Fetch/XHR</code>.
                      </li>
                      <li>
                        Click 'Regenerate Security Key' or perform a 2FA verification.
                      </li>
                      <li>
                        Confirm that <strong>zero outbound HTTP network requests (0 bytes payload)</strong> are transmitted.
                      </li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>

            {/* RFC 6238 Mathematical Foundations */}
            <div className="card rfc-card">
              <div className="card-header">
                <h3 className="card-title">
                  <Terminal size={18} /> RFC 6238 TOTP Mathematical Specification
                </h3>
              </div>
              <div className="rfc-content-grid">
                <div className="rfc-step-item">
                  <div className="rfc-step-title">1. Time Epoch Counter</div>
                  <p>
                    <code>T = Math.floor(UnixTime / 30)</code>
                    <br />
                    A 64-bit integer incrementing every 30 seconds, stored in an 8-byte big-endian buffer.
                  </p>
                </div>
                <div className="rfc-step-item">
                  <div className="rfc-step-title">2. HMAC-SHA1 Hash Signature</div>
                  <p>
                    <code>HS = HMAC-SHA1(Base32SecretBytes, 8-Byte T)</code>
                    <br />
                    A 20-byte cryptographic hash signature calculated locally via <code>crypto.subtle.sign</code>.
                  </p>
                </div>
                <div className="rfc-step-item">
                  <div className="rfc-step-title">3. Dynamic Truncation (RFC 4226)</div>
                  <p>
                    <code>Offset = HS[19] & 0x0F</code>
                    <br />
                    Extracts 4 consecutive bytes from the offset, masks the sign bit, and performs modulo 10^6 to produce the 6-digit code.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ================= FOOTER ================= */}
      <footer className="app-footer">
        <p>
          KOPO Gangseo Cybersecurity Laboratory &bull; Zero-Transmission TOTP 2FA Service
        </p>
        <p className="footer-sub">
          RFC 6238 &bull; RFC 4226 &bull; Web Crypto API &bull; Zero Outbound Network Payload
        </p>
      </footer>
    </div>
  )
}
