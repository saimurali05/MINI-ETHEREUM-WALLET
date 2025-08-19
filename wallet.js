import {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
  parseEther,
  isAddress,
} from 'https://esm.sh/viem';
import { sepolia } from 'https://esm.sh/viem/chains';
import {
  generatePrivateKey,
  privateKeyToAccount,
} from 'https://esm.sh/viem/accounts';

// DOM Elements
const addressSpan = document.getElementById('address');
const privateKeySpan = document.getElementById('privateKey');
const balanceSpan = document.getElementById('balance');
const toInput = document.getElementById('to');
const amountInput = document.getElementById('amount');
const txStatusP = document.getElementById('txStatus');
const sendEthBtn = document.getElementById('sendEthBtn');
const gasFeeSpan = document.getElementById('gasFee');
const ensResolvedAddressP = document.getElementById('ensResolvedAddress');
const logoutBtn = document.getElementById('logoutBtn');
const importModal = document.getElementById('importModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const importPrivateKeyInput = document.getElementById('importPrivateKeyInput');
const historyCard = document.getElementById('historyCard');
const txList = document.getElementById('txList');
const addressBookModal = document.getElementById('addressBookModal');
const closeAddressBookModalBtn = document.getElementById('closeAddressBookModalBtn');
const contactList = document.getElementById('contactList');
const contactNameInput = document.getElementById('contactNameInput');
const contactAddressInput = document.getElementById('contactAddressInput');
const revealKeyBtn = document.getElementById('revealKeyBtn');

// Viem Client Setup
const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(),
});

// Etherscan API Setup
const ETHERSCAN_API_KEY = 'YOUR_ETHERSCAN_API_KEY'; // Replace with your Etherscan API key

// App State & Constants
const ADDRESS_BOOK_STORAGE_KEY = 'miniWalletAddressBook';
const WALLET_STORAGE_KEY = 'miniWalletSessionKey';
let estimatedGasCost = 0n;
let addressBook = [];
let account;
let walletClient;
let balanceInterval;
let lastGasPrice = null;
let lastGasPriceTime = 0;

// UI Helpers
export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('show');
  }, 100);
  setTimeout(() => {
    toast.classList.remove('show');
    toast.addEventListener('transitionend', () => toast.remove());
  }, 3000);
}

export function showValidationError(inputElement, message) {
  const formGroup = inputElement.closest('.form-group');
  if (!formGroup) return;
  const errorElement = formGroup.querySelector('.validation-error');
  if (errorElement) {
    errorElement.textContent = message;
  }
  formGroup.classList.add('invalid');
}

export function clearValidationError(inputElement) {
  const formGroup = inputElement.closest('.form-group');
  if (formGroup) formGroup.classList.remove('invalid');
}

export async function updateWalletUI(newAccount, privateKey) {
  if (balanceInterval) {
    clearInterval(balanceInterval);
  }
  if (privateKey) {
    sessionStorage.setItem(WALLET_STORAGE_KEY, privateKey);
  }
  account = newAccount;
  walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(),
  });
  addressSpan.textContent = account.address;
  privateKeySpan.textContent = '••••••••••••••••••••••••••••••••••••••••••••••••••••••••';
  balanceSpan.textContent = 'Fetching...';
  document.getElementById('wallet-dashboard').style.display = 'block';
  document.getElementById('send-card').style.display = 'block';
  document.getElementById('initial-prompt').style.display = 'none';
  console.log('Wallet loaded:', account.address);
  await updateBalance();
  await displayTransactionHistory();
  balanceInterval = setInterval(updateBalance, 15000);
  clearSendForm();
}

export async function generateWallet() {
  try {
    const privateKey = generatePrivateKey();
    const newAccount = privateKeyToAccount(privateKey);
    await updateWalletUI(newAccount, privateKey);
    showToast('New wallet created successfully!', 'success');
  } catch (error) {
    console.error('Error generating wallet:', error);
    showToast('Could not generate wallet. See console.', 'error');
  }
}

async function importWallet() {
  const pk = importPrivateKeyInput.value;
  clearValidationError(importPrivateKeyInput);
  if (!pk || !pk.startsWith('0x')) {
    showValidationError(importPrivateKeyInput, 'Please enter a valid private key (starting with 0x).');
    return;
  }
  try {
    const newAccount = privateKeyToAccount(pk);
    await updateWalletUI(newAccount, pk);
    closeModal();
    showToast('Wallet imported successfully!', 'success');
  } catch (error) {
    console.error('Error importing wallet:', error);
    showValidationError(importPrivateKeyInput, 'Invalid private key format.');
  } finally {
    importPrivateKeyInput.value = '';
  }
}

