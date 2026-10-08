<template>
  <div class="store-checkout">
    <a
      :href="storeHref"
      class="inline-flex items-center gap-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 px-4 py-2 rounded-lg font-medium transition-colors mb-6"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
      </svg>
      Back to Store
    </a>

    <!-- Progress Indicator -->
    <div class="mb-8">
      <div class="max-w-2xl mx-auto px-4">
        <div class="flex items-center">
          <template v-for="(phase, index) in phases" :key="phase.id">
            <!-- Phase Circle and Label -->
            <div class="flex flex-col items-center flex-1 relative">
              <!-- Phase Circle -->
              <div
                :class="[
                  'w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all relative z-10',
                  getPhaseClass(phase.id)
                ]"
              >
                <span v-if="!isPhaseComplete(phase.id)">{{ index + 1 }}</span>
                <svg
                  v-else
                  class="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <!-- Phase Label -->
              <span
                :class="[
                  'mt-2 text-xs font-medium text-center whitespace-nowrap',
                  currentPhase === phase.id
                    ? 'text-blue-600 dark:text-blue-400'
                    : isPhaseComplete(phase.id)
                    ? 'text-gray-600 dark:text-gray-400'
                    : 'text-gray-400 dark:text-gray-600'
                ]"
              >
                {{ phase.label }}
              </span>
            </div>
            <!-- Connector Line -->
            <div
              v-if="index < phases.length - 1"
              :class="[
                'h-0.5 flex-1 mx-2 -mt-5 transition-colors',
                isPhaseComplete(phase.id)
                  ? 'bg-blue-600 dark:bg-blue-400'
                  : 'bg-gray-300 dark:bg-gray-700'
              ]"
            />
          </template>
        </div>
      </div>
    </div>

    <!-- Phase 1: Cart -->
    <div v-if="currentPhase === 'cart'" class="phase-content">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h3 class="text-lg font-semibold mb-4">Cart ({{ cart.length }})</h3>
        <div v-if="cart.length === 0" class="text-gray-500 dark:text-gray-400 text-sm">
          Your cart is empty
        </div>
        <div v-else>
          <div class="space-y-3 mb-4">
            <div
              v-for="item in cart"
              :key="item.variationId"
              class="flex items-center justify-between py-2"
            >
              <div>
                <p class="font-medium">{{ item.name }}</p>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  Qty: {{ item.quantity }} × ${{ formatPrice(item.price) }}
                </p>
              </div>
              <div class="flex items-center gap-2">
                <span class="font-semibold">${{ formatPrice(item.price * item.quantity) }}</span>
                <button
                  @click="removeFromCart(item.variationId)"
                  class="text-red-600 hover:text-red-700 text-sm"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
          <div class="border-t border-gray-200 dark:border-gray-700 pt-4">
            <div class="flex justify-between text-lg font-semibold mb-4">
              <span>Total:</span>
              <span>${{ formatPrice(totalAmount) }}</span>
            </div>
            <button
              @click="goToPhase('verify')"
              :disabled="cart.length === 0"
              class="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg transition-colors font-semibold"
            >
              Proceed to Review
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Phase 2: Verify -->
    <div v-if="currentPhase === 'verify'" class="phase-content">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h3 class="text-xl font-semibold mb-6">Review Your Order</h3>
        
        <div class="space-y-4 mb-6">
          <div
            v-for="item in cart"
            :key="item.variationId"
            class="flex items-center justify-between py-3"
          >
            <div>
              <p class="font-medium">{{ item.name }}</p>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                Quantity: {{ item.quantity }}
              </p>
            </div>
            <span class="font-semibold">
              ${{ formatPrice(item.price * item.quantity) }}
            </span>
          </div>
        </div>
        
        <div class="border-t border-gray-200 dark:border-gray-700 pt-4 mb-6">
          <div class="flex justify-between text-lg font-semibold">
            <span>Total:</span>
            <span>${{ formatPrice(totalAmount) }}</span>
          </div>
        </div>
        
        <div class="flex gap-4">
          <button
            @click="goToPhase('cart')"
            class="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 px-6 py-3 rounded-lg transition-colors font-semibold"
          >
            Back to Cart
          </button>
          <button
            @click="goToPhase('payment')"
            class="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors font-semibold"
          >
            Continue to Payment
          </button>
        </div>
      </div>
    </div>

    <!-- Phase 3: Payment (Embedded card form - no redirect) -->
    <div v-if="currentPhase === 'payment'" class="phase-content">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h3 class="text-xl font-semibold mb-6">Payment</h3>
        
        <div class="mb-6">
          <div class="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-4">
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">Order Total</p>
            <p class="text-2xl font-bold">${{ formatPrice(totalAmount) }}</p>
          </div>
        </div>
        
        <!-- Billing contact (required for Square tokenization / 3DS) -->
        <div class="mb-6 space-y-4">
          <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Billing information</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label for="billing-given" class="block text-sm text-gray-600 dark:text-gray-400 mb-1">First name</label>
              <input
                id="billing-given"
                v-model="billingGiven"
                type="text"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                placeholder="John"
              />
            </div>
            <div>
              <label for="billing-family" class="block text-sm text-gray-600 dark:text-gray-400 mb-1">Last name</label>
              <input
                id="billing-family"
                v-model="billingFamily"
                type="text"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                placeholder="Doe"
              />
            </div>
          </div>
          <div>
            <label for="billing-email" class="block text-sm text-gray-600 dark:text-gray-400 mb-1">Email</label>
            <input
              id="billing-email"
              v-model="billingEmail"
              type="email"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              placeholder="[email protected]"
            />
          </div>
          <div>
            <label for="billing-postal" class="block text-sm text-gray-600 dark:text-gray-400 mb-1">Postal code</label>
            <input
              id="billing-postal"
              v-model="billingPostal"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              placeholder="94103"
            />
          </div>
        </div>
        
        <!-- Square card form container -->
        <div class="mb-6">
          <p class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Card details</p>
          <div
            id="square-card-container"
            class="min-h-[120px] rounded-lg border border-gray-300 dark:border-gray-600 p-3 bg-white dark:bg-gray-900"
          />
        </div>
        
        <div class="flex gap-4">
          <button
            type="button"
            @click="goToPhase('verify')"
            :disabled="processingPayment"
            class="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 px-6 py-3 rounded-lg transition-colors font-semibold disabled:opacity-50"
          >
            Back
          </button>
          <button
            type="button"
            @click="processPayment"
            :disabled="processingPayment || !squareCardReady"
            class="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg transition-colors font-semibold"
          >
            {{ processingPayment ? 'Processing...' : `Pay $${formatPrice(totalAmount)}` }}
          </button>
        </div>
        
        <!-- Error Messages -->
        <div
          v-if="paymentMessage && paymentMessageType === 'error'"
          class="mt-4 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
        >
          {{ paymentMessage }}
        </div>
      </div>
    </div>

    <!-- Phase 4: Confirmation -->
    <div v-if="currentPhase === 'confirmation'" class="phase-content">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 text-center">
        <div class="mb-6">
          <div class="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              class="w-8 h-8 text-green-600 dark:text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h3 class="text-2xl font-semibold mb-2">Payment Successful!</h3>
          <p class="text-gray-600 dark:text-gray-400">
            Your order has been processed successfully.
          </p>
        </div>

        <div v-if="cart.length > 0" class="mb-6 text-left bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
          <p class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Order summary</p>
          <div class="space-y-2 mb-4">
            <div
              v-for="item in cart"
              :key="item.variationId"
              class="flex justify-between text-sm"
            >
              <span class="text-gray-700 dark:text-gray-300">
                {{ item.name }} × {{ item.quantity }}
              </span>
              <span class="font-medium">${{ formatPrice(item.price * item.quantity) }}</span>
            </div>
          </div>
          <div class="flex justify-between text-base font-semibold border-t border-gray-200 dark:border-gray-700 pt-3">
            <span>Total paid</span>
            <span>${{ formatPrice(totalAmount) }}</span>
          </div>
        </div>

        <div v-if="paymentResult" class="mb-6 text-left bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">Payment ID</p>
          <p class="font-mono text-sm">{{ paymentResult.paymentId }}</p>
          <p v-if="paymentResult.admissionId" class="text-sm text-gray-600 dark:text-gray-400 mt-4 mb-2">Admission ID</p>
          <p v-if="paymentResult.admissionId" class="font-mono text-sm">{{ paymentResult.admissionId }}</p>
        </div>
        
        <div class="space-y-4">
          <button
            @click="resetCheckout"
            class="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors font-semibold"
          >
            Start New Order
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { prependBase } from '../../lib/helpers';

