import './style.css';
import {
  generateBase32Secret,
  generateTOTP,
  verifyTOTP,
  buildOtpAuthUri,
} from './totp.js';

const state = {
  secret: '',
  issuer: 'MySecurityLab',
  account: 'user@example.com',
  currentOtp: '',
};

const elements = {
  issuerInput: document.getElementById('issuerInput'),
  accountInput: document.getElementById('accountInput'),
  generateKeyBtn: document.getElementById('generateKeyBtn'),
  qrCanvas: document.getElementById('qrCanvas'),
  secretDisplay: document.getElementById('secretDisplay'),
  copySecretBtn: document.getElementById('copySecretBtn'),
  otpInput: document.getElementById('otpInput'),
  verifyBtn: document.getElementById('verifyBtn'),
  windowTolerance: document.getElementById('windowTolerance'),
  verifyResult: document.getElementById('verifyResult'),
  displayIssuer: document.getElementById('displayIssuer'),
  displayAccount: document.getElementById('displayAccount'),
  liveOtpCode: document.getElementById('liveOtpCode'),
  autoFillBtn: document.getElementById('autoFillBtn'),
  timerProgress: document.getElementById('timerProgress'),
  secondsLeft: document.getElementById('secondsLeft'),
};

// Canvas에 QR 코드를 선명하게 직접 렌더링
function drawQRToCanvas(canvas, text, size = 190) {
  if (typeof window.qrcode !== 'function') return;

  const qr = window.qrcode(0, 'M');
  qr.addData(text);
  qr.make();

  const count = qr.getModuleCount();
  const padding = 12;
  const cellSize = (size - padding * 2) / count;

  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // 흰색 배경 채우기
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  // 검은색 QR 모듈 그리기
  ctx.fillStyle = '#0f172a';
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (qr.isDark(row, col)) {
        ctx.fillRect(
          Math.round(padding + col * cellSize),
          Math.round(padding + row * cellSize),
          Math.ceil(cellSize),
          Math.ceil(cellSize)
        );
      }
    }
  }
}

async function renderQRCode() {
  state.issuer = elements.issuerInput.value.trim() || 'MySecurityLab';
  state.account = elements.accountInput.value.trim() || 'user@example.com';

  elements.displayIssuer.textContent = state.issuer;
  elements.displayAccount.textContent = state.account;
  elements.secretDisplay.textContent = state.secret;

  const uri = buildOtpAuthUri({
    secret: state.secret,
    issuer: state.issuer,
    account: state.account,
  });

  drawQRToCanvas(elements.qrCanvas, uri, 190);
}

async function issueNewSecret() {
  state.secret = generateBase32Secret(20);
  elements.otpInput.value = '';
  elements.verifyResult.className = 'result-box hidden';
  await renderQRCode();
  await updateLiveOtp();
}

async function updateLiveOtp() {
  if (!state.secret) return;

  const nowSeconds = Math.floor(Date.now() / 1000);
  const remaining = 30 - (nowSeconds % 30);

  elements.secondsLeft.textContent = `${remaining}초`;
  const percent = (remaining / 30) * 100;
  elements.timerProgress.style.width = `${percent}%`;

  if (remaining <= 5) {
    elements.timerProgress.classList.add('urgent');
    elements.liveOtpCode.classList.add('urgent');
  } else {
    elements.timerProgress.classList.remove('urgent');
    elements.liveOtpCode.classList.remove('urgent');
  }

  const code = await generateTOTP(state.secret, 0);
  state.currentOtp = code;
  elements.liveOtpCode.textContent = `${code.slice(0, 3)} ${code.slice(3)}`;
}

async function handleVerify() {
  const inputVal = elements.otpInput.value.trim();
  const allowWindow = elements.windowTolerance.checked;

  const { valid, matchedStep } = await verifyTOTP(inputVal, state.secret, allowWindow);

  elements.verifyResult.classList.remove('hidden', 'success', 'error');

  if (valid) {
    const stepNote =
      matchedStep === 0
        ? '현재 30초 주기와 정확히 일치합니다.'
        : `시간 오차 보정(${matchedStep > 0 ? '+30초' : '-30초'} 스텝)으로 인증되었습니다.`;
    elements.verifyResult.classList.add('success');
    elements.verifyResult.innerHTML = `✅ <strong>인증 성공!</strong> ${stepNote}`;
  } else {
    elements.verifyResult.classList.add('error');
    elements.verifyResult.innerHTML = `❌ <strong>인증 실패!</strong> 6자리 숫자가 일치하지 않거나 만료되었습니다.`;
  }
}

function bindEvents() {
  elements.generateKeyBtn.addEventListener('click', issueNewSecret);
  elements.issuerInput.addEventListener('input', renderQRCode);
  elements.accountInput.addEventListener('input', renderQRCode);

  elements.copySecretBtn.addEventListener('click', async () => {
    await navigator.clipboard.writeText(state.secret);
    const originalText = elements.copySecretBtn.textContent;
    elements.copySecretBtn.textContent = '복사됨!';
    setTimeout(() => (elements.copySecretBtn.textContent = originalText), 1500);
  });

  elements.autoFillBtn.addEventListener('click', () => {
    elements.otpInput.value = state.currentOtp;
    elements.otpInput.focus();
  });

  elements.verifyBtn.addEventListener('click', handleVerify);
  elements.otpInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleVerify();
  });
}

(async function init() {
  bindEvents();
  await issueNewSecret();
  setInterval(updateLiveOtp, 250);
})();