async function updateBalance() {
  if (!account) return;
  balanceSpan.classList.add('refreshing');
  try {
    const balance = await publicClient.getBalance({ address: account.address });
    const faucetInfo = document.getElementById('faucet-info');
    balanceSpan.textContent = `${formatEther(balance)} ETH`;
    if (faucetInfo) {
      faucetInfo.style.display = balance === 0n ? 'block' : 'none';
    }
  } catch (error) {
    console.error('Could not fetch balance:', error);
    balanceSpan.textContent = 'Error fetching balance';
  } finally {
    balanceSpan.classList.remove('refreshing');
  }
}

async function displayTransactionHistory() {
  if (!account) return;
  historyCard.style.display = 'block';
  txList.innerHTML = '<p>Loading history...</p>';
  if (ETHERSCAN_API_KEY === 'YOUR_ETHERSCAN_API_KEY') {
    txList.innerHTML = '<p>Please add an Etherscan API key in wallet.js to view history.</p>';
    showToast('Please set a valid Etherscan API key in wallet.js.', 'error');
    return;
  }
  try {
    const apiUrl = `https://api-sepolia.etherscan.io/api?module=account&action=txlist&address=${account.address}&startblock=0&endblock=99999999&sort=desc&apikey=${ETHERSCAN_API_KEY}`;
    const response = await fetch(apiUrl);
    const data = await response.json();
    if (data.status !== '1') {
      if (data.message === 'No transactions found') {
        txList.innerHTML = '<p>No transactions found for this address.</p>';
      } else {
        throw new Error(data.message || 'Could not fetch history.');
      }
      return;
    }
    txList.innerHTML = '';
    data.result.slice(0, 15).forEach(tx => {
      const isOut = tx.from.toLowerCase() === account.address.toLowerCase();
      const direction = isOut ? 'OUT' : 'IN';
      const counterparty = isOut ? tx.to : tx.from;
      const value = formatEther(tx.value);
      const txItem = document.createElement('div');
      txItem.className = 'tx-item';
      const explorerUrl = `${publicClient.chain.blockExplorers.default.url}/tx/${tx.hash}`;
      txItem.innerHTML = `
        <div class="tx-details">
          <span class="tx-direction tx-direction-${direction.toLowerCase()}">${direction}</span>
          <div>
            <div><strong>${parseFloat(value).toFixed(5)} ETH</strong></div>
            <div class="tx-address">${isOut ? 'To' : 'From'}: ${truncateAddress(counterparty)}</div>
          </div>
        </div>
        <div class="tx-link">
          <a href="${explorerUrl}" target="_blank" rel="noopener noreferrer">Details ↗</a>
        </div>
      `;
      txList.appendChild(txItem);
    });
  } catch (error) {
    console.error('Error fetching transaction history:', error);
    txList.innerHTML = '<p>Could not load transaction history.</p>';
  }
}

function validateAmount() {
  const amountValue = amountInput.value;
  const amountNum = parseFloat(amountValue);
  if (!amountValue || isNaN(amountNum) || amountNum <= 0) {
    showValidationError(amountInput, 'Please enter a valid amount greater than 0.');
    return false;
  } else {
    clearValidationError(amountInput);
    return true;
  }
}

async function getRecipientAddress() {
  const toValue = toInput.value.trim();
  if (ensResolvedAddressP) ensResolvedAddressP.textContent = '';
  clearValidationError(toInput);
  if (toValue.endsWith('.eth')) {
    if (ensResolvedAddressP) ensResolvedAddressP.textContent = 'Resolving ENS name...';
    try {
      const resolvedAddress = await publicClient.getEnsAddress({ name: toValue });
      if (resolvedAddress) {
        if (ensResolvedAddressP) ensResolvedAddressP.textContent = `Resolved: ${truncateAddress(resolvedAddress)}`;
        return resolvedAddress;
      } else {
        throw new Error('ENS name not found.');
      }
    } catch (e) {
      if (ensResolvedAddressP) ensResolvedAddressP.textContent = '';
      showValidationError(toInput, e.message || 'Could not resolve ENS name.');
      return null;
    }
  } else if (isAddress(toValue)) {
    return toValue;
  } else {
    showValidationError(toInput, 'Please enter a valid address or ENS name.');
    return null;
  }
}

async function updateAndShowGasEstimate() {
  gasFeeSpan.textContent = 'Estimating...';
  const to = await getRecipientAddress();
  if (!account || !to || !validateAmount()) {
    gasFeeSpan.textContent = '-';
    estimatedGasCost = 0n;
    return;
  }
  try {
    const amount = amountInput.value;
    const value = parseEther(amount);
    const gas = await publicClient.estimateGas({ account, to, value });
    const now = Date.now();
    if (!lastGasPrice || now - lastGasPriceTime > 60000) {
      lastGasPrice = await publicClient.getGasPrice();
      lastGasPriceTime = now;
    }
    estimatedGasCost = gas * lastGasPrice;
    gasFeeSpan.textContent = `${formatEther(estimatedGasCost)}`;
  } catch (error) {
    console.error('Gas estimation failed:', error);
    gasFeeSpan.textContent = 'Unavailable';
    estimatedGasCost = 0n;
  }
}