interface CartItem {
  id: string;
  name: string;
  variationId: string;
  price: number;
  currency: string;
  quantity: number;
}

interface CatalogItem {
  id: string;
  name: string;
  description?: string;
  variationId: string;
  price: {
    amount: string;
    currency: string;
  };
}

interface PaymentResult {
  paymentId?: string;
  admissionId?: string;
}

type Phase = 'cart' | 'verify' | 'payment' | 'confirmation';

const props = withDefaults(
  defineProps<{
    squareApplicationId: string;
    squareLocationId: string;
    squareEnvironment: string;
    locale?: string;
  }>(),
  { locale: 'en-US' }
);

const phases = [
  { id: 'cart' as Phase, label: 'Cart' },
  { id: 'verify' as Phase, label: 'Review' },
  { id: 'payment' as Phase, label: 'Payment' },
  { id: 'confirmation' as Phase, label: 'Complete' },
];

const currentPhase = ref<Phase>('cart');
const completedPhases = ref<Set<Phase>>(new Set());
const cart = ref<CartItem[]>([]);
const catalogItems = ref<CatalogItem[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const processingPayment = ref(false);
const paymentMessage = ref<string | null>(null);
const paymentMessageType = ref<'success' | 'error'>('error');
const paymentResult = ref<PaymentResult | null>(null);
const squareCardReady = ref(false);
const squareCardInstance = ref<any>(null);
const squarePayments = ref<any>(null);
const billingGiven = ref('');
const billingFamily = ref('');
const billingEmail = ref('');
const billingPostal = ref('');

const totalAmount = computed(() => {
  return cart.value.reduce((sum, item) => sum + item.price * item.quantity, 0);
});

const storeHref = computed(() => prependBase('/tickets', props.locale));

const formatPrice = (amount: number | string) => {
  const numAmount = typeof amount === 'string' ? parseInt(amount) : amount;
  return (numAmount / 100).toFixed(2);
};

const isPhaseComplete = (phaseId: Phase) => {
  return completedPhases.value.has(phaseId);
};

const getPhaseClass = (phaseId: Phase) => {
  if (currentPhase.value === phaseId) {
    return 'bg-blue-600 text-white dark:bg-blue-500';
  }
  if (isPhaseComplete(phaseId)) {
    return 'bg-green-600 text-white dark:bg-green-500';
  }
  return 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
};

const goToPhase = (phase: Phase) => {
  // Mark current phase as complete when moving forward
  if (phases.findIndex(p => p.id === currentPhase.value) < phases.findIndex(p => p.id === phase)) {
    completedPhases.value.add(currentPhase.value);
  }
  currentPhase.value = phase;
  paymentMessage.value = null;
};

const addToCart = (item: CatalogItem) => {
  const existingItem = cart.value.find(cartItem => cartItem.variationId === item.variationId);
  
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.value.push({
      id: item.id,
      name: item.name,
      variationId: item.variationId,
      price: parseInt(item.price.amount),
      currency: item.price.currency,
      quantity: 1,
    });
  }
};

