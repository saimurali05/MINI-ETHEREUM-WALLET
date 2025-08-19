import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.10.0/dist/ethers.min.js";

const importWalletBtn = document.getElementById('importWalletBtn');
const generateWalletBtn = document.getElementById('generateWalletBtn');
const proceedToWalletBtn = document.getElementById('proceedToWalletBtn');
const copyAddressBtn = document.getElementById('copyAddressBtn');
const copyKeyBtn = document.getElementById('copyKeyBtn');

const importPrivateKeyInput = document.getElementById('importPrivateKeyInput');
const loginStatus = document.getElementById('loginStatus');
const keyErrorMessage = document.getElementById('key-error-message');
const newWalletDetails = document.getElementById('new-wallet-details');
const addressSpan = document.getElementById('address');
const privateKeySpan = document.getElementById('privateKey');
const keySavedCheckbox = document.getElementById('keySavedCheckbox');

const emailOtpModalContainer = document.getElementById('emailOtpModalContainer');
const toastContainer = document.getElementById('toast-container');

// ✅ Utility - show toast
function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerText = message;
  toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ✅ Save session
function saveSession(privateKey) {
  sessionStorage.setItem('miniWalletSessionKey', privateKey);
}

// ✅ Handle login/import wallet
if (importWalletBtn) {
  importWalletBtn.addEventListener('click', () => {
    const pk = importPrivateKeyInput.value.trim();
    try {
      const wallet = new ethers.Wallet(pk);
      saveSession(pk);
      loginStatus.textContent = "✅ Wallet imported successfully!";
      loginStatus.style.color = "green";
      keyErrorMessage.textContent = "";
      showToast("Wallet imported successfully!", "success");
      setTimeout(() => (window.location.href = "wallet.html"), 1500);
    } catch (err) {
      keyErrorMessage.textContent = "❌ Invalid private key. Please try again.";
      importPrivateKeyInput.setAttribute("aria-invalid", "true");
    }
  });
}

// ✅ Handle wallet creation (signup)
if (generateWalletBtn) {
  generateWalletBtn.addEventListener('click', () => {
    // Show OTP modal (demo only)
    emailOtpModalContainer.innerHTML = `
      <div class="modal glass-card">
        <h2>Email Verification</h2>
        <p>Enter OTP sent to your email (demo only).</p>
        <input type="text" id="otpInput" placeholder="Enter OTP">
        <button id="verifyOtpBtn">Verify OTP</button>
      </div>
    `;

    // ✅ Attach listener after DOM updates
    setTimeout(() => {
      const verifyBtn = document.getElementById('verifyOtpBtn');
      if (verifyBtn) {
        verifyBtn.addEventListener('click', () => {
          emailOtpModalContainer.innerHTML = "";
          showNewWallet();
        });
      }
    }, 0);
  });
}

// ✅ Show new wallet details
function showNewWallet() {
  const wallet = ethers.Wallet.createRandom();
  addressSpan.textContent = wallet.address;
  privateKeySpan.textContent = wallet.privateKey;
  newWalletDetails.style.display = "block";

  // Save session automatically
  saveSession(wallet.privateKey);

  showToast("New wallet generated!", "success");
}

// ✅ Proceed to wallet page only if key saved
if (proceedToWalletBtn) {
  proceedToWalletBtn.addEventListener('click', () => {
    if (!keySavedCheckbox.checked) {
      showToast("⚠️ Please confirm that you saved your private key.", "error");
      return;
    }
    window.location.href = "wallet.html";
  });
}

// ✅ Copy buttons
if (copyAddressBtn) {
  copyAddressBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(addressSpan.textContent);
    showToast("Address copied!", "success");
  });
}

if (copyKeyBtn) {
  copyKeyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(privateKeySpan.textContent);
    showToast("Private key copied!", "success");
  });
}

// ✅ Enable Proceed button only if checkbox ticked
if (keySavedCheckbox) {
  keySavedCheckbox.addEventListener('change', () => {
    proceedToWalletBtn.disabled = !keySavedCheckbox.checked;
  });
}