function clearSendForm() {
  toInput.value = '';
  amountInput.value = '';
  txStatusP.innerHTML = '';
  if (ensResolvedAddressP) ensResolvedAddressP.textContent = '';
  gasFeeSpan.textContent = '-';
  clearValidationError(toInput);
  clearValidationError(amountInput);
}

function loadAddressBook() {
  const stored = localStorage.getItem(ADDRESS_BOOK_STORAGE_KEY);
  addressBook = stored ? JSON.parse(stored) : [];
}

function saveAddressBook() {
  localStorage.setItem(ADDRESS_BOOK_STORAGE_KEY, JSON.stringify(addressBook));
}

function renderAddressBook() {
  contactList.innerHTML = '';
  if (addressBook.length === 0) {
    contactList.innerHTML = '<p>No contacts saved yet.</p>';
    return;
  }
  addressBook.forEach(contact => {
    const item = document.createElement('div');
    item.className = 'contact-item';
    item.innerHTML = `
      <div class="contact-info">
        <div class="name">${contact.name}</div>
        <div class="address">${truncateAddress(contact.address)}</div>
      </div>
      <div class="contact-actions">
        <button class="select-contact-btn" data-address="${contact.address}">Select</button>
        <button class="delete-contact-btn delete" data-address="${contact.address}">Delete</button>
      </div>
    `;
    contactList.appendChild(item);
  });
}

function addContact() {
  const name = contactNameInput.value.trim();
  const address = contactAddressInput.value.trim();
  clearValidationError(contactNameInput);
  clearValidationError(contactAddressInput);
  let isFormValid = true;
  if (!name) {
    showValidationError(contactNameInput, 'Name cannot be empty.');
    isFormValid = false;
  }
  if (!isAddress(address)) {
    showValidationError(contactAddressInput, 'Please enter a valid Ethereum address.');
    isFormValid = false;
  } else if (addressBook.some(c => c.address.toLowerCase() === address.toLowerCase())) {
    showValidationError(contactAddressInput, 'This address is already in your book.');
    isFormValid = false;
  }
  if (!isFormValid) return;
  addressBook.push({ name, address });
  saveAddressBook();
  renderAddressBook();
  showToast('Contact added!', 'success');
  contactNameInput.value = '';
  contactAddressInput.value = '';
}

function handleContactListClick(event) {
  const target = event.target;
  const address = target.dataset.address;
  if (!address) return;
  if (target.classList.contains('select-contact-btn')) {
    toInput.value = address;
    closeAddressBookModal();
    showToast('Recipient address populated.', 'success');
  } else if (target.classList.contains('delete-contact-btn')) {
    if (confirm('Are you sure you want to delete this contact?')) {
      addressBook = addressBook.filter(c => c.address !== address);
      saveAddressBook();
      renderAddressBook();
      showToast('Contact deleted.', 'info');
    }
  }
}