const removeFromCart = (variationId: string) => {
  cart.value = cart.value.filter(item => item.variationId !== variationId);
};

const fetchCatalog = async () => {
  loading.value = true;
  error.value = null;
  
  try {
    const catalogPath = prependBase('/api/square/catalog.json');
    const catalogUrl = typeof window !== 'undefined'
      ? `${window.location.origin}${catalogPath}`
      : catalogPath;
    const response = await fetch(catalogUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch catalog: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (result.success && result.generalAdmission) {
      catalogItems.value = [result.generalAdmission];
    } else if (result.success && result.items) {
      catalogItems.value = result.items.map((item: any) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        variationId: item.variations?.[0]?.id || '',
        price: {
          amount: item.variations?.[0]?.priceMoney?.amount || '0',
          currency: item.variations?.[0]?.priceMoney?.currency || 'USD',
        },
      }));
    } else {
      error.value = result.error || 'Failed to load catalog items';
    }
  } catch (err) {
    error.value = 'Error loading catalog items. Please check your Square API configuration.';
    console.error('Catalog fetch error:', err);
  } finally {
    loading.value = false;
  }
};

/** Load Square Web Payments SDK script */
const loadSquareSdk = (): Promise<void> => {
  const isSandbox = (props.squareEnvironment || 'sandbox').toLowerCase() === 'sandbox';
  const src = isSandbox
    ? 'https://sandbox.web.squarecdn.com/v1/square.js'
    : 'https://web.squarecdn.com/v1/square.js';
  const existing = document.querySelector(`script[src="${src}"]`);
  if (existing) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Square SDK'));
    document.head.appendChild(script);
  });
};

/** Initialize Square card form and attach to DOM */
const initSquareCard = async () => {
  if (!props.squareApplicationId || !props.squareLocationId) {
    squareCardReady.value = false;
    return;
  }
  try {
    await loadSquareSdk();
    const Square = (window as any).Square;
    if (!Square) {
      throw new Error('Square SDK not available');
    }
    squarePayments.value = Square.payments(props.squareApplicationId, props.squareLocationId);
    squareCardInstance.value = await squarePayments.value.card();
    await squareCardInstance.value.attach('#square-card-container');
    squareCardReady.value = true;
  } catch (e) {
    console.error('Square card init failed:', e);
    paymentMessage.value = 'Could not load payment form. Please refresh and try again.';
    paymentMessageType.value = 'error';
    squareCardReady.value = false;
  }
};