function truncateAddress(address) {
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

function copyAddress(event) {
  const address = addressSpan.textContent;
  const copyButton = event.currentTarget;
  if (address && address !== '-') {
    navigator.clipboard.writeText(address).then(() => {
      copyButton.innerHTML = 'Copied! ✅';
      copyButton.disabled = true;
      setTimeout(() => {
        copyButton.innerHTML = '📋 Copy';
        copyButton.disabled = false;
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy address:', err);
      showToast('Failed to copy address.', 'error');
    });
  }
}

async function sendETH() {
  if (!walletClient || !account) {
    showToast('Please create or import a wallet first.', 'info');
    return;
  }
  try {
    const recipientAddress = await getRecipientAddress();
    if (!recipientAddress || !validateAmount()) {
      return;
    }
    const amountInWei = parseEther(amountInput.value);
    const totalCost = amountInWei + estimatedGasCost;
    const balance = await publicClient.getBalance({ address: account.address });
    if (balance < totalCost) {
      showToast(`Insufficient funds. Total cost is approx. ${formatEther(totalCost)} ETH.`, 'error');
      return;
    }
  } catch (error) {
    showToast('Invalid amount entered.', 'error');
    console.error('Error parsing amount or fetching balance:', error);
    return;
  }
  sendEthBtn.disabled = true;
  sendEthBtn.textContent = 'Sending...';
  txStatusP.innerHTML = '';
  try {
    const to = await getRecipientAddress();
    const txHash = await walletClient.sendTransaction({
      to,
      value: parseEther(amountInput.value),
    });
    const explorerUrl = `${publicClient.chain.blockExplorers.default.url}/tx/${txHash}`;
    txStatusP.innerHTML = `Transaction sent! Waiting for confirmation... <a href="${explorerUrl}" target="_blank">View on Explorer</a>`;
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status === 'success') {
      txStatusP.innerHTML = `Transaction confirmed! ✅ <a href="${explorerUrl}" target="_blank">View on Explorer</a>`;
      showToast('Transaction successful!', 'success');
    } else {
      txStatusP.innerHTML = `Transaction failed. ❌ <a href="${explorerUrl}" target="_blank">View on Explorer</a>`;
      showToast('Transaction failed to confirm.', 'error');
    }
    updateBalance();
    displayTransactionHistory();
    clearSendForm();
  } catch (error) {
    console.error('Transaction failed:', error);
    txStatusP.textContent = `Error: ${error.message}`;
    showToast(error.shortMessage || 'Transaction failed.', 'error');
  } finally {
    sendEthBtn.disabled = false;
    sendEthBtn.textContent = '🚀 Send';
  }
}

async function loadWalletFromStorage() {
  const pk = sessionStorage.getItem(WALLET_STORAGE_KEY);
  if (pk) {
    try {
      console.log('Found wallet in session, loading...');
      const savedAccount = privateKeyToAccount(pk);
      await updateWalletUI(savedAccount);
    } catch (error) {
      console.error('Failed to load wallet from session storage:', error);
      sessionStorage.removeItem(WALLET_STORAGE_KEY);
      window.location.href = 'login.html';
    }
  } else {
    document.getElementById('initial-prompt').style.display = 'block';
    document.getElementById('wallet-dashboard').style.display = 'none';
    document.getElementById('send-card').style.display = 'none';
    document.getElementById('historyCard').style.display = 'none';
    window.location.href = 'login.html';
  }
}

function logout() {
  sessionStorage.removeItem(WALLET_STORAGE_KEY);
  window.location.href = 'login.html';
  showToast('Wallet cleared from session.', 'info');
}

function openModal() {
  if (importModal) importModal.classList.add('show');
}

function closeModal() {
  if (importModal) {
    importModal.classList.remove('show');
    clearValidationError(importPrivateKeyInput);
  }
}

function openAddressBookModal() {
  renderAddressBook();
  if (addressBookModal) addressBookModal.classList.add('show');
}

function closeAddressBookModal() {
  if (addressBookModal) {
    addressBookModal.classList.remove('show');
    klValidationError(contactNameInput);
    clearValidationError(contactAddressInput);
  }
}

function debounce(func, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
}

// Event Listeners
document.getElementById('generateWalletBtn')?.addEventListener('click', generateWallet);
document.getElementById('copyAddressBtn')?.addEventListener('click', copyAddress);
sendEthBtn?.addEventListener('click', sendETH);
logoutBtn?.addEventListener('click', logout);
document.getElementById('openImportModalBtn')?.addEventListener('click', openModal);
document.getElementById('importWalletBtn')?.addEventListener('click', importWallet);
closeModalBtn?.addEventListener('click', closeModal);
importModal?.addEventListener('click', (event) => {
  if (event.target === importModal) {
    closeModal();
  }
});
document.getElementById('openAddressBookBtn')?.addEventListener('click', openAddressBookModal);
document.getElementById('addContactBtn')?.addEventListener('click', addContact);
contactList?.addEventListener('click', handleContactListClick);
closeAddressBookModalBtn?.addEventListener('click', closeAddressBookModal);
addressBookModal?.addEventListener('click', (event) => {
  if (event.target === addressBookModal) {
    closeAddressBookModal();
  }
});
revealKeyBtn?.addEventListener('click', () => {
  if (confirm('Are you sure you want to reveal your private key? This is sensitive information.')) {
    privateKeySpan.textContent = sessionStorage.getItem(WALLET_STORAGE_KEY);
    setTimeout(() => {
      privateKeySpan.textContent = '••••••••••••••••••••••••••••••••••••••••••••••••••••••••';
    }, 10000);
  }
});

const debouncedGasEstimate = debounce(updateAndShowGasEstimate, 300);
toInput?.addEventListener('input', debouncedGasEstimate);
amountInput?.addEventListener('input', debouncedGasEstimate);

document.addEventListener('DOMContentLoaded', () => {
  loadWalletFromStorage();
  loadAddressBook();
  if (ETHERSCAN_API_KEY === 'YOUR_ETHERSCAN_API_KEY') {
    showToast('Please set a valid Etherscan API key in wallet.js.', 'error');
  }
});