/** Clean up Square card when leaving payment phase */
const destroySquareCard = async () => {
  if (squareCardInstance.value) {
    try {
      await squareCardInstance.value.destroy();
    } catch (e) {
      console.warn('Square card destroy:', e);
    }
    squareCardInstance.value = null;
    squarePayments.value = null;
    squareCardReady.value = false;
  }
};

const processPayment = async () => {
  if (cart.value.length === 0) {
    paymentMessage.value = 'Your cart is empty';
    paymentMessageType.value = 'error';
    return;
  }
  if (!squareCardInstance.value) {
    paymentMessage.value = 'Payment form is not ready. Please wait or refresh.';
    paymentMessageType.value = 'error';
    return;
  }
  if (!billingGiven.value.trim() || !billingFamily.value.trim() || !billingEmail.value.trim() || !billingPostal.value.trim()) {
    paymentMessage.value = 'Please fill in all billing information.';
    paymentMessageType.value = 'error';
    return;
  }

  processingPayment.value = true;
  paymentMessage.value = null;

  try {
    const amountInCents = Math.round(totalAmount.value);
    const currency = cart.value[0]?.currency || 'USD';
    const amountDollars = (amountInCents / 100).toFixed(2);

    const verificationDetails = {
      amount: amountDollars,
      currencyCode: currency,
      intent: 'CHARGE' as const,
      customerInitiated: true,
      sellerKeyedIn: false,
      billingContact: {
        givenName: billingGiven.value.trim(),
        familyName: billingFamily.value.trim(),
        email: billingEmail.value.trim(),
        addressLines: [],
        city: '',
        state: '',
        postalCode: billingPostal.value.trim(),
        countryCode: 'US',
      },
    };

    const tokenResult = await squareCardInstance.value.tokenize(verificationDetails);
    if (tokenResult.status !== 'OK' || !tokenResult.token) {
      const errMsg = tokenResult.errors?.[0]?.message || `Tokenization failed: ${tokenResult.status}`;
      throw new Error(errMsg);
    }

    const paymentPath = prependBase('/api/square/payment');
    const paymentUrl = `${window.location.origin}${paymentPath}`;
    const response = await fetch(paymentUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceId: tokenResult.token,
        idempotencyKey: crypto.randomUUID(),
        amountMoney: {
          amount: amountInCents.toString(),
          currency,
        },
        lineItems: cart.value.map(item => ({
          itemId: item.id,
          itemVariationId: item.variationId,
          quantity: item.quantity.toString(),
        })),
      }),
    });

    const text = await response.text();
    let result: { success?: boolean; paymentId?: string; admissionId?: string; error?: string };
    try {
      result = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(response.ok ? 'Invalid response from payment server' : response.statusText || 'Payment request failed');
    }

    if (response.ok && result.success) {
      paymentResult.value = {
        paymentId: result.paymentId,
        admissionId: result.admissionId,
      };
      await destroySquareCard();
      completedPhases.value.add('payment');
      currentPhase.value = 'confirmation';
    } else {
      throw new Error(result.error || 'Payment failed');
    }
  } catch (err) {
    paymentMessage.value = err instanceof Error ? err.message : 'Payment failed. Please try again.';
    paymentMessageType.value = 'error';
  } finally {
    processingPayment.value = false;
  }
};

const resetCheckout = () => {
  cart.value = [];
  currentPhase.value = 'cart';
  completedPhases.value.clear();
  paymentResult.value = null;
  paymentMessage.value = null;
};

watch(currentPhase, async (phase) => {
  if (phase === 'payment') {
    await nextTick();
    await initSquareCard();
  } else {
    await destroySquareCard();
  }
});

onMounted(async () => {
  await fetchCatalog();

  // Pre-populate cart from URL (e.g. from Store Buy Now)
  const urlParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const itemId = urlParams.get('itemId');
  const variationId = urlParams.get('variationId');
  const quantity = urlParams.get('quantity');
  const name = urlParams.get('name');
  const price = urlParams.get('price');
  const currency = urlParams.get('currency');

  if (itemId && variationId && quantity && name && price) {
    cart.value = [{
      id: itemId,
      name: decodeURIComponent(name),
      variationId,
      price: parseInt(price, 10),
      currency: currency || 'USD',
      quantity: parseInt(quantity, 10),
    }];
    goToPhase('cart');
    // Clear URL params so refresh doesn't re-add
    const url = new URL(window.location.href);
    url.search = '';
    window.history.replaceState({}, '', url.toString());
  }
});

onUnmounted(() => {
  destroySquareCard();
});
</script>

<style scoped>
.store-checkout {
  max-width: 4xl;
  margin: 0 auto;
}

.phase-content {
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Square hosted checkout - no embedded form needed */
</style>